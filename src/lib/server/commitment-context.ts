import { CommitmentApplication, ScheduledCommitment, User } from '@/lib/models'
import { COMMITMENT_APPLICATION_STATUSES } from '@/lib/constants'
import { resolveCommitmentAmountForPeriod } from '@/lib/server/commitment-amounts'
import { resolveApplicationStateForPeriod } from '@/lib/server/commitments'
import type { CommitmentCandidate } from '@/lib/server/commitment-matching'
import { normalizeRuleText } from '@/lib/utils/rules'
import { getCurrentFinancialPeriod } from '@/lib/utils/period'
import { resolveCommitmentOccurrenceForPeriod } from '@/lib/utils/commitment-dates'

/**
 * Compromisos con aplicación pendiente en el período actual, listos para que
 * Captura rápida los ofrezca.
 *
 * Se resuelve en el servidor porque el monto vigente, el estado derivado y el
 * período financiero dependen de datos y preferencias que el cliente no tiene.
 * Nunca aplica nada: sólo describe qué está pendiente.
 */
export async function getApplicableCommitmentsForUser(
    userId: string
): Promise<{ commitments: CommitmentCandidate[]; currentPeriod: string }> {
    const userDoc = await User.findById(userId, { 'preferences.monthStartDay': 1 })
    const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
    const currentPeriod = getCurrentFinancialPeriod(new Date(), monthStartDay)

    const commitments = await ScheduledCommitment.find({
        userId,
        isActive: true,
        // Un compromiso de una sola vez ya vencido no se ofrece; monthly y weekly sí.
        $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: new Date() } }],
    }).lean()

    if (commitments.length === 0) return { commitments: [], currentPeriod }

    const commitmentIds = commitments.map((commitment) => commitment._id)

    const applications = await CommitmentApplication.find({
        userId,
        commitmentId: { $in: commitmentIds },
    })
        .select({ commitmentId: 1, period: 1, status: 1, 'snapshot.amount': 1, 'snapshot.amountSource': 1 })
        .lean<
            Array<{
                commitmentId: { toString(): string }
                period: string
                status?: 'registered' | 'skipped' | 'cancelled' | 'reverted'
                snapshot?: { amount?: number; amountSource?: never }
            }>
        >()

    const currentByCommitment = new Map<string, (typeof applications)[number]>()
    const historyByCommitment = new Map<string, number[]>()

    for (const application of [...applications].sort((a, b) => b.period.localeCompare(a.period))) {
        const key = application.commitmentId.toString()

        if (application.period === currentPeriod) currentByCommitment.set(key, application)

        if (application.status === COMMITMENT_APPLICATION_STATUSES.REGISTERED) {
            const amount = application.snapshot?.amount
            if (typeof amount === 'number') {
                const list = historyByCommitment.get(key) ?? []
                if (list.length < 6) list.push(amount)
                historyByCommitment.set(key, list)
            }
        }
    }

    const candidates: CommitmentCandidate[] = commitments.flatMap((commitment) => {
        const occurrence = resolveCommitmentOccurrenceForPeriod(
            commitment,
            currentPeriod,
            monthStartDay
        )
        if (!occurrence) return []

        const id = commitment._id.toString()
        const application = currentByCommitment.get(id)

        const registered =
            application?.status === COMMITMENT_APPLICATION_STATUSES.REGISTERED ? application : null

        const resolved = resolveCommitmentAmountForPeriod(commitment, currentPeriod, {
            monthStartDay,
            dueDate: occurrence,
            registeredApplication: registered,
            recentAmounts: historyByCommitment.get(id) ?? [],
        })

        return [{
            commitmentId: id,
            description: commitment.description,
            normalizedDescription:
                commitment.normalizedDescription || normalizeRuleText(commitment.description),
            aliases: commitment.aliases ?? [],
            period: currentPeriod,
            currency: commitment.currency,
            resolvedAmount: resolved.amount,
            amountPolicy: commitment.amountPolicy ?? 'fixed',
            accountId: commitment.accountId?.toString(),
            categoryId: commitment.categoryId?.toString(),
            state: resolveApplicationStateForPeriod(
                commitment,
                currentPeriod,
                currentPeriod,
                application ?? null
            ),
        }]
    })

    return { commitments: candidates, currentPeriod }
}
