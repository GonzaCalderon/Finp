import type {
    CommitmentAmountPolicy,
    CommitmentAmountSource,
    CommitmentEstimationMode,
} from '@/lib/constants'
import {
    resolveDayInMonth,
    resolveCommitmentOccurrenceForPeriod,
} from '@/lib/utils/commitment-dates'
import { parseFinancialPeriod } from '@/lib/utils/period'

/**
 * Nivel de certeza de un monto proyectado. La proyección debe poder distinguir
 * lo que ya ocurrió de lo que todavía es una estimación.
 */
export type CommitmentAmountCertainty =
    | 'confirmed'
    | 'calculated'
    | 'estimated'
    | 'pending_amount'

export interface CommitmentAmountResolution {
    amount: number
    source: CommitmentAmountSource
    certainty: CommitmentAmountCertainty
    /** Fecha desde la que rige el tramo que resolvió el monto. */
    effectiveFrom?: Date
    /** Vencimiento usado para elegir el tramo. */
    dueDate: Date
}

type AmountScheduleEntry = {
    effectiveFrom: Date | string
    amount: number
}

export interface CommitmentAmountInput {
    amount: number
    recurrence?: string
    startDate?: Date | string
    endDate?: Date | string
    dueDate?: Date | string
    dayOfMonth?: number
    amountPolicy?: CommitmentAmountPolicy
    amountSchedule?: AmountScheduleEntry[]
    estimationMode?: CommitmentEstimationMode
}

export interface ResolveCommitmentAmountOptions {
    monthStartDay?: number
    /** Ocurrencia ya validada para el período. */
    dueDate?: Date
    /** Aplicación ya registrada de ese período, si existe. */
    registeredApplication?: {
        snapshot?: { amount?: number; amountSource?: CommitmentAmountSource } | null
    } | null
    /** Montos de aplicaciones registradas previas, de la más reciente a la más antigua. */
    recentAmounts?: number[]
}

function toDate(value: Date | string | undefined): Date | null {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Fecha de referencia del período: el vencimiento del compromiso dentro de él.
 *
 * Importa porque un aumento efectivo a mitad del período debe aplicarse si cae
 * antes del vencimiento. Con monthStartDay != 1 el período abarca dos meses
 * calendario, así que el día del mes puede caer en cualquiera de los dos.
 */
export function resolveCommitmentDueDate(
    period: string,
    dayOfMonth: number | undefined,
    monthStartDay = 1
): Date {
    if (!dayOfMonth) {
        return parseFinancialPeriod(period, monthStartDay).start
    }

    const occurrence = resolveCommitmentOccurrenceForPeriod(
        {
            recurrence: 'monthly',
            startDate: new Date(1900, 0, 1),
            dayOfMonth,
        },
        period,
        monthStartDay
    )
    if (occurrence) return occurrence

    const [year, month] = period.split('-').map(Number)
    return resolveDayInMonth(year, month - 1, dayOfMonth)
}

/**
 * Única fuente de verdad de "cuánto vale este compromiso en este período".
 *
 * Precedencia:
 *   1. lo que efectivamente se registró (aplicación con snapshot) → confirmado;
 *   2. el tramo de la agenda vigente al vencimiento → calculado;
 *   3. monto variable: estimación según estimationMode → estimado o pendiente;
 *   4. monto de la plantilla → calculado.
 *
 * Consumida por el apply, la proyección, el dashboard y el contexto de Captura
 * rápida, para que ninguna superficie invente su propio criterio.
 */
export function resolveCommitmentAmountForPeriod(
    commitment: CommitmentAmountInput,
    period: string,
    options: ResolveCommitmentAmountOptions = {}
): CommitmentAmountResolution {
    const dueDate =
        options.dueDate ??
        resolveCommitmentDueDate(period, commitment.dayOfMonth, options.monthStartDay)
    const snapshot = options.registeredApplication?.snapshot
    if (snapshot && typeof snapshot.amount === 'number' && Number.isFinite(snapshot.amount)) {
        return {
            amount: snapshot.amount,
            source: snapshot.amountSource ?? 'manual',
            certainty: 'confirmed',
            dueDate,
        }
    }

    const scheduled = (commitment.amountSchedule ?? [])
        .map((entry) => ({ effectiveFrom: toDate(entry.effectiveFrom), amount: entry.amount }))
        .filter(
            (entry): entry is { effectiveFrom: Date; amount: number } =>
                entry.effectiveFrom !== null &&
                typeof entry.amount === 'number' &&
                Number.isFinite(entry.amount)
        )
        .filter((entry) => entry.effectiveFrom <= dueDate)
        .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())

    const vigente = scheduled.at(-1)
    if (vigente) {
        return {
            amount: vigente.amount,
            source: 'schedule',
            certainty: 'calculated',
            effectiveFrom: vigente.effectiveFrom,
            dueDate,
        }
    }

    if (commitment.amountPolicy === 'variable') {
        return resolveVariableAmount(commitment, options.recentAmounts ?? [], dueDate)
    }

    return {
        amount: commitment.amount,
        source: 'template',
        certainty: 'calculated',
        effectiveFrom: toDate(commitment.startDate) ?? undefined,
        dueDate,
    }
}

function resolveVariableAmount(
    commitment: CommitmentAmountInput,
    recentAmounts: number[],
    dueDate: Date
): CommitmentAmountResolution {
    const usable = recentAmounts.filter((amount) => typeof amount === 'number' && Number.isFinite(amount))
    const mode = commitment.estimationMode ?? 'template'

    if (mode === 'last' && usable.length > 0) {
        return { amount: usable[0], source: 'estimated', certainty: 'estimated', dueDate }
    }

    if (mode === 'average' && usable.length > 0) {
        const total = usable.reduce((sum, amount) => sum + amount, 0)
        return {
            amount: Math.round(total / usable.length),
            source: 'estimated',
            certainty: 'estimated',
            dueDate,
        }
    }

    if (typeof commitment.amount === 'number' && commitment.amount > 0) {
        return { amount: commitment.amount, source: 'estimated', certainty: 'estimated', dueDate }
    }

    // Variable sin ninguna referencia: el usuario tiene que ingresar el importe.
    return { amount: 0, source: 'estimated', certainty: 'pending_amount', dueDate }
}

/** Un compromiso variable exige confirmar el importe antes de registrarlo. */
export function requiresAmountConfirmation(commitment: CommitmentAmountInput): boolean {
    return commitment.amountPolicy === 'variable'
}
