import type { SpaceSplitMode } from '@/lib/constants'
import { getCurrencyScale } from '@/lib/constants/iso-currencies'
import {
    allocateMinorUnitsByLargestRemainder,
    convertMoneyExact,
    moneyFromDecimal,
    moneyToNumber,
    type ConversionDirection,
    type ConversionSnapshot,
} from '@/lib/utils/money'

const MONEY_SCALE = 100
const ZERO_TOLERANCE = 0.000001
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export type SpaceFinancialRuleErrorCode =
    | 'INVALID_AMOUNT'
    | 'INVALID_PARTICIPANTS'
    | 'INVALID_SPLIT'
    | 'INVALID_EXCHANGE_RATE'
    | 'INVALID_TIMEZONE'
    | 'INVALID_DATE_KEY'

export class SpaceFinancialRuleError extends Error {
    constructor(
        readonly code: SpaceFinancialRuleErrorCode,
        message: string
    ) {
        super(message)
        this.name = 'SpaceFinancialRuleError'
    }
}

function toMinorUnits(value: number, currency = 'ARS') {
    if (!Number.isFinite(value) || value < 0) {
        throw new SpaceFinancialRuleError('INVALID_AMOUNT', 'El monto debe ser finito y no negativo.')
    }
    const minorUnits = Number(moneyFromDecimal(currency, value).minorUnits)
    if (!Number.isSafeInteger(minorUnits)) {
        throw new SpaceFinancialRuleError('INVALID_AMOUNT', 'El monto excede el rango seguro.')
    }
    return minorUnits
}

function fromMinorUnits(value: number, currency = 'ARS') {
    const scale = getCurrencyScale(currency) ?? 2
    return Number(value) / 10 ** scale
}

function uniqueParticipantIds(participantIds: string[]) {
    const normalized = participantIds.map((participantId) => participantId.trim())
    if (normalized.some((participantId) => !participantId)) {
        throw new SpaceFinancialRuleError('INVALID_PARTICIPANTS', 'Cada participante debe tener identidad.')
    }
    if (new Set(normalized).size !== normalized.length) {
        throw new SpaceFinancialRuleError('INVALID_PARTICIPANTS', 'El reparto no admite participantes duplicados.')
    }
    return normalized
}

function distributeMinorUnits(total: number, weights: number[], stableKeys: string[]) {
    if (weights.length === 0) return []
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
    if (!Number.isFinite(weightTotal) || weightTotal <= 0) {
        throw new SpaceFinancialRuleError('INVALID_SPLIT', 'El reparto debe tener un peso positivo.')
    }

    if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
        throw new SpaceFinancialRuleError('INVALID_SPLIT', 'El reparto contiene un valor inválido.')
    }
    const normalizedWeights = weights.map((weight) => BigInt(Math.round(weight * 1_000_000)))
    return allocateMinorUnitsByLargestRemainder({
        totalMinorUnits: BigInt(total),
        weights: normalizedWeights,
        stableKeys,
    }).map(Number)
}

export interface SpaceSplitAllocationV2 {
    participantId: string
    percentage?: number
    amount?: number
}

export interface SpaceShareV2 {
    participantId: string
    amount: number
    reportingAmount: number
    amountMoney?: import('@/lib/utils/money').MoneyDto
    reportingMoney?: import('@/lib/utils/money').MoneyDto
}

export function calculateSpaceSharesV2(input: {
    amount: number
    reportingAmount: number
    currency?: string
    reportingCurrency?: string
    splitMode: SpaceSplitMode
    participantIds: string[]
    allocations?: SpaceSplitAllocationV2[]
}): SpaceShareV2[] {
    const participantIds = uniqueParticipantIds(input.participantIds)
    const currency = input.currency ?? 'ARS'
    const reportingCurrency = input.reportingCurrency ?? 'ARS'
    const amountMinor = toMinorUnits(input.amount, currency)
    const reportingMinor = toMinorUnits(input.reportingAmount, reportingCurrency)

    if (amountMinor === 0) return []
    if (participantIds.length === 0) {
        throw new SpaceFinancialRuleError('INVALID_PARTICIPANTS', 'El reparto necesita al menos un participante.')
    }

    let amountParts: number[]
    if (input.splitMode === 'none') {
        if (participantIds.length !== 1) {
            throw new SpaceFinancialRuleError('INVALID_SPLIT', 'Responsable único exige exactamente una persona.')
        }
        amountParts = [amountMinor]
    } else if (input.splitMode === 'equal') {
        amountParts = distributeMinorUnits(amountMinor, participantIds.map(() => 1), participantIds)
    } else {
        const allocations = input.allocations ?? []
        const byParticipant = new Map<string, SpaceSplitAllocationV2>()
        for (const allocation of allocations) {
            if (!participantIds.includes(allocation.participantId) || byParticipant.has(allocation.participantId)) {
                throw new SpaceFinancialRuleError('INVALID_SPLIT', 'Las asignaciones no coinciden con los participantes.')
            }
            byParticipant.set(allocation.participantId, allocation)
        }
        if (byParticipant.size !== participantIds.length) {
            throw new SpaceFinancialRuleError('INVALID_SPLIT', 'Cada participante necesita una asignación explícita.')
        }

        if (input.splitMode === 'percentage') {
            const percentages = participantIds.map(
                (participantId) => byParticipant.get(participantId)?.percentage ?? Number.NaN
            )
            const totalPercentage = percentages.reduce((sum, percentage) => sum + percentage, 0)
            if (Math.abs(totalPercentage - 100) > ZERO_TOLERANCE) {
                throw new SpaceFinancialRuleError('INVALID_SPLIT', 'Los porcentajes deben sumar exactamente 100.')
            }
            amountParts = distributeMinorUnits(amountMinor, percentages, participantIds)
        } else if (input.splitMode === 'fixed') {
            amountParts = participantIds.map((participantId) =>
                toMinorUnits(byParticipant.get(participantId)?.amount ?? Number.NaN, currency)
            )
            if (amountParts.reduce((sum, amount) => sum + amount, 0) !== amountMinor) {
                throw new SpaceFinancialRuleError('INVALID_SPLIT', 'Los montos fijos deben cerrar exactamente el total.')
            }
        } else {
            throw new SpaceFinancialRuleError('INVALID_SPLIT', 'El modo de reparto no es compatible con v2.')
        }
    }

    const reportingParts = distributeMinorUnits(reportingMinor, amountParts, participantIds)
    return participantIds.map((participantId, index) => ({
        participantId,
        amount: fromMinorUnits(amountParts[index] ?? 0, currency),
        reportingAmount: fromMinorUnits(reportingParts[index] ?? 0, reportingCurrency),
        amountMoney: {
            currency,
            minorUnits: String(amountParts[index] ?? 0),
            scale: getCurrencyScale(currency) ?? 2,
        },
        reportingMoney: {
            currency: reportingCurrency,
            minorUnits: String(reportingParts[index] ?? 0),
            scale: getCurrencyScale(reportingCurrency) ?? 2,
        },
    }))
}

export function convertSpaceAmountV2(input: {
    amount: number
    currency: string
    reportingCurrency: string
    exchangeRate?: number
    exchangeRateDecimal?: string
    direction?: ConversionDirection
    snapshot?: ConversionSnapshot
}) {
    const originalMoney = moneyFromDecimal(input.currency, input.amount)
    if (input.currency === input.reportingCurrency) {
        return {
            reportingAmount: moneyToNumber(originalMoney),
            exchangeRate: undefined,
            originalMoney,
            reportingMoney: originalMoney,
            conversionSnapshot: undefined,
        }
    }
    const rate = input.exchangeRateDecimal ?? input.exchangeRate?.toString()
    if (!rate || !Number.isFinite(Number(rate)) || Number(rate) <= 0) {
        throw new SpaceFinancialRuleError(
            'INVALID_EXCHANGE_RATE',
            'Una moneda distinta de la moneda de reporte exige cotización explícita.'
        )
    }
    const reportingMoney = convertMoneyExact({
        money: originalMoney,
        targetCurrency: input.reportingCurrency,
        rate,
        direction: input.direction,
    })
    return {
        reportingAmount: moneyToNumber(reportingMoney),
        exchangeRate: Number(rate),
        originalMoney,
        reportingMoney,
        conversionSnapshot: input.snapshot,
    }
}

export function assertIanaTimezone(timezone: string) {
    const normalized = timezone.trim()
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date(0))
    } catch {
        throw new SpaceFinancialRuleError('INVALID_TIMEZONE', 'La zona horaria debe ser un identificador IANA válido.')
    }
    return normalized
}

export function normalizeFinancialDateKey(dateKey: string) {
    const match = DATE_KEY_PATTERN.exec(dateKey.trim())
    if (!match) {
        throw new SpaceFinancialRuleError('INVALID_DATE_KEY', 'La fecha financiera debe usar YYYY-MM-DD.')
    }
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const candidate = new Date(Date.UTC(year, month - 1, day))
    if (
        candidate.getUTCFullYear() !== year ||
        candidate.getUTCMonth() !== month - 1 ||
        candidate.getUTCDate() !== day
    ) {
        throw new SpaceFinancialRuleError('INVALID_DATE_KEY', 'La fecha financiera no existe.')
    }
    return `${match[1]}-${match[2]}-${match[3]}`
}

function zonedParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date)
    return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function financialDateKeyFromInstant(date: Date, timezone: string) {
    const validTimezone = assertIanaTimezone(timezone)
    if (Number.isNaN(date.getTime())) {
        throw new SpaceFinancialRuleError('INVALID_DATE_KEY', 'La fecha financiera no es válida.')
    }
    const parts = zonedParts(date, validTimezone)
    return normalizeFinancialDateKey(`${parts.year}-${parts.month}-${parts.day}`)
}

/** Convierte el día civil a mediodía local para evitar corrimientos en ambos extremos del huso. */
export function financialDateKeyToInstant(dateKey: string, timezone: string) {
    const validDateKey = normalizeFinancialDateKey(dateKey)
    const validTimezone = assertIanaTimezone(timezone)
    const [year, month, day] = validDateKey.split('-').map(Number)
    const desiredUtcShape = Date.UTC(year, month - 1, day, 12, 0, 0)
    let candidate = new Date(desiredUtcShape)

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const parts = zonedParts(candidate, validTimezone)
        const observedUtcShape = Date.UTC(
            Number(parts.year),
            Number(parts.month) - 1,
            Number(parts.day),
            Number(parts.hour),
            Number(parts.minute),
            Number(parts.second)
        )
        candidate = new Date(candidate.getTime() + desiredUtcShape - observedUtcShape)
    }

    if (financialDateKeyFromInstant(candidate, validTimezone) !== validDateKey) {
        throw new SpaceFinancialRuleError('INVALID_DATE_KEY', 'No se pudo representar el día en la zona horaria elegida.')
    }
    return candidate
}

export type PersonalImpactAmountsV2 =
    | {
          action: 'none'
          ownShareAmount: 0
          accountImpactAmount: 0
          operationalAmount: 0
          recoverableAdvanceAmount: 0
      }
    | {
          action: 'create'
          kind: 'personal_expense' | 'advance' | 'settlement_paid' | 'settlement_received'
          ownShareAmount: number
          accountImpactAmount: number
          operationalAmount: number
          recoverableAdvanceAmount: number
      }

export function derivePersonalImpactAmountsV2(input: {
    entryType: 'expense' | 'income' | 'adjustment' | 'settlement'
    entryAmount: number
    ownShareAmount: number
    currency?: string
    isPayer: boolean
    isReceiver?: boolean
}): PersonalImpactAmountsV2 {
    const currency = input.currency ?? 'ARS'
    const entryAmount = fromMinorUnits(toMinorUnits(input.entryAmount, currency), currency)
    const ownShareAmount = fromMinorUnits(toMinorUnits(input.ownShareAmount, currency), currency)

    if (input.entryType === 'settlement') {
        if (input.isPayer) {
            return {
                action: 'create',
                kind: 'settlement_paid',
                ownShareAmount: 0,
                accountImpactAmount: entryAmount,
                operationalAmount: 0,
                recoverableAdvanceAmount: 0,
            }
        }
        if (input.isReceiver) {
            return {
                action: 'create',
                kind: 'settlement_received',
                ownShareAmount: 0,
                accountImpactAmount: entryAmount,
                operationalAmount: 0,
                recoverableAdvanceAmount: 0,
            }
        }
        return {
            action: 'none',
            ownShareAmount: 0,
            accountImpactAmount: 0,
            operationalAmount: 0,
            recoverableAdvanceAmount: 0,
        }
    }

    if (!input.isPayer && ownShareAmount === 0) {
        return {
            action: 'none',
            ownShareAmount: 0,
            accountImpactAmount: 0,
            operationalAmount: 0,
            recoverableAdvanceAmount: 0,
        }
    }

    const accountImpactAmount = input.isPayer ? entryAmount : 0
    const recoverableAdvanceAmount = input.isPayer
        ? fromMinorUnits(Math.max(0, toMinorUnits(entryAmount) - toMinorUnits(ownShareAmount)))
        : 0
    return {
        action: 'create',
        kind: input.isPayer && ownShareAmount === 0 ? 'advance' : 'personal_expense',
        ownShareAmount,
        accountImpactAmount,
        operationalAmount: ownShareAmount,
        recoverableAdvanceAmount,
    }
}

export interface SpaceLedgerParticipantV2 {
    participantId: string
    displayName: string
    userId?: string
}

export interface SpaceLedgerEntryV2 {
    entryId: string
    status: 'recorded' | 'voided'
    type: 'expense' | 'income' | 'adjustment' | 'settlement'
    amount: number
    reportingAmount: number
    currency?: string
    reportingCurrency?: string
    paidByParticipantId?: string
    sharedWithParticipantIds: string[]
    splitMode: SpaceSplitMode
    splitAllocations?: SpaceSplitAllocationV2[]
}

export interface SpaceBalanceV2 extends SpaceLedgerParticipantV2 {
    paidReporting: number
    shareReporting: number
    balanceReporting: number
}

export function calculateSpaceBalancesV2(
    entries: SpaceLedgerEntryV2[],
    participants: SpaceLedgerParticipantV2[]
): SpaceBalanceV2[] {
    const rows = new Map(participants.map((participant) => [participant.participantId, {
        ...participant,
        paidReporting: 0,
        shareReporting: 0,
        balanceReporting: 0,
    }]))

    for (const entry of entries) {
        if (entry.status === 'voided') continue
        const payer = entry.paidByParticipantId ? rows.get(entry.paidByParticipantId) : undefined
        const shares = calculateSpaceSharesV2({
            amount: entry.amount,
            reportingAmount: entry.reportingAmount,
            splitMode: entry.splitMode,
            participantIds: entry.sharedWithParticipantIds,
            allocations: entry.splitAllocations,
        })
        const direction = entry.type === 'income' ? -1 : 1
        if (payer) payer.paidReporting += direction * entry.reportingAmount
        for (const share of shares) {
            const participant = rows.get(share.participantId)
            if (participant) participant.shareReporting += direction * share.reportingAmount
        }
    }

    return Array.from(rows.values()).map((row) => ({
        ...row,
        paidReporting: fromMinorUnits(toMinorUnits(Math.abs(row.paidReporting))) * Math.sign(row.paidReporting || 1),
        shareReporting: fromMinorUnits(toMinorUnits(Math.abs(row.shareReporting))) * Math.sign(row.shareReporting || 1),
        balanceReporting: fromMinorUnits(
            Math.round((row.paidReporting - row.shareReporting) * MONEY_SCALE)
        ),
    }))
}

export interface SpaceDebtProjectionV2 {
    fromParticipantId: string
    toParticipantId: string
    amount: number
    currency?: string
}

function netDebtEdges(edges: SpaceDebtProjectionV2[]) {
    const net = new Map<string, number>()
    for (const edge of edges) {
        const forward = `${edge.fromParticipantId}:${edge.toParticipantId}`
        const reverse = `${edge.toParticipantId}:${edge.fromParticipantId}`
        const amount = toMinorUnits(edge.amount)
        const reverseAmount = net.get(reverse) ?? 0
        if (reverseAmount >= amount) {
            net.set(reverse, reverseAmount - amount)
        } else {
            net.delete(reverse)
            net.set(forward, (net.get(forward) ?? 0) + amount - reverseAmount)
        }
    }
    return Array.from(net.entries())
        .filter(([, amount]) => amount > 0)
        .map(([key, amount]) => {
            const [fromParticipantId, toParticipantId] = key.split(':')
            return { fromParticipantId, toParticipantId, amount: fromMinorUnits(amount) }
        })
}

export function calculateSpaceDebtProjectionsV2(input: {
    mode: 'direct' | 'simplified'
    entries: SpaceLedgerEntryV2[]
    participants: SpaceLedgerParticipantV2[]
}): SpaceDebtProjectionV2[] {
    const explicitCurrencies = Array.from(new Set(
        input.entries.map((entry) => entry.currency).filter((currency): currency is string => Boolean(currency))
    ))
    if (explicitCurrencies.length > 0) {
        return explicitCurrencies.flatMap((currency) => {
            const entries = input.entries
                .filter((entry) => entry.currency === currency)
                .map((entry) => ({ ...entry, reportingAmount: entry.amount }))
            return calculateSpaceDebtProjectionsV2({
                ...input,
                entries: entries.map((entry) => {
                    const withoutCurrency = { ...entry }
                    delete withoutCurrency.currency
                    return withoutCurrency
                }),
            }).map((projection) => ({ ...projection, currency }))
        })
    }
    if (input.mode === 'simplified') {
        const balances = calculateSpaceBalancesV2(input.entries, input.participants)
        const debtors = balances
            .filter((balance) => balance.balanceReporting < 0)
            .map((balance) => ({ id: balance.participantId, pending: toMinorUnits(Math.abs(balance.balanceReporting)) }))
            .sort((left, right) => right.pending - left.pending || left.id.localeCompare(right.id))
        const creditors = balances
            .filter((balance) => balance.balanceReporting > 0)
            .map((balance) => ({ id: balance.participantId, pending: toMinorUnits(balance.balanceReporting) }))
            .sort((left, right) => right.pending - left.pending || left.id.localeCompare(right.id))
        const result: SpaceDebtProjectionV2[] = []
        let debtorIndex = 0
        let creditorIndex = 0
        while (debtors[debtorIndex] && creditors[creditorIndex]) {
            const debtor = debtors[debtorIndex]
            const creditor = creditors[creditorIndex]
            const amount = Math.min(debtor.pending, creditor.pending)
            if (amount > 0) {
                result.push({
                    fromParticipantId: debtor.id,
                    toParticipantId: creditor.id,
                    amount: fromMinorUnits(amount),
                })
            }
            debtor.pending -= amount
            creditor.pending -= amount
            if (debtor.pending === 0) debtorIndex += 1
            if (creditor.pending === 0) creditorIndex += 1
        }
        return result
    }

    const directEdges: SpaceDebtProjectionV2[] = []
    for (const entry of input.entries) {
        if (entry.status === 'voided' || !entry.paidByParticipantId) continue
        if (entry.type === 'settlement') {
            const receiverId = entry.sharedWithParticipantIds[0]
            if (receiverId && receiverId !== entry.paidByParticipantId) {
                directEdges.push({
                    fromParticipantId: receiverId,
                    toParticipantId: entry.paidByParticipantId,
                    amount: entry.reportingAmount,
                })
            }
            continue
        }
        const shares = calculateSpaceSharesV2({
            amount: entry.amount,
            reportingAmount: entry.reportingAmount,
            splitMode: entry.splitMode,
            participantIds: entry.sharedWithParticipantIds,
            allocations: entry.splitAllocations,
        })
        for (const share of shares) {
            if (share.participantId === entry.paidByParticipantId || share.reportingAmount === 0) continue
            directEdges.push({
                fromParticipantId: share.participantId,
                toParticipantId: entry.paidByParticipantId,
                amount: share.reportingAmount,
            })
        }
    }

    // Un settlement agrega la arista inversa al gasto original y por eso reduce
    // el par exacto; un sobrepago puede invertir la obligación sin perder historia.
    return netDebtEdges(directEdges)
}
