import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

/**
 * Reconciliación de pendientes cuando cambia el reparto de un movimiento.
 *
 * Cubre los tres casos de la regla: monto que cambia, participante removido y
 * participante agregado. Los `linked` no se tocan acá — ese camino es
 * `markLinkedImpactsAsNeedsReview`, porque sí hay historia que revisar.
 */

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
    create: vi.fn(),
    resolveNotificationsForTarget: vi.fn(),
    safeUpsertNotificationByDedupeKey: vi.fn(),
    buildNotificationFromPendingAction: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    SpaceEntryPersonalImpact: {
        find: mocks.find,
        findOne: mocks.findOne,
        updateOne: mocks.updateOne,
        create: mocks.create,
    },
}))

vi.mock('@/lib/server/notifications', () => ({
    resolveNotificationsForTarget: mocks.resolveNotificationsForTarget,
    safeUpsertNotificationByDedupeKey: mocks.safeUpsertNotificationByDedupeKey,
    buildNotificationFromPendingAction: mocks.buildNotificationFromPendingAction,
}))

const { syncPendingActionsForEntryChange } = await import('@/lib/server/personal-sync-events')

const SPACE_ID = new Types.ObjectId().toString()
const ENTRY_ID = new Types.ObjectId().toString()
const ACTOR_ID = new Types.ObjectId().toString()
const ANA_ID = new Types.ObjectId().toString()
const BETO_ID = new Types.ObjectId().toString()

function pending(overrides: Record<string, unknown> = {}) {
    return {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(ANA_ID),
        actionType: 'impact_space_expense',
        impactKind: 'participant_share',
        amount: 500,
        currency: 'ARS',
        ...overrides,
    }
}

function target(overrides: Record<string, unknown> = {}) {
    return {
        userId: ANA_ID,
        participantId: new Types.ObjectId().toString(),
        impactKind: 'participant_share' as const,
        actionType: 'impact_space_expense' as const,
        amount: 500,
        currency: 'ARS',
        ...overrides,
    }
}

function event(pendingTargets: ReturnType<typeof target>[]) {
    return {
        actorUserId: ACTOR_ID,
        spaceId: SPACE_ID,
        entryId: ENTRY_ID,
        sourceType: 'space_entry' as const,
        pendingTargets,
    }
}

function existing(rows: ReturnType<typeof pending>[]) {
    mocks.find.mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) })
}

describe('syncPendingActionsForEntryChange', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        existing([])
        mocks.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
        mocks.updateOne.mockResolvedValue({ modifiedCount: 1 })
        mocks.create.mockResolvedValue({ _id: new Types.ObjectId() })
        mocks.resolveNotificationsForTarget.mockResolvedValue(undefined)
        mocks.safeUpsertNotificationByDedupeKey.mockResolvedValue(undefined)
        mocks.buildNotificationFromPendingAction.mockReturnValue({ dedupeKey: 'k' })
    })

    it('sólo mira pendientes: los ya registrados no se tocan', async () => {
        await syncPendingActionsForEntryChange(event([]))

        const [filter] = mocks.find.mock.calls[0]
        expect(filter.status).toBe('pending')
        expect(String(filter.entryId)).toBe(ENTRY_ID)
    })

    describe('cambio de monto', () => {
        it('actualiza el pendiente existente y refresca su aviso', async () => {
            const row = pending({ amount: 500 })
            existing([row])

            const result = await syncPendingActionsForEntryChange(
                event([target({ amount: 800 })])
            )

            expect(result).toMatchObject({ updated: 1, cancelled: 0, created: 0 })

            const [filter, update] = mocks.updateOne.mock.calls[0]
            expect(filter._id).toBe(row._id)
            expect(update.$set).toMatchObject({ amount: 800, currency: 'ARS' })
            // Se conserva la identidad del pendiente: no se cancela ni se recrea.
            expect(update.$set.status).toBeUndefined()
            expect(mocks.create).not.toHaveBeenCalled()

            const [, , pendingId] = mocks.buildNotificationFromPendingAction.mock.calls[0]
            expect(pendingId).toBe(row._id.toString())
            expect(mocks.safeUpsertNotificationByDedupeKey).toHaveBeenCalledOnce()
        })

        it('no toca nada si el monto no cambió', async () => {
            existing([pending({ amount: 500 })])

            const result = await syncPendingActionsForEntryChange(
                event([target({ amount: 500 })])
            )

            expect(result).toMatchObject({ updated: 0, cancelled: 0, created: 0 })
            expect(mocks.updateOne).not.toHaveBeenCalled()
            expect(mocks.safeUpsertNotificationByDedupeKey).not.toHaveBeenCalled()
        })

        it('actualiza el desglose del pagador cuando cambia su parte', async () => {
            existing([
                pending({
                    impactKind: 'payer_full_amount',
                    amount: 500,
                    accountImpactAmount: 1000,
                    operationalAmount: 500,
                }),
            ])

            await syncPendingActionsForEntryChange(
                event([
                    target({
                        impactKind: 'payer_full_amount',
                        amount: 600,
                        accountImpactAmount: 1200,
                        operationalAmount: 600,
                    }),
                ])
            )

            const [, update] = mocks.updateOne.mock.calls[0]
            expect(update.$set).toMatchObject({
                amount: 600,
                accountImpactAmount: 1200,
                operationalAmount: 600,
            })
        })

        it('limpia el desglose si el usuario deja de ser pagador', async () => {
            existing([
                pending({
                    impactKind: 'payer_full_amount',
                    accountImpactAmount: 1000,
                    operationalAmount: 500,
                }),
            ])

            await syncPendingActionsForEntryChange(
                event([target({ impactKind: 'participant_share', amount: 300 })])
            )

            const [, update] = mocks.updateOne.mock.calls[0]
            expect(update.$set.impactKind).toBe('participant_share')
            // Si quedaran, el pendiente seguiría diciendo que puso el total.
            expect(update.$unset).toEqual({
                accountImpactAmount: '',
                operationalAmount: '',
            })
        })
    })

    describe('usuario removido del split', () => {
        it('cancela el pendiente y resuelve su notificación', async () => {
            const row = pending()
            existing([row])

            const result = await syncPendingActionsForEntryChange(event([]))

            expect(result).toMatchObject({ cancelled: 1, updated: 0, created: 0 })

            const [filter, update] = mocks.updateOne.mock.calls[0]
            expect(filter._id).toBe(row._id)
            expect(update.$set.status).toBe('cancelled')
            expect(update.$set.resolvedAt).toBeInstanceOf(Date)

            expect(mocks.resolveNotificationsForTarget).toHaveBeenCalledWith({
                recipientUserId: ANA_ID,
                pendingActionId: row._id.toString(),
                actionStatus: 'cancelled',
            })
        })

        it('no cancela a quien sigue participando', async () => {
            const ana = pending({ userId: new Types.ObjectId(ANA_ID) })
            const beto = pending({ userId: new Types.ObjectId(BETO_ID) })
            existing([ana, beto])

            const result = await syncPendingActionsForEntryChange(
                event([target({ userId: BETO_ID })])
            )

            expect(result).toMatchObject({ cancelled: 1, created: 0 })
            const cancelled = mocks.updateOne.mock.calls.find(
                ([, update]) => update.$set.status === 'cancelled'
            )
            expect(cancelled?.[0]._id).toBe(ana._id)
        })

        it('un mismo usuario conserva el pendiente de otro tipo de acción', async () => {
            const cobro = pending({ actionType: 'impact_space_collect' })
            existing([cobro])

            const result = await syncPendingActionsForEntryChange(
                event([target({ actionType: 'impact_space_expense' })])
            )

            // Distinto tipo de acción es distinto pendiente: uno se cancela y el
            // otro se crea, en vez de pisarse entre sí.
            expect(result).toMatchObject({ cancelled: 1, created: 1 })
        })
    })

    describe('usuario agregado al split', () => {
        it('crea el pendiente del participante nuevo', async () => {
            existing([])

            const result = await syncPendingActionsForEntryChange(
                event([target({ userId: BETO_ID, amount: 250 })])
            )

            expect(result).toMatchObject({ created: 1, updated: 0, cancelled: 0 })
            expect(mocks.create).toHaveBeenCalledOnce()
            expect(mocks.create.mock.calls[0][0]).toMatchObject({
                amount: 250,
                status: 'pending',
                actionType: 'impact_space_expense',
            })
        })

        it('no crea un pendiente a quien ya registró el movimiento', async () => {
            mocks.findOne.mockReturnValue({
                lean: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
            })

            await syncPendingActionsForEntryChange(event([target({ userId: BETO_ID })]))

            expect(mocks.create).not.toHaveBeenCalled()
        })

        it('resuelve altas, bajas y cambios en una sola pasada', async () => {
            const ana = pending({ userId: new Types.ObjectId(ANA_ID), amount: 500 })
            const beto = pending({ userId: new Types.ObjectId(BETO_ID), amount: 500 })
            existing([ana, beto])

            const nuevo = new Types.ObjectId().toString()
            const result = await syncPendingActionsForEntryChange(
                event([
                    target({ userId: BETO_ID, amount: 400 }),
                    target({ userId: nuevo, amount: 400 }),
                ])
            )

            expect(result).toEqual({ created: 1, updated: 1, cancelled: 1 })
        })
    })

    it('un fallo en un usuario no impide reconciliar al resto', async () => {
        const ana = pending({ userId: new Types.ObjectId(ANA_ID) })
        const beto = pending({ userId: new Types.ObjectId(BETO_ID), amount: 500 })
        existing([ana, beto])
        mocks.updateOne.mockRejectedValueOnce(new Error('mongo caído'))

        const result = await syncPendingActionsForEntryChange(
            event([target({ userId: BETO_ID, amount: 900 })])
        )

        expect(result.updated).toBe(1)
    })
})
