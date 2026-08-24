import { Types } from 'mongoose'

import {
    SpaceEntry,
    SpaceEntryPersonalImpact,
    Transaction,
} from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import {
    loadSpaceApplicationContextV2,
} from '@/lib/server/space-application-context-v2'
import { executeSpaceOperation } from '@/lib/server/space-operation-executor'
import { reconcileSpacePendingNotificationsV2 } from '@/lib/server/space-notification-reconciliation-v2'
import {
    createInternalSpaceTransaction,
    type CreateInternalSpaceTransactionInput,
} from '@/lib/server/transactions'
import {
    calculateSpaceSharesV2,
    derivePersonalImpactAmountsV2,
    financialDateKeyFromInstant,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryPersonalImpact, ITransaction } from '@/types'

type PersonalImpactDecisionV2 =
    | { type: 'create_transaction'; accountId?: string; categoryId?: string; description?: string }
    | { type: 'link_existing'; transactionId: string }
    | { type: 'ignore' }
    | { type: 'keep_review' }
    | { type: 'remove_transaction' }

function amountsForImpact(entry: ISpaceEntry, impact: ISpaceEntryPersonalImpact) {
    const participantId = impact.participantId.toString()
    const shares = calculateSpaceSharesV2({
        amount: entry.amount,
        reportingAmount: entry.reportingAmount,
        splitMode: entry.splitMode,
        participantIds: (entry.sharedWithParticipantIds ?? []).map((id) => id.toString()),
        allocations: (entry.splitAllocations ?? []).map((allocation) => ({
            participantId: allocation.participantId.toString(),
            percentage: allocation.percentage,
            amount: allocation.amount,
        })),
    })
    return derivePersonalImpactAmountsV2({
        entryType: entry.type,
        entryAmount: entry.amount,
        ownShareAmount: shares.find((share) => share.participantId === participantId)?.amount ?? 0,
        isPayer: extractId(entry.paidByParticipantId) === participantId,
        isReceiver: entry.type === 'settlement' && extractId(entry.sharedWithParticipantIds?.[0]) === participantId,
    })
}

function impactVariant(input: {
    kind: 'personal_expense' | 'advance' | 'settlement_paid' | 'settlement_received'
    isPayer: boolean
}) {
    if (input.kind === 'advance') return 'advance' as const
    if (input.kind === 'settlement_paid') return 'settlement_paid' as const
    if (input.kind === 'settlement_received') return 'settlement_received' as const
    return input.isPayer ? 'payer_expense' as const : 'participant_expense' as const
}

function expectedTransactionType(variant: ReturnType<typeof impactVariant>): ITransaction['type'] {
    if (variant === 'settlement_paid') return 'personal_debt_payment'
    if (variant === 'settlement_received') return 'personal_debt_collect'
    return 'expense'
}

function assertAmountsClose(actual: number | undefined, expected: number, code: string) {
    if (actual === undefined || Math.abs(actual - expected) > 0.01) {
        throw new ServiceError(409, code, 'La transacción elegida no coincide con el impacto esperado.')
    }
}

async function reconcileImpactPresentation(impactId?: Types.ObjectId) {
    if (!impactId) return { state: 'not_needed' as const, failures: [] }
    try {
        const result = await reconcileSpacePendingNotificationsV2({
            pendingActionIds: [impactId.toHexString()],
        })
        return {
            state: result.failures.length ? 'retry_required' as const : 'reconciled' as const,
            failures: result.failures,
        }
    } catch (error) {
        return {
            state: 'retry_required' as const,
            failures: [{ pendingActionId: impactId.toHexString(), errorName: error instanceof Error ? error.name : 'UnknownError' }],
        }
    }
}

export async function resolveSpacePersonalImpactV2(input: {
    actorUserId: string
    spaceId: string
    entryId: string
    impactId: string
    idempotencyKey: string
    expectedRevision: number
    decision: PersonalImpactDecisionV2
}) {
    const operationType = input.decision.type === 'link_existing'
        ? 'link_personal_impact' as const
        : input.decision.type === 'ignore'
            ? 'ignore_personal_impact' as const
            : input.decision.type === 'keep_review'
                ? 'review_personal_impact' as const
                : input.decision.type === 'remove_transaction'
                    ? 'remove_personal_impact' as const
                    : 'resolve_personal_impact' as const
    const execution = await executeSpaceOperation<{
        impactId: string
        status: 'ignored' | 'linked' | 'removed'
    }>({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: operationType,
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'resolve_personal_impact',
            })
            const [entry, impact] = await Promise.all([
                SpaceEntry.findOne({
                    _id: input.entryId,
                    spaceId: input.spaceId,
                    contractVersion: 2,
                }).session(session).lean<ISpaceEntry | null>(),
                SpaceEntryPersonalImpact.findOne({
                    _id: input.impactId,
                    entryId: input.entryId,
                    spaceId: input.spaceId,
                    userId: input.actorUserId,
                    contractVersion: 2,
                }).session(session).lean<ISpaceEntryPersonalImpact | null>(),
            ])
            if (!entry || !impact) {
                throw new ServiceError(404, 'SPACE_PERSONAL_IMPACT_NOT_FOUND', 'El impacto personal no existe.')
            }
            if ((impact.revision ?? 0) !== input.expectedRevision) {
                throw new ServiceError(409, 'SPACE_IMPACT_VERSION_CONFLICT', 'El impacto cambió. Revisalo antes de continuar.')
            }

            if (input.decision.type === 'ignore') {
                if (impact.status !== 'pending') {
                    throw new ServiceError(409, 'SPACE_IMPACT_NOT_PENDING', 'Sólo un pendiente puede ignorarse.')
                }
                const update = await SpaceEntryPersonalImpact.updateOne(
                    { _id: impact._id, contractVersion: 2, status: 'pending', revision: input.expectedRevision },
                    {
                        $set: { status: 'ignored', ignoredAt: new Date(), resolvedAt: new Date(), operationId },
                        $inc: { revision: 1 },
                    },
                    { session }
                )
                if (update.modifiedCount !== 1) throw new ServiceError(409, 'SPACE_IMPACT_VERSION_CONFLICT', 'El impacto cambió.')
                return {
                    value: { impactId: input.impactId, status: 'ignored' as const },
                    resultRefs: { personalImpactId: impact._id },
                }
            }

            if (input.decision.type === 'keep_review') {
                if (impact.status !== 'needs_review') {
                    throw new ServiceError(409, 'SPACE_IMPACT_NOT_IN_REVIEW', 'El impacto no requiere revisión.')
                }
                const update = await SpaceEntryPersonalImpact.updateOne(
                    { _id: impact._id, contractVersion: 2, status: 'needs_review', revision: input.expectedRevision },
                    {
                        $set: {
                            status: 'linked',
                            reviewedAt: new Date(),
                            reviewedResolution: 'kept',
                            operationId,
                        },
                        $inc: { revision: 1 },
                    },
                    { session }
                )
                if (update.modifiedCount !== 1) throw new ServiceError(409, 'SPACE_IMPACT_VERSION_CONFLICT', 'El impacto cambió.')
                return {
                    value: { impactId: input.impactId, status: 'linked' as const },
                    resultRefs: {
                        personalImpactId: impact._id,
                        transactionId: impact.transactionId,
                    },
                }
            }

            if (input.decision.type === 'remove_transaction') {
                if (impact.status !== 'linked' && impact.status !== 'needs_review') {
                    throw new ServiceError(409, 'SPACE_IMPACT_NOT_LINKED', 'El impacto no tiene una transacción activa.')
                }
                if (impact.transactionId) {
                    const deletion = await Transaction.deleteOne({
                        _id: impact.transactionId,
                        userId: input.actorUserId,
                        spaceId: input.spaceId,
                        spaceEntryId: input.entryId,
                        spaceImpactId: impact._id,
                        spaceContractVersion: 2,
                    }, { session })
                    if (deletion.deletedCount !== 1) {
                        throw new ServiceError(409, 'SPACE_TRANSACTION_DELETE_CONFLICT', 'La transacción vinculada cambió o ya no coincide.')
                    }
                }
                const update = await SpaceEntryPersonalImpact.updateOne(
                    { _id: impact._id, contractVersion: 2, revision: input.expectedRevision },
                    {
                        $set: {
                            status: 'removed',
                            removedAt: new Date(),
                            reviewedAt: new Date(),
                            reviewedResolution: 'removed',
                            operationId,
                        },
                        $unset: { transactionId: 1, accountId: 1 },
                        $inc: { revision: 1 },
                    },
                    { session }
                )
                if (update.modifiedCount !== 1) throw new ServiceError(409, 'SPACE_IMPACT_VERSION_CONFLICT', 'El impacto cambió.')
                return {
                    value: { impactId: input.impactId, status: 'removed' as const },
                    resultRefs: { personalImpactId: impact._id },
                }
            }

            if (entry.status !== 'recorded') {
                throw new ServiceError(409, 'SPACE_ENTRY_VOIDED', 'Un movimiento anulado no puede agregarse a Mi Finp.')
            }
            if (!['pending', 'ignored', 'removed'].includes(impact.status)) {
                throw new ServiceError(409, 'SPACE_IMPACT_ALREADY_LINKED', 'El impacto ya tiene historia personal activa.')
            }
            const amounts = amountsForImpact(entry, impact)
            if (amounts.action === 'none') {
                throw new ServiceError(409, 'SPACE_IMPACT_NOT_REQUIRED', 'Este movimiento no produce una acción financiera personal.')
            }
            const isPayer = extractId(entry.paidByParticipantId) === impact.participantId.toString()
            const variant = impactVariant({ kind: amounts.kind, isPayer })
            const transactionAmount = amounts.accountImpactAmount > 0
                ? amounts.accountImpactAmount
                : amounts.ownShareAmount
            let transactionId: Types.ObjectId
            let accountId: string | undefined
            let categoryId: string | undefined

            if (input.decision.type === 'link_existing') {
                const transaction = await Transaction.findOne({
                    _id: input.decision.transactionId,
                    userId: input.actorUserId,
                    $or: [
                        { spaceImpactId: { $exists: false } },
                        { spaceImpactId: impact._id },
                    ],
                }).session(session).lean<ITransaction | null>()
                if (!transaction) {
                    throw new ServiceError(404, 'SPACE_TRANSACTION_NOT_FOUND', 'La transacción no existe o ya está vinculada.')
                }
                if (transaction.type !== expectedTransactionType(variant) || transaction.currency !== entry.currency) {
                    throw new ServiceError(409, 'SPACE_TRANSACTION_TYPE_MISMATCH', 'Tipo o moneda incompatibles con el Espacio.')
                }
                assertAmountsClose(transaction.amount, transactionAmount, 'SPACE_TRANSACTION_AMOUNT_MISMATCH')
                assertAmountsClose(
                    transaction.operationalAmount ?? transaction.amount,
                    amounts.operationalAmount,
                    'SPACE_TRANSACTION_OPERATIONAL_MISMATCH'
                )
                if (!entry.timezone || !entry.dateKey || financialDateKeyFromInstant(transaction.date, entry.timezone) !== entry.dateKey) {
                    throw new ServiceError(409, 'SPACE_TRANSACTION_DATE_MISMATCH', 'La fecha no coincide con el día financiero del Espacio.')
                }
                const sourceAccountId = extractId(transaction.sourceAccountId)
                const destinationAccountId = extractId(transaction.destinationAccountId)
                if (variant === 'participant_expense' && (sourceAccountId || destinationAccountId)) {
                    throw new ServiceError(409, 'SPACE_TRANSACTION_ACCOUNT_MISMATCH', 'La parte de un no pagador no debe mover una cuenta.')
                }
                if ((variant === 'payer_expense' || variant === 'advance' || variant === 'settlement_paid') && !sourceAccountId) {
                    throw new ServiceError(409, 'SPACE_TRANSACTION_ACCOUNT_MISMATCH', 'La salida real exige cuenta origen.')
                }
                if (variant === 'settlement_received' && !destinationAccountId) {
                    throw new ServiceError(409, 'SPACE_TRANSACTION_ACCOUNT_MISMATCH', 'La entrada real exige cuenta destino.')
                }
                const link = await Transaction.updateOne(
                    {
                        _id: transaction._id,
                        userId: input.actorUserId,
                        $or: [{ spaceImpactId: { $exists: false } }, { spaceImpactId: impact._id }],
                    },
                    {
                        $set: {
                            spaceId: input.spaceId,
                            spaceEntryId: input.entryId,
                            spaceImpactId: impact._id,
                            spaceOperationId: operationId,
                            spaceContractVersion: 2,
                        },
                    },
                    { session }
                )
                if (link.matchedCount !== 1) throw new ServiceError(409, 'SPACE_TRANSACTION_LINK_CONFLICT', 'La transacción cambió.')
                transactionId = transaction._id
                accountId = sourceAccountId ?? destinationAccountId
                categoryId = extractId(transaction.categoryId)
            } else {
                const accountIdInput = input.decision.accountId
                if (variant !== 'participant_expense' && !accountIdInput) {
                    throw new ServiceError(400, 'SPACE_ACCOUNT_REQUIRED', 'La salida o entrada real exige una cuenta.')
                }
                const transactionInput = {
                    variant,
                    userId: input.actorUserId,
                    spaceId: input.spaceId,
                    spaceEntryId: input.entryId,
                    spaceImpactId: input.impactId,
                    spaceOperationId: operationId.toHexString(),
                    amount: transactionAmount,
                    operationalAmount: amounts.operationalAmount,
                    currency: entry.currency as 'ARS' | 'USD',
                    date: entry.date,
                    description: input.decision.description?.trim() || entry.title,
                    categoryId: input.decision.categoryId,
                    spaceNameSnapshot: context.space.name,
                    ...(variant === 'participant_expense'
                        ? {}
                        : variant === 'settlement_received'
                            ? { destinationAccountId: accountIdInput! }
                            : { sourceAccountId: accountIdInput! }),
                } as CreateInternalSpaceTransactionInput
                const transaction = await createInternalSpaceTransaction(transactionInput, session)
                transactionId = transaction._id
                accountId = extractId(transaction.sourceAccountId) ?? extractId(transaction.destinationAccountId)
                categoryId = extractId(transaction.categoryId)
            }

            const update = await SpaceEntryPersonalImpact.updateOne(
                { _id: impact._id, contractVersion: 2, revision: input.expectedRevision },
                {
                    $set: {
                        status: 'linked',
                        impactKind: amounts.kind,
                        amount: amounts.kind === 'advance' ? amounts.accountImpactAmount : amounts.ownShareAmount,
                        ownShareAmount: amounts.ownShareAmount,
                        accountImpactAmount: amounts.accountImpactAmount,
                        operationalAmount: amounts.operationalAmount,
                        transactionId,
                        ...(accountId ? { accountId } : {}),
                        ...(categoryId ? { categoryId } : {}),
                        resolvedAt: new Date(),
                        operationId,
                    },
                    $unset: {
                        ignoredAt: 1,
                        removedAt: 1,
                        ...(!accountId ? { accountId: 1 } : {}),
                    },
                    $inc: { revision: 1 },
                },
                { session }
            )
            if (update.modifiedCount !== 1) throw new ServiceError(409, 'SPACE_IMPACT_VERSION_CONFLICT', 'El impacto cambió.')
            return {
                value: { impactId: input.impactId, status: 'linked' as const },
                resultRefs: { personalImpactId: impact._id, transactionId },
            }
        },
    })

    return {
        ...execution,
        presentation: await reconcileImpactPresentation(execution.resultRefs.personalImpactId),
    }
}
