import mongoose, { type ClientSession } from 'mongoose'
import { InstallmentPlan, Notification, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import {
    NOTIFICATION_ACTION_STATUSES,
    NOTIFICATION_STATUSES,
    SPACE_PERSONAL_IMPACT_STATUSES,
} from '@/lib/constants'
import { revertApplicationForTransaction } from '@/lib/server/commitments'
import { ServiceError } from '@/lib/server/errors'

export interface TransactionTeardownResult {
    /** Compromiso cuyo período volvió a quedar pendiente, si aplica. */
    revertedCommitment?: { commitmentId: string; period: string }
    /** Plan de cuotas que se eliminó junto con su compra originaria. */
    deletedInstallmentPlan?: { planId: string; installmentCount: number }
    /** Impacto personal de Espacios que se desvinculó. */
    unlinkedPersonalImpact: boolean
    /** Notificaciones pendientes que apuntaban a la transacción. */
    resolvedNotifications: number
    /** Hermano del pago dual que quedó huérfano. */
    orphanPaymentSiblingId?: string
}

export interface PaymentGroupNormalizationResult {
    groupId: string
    clearedMemberIds: string[]
}

export type TeardownTransaction = {
    _id: { toString(): string }
    type?: string
    amount?: number
    currency?: string
    date?: Date
    description?: string
    merchant?: string
    sourceAccountId?: unknown
    destinationAccountId?: unknown
    categoryId?: unknown
    paymentGroupId?: string | null
    /** Puede llegar como ObjectId (`lean`), como string o poblado. */
    installmentPlanId?: unknown
    updatedAt?: Date
}

export type AuthorizedTransactionSelector = {
    transactionId: string
    spaceId?: string
    spaceEntryId?: string
}

export interface AuthorizedTransactionDeletionResult {
    deletedTransactions: TeardownTransaction[]
    teardowns: TransactionTeardownResult[]
    normalizedGroups: PaymentGroupNormalizationResult[]
}

type TeardownOptions = {
    session?: ClientSession
    strict?: boolean
}

class TransactionTeardownError extends Error {
    stage: string

    constructor(stage: string, cause: unknown) {
        super(`Fallo el teardown de la transaccion en ${stage}.`, { cause })
        this.name = 'TransactionTeardownError'
        this.stage = stage
    }
}

function throwOrReportTeardownFailure(
    stage: string,
    message: string,
    error: unknown,
    strict: boolean
) {
    if (strict) throw new TransactionTeardownError(stage, error)
    console.error(message, error)
}

function withSession<T extends { session(session: ClientSession): T }>(
    query: T,
    session?: ClientSession
): T {
    return session ? query.session(session) : query
}

function buildAuthorizedTransactionFilter(
    userId: string,
    selector: AuthorizedTransactionSelector
) {
    return {
        _id: selector.transactionId,
        userId,
        ...(selector.spaceId ? { spaceId: selector.spaceId } : {}),
        ...(selector.spaceEntryId ? { spaceEntryId: selector.spaceEntryId } : {}),
    }
}

/**
 * Resuelve la referencia al plan sin asumir cómo se leyó la transacción: un
 * `lean()` devuelve `ObjectId`, un populate devuelve el documento y un borrador
 * puede traer el id como string.
 */
function resolveInstallmentPlanId(value: unknown): string | null {
    if (!value) return null
    if (typeof value === 'string') return value.trim() || null
    if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
        const nested = (value as { _id?: { toString(): string } })._id
        return nested ? nested.toString() : null
    }
    return typeof (value as { toString?: () => string }).toString === 'function'
        ? (value as { toString(): string }).toString()
        : null
}

/**
 * Desvincula todo lo que apunta a una transacción antes de eliminarla.
 *
 * Hasta ahora el DELETE no revertía nada: dejaba la aplicación del compromiso
 * marcada como aplicada para siempre, el impacto de Espacios en `linked` con un
 * `transactionId` colgado y las notificaciones en `pending`.
 *
 * El modo heredado conserva tolerancia por etapa para los callers que realizan
 * su propia recuperación. La operación compartida de borrado usa `strict`: ante
 * cualquier fallo aborta la sesión y no confirma un estado parcial.
 *
 * Se ejecuta antes del borrado a propósito. Dentro de la transacción MongoDB,
 * teardown y eliminación se confirman juntos o se revierten juntos.
 */
export async function unlinkTransactionDependents(
    userId: string,
    transaction: TeardownTransaction,
    options: TeardownOptions = {}
): Promise<TransactionTeardownResult> {
    const transactionId = transaction._id.toString()
    const { session, strict = false } = options

    const result: TransactionTeardownResult = {
        unlinkedPersonalImpact: false,
        resolvedNotifications: 0,
    }

    // 1. Compromiso: el período vuelve a estar pendiente y la plantilla sigue viva.
    const reverted = session
        ? await revertApplicationForTransaction(
            userId,
            transactionId,
            'transaction_deleted',
            session
        )
        : await revertApplicationForTransaction(userId, transactionId)
    if (reverted) result.revertedCommitment = reverted

    // 2. Plan de cuotas: el plan es la fuente de verdad de las cuotas futuras y
    //    Proyección, Dashboard y el resumen de tarjetas lo leen sin mirar la
    //    compra que lo originó. Si sobrevive, esas superficies siguen cobrando
    //    cuotas de una compra eliminada.
    const installmentPlanId = resolveInstallmentPlanId(transaction.installmentPlanId)
    if (installmentPlanId) {
        try {
            // Sólo cae el plan cuya única compra es la que se está borrando: si
            // otra transacción sigue apuntándolo, el plan sigue teniendo dueño.
            const otherPurchase = await withSession(
                Transaction.exists({
                    userId,
                    installmentPlanId,
                    _id: { $ne: transaction._id },
                }),
                session
            )

            if (otherPurchase) {
                console.warn(
                    `El plan de cuotas ${installmentPlanId} conserva otra transacción asociada: no se elimina en cascada.`
                )
            } else {
                const planFilter = { _id: installmentPlanId, userId }
                const deletedPlan = session
                    ? await InstallmentPlan.findOneAndDelete(planFilter, { session })
                    : await InstallmentPlan.findOneAndDelete(planFilter)

                if (deletedPlan) {
                    result.deletedInstallmentPlan = {
                        planId: installmentPlanId,
                        installmentCount: deletedPlan.installmentCount,
                    }
                }
            }
        } catch (error) {
            throwOrReportTeardownFailure(
                'installment_plan',
                'No se pudo eliminar el plan de cuotas asociado:',
                error,
                strict
            )
        }
    }

    // 3. Impacto personal de Espacios. Se replica el criterio del handler de
    //    "Quitar de mi Finp": el impacto pasa a REMOVED y suelta la transacción.
    try {
        const impact = await SpaceEntryPersonalImpact.findOneAndUpdate(
            {
                userId,
                transactionId,
                status: {
                    $in: [
                        SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
                        SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
                    ],
                },
            },
            {
                $set: {
                    status: SPACE_PERSONAL_IMPACT_STATUSES.REMOVED,
                    removedAt: new Date(),
                    reviewedAt: new Date(),
                    reviewedResolution: 'removed',
                },
                $unset: { transactionId: 1, accountId: 1 },
            },
            session ? { new: true, session } : { new: true }
        )
        result.unlinkedPersonalImpact = Boolean(impact)

        if (impact) {
            const impactNotifications = await Notification.updateMany(
                {
                    recipientUserId: userId,
                    $or: [
                        { pendingActionId: impact._id },
                        { 'entityRefs.personalImpactId': impact._id },
                    ],
                    actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
                    status: { $ne: NOTIFICATION_STATUSES.DISMISSED },
                },
                {
                    $set: {
                        actionStatus: NOTIFICATION_ACTION_STATUSES.COMPLETED,
                        resolvedAt: new Date(),
                    },
                },
                session ? { session } : undefined
            )
            result.resolvedNotifications += impactNotifications.modifiedCount ?? 0
        }
    } catch (error) {
        throwOrReportTeardownFailure(
            'personal_impact',
            'No se pudo desvincular el impacto personal:',
            error,
            strict
        )
    }

    // 4. Notificaciones que apuntaban a la transacción y seguían pendientes.
    try {
        const notifications = await Notification.updateMany(
            {
                recipientUserId: userId,
                'entityRefs.transactionId': transactionId,
                actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
                status: { $ne: NOTIFICATION_STATUSES.DISMISSED },
            },
            {
                $set: {
                    actionStatus: NOTIFICATION_ACTION_STATUSES.CANCELLED,
                    resolvedAt: new Date(),
                },
            },
            session ? { session } : undefined
        )
        result.resolvedNotifications += notifications.modifiedCount ?? 0
    } catch (error) {
        throwOrReportTeardownFailure(
            'transaction_notifications',
            'No se pudieron resolver las notificaciones:',
            error,
            strict
        )
    }

    // 5. Pago dual: no se borra el hermano por su cuenta — eso movería dinero sin
    //    que el usuario lo pida — pero sí se informa para poder advertirlo.
    if (transaction.paymentGroupId) {
        try {
            const sibling = await withSession(
                Transaction.findOne({
                    userId,
                    paymentGroupId: transaction.paymentGroupId,
                    _id: { $ne: transaction._id },
                }).select({ _id: 1 }),
                session
            )

            if (sibling) result.orphanPaymentSiblingId = sibling._id.toString()
        } catch (error) {
            throwOrReportTeardownFailure(
                'payment_group',
                'No se pudo revisar el pago dual:',
                error,
                strict
            )
        }
    }

    return result
}

/**
 * Un grupo de pago sólo existe mientras conserva al menos dos partes. Al
 * borrar una parte no se borra la restante, pero sí se limpia su referencia
 * para que no siga apareciendo como un pago dual incompleto.
 */
export async function normalizePaymentGroup(
    userId: string,
    paymentGroupId?: string | null,
    session?: ClientSession
): Promise<PaymentGroupNormalizationResult | null> {
    if (!paymentGroupId) return null

    const members = await withSession(
        Transaction.find({
            userId,
            paymentGroupId,
        }).select({ _id: 1 }),
        session
    )

    if (members.length >= 2) return null

    const clearedMemberIds = members.map((member) => member._id.toString())
    if (clearedMemberIds.length > 0) {
        const filter = {
            userId,
            paymentGroupId,
            _id: { $in: clearedMemberIds },
        }
        const update = { $unset: { paymentGroupId: 1 } }
        if (session) await Transaction.updateMany(filter, update, { session })
        else await Transaction.updateMany(filter, update)
    }

    return { groupId: paymentGroupId, clearedMemberIds }
}

/**
 * Elimina una o más transacciones personales ya seleccionadas por id. La lectura,
 * el teardown, el borrado y la normalización comparten una sesión MongoDB para
 * que un fallo no confirme un estado financiero parcial.
 */
export async function deleteAuthorizedPersonalTransactions(
    userId: string,
    selectors: AuthorizedTransactionSelector[]
): Promise<AuthorizedTransactionDeletionResult> {
    const uniqueSelectors = Array.from(
        new Map(selectors.map((selector) => [selector.transactionId, selector])).values()
    )
    if (uniqueSelectors.length === 0) {
        return { deletedTransactions: [], teardowns: [], normalizedGroups: [] }
    }

    const dbSession = await mongoose.startSession()
    let result: AuthorizedTransactionDeletionResult = {
        deletedTransactions: [],
        teardowns: [],
        normalizedGroups: [],
    }

    try {
        await dbSession.withTransaction(async () => {
            const targets = await Transaction.find({
                userId,
                $or: uniqueSelectors.map((selector) => ({
                    _id: selector.transactionId,
                    ...(selector.spaceId ? { spaceId: selector.spaceId } : {}),
                    ...(selector.spaceEntryId ? { spaceEntryId: selector.spaceEntryId } : {}),
                })),
            })
                .session(dbSession)
                .lean<TeardownTransaction[]>()

            const targetsById = new Map(
                targets.map((transaction) => [transaction._id.toString(), transaction])
            )
            const orderedTargets = uniqueSelectors
                .map((selector) => targetsById.get(selector.transactionId))
                .filter((transaction): transaction is TeardownTransaction => Boolean(transaction))
            const teardowns: TransactionTeardownResult[] = []

            for (const transaction of orderedTargets) {
                teardowns.push(await unlinkTransactionDependents(userId, transaction, {
                    session: dbSession,
                    strict: true,
                }))
            }

            for (const transaction of orderedTargets) {
                const selector = uniqueSelectors.find(
                    (candidate) => candidate.transactionId === transaction._id.toString()
                )
                if (!selector) continue

                const deletion = await Transaction.deleteOne(
                    buildAuthorizedTransactionFilter(userId, selector),
                    { session: dbSession }
                )
                if (deletion.deletedCount !== 1) {
                    throw new ServiceError(
                        409,
                        'TRANSACTION_DELETE_CONFLICT',
                        'La transacción cambió mientras intentábamos eliminarla. Actualizá los datos e intentá de nuevo.'
                    )
                }
            }

            const normalizedGroups: PaymentGroupNormalizationResult[] = []
            const paymentGroupIds = Array.from(new Set(
                orderedTargets
                    .map((transaction) => transaction.paymentGroupId)
                    .filter((groupId): groupId is string => Boolean(groupId))
            ))
            for (const paymentGroupId of paymentGroupIds) {
                const normalized = await normalizePaymentGroup(
                    userId,
                    paymentGroupId,
                    dbSession
                )
                if (normalized) normalizedGroups.push(normalized)
            }

            result = {
                deletedTransactions: orderedTargets,
                teardowns,
                normalizedGroups,
            }
        })
    } catch (error) {
        if (error instanceof ServiceError) throw error

        console.error('[transaction-delete] rollback ejecutado', {
            code: 'TRANSACTION_TEARDOWN_FAILED',
            stage: error instanceof TransactionTeardownError ? error.stage : 'delete',
        })
        throw new ServiceError(
            500,
            'TRANSACTION_TEARDOWN_FAILED',
            'No se pudo eliminar la transacción. No se confirmaron cambios.'
        )
    } finally {
        await dbSession.endSession()
    }

    return result
}

/** Cierra de forma atómica un impacto cuyo movimiento personal ya no existe. */
export async function removePersonalImpactWithoutTransaction(
    userId: string,
    personalImpactId: string
): Promise<boolean> {
    const dbSession = await mongoose.startSession()
    let removed = false

    try {
        await dbSession.withTransaction(async () => {
            const update = await SpaceEntryPersonalImpact.updateOne(
                {
                    _id: personalImpactId,
                    userId,
                    status: {
                        $in: [
                            SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
                            SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
                        ],
                    },
                },
                {
                    $set: {
                        status: SPACE_PERSONAL_IMPACT_STATUSES.REMOVED,
                        removedAt: new Date(),
                        reviewedAt: new Date(),
                        reviewedResolution: 'removed',
                    },
                    $unset: { transactionId: 1, accountId: 1 },
                },
                { session: dbSession }
            )
            removed = update.modifiedCount === 1
            if (!removed) return

            await Notification.updateMany(
                {
                    recipientUserId: userId,
                    $or: [
                        { pendingActionId: personalImpactId },
                        { 'entityRefs.personalImpactId': personalImpactId },
                    ],
                    actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
                    status: { $ne: NOTIFICATION_STATUSES.DISMISSED },
                },
                {
                    $set: {
                        actionStatus: NOTIFICATION_ACTION_STATUSES.COMPLETED,
                        resolvedAt: new Date(),
                    },
                },
                { session: dbSession }
            )
        })
    } catch {
        console.error('[personal-impact] rollback ejecutado', {
            code: 'PERSONAL_IMPACT_CLOSE_FAILED',
        })
        throw new ServiceError(
            500,
            'PERSONAL_IMPACT_CLOSE_FAILED',
            'No se pudo cerrar el impacto personal. No se confirmaron cambios.'
        )
    } finally {
        await dbSession.endSession()
    }

    return removed
}
