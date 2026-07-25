import { Notification, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import {
    NOTIFICATION_ACTION_STATUSES,
    NOTIFICATION_STATUSES,
    SPACE_PERSONAL_IMPACT_STATUSES,
} from '@/lib/constants'
import { revertApplicationForTransaction } from '@/lib/server/commitments'

export interface TransactionTeardownResult {
    /** Compromiso cuyo período volvió a quedar pendiente, si aplica. */
    revertedCommitment?: { commitmentId: string; period: string }
    /** Impacto personal de Espacios que se desvinculó. */
    unlinkedPersonalImpact: boolean
    /** Notificaciones pendientes que apuntaban a la transacción. */
    resolvedNotifications: number
    /** Hermano del pago dual que quedó huérfano. */
    orphanPaymentSiblingId?: string
}

type TeardownTransaction = {
    _id: { toString(): string }
    paymentGroupId?: string | null
}

/**
 * Desvincula todo lo que apunta a una transacción antes de eliminarla.
 *
 * Hasta ahora el DELETE no revertía nada: dejaba la aplicación del compromiso
 * marcada como aplicada para siempre, el impacto de Espacios en `linked` con un
 * `transactionId` colgado y las notificaciones en `pending`.
 *
 * Cada paso es independiente y tolerante a fallos: no poder cerrar una
 * notificación no debe impedir borrar el movimiento. El estado financiero
 * (la aplicación del compromiso) se revierte primero, porque es el que importa.
 */
export async function unlinkTransactionDependents(
    userId: string,
    transaction: TeardownTransaction
): Promise<TransactionTeardownResult> {
    const transactionId = transaction._id.toString()

    const result: TransactionTeardownResult = {
        unlinkedPersonalImpact: false,
        resolvedNotifications: 0,
    }

    // 1. Compromiso: el período vuelve a estar pendiente y la plantilla sigue viva.
    const reverted = await revertApplicationForTransaction(userId, transactionId)
    if (reverted) result.revertedCommitment = reverted

    // 2. Impacto personal de Espacios. Se replica el criterio del handler de
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
            }
        )
        result.unlinkedPersonalImpact = Boolean(impact)
    } catch (error) {
        console.error('No se pudo desvincular el impacto personal:', error)
    }

    // 3. Notificaciones que apuntaban a la transacción y seguían pendientes.
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
            }
        )
        result.resolvedNotifications = notifications.modifiedCount ?? 0
    } catch (error) {
        console.error('No se pudieron resolver las notificaciones:', error)
    }

    // 4. Pago dual: no se borra el hermano por su cuenta — eso movería dinero sin
    //    que el usuario lo pida — pero sí se informa para poder advertirlo.
    if (transaction.paymentGroupId) {
        try {
            const sibling = await Transaction.findOne({
                userId,
                paymentGroupId: transaction.paymentGroupId,
                _id: { $ne: transaction._id },
            }).select({ _id: 1 })

            if (sibling) result.orphanPaymentSiblingId = sibling._id.toString()
        } catch (error) {
            console.error('No se pudo revisar el pago dual:', error)
        }
    }

    return result
}
