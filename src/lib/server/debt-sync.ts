import type { Types } from 'mongoose'
import { Space, SpaceEntry, SpaceParticipant, Debt, DebtMovement } from '@/lib/models'
import { buildSpaceBalances, extractId } from '@/lib/utils/spaces'
import { computeSimplifiedSpaceDebts, computeDirectSpaceDebts } from '@/lib/utils/debt'
import { DEBT_STATUSES, DEBT_MOVEMENT_TYPES, SPACE_DEBT_MODES } from '@/lib/constants'
import type { SpaceDebtItem } from '@/lib/utils/debt'
import type { IDebt } from '@/types/debt'

function buildSpaceDebtKey(userId: string, spaceId: string, counterpartyParticipantId: string, currency: string): string {
    return `${userId}:${spaceId}:${counterpartyParticipantId}:${currency}`
}

export interface SyncResult {
    created: number
    updated: number
    paid: number
}

/**
 * Sincroniza idempotentemente las deudas personales de un usuario derivadas de un espacio.
 *
 * Invariantes:
 * - Solo crea/actualiza deudas para el usuario indicado; no modifica deudas de otros usuarios.
 * - Si una deuda tiene status 'ignored', actualiza amount/remainingAmount pero conserva el status.
 * - Deudas existentes cuyo balance llegó a cero cambian a 'paid'.
 * - Las entradas anuladas (isVoided) no generan deuda activa (buildSpaceBalances ya las excluye).
 * - Los settlements ya registrados en el espacio reducen el balance y por ende la deuda (buildSpaceBalances los incluye).
 *
 * Nota sobre monedas: buildSpaceBalances trabaja en reportingCurrency del espacio.
 * Por lo tanto, las deudas derivadas de espacio se expresan en reportingCurrency.
 * La clave spaceDebtKey incluye currency para ser forward-compatible con futura derivación por moneda original.
 */
export async function syncSpaceDebtsForUser(
    spaceId: string | Types.ObjectId,
    userId: string | Types.ObjectId
): Promise<SyncResult> {
    const spaceIdStr = spaceId.toString()
    const userIdStr = userId.toString()

    // Cargar espacio y verificar existencia
    const space = await Space.findById(spaceIdStr)
    if (!space) throw new Error(`Space ${spaceIdStr} not found`)

    const debtMode = space.debtMode ?? SPACE_DEBT_MODES.SIMPLIFIED
    const currency = space.reportingCurrency

    // Cargar participantes activos
    const participants = await SpaceParticipant.find({
        spaceId: spaceIdStr,
        isActive: true,
    })

    // Identificar el participante del usuario actual
    const currentParticipant = participants.find(
        (p) => p.kind === 'finp_user' && p.userId?.toString() === userIdStr
    )
    if (!currentParticipant) return { created: 0, updated: 0, paid: 0 }

    const currentParticipantId = currentParticipant._id.toString()

    // Cargar todas las entradas no anuladas del espacio
    const entries = await SpaceEntry.find({
        spaceId: spaceIdStr,
        isVoided: { $ne: true },
    })

    // Calcular balances usando la función existente (type-safe, excluye anuladas y rechazadas)
    const balances = buildSpaceBalances(entries, participants)

    // Calcular deudas según el modo del espacio
    const debtItems: SpaceDebtItem[] =
        debtMode === SPACE_DEBT_MODES.DIRECT
            ? computeDirectSpaceDebts(balances, participants, currentParticipantId, currency)
            : computeSimplifiedSpaceDebts(balances, participants, currentParticipantId, currency)

    const result: SyncResult = { created: 0, updated: 0, paid: 0 }
    const now = new Date()
    const syncedKeys = new Set<string>()

    // Pre-cargar todas las deudas del usuario para este espacio en una sola query
    const existingDebtsForSpace = await Debt.find({
        userId: userIdStr,
        sourceType: 'space',
        spaceId: spaceIdStr,
    })
    const existingDebtsByKey = new Map<string, (typeof existingDebtsForSpace)[number]>(
        existingDebtsForSpace
            .filter((d: (typeof existingDebtsForSpace)[number]) => d.spaceDebtKey)
            .map((d: (typeof existingDebtsForSpace)[number]) => [d.spaceDebtKey as string, d])
    )

    // Procesar cada relación de deuda calculada
    for (const item of debtItems) {
        const spaceDebtKey = buildSpaceDebtKey(userIdStr, spaceIdStr, item.counterpartyParticipantId, currency)
        syncedKeys.add(spaceDebtKey)

        const existing = existingDebtsByKey.get(spaceDebtKey) ?? null

        const counterpartyParticipant = participants.find(
            (p) => p._id.toString() === item.counterpartyParticipantId
        )
        const counterpartyUserId = counterpartyParticipant?.kind === 'finp_user'
            ? counterpartyParticipant.userId?.toString()
            : undefined

        const syncSnapshot = {
            debtMode,
            calculatedAt: now.toISOString(),
        }

        if (!existing) {
            // Crear nueva deuda
            const debt = await Debt.create({
                userId: userIdStr,
                direction: item.direction,
                sourceType: 'space',
                spaceId: spaceIdStr,
                counterpartyParticipantId: item.counterpartyParticipantId,
                counterpartyUserId,
                counterpartyNameSnapshot: item.counterpartyDisplayName,
                amount: item.amount,
                remainingAmount: item.amount,
                currency,
                status: DEBT_STATUSES.ACTIVE,
                originMode: debtMode,
                spaceDebtKey,
                metadata: {
                    syncSnapshot,
                },
            })

            await DebtMovement.create({
                userId: userIdStr,
                debtId: debt._id,
                type: DEBT_MOVEMENT_TYPES.CREATION,
                amount: item.amount,
                currency,
                spaceId: spaceIdStr,
                date: now,
            })

            result.created++
        } else {
            // Actualizar deuda existente
            const wasIgnored = existing.status === DEBT_STATUSES.IGNORED
            const previousAmount = existing.remainingAmount

            // Calcular nuevo remainingAmount respetando pagos parciales ya hechos
            // Para deudas de espacio, remainingAmount se recalcula desde el balance del espacio
            const amountPaid = Math.max(0, existing.amount - existing.remainingAmount)
            const newRemainingAmount = Math.max(0, item.amount - amountPaid)

            let newStatus: IDebt['status'] = existing.status
            if (!wasIgnored) {
                if (newRemainingAmount <= 0.01) {
                    newStatus = DEBT_STATUSES.PAID
                } else if (amountPaid > 0.01) {
                    newStatus = DEBT_STATUSES.PARTIALLY_PAID
                } else {
                    newStatus = DEBT_STATUSES.ACTIVE
                }
            }

            await Debt.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        amount: item.amount,
                        remainingAmount: newRemainingAmount,
                        status: newStatus,
                        counterpartyNameSnapshot: item.counterpartyDisplayName,
                        counterpartyUserId,
                        originMode: debtMode,
                        'metadata.syncSnapshot': syncSnapshot,
                    },
                }
            )

            // Solo crear DebtMovement si hubo un cambio significativo en el monto
            if (Math.abs(previousAmount - newRemainingAmount) > 0.01) {
                await DebtMovement.create({
                    userId: userIdStr,
                    debtId: existing._id,
                    type: DEBT_MOVEMENT_TYPES.SYNC_UPDATE,
                    amount: Math.abs(newRemainingAmount - previousAmount),
                    currency,
                    spaceId: spaceIdStr,
                    date: now,
                })
            }

            const statusChanged = newStatus !== existing.status
            const amountChanged = Math.abs(item.amount - existing.amount) > 0.01

            if (newStatus === DEBT_STATUSES.PAID && statusChanged) {
                result.paid++
            } else if (statusChanged || amountChanged) {
                result.updated++
            }
            // Sin cambios reales → no incrementa contadores (idempotente)
        }
    }

    // Marcar como pagadas las deudas existentes cuya relación ya no aparece (balance llegó a cero)
    const existingSpaceDebts = existingDebtsForSpace.filter(
        (d: (typeof existingDebtsForSpace)[number]) =>
            d.status === DEBT_STATUSES.ACTIVE ||
            d.status === DEBT_STATUSES.PARTIALLY_PAID ||
            d.status === DEBT_STATUSES.IGNORED
    )

    for (const existingDebt of existingSpaceDebts) {
        if (!existingDebt.spaceDebtKey || syncedKeys.has(existingDebt.spaceDebtKey)) continue

        // Esta deuda ya no aparece en el cálculo actual → balance llegó a cero
        if (existingDebt.status === DEBT_STATUSES.IGNORED) {
            // Preservar la decisión del usuario de ignorarla, pero limpiar el saldo fantasma
            await Debt.updateOne(
                { _id: existingDebt._id },
                { $set: { remainingAmount: 0 } }
            )
        } else {
            await Debt.updateOne(
                { _id: existingDebt._id },
                { $set: { remainingAmount: 0, status: DEBT_STATUSES.PAID } }
            )
            result.paid++
        }
    }

    return result
}

/**
 * Sincroniza las deudas de todos los participantes activos de un espacio.
 * Llamada desde endpoints de mutación de Espacios (crear/editar/anular movimiento, cambiar debtMode).
 * Usa Promise.allSettled para no interrumpir la respuesta si un participante falla.
 */
export async function syncSpaceDebtsForActiveParticipants(
    spaceId: string | Types.ObjectId
): Promise<void> {
    const spaceIdStr = spaceId.toString()
    const participants = await SpaceParticipant.find({ spaceId: spaceIdStr, isActive: true })
    await Promise.allSettled(
        participants
            .filter((p) => p.userId)
            .map((p) => syncSpaceDebtsForUser(spaceIdStr, String(p.userId)))
    )
}

/**
 * Sincroniza las deudas de todos los espacios en los que el usuario participa.
 * Diseñada como función reusable para ser invocada desde mutaciones de Espacios en Fase 6B
 * (crear/editar/anular movimiento, registrar settlement, cambiar debtMode).
 */
export async function syncAllSpaceDebtsForUser(
    userId: string | Types.ObjectId
): Promise<Record<string, SyncResult>> {
    const userIdStr = userId.toString()

    const participations = await SpaceParticipant.find({
        userId: userIdStr,
        isActive: true,
        inviteStatus: 'accepted',
    }).select('spaceId')

    const results: Record<string, SyncResult> = {}

    for (const participation of participations) {
        const spaceId = extractId(participation.spaceId)
        if (!spaceId) continue
        try {
            results[spaceId] = await syncSpaceDebtsForUser(spaceId, userIdStr)
        } catch {
            results[spaceId] = { created: 0, updated: 0, paid: 0 }
        }
    }

    return results
}
