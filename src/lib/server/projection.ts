import { CommitmentApplication, InstallmentPlan, ScheduledCommitment, User } from '@/lib/models'
import { COMMITMENT_APPLICATION_STATUSES, type CommitmentAmountSource } from '@/lib/constants'
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

export type CurrencyTotals = { ars: number; usd: number }

export type ProjectionMode = 'annual' | 'monthly'

export interface ProjectionCommitmentItem {
    _id: string
    description: string
    amount: number
    currency: string
    dayOfMonth?: number
    recurrence: string
    /** Veces que el compromiso cae dentro del período. */
    occurrences: number
    certainty: CommitmentAmountCertainty
    isRegistered: boolean
}

export interface ProjectionMonth {
    month: string
    isCurrentMonth: boolean
    isPast: boolean
    commitments: ProjectionCommitmentItem[]
    installmentsByAccount: Array<{
        accountId: string
        accountName: string
        items: Array<{
            description: string
            installmentAmount: number
            currency: string
            currentInstallment: number
            installmentCount: number
        }>
        total: CurrencyTotals
    }>
    totalCommitments: CurrencyTotals
    totalInstallments: CurrencyTotals
    total: CurrencyTotals
}

function emptyCurrencyTotals(): CurrencyTotals {
    return { ars: 0, usd: 0 }
}

function addCurrencyAmount(totals: CurrencyTotals, currency: string, amount: number) {
    if (currency === 'USD') totals.usd += amount
    else totals.ars += amount
}

function addCurrencyTotals(base: CurrencyTotals, extra: CurrencyTotals): CurrencyTotals {
    return { ars: base.ars + extra.ars, usd: base.usd + extra.usd }
}

/**
 * Cuántas veces cae el compromiso dentro del período.
 *
 * Antes la proyección sólo contemplaba `monthly` y los otros dos tipos
 * desaparecían por completo del cálculo.
 */
export function countOccurrencesInPeriod(
    commitment: { recurrence: string; startDate?: Date | string; endDate?: Date | string; dueDate?: Date | string },
    periodStart: Date,
    periodEnd: Date
): number {
    return resolveCommitmentOccurrencesInRange(
        commitment,
        periodStart,
        periodEnd
    ).length
}

function buildMonths(mode: ProjectionMode, year: number, monthCount: number, currentPeriod: string): string[] {
    if (mode === 'annual') {
        return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
    }

    return Array.from({ length: monthCount }, (_, index) => shiftFinancialPeriod(currentPeriod, index))
}

export async function getProjectionForUser(
    userId: string,
    options: { mode?: ProjectionMode; year?: number; monthCount?: number } = {}
): Promise<{ projection: ProjectionMonth[]; currentPeriod: string }> {
    const mode: ProjectionMode = options.mode === 'monthly' ? 'monthly' : 'annual'
    const year =
        Number.isFinite(options.year) && options.year ? options.year : new Date().getFullYear()
    const monthCount =
        Number.isFinite(options.monthCount) && options.monthCount
            ? Math.min(Math.max(options.monthCount, 1), 24)
            : 3

    const userDoc = await User.findById(userId, { 'preferences.monthStartDay': 1 })
    const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
    const currentPeriod = getCurrentFinancialPeriod(new Date(), monthStartDay)

    const months = buildMonths(mode, year, monthCount, currentPeriod)

    // Ya no se filtra por recurrence: weekly y once también se proyectan.
    const commitments = await ScheduledCommitment.find({ userId, isActive: true }).populate(
        'categoryId',
        'name'
    )

    const [installmentPlans, applications] = await Promise.all([
        InstallmentPlan.find({ userId }).populate('accountId', 'name type'),
        CommitmentApplication.find({
            userId,
            status: COMMITMENT_APPLICATION_STATUSES.REGISTERED,
        })
            .select({ commitmentId: 1, period: 1, 'snapshot.amount': 1, 'snapshot.amountSource': 1 })
            .lean<
                Array<{
                    commitmentId: { toString(): string }
                    period: string
                    snapshot?: { amount?: number; amountSource?: CommitmentAmountSource }
                }>
            >(),
    ])

    const applicationByKey = new Map(
        applications.map((application) => [
            `${application.commitmentId.toString()}|${application.period}`,
            application,
        ])
    )

    // Historial de importes por compromiso, para estimar los variables.
    const amountsByCommitment = new Map<string, number[]>()
    for (const application of [...applications].sort((a, b) => b.period.localeCompare(a.period))) {
        const amount = application.snapshot?.amount
        if (typeof amount !== 'number') continue
        const key = application.commitmentId.toString()
        const list = amountsByCommitment.get(key) ?? []
        if (list.length < 6) list.push(amount)
        amountsByCommitment.set(key, list)
    }

    const projection = months.map((month) => {
        const { start: periodStart, end: periodEnd } = parseFinancialPeriod(month, monthStartDay)
        const isCurrentMonth = month === currentPeriod
        const isPast = month < currentPeriod

        const monthCommitments: ProjectionCommitmentItem[] = []

        for (const commitment of commitments) {
            const occurrences = countOccurrencesInPeriod(commitment, periodStart, periodEnd)
            if (occurrences === 0) continue

            const id = commitment._id.toString()
            const application = applicationByKey.get(`${id}|${month}`)
            const occurrence = resolveCommitmentOccurrenceForPeriod(
                commitment,
                month,
                monthStartDay
            )

            const resolved = resolveCommitmentAmountForPeriod(commitment, month, {
                monthStartDay,
                dueDate: occurrence ?? undefined,
                registeredApplication: application ?? null,
                recentAmounts: amountsByCommitment.get(id) ?? [],
            })

            monthCommitments.push({
                _id: id,
                description: commitment.description,
                amount: resolved.amount * occurrences,
                currency: commitment.currency,
                dayOfMonth: commitment.dayOfMonth,
                recurrence: commitment.recurrence,
                occurrences,
                certainty: resolved.certainty,
                isRegistered: Boolean(application),
            })
        }

        const totalCommitments = monthCommitments.reduce((totals, commitment) => {
            addCurrencyAmount(totals, commitment.currency, commitment.amount)
            return totals
        }, emptyCurrencyTotals())

        const installmentsByAccount: Record<string, ProjectionMonth['installmentsByAccount'][number]> = {}

        for (const plan of installmentPlans) {
            // Una compra en un pago no es una cuota: el dashboard ya filtraba así.
            if (plan.installmentCount <= 1) continue

            const [fy, fm] = plan.firstClosingMonth.split('-').map(Number)
            const [y, m] = month.split('-').map(Number)
            const index = (y - fy) * 12 + (m - fm)
            if (index < 0 || index >= plan.installmentCount) continue

            const account = plan.accountId as { _id?: { toString(): string }; name?: string } | null
            const accountId = account?._id?.toString() ?? 'sin-cuenta'
            const accountName = account?.name ?? 'Sin tarjeta'

            installmentsByAccount[accountId] ??= {
                accountId,
                accountName,
                items: [],
                total: emptyCurrencyTotals(),
            }

            installmentsByAccount[accountId].items.push({
                description: plan.description,
                installmentAmount: plan.installmentAmount,
                currency: plan.currency,
                currentInstallment: index + 1,
                installmentCount: plan.installmentCount,
            })

            addCurrencyAmount(installmentsByAccount[accountId].total, plan.currency, plan.installmentAmount)
        }

        const totalInstallments = Object.values(installmentsByAccount).reduce(
            (totals, account) => addCurrencyTotals(totals, account.total),
            emptyCurrencyTotals()
        )

        return {
            month,
            isCurrentMonth,
            isPast,
            commitments: monthCommitments,
            installmentsByAccount: Object.values(installmentsByAccount),
            totalCommitments,
            totalInstallments,
            total: addCurrencyTotals(totalCommitments, totalInstallments),
        }
    })

    return { projection, currentPeriod }
}
