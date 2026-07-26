import { InstallmentPlan, Notification, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import {
    NOTIFICATION_ACTION_STATUSES,
    NOTIFICATION_STATUSES,
    SPACE_PERSONAL_IMPACT_STATUSES,
} from '@/lib/constants'
import { revertApplicationForTransaction } from '@/lib/server/commitments'

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

type TeardownTransaction = {
    _id: { toString(): string }
    paymentGroupId?: string | null
    /** Puede llegar como ObjectId (`lean`), como string o poblado. */
    installmentPlanId?: unknown
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
 * Cada paso es independiente y tolerante a fallos: no poder cerrar una
 * notificación no debe impedir borrar el movimiento. El estado financiero
 * (la aplicación del compromiso y el plan de cuotas) se resuelve primero,
 * porque es el que importa.
 *
 * Se ejecuta antes del borrado a propósito. Si después falla el borrado queda
 * una transacción sin plan —visible y borrable de nuevo, y el reintento cierra
 * el caso— en lugar de un plan huérfano proyectando cuotas de una compra que ya
 * no existe, que era el estado que quedaba hasta ahora.
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

    // 2. Plan de cuotas: el plan es la fuente de verdad de las cuotas futuras y
    //    Proyección, Dashboard y el resumen de tarjetas lo leen sin mirar la
    //    compra que lo originó. Si sobrevive, esas superficies siguen cobrando
    //    cuotas de una compra eliminada.
    const installmentPlanId = resolveInstallmentPlanId(transaction.installmentPlanId)
    if (installmentPlanId) {
        try {
            // Sólo cae el plan cuya única compra es la que se está borrando: si
            // otra transacción sigue apuntándolo, el plan sigue teniendo dueño.
            const otherPurchase = await Transaction.exists({
                userId,
                installmentPlanId,
                _id: { $ne: transaction._id },
            })

            if (otherPurchase) {
                console.warn(
                    `El plan de cuotas ${installmentPlanId} conserva otra transacción asociada: no se elimina en cascada.`
                )
            } else {
                const deletedPlan = await InstallmentPlan.findOneAndDelete({
                    _id: installmentPlanId,
                    userId,
                })

                if (deletedPlan) {
                    result.deletedInstallmentPlan = {
                        planId: installmentPlanId,
                        installmentCount: deletedPlan.installmentCount,
                    }
                }
            }
        } catch (error) {
            console.error('No se pudo eliminar el plan de cuotas asociado:', error)
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
            }
        )
        result.unlinkedPersonalImpact = Boolean(impact)
    } catch (error) {
        console.error('No se pudo desvincular el impacto personal:', error)
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
            }
        )
        result.resolvedNotifications = notifications.modifiedCount ?? 0
    } catch (error) {
        console.error('No se pudieron resolver las notificaciones:', error)
    }

    // 5. Pago dual: no se borra el hermano por su cuenta — eso movería dinero sin
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
