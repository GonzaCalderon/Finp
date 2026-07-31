import {
    CommitmentApplication,
    InstallmentPlan,
    ScheduledCommitment,
    Transaction,
    User,
} from '@/lib/models'
import { COMMITMENT_APPLICATION_STATUSES, type CommitmentAmountSource, type Currency } from '@/lib/constants'
import {
    resolveCommitmentAmountForPeriod,
    type CommitmentAmountCertainty,
} from '@/lib/server/commitment-amounts'
import {
    getCurrentFinancialPeriod,
    parseFinancialPeriod,
    shiftFinancialPeriod,
} from '@/lib/utils/period'
import {
    resolveCommitmentOccurrenceForPeriod,
    resolveCommitmentOccurrencesInRange,
} from '@/lib/utils/commitment-dates'
import {
    buildMonthlyCardPaymentSummary,
    type MonthlyCardChargeItem,
} from '@/lib/utils/credit-card'
import {
    addCurrencyAmount,
    emptyCurrencyTotals,
} from '@/lib/utils/currency-totals'
import { clampRangeStartToOperationalStart, hasOperationalCoverage } from '@/lib/utils/operational-start'
import type {
    ProjectionItem,
    ProjectionMode,
    ProjectionPeriod,
    ProjectionReference,
    ProjectionResponse,
    ProjectionTotals,
} from '@/types/projection'

type RefLike = string | {
    _id?: { toString(): string }
    name?: string
    color?: string
} | null | undefined

type ProjectionApplication = {
    commitmentId: { toString(): string }
    period: string
    transactionId?: { toString(): string }
    snapshot?: {
        amount?: number
        currency?: Currency
        description?: string
        categoryId?: RefLike
        accountId?: RefLike
        amountSource?: CommitmentAmountSource
        dueDate?: Date | string
    }
}

function toReference(value: RefLike): ProjectionReference | undefined {
    if (!value || typeof value === 'string') return undefined
    const id = value._id?.toString()
    if (!id || !value.name) return undefined
    return { id, name: value.name, color: value.color }
}

function toIsoString(value?: Date | string | null): string | undefined {
    if (!value) return undefined
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function dueDateForPeriod(period: string, dueDay?: number): string | undefined {
    if (!dueDay) return undefined
    const [year, month] = period.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    return new Date(year, month - 1, Math.min(dueDay, lastDay), 12).toISOString()
}

function buildCardLink(item: MonthlyCardChargeItem, month: string): string {
    const params = new URLSearchParams({
        month,
        cardId: item.cardId,
        installmentFilter: item.kind === 'single' ? 'single' : 'multi',
    })
    if (item.categoryId) params.set('categoryId', item.categoryId)
    return `/transactions/credit-card?${params.toString()}`
}

function emptyProjectionTotals(): ProjectionTotals {
    return {
        commitments: emptyCurrencyTotals(),
        cardSingle: emptyCurrencyTotals(),
        cardInstallments: emptyCurrencyTotals(),
        estimated: emptyCurrencyTotals(),
        total: emptyCurrencyTotals(),
        pendingAmountCount: 0,
    }
}

export function buildProjectionTotals(items: ProjectionItem[]): ProjectionTotals {
    const totals = emptyProjectionTotals()

    for (const item of items) {
        addCurrencyAmount(totals.total, item.currency, item.amount)
        if (item.kind === 'commitment') addCurrencyAmount(totals.commitments, item.currency, item.amount)
        if (item.kind === 'card_single') addCurrencyAmount(totals.cardSingle, item.currency, item.amount)
        if (item.kind === 'card_installment') addCurrencyAmount(totals.cardInstallments, item.currency, item.amount)
        if (item.certainty === 'estimated') addCurrencyAmount(totals.estimated, item.currency, item.amount)
        if (item.certainty === 'pending_amount') totals.pendingAmountCount += 1
    }

    return totals
}

/** Cuántas veces cae el compromiso dentro del período semiabierto. */
export function countOccurrencesInPeriod(
    commitment: { recurrence: string; startDate?: Date | string; endDate?: Date | string; dueDate?: Date | string },
    periodStart: Date,
    periodEnd: Date
): number {
    return resolveCommitmentOccurrencesInRange(commitment, periodStart, periodEnd).length
}

function buildMonths(mode: ProjectionMode, year: number, monthCount: number, currentPeriod: string): string[] {
    if (mode === 'annual') {
        return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
    }
    return Array.from({ length: monthCount }, (_, index) => shiftFinancialPeriod(currentPeriod, index))
}

function cardItemToProjectionItem(item: MonthlyCardChargeItem, month: string): ProjectionItem {
    const isSingle = item.kind === 'single'
    const card = item.cardId
        ? {
            id: item.cardId,
            name: item.cardName ?? 'Tarjeta',
            color: item.cardColor,
            dueDay: item.cardDueDay,
        }
        : undefined
    const category = item.categoryId && item.categoryName
        ? { id: item.categoryId, name: item.categoryName, color: item.categoryColor }
        : undefined

    return {
        id: `${isSingle ? 'card_single' : 'card_installment'}:${item.sourceId}:${month}`,
        sourceId: item.sourceId,
        source: { type: item.sourceType, id: item.sourceId },
        kind: isSingle ? 'card_single' : 'card_installment',
        description: item.description,
        amount: item.amount,
        currency: item.currency as Currency,
        certainty: isSingle ? 'confirmed' : 'calculated',
        isRegistered: isSingle,
        category,
        card,
        dueDate: dueDateForPeriod(month, item.cardDueDay),
        purchaseDate: toIsoString(item.purchaseDate),
        installment: isSingle
            ? undefined
            : { current: item.installmentNumber, count: item.installmentCount },
        link: {
            href: buildCardLink(item, month),
            label: 'Ver en Tarjetas',
        },
    }
}

export async function getProjectionForUser(
    userId: string,
    options: { mode?: ProjectionMode; year?: number; monthCount?: number } = {}
): Promise<ProjectionResponse> {
    const mode: ProjectionMode = options.mode === 'annual' ? 'annual' : 'monthly'
    const year = Number.isFinite(options.year) && options.year ? options.year : new Date().getFullYear()
    const monthCount = Number.isFinite(options.monthCount) && options.monthCount
        ? Math.min(Math.max(options.monthCount, 1), 24)
        : 6

    const userDoc = await User.findById(userId, {
        'preferences.monthStartDay': 1,
        'preferences.operationalStartDate': 1,
    })
    const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
    const operationalStartDate = userDoc?.preferences?.operationalStartDate
    const currentPeriod = getCurrentFinancialPeriod(new Date(), monthStartDay)
    const months = buildMonths(mode, year, monthCount, currentPeriod)
    const applicationPeriods = Array.from(new Set([
        ...months,
        ...Array.from({ length: 6 }, (_, index) => shiftFinancialPeriod(months[0], -(index + 1))),
    ]))
    const periodRanges = months.map((month) => parseFinancialPeriod(month, monthStartDay))
    const rangeStart = clampRangeStartToOperationalStart(periodRanges[0].start, operationalStartDate)
    const rangeEnd = periodRanges[periodRanges.length - 1].end

    const [commitments, installmentPlans, applications, historicalSingleCharges] = await Promise.all([
        ScheduledCommitment.find({ userId, isActive: true })
            .populate('categoryId', 'name color type')
            .populate('accountId', 'name color type'),
        InstallmentPlan.find({ userId, firstClosingMonth: { $lte: months[months.length - 1] } })
            .populate('accountId', 'name type currency color creditCardConfig.dueDay')
            .populate('categoryId', 'name color type'),
        CommitmentApplication.find({
            userId,
            status: COMMITMENT_APPLICATION_STATUSES.REGISTERED,
            period: { $in: applicationPeriods },
        })
            .select({
                commitmentId: 1,
                period: 1,
                transactionId: 1,
                snapshot: 1,
            })
            .populate('snapshot.categoryId', 'name color type')
            .populate('snapshot.accountId', 'name color type')
            .lean<ProjectionApplication[]>(),
        rangeStart < rangeEnd
            ? Transaction.find({
                userId,
                type: 'credit_card_expense',
                installmentPlanId: { $exists: false },
                date: { $gte: rangeStart, $lt: rangeEnd },
            })
                .populate('categoryId', 'name color type')
                .populate('sourceAccountId', 'name type currency color creditCardConfig.dueDay')
            : Promise.resolve([]),
    ])

    const applicationByKey = new Map(
        applications.map((application) => [
            `${application.commitmentId.toString()}|${application.period}`,
            application,
        ])
    )

    const amountsByCommitment = new Map<string, number[]>()
    for (const application of [...applications].sort((left, right) => right.period.localeCompare(left.period))) {
        const amount = application.snapshot?.amount
        if (typeof amount !== 'number') continue
        const key = application.commitmentId.toString()
        const list = amountsByCommitment.get(key) ?? []
        if (list.length < 6) list.push(amount)
        amountsByCommitment.set(key, list)
    }

    const projection: ProjectionPeriod[] = months.map((month) => {
        const { start: periodStart, end: periodEnd } = parseFinancialPeriod(month, monthStartDay)
        const items: ProjectionItem[] = []

        if (hasOperationalCoverage(periodStart, periodEnd, operationalStartDate)) {
            for (const commitment of commitments) {
                const occurrences = countOccurrencesInPeriod(commitment, periodStart, periodEnd)
                if (occurrences === 0) continue

                const sourceId = commitment._id.toString()
                const application = applicationByKey.get(`${sourceId}|${month}`)
                const occurrence = resolveCommitmentOccurrenceForPeriod(commitment, month, monthStartDay)
                const resolved = resolveCommitmentAmountForPeriod(commitment, month, {
                    monthStartDay,
                    dueDate: occurrence ?? undefined,
                    registeredApplication: application ?? null,
                    recentAmounts: amountsByCommitment.get(sourceId) ?? [],
                })
                const snapshot = application?.snapshot
                const category = toReference(snapshot?.categoryId) ?? toReference(commitment.categoryId as RefLike)
                const account = toReference(snapshot?.accountId) ?? toReference(commitment.accountId as RefLike)

                items.push({
                    id: `commitment:${sourceId}:${month}`,
                    sourceId,
                    source: { type: 'scheduled_commitment', id: sourceId },
                    kind: 'commitment',
                    description: snapshot?.description ?? commitment.description,
                    amount: resolved.amount * occurrences,
                    currency: (snapshot?.currency ?? commitment.currency) as Currency,
                    certainty: resolved.certainty as CommitmentAmountCertainty,
                    isRegistered: Boolean(application),
                    category,
                    account,
                    dueDate: toIsoString(snapshot?.dueDate ?? occurrence),
                    recurrence: commitment.recurrence,
                    occurrences,
                    link: { href: '/commitments', label: 'Ver Compromisos' },
                })
            }

            const cardSummaries = buildMonthlyCardPaymentSummary({
                month,
                monthStartDay,
                plans: installmentPlans,
                transactions: historicalSingleCharges,
                operationalStartDate,
            })
            for (const summary of cardSummaries) {
                items.push(...summary.items.map((item) => cardItemToProjectionItem(item, month)))
            }
        }

        return {
            month,
            isCurrentMonth: month === currentPeriod,
            isPast: month < currentPeriod,
            items,
            totals: buildProjectionTotals(items),
        }
    })

    return { projection, currentPeriod }
}
