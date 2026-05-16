import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

const mocks = vi.hoisted(() => {
    function makeLean(result: unknown) {
        return { lean: () => Promise.resolve(result) }
    }
    const SpaceEntryPersonalImpact = {
        findOne: vi.fn(),
        create: vi.fn(),
        findOneAndUpdate: vi.fn(),
        _makeLean: makeLean,
    }
    const safeUpsertNotificationByDedupeKey = vi.fn().mockResolvedValue(undefined)
    const buildNotificationFromPendingAction = vi.fn().mockReturnValue({ dedupeKey: 'mock-key' })
    return { SpaceEntryPersonalImpact, safeUpsertNotificationByDedupeKey, buildNotificationFromPendingAction }
})

vi.mock('@/lib/models', () => ({
    SpaceEntryPersonalImpact: mocks.SpaceEntryPersonalImpact,
}))

vi.mock('@/lib/server/notifications', () => ({
    safeUpsertNotificationByDedupeKey: mocks.safeUpsertNotificationByDedupeKey,
    buildNotificationFromPendingAction: mocks.buildNotificationFromPendingAction,
}))

vi.mock('@/lib/constants', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/constants')>()
    return { ...actual }
})

const { emitPersonalSyncEvent } = await import('@/lib/server/personal-sync-events')

const spaceId = new Types.ObjectId().toString()
const entryId = new Types.ObjectId().toString()
const actorUserId = new Types.ObjectId().toString()
const userAId = new Types.ObjectId().toString()
const participantAId = new Types.ObjectId().toString()
const userBId = new Types.ObjectId().toString()
const participantBId = new Types.ObjectId().toString()

function makePendingTarget(overrides = {}) {
    return {
        userId: userAId,
        participantId: participantAId,
        impactKind: 'participant_share' as const,
        actionType: 'impact_space_expense' as const,
        amount: 500,
        currency: 'ARS',
        ...overrides,
    }
}

function leanNull() {
    return { lean: () => Promise.resolve(null) }
}

beforeEach(() => {
    vi.clearAllMocks()
    // Por defecto: no existe linked ni pending
    mocks.SpaceEntryPersonalImpact.findOne.mockReturnValue(leanNull())
    mocks.SpaceEntryPersonalImpact.create.mockImplementation(async (data: unknown) => ({
        _id: new Types.ObjectId(),
        ...(data as object),
    }))
})

describe('emitPersonalSyncEvent — createPersonalPendingActions', () => {
    it('crea un pendiente para el participante involucrado', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [makePendingTarget()],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).toHaveBeenCalledOnce()
        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.status).toBe('pending')
        expect(created.actionType).toBe('impact_space_expense')
        expect(created.userId.toString()).toBe(userAId)
    })

    it('es idempotente: no crea duplicado si ya existe pending con mismo actionType, pero sí upserta notificación', async () => {
        mocks.SpaceEntryPersonalImpact.findOne
            .mockReturnValueOnce(leanNull())   // linked check → no existe
            .mockReturnValueOnce({ lean: () => Promise.resolve({ _id: 'existing-pending-id' }) })  // pending check → ya existe

        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [makePendingTarget()],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).not.toHaveBeenCalled()
        // La notificación sí se upserta aunque el pending ya existía
        expect(mocks.safeUpsertNotificationByDedupeKey).toHaveBeenCalledOnce()
    })

    it('llama a safeUpsertNotificationByDedupeKey cuando crea un pending nuevo', async () => {
        mocks.SpaceEntryPersonalImpact.create.mockResolvedValue({ _id: 'new-pending-id' })

        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [makePendingTarget()],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).toHaveBeenCalledOnce()
        expect(mocks.safeUpsertNotificationByDedupeKey).toHaveBeenCalledOnce()
    })

    it('no llama a safeUpsertNotificationByDedupeKey si ya existe linked', async () => {
        mocks.SpaceEntryPersonalImpact.findOne.mockReturnValueOnce({
            lean: () => Promise.resolve({ _id: 'linked-existing', status: 'linked' }),
        })

        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [makePendingTarget()],
        })

        expect(mocks.safeUpsertNotificationByDedupeKey).not.toHaveBeenCalled()
    })

    it('no crea pendiente si ya existe linked vigente para (userId, entryId)', async () => {
        mocks.SpaceEntryPersonalImpact.findOne.mockReturnValueOnce({
            lean: () => Promise.resolve({ _id: 'linked-existing', status: 'linked' }),
        })

        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [makePendingTarget()],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).not.toHaveBeenCalled()
    })

    it('crea pendientes para múltiples participantes independientemente', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [
                makePendingTarget({ userId: userAId, participantId: participantAId }),
                makePendingTarget({ userId: userBId, participantId: participantBId }),
            ],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).toHaveBeenCalledTimes(2)
    })

    it('no falla si pendingTargets está vacío', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).not.toHaveBeenCalled()
    })

    it('guarda actorUserId y sourceType en el registro creado', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'debt_payment',
            debtId: new Types.ObjectId().toString(),
            pendingTargets: [makePendingTarget()],
        })

        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.sourceType).toBe('debt_payment')
        expect(created.actorUserId.toString()).toBe(actorUserId)
    })

    it('guarda counterpartyNameSnapshot cuando se provee', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [
                makePendingTarget({
                    counterpartyNameSnapshot: 'Roro',
                    counterpartyParticipantId: participantBId,
                }),
            ],
        })

        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.counterpartyNameSnapshot).toBe('Roro')
    })

    it('no interrumpe si falla un participante individual (Promise.allSettled)', async () => {
        mocks.SpaceEntryPersonalImpact.create
            .mockRejectedValueOnce(new Error('DB error'))
            .mockResolvedValueOnce({})

        await expect(
            emitPersonalSyncEvent({
                actorUserId,
                spaceId,
                entryId,
                sourceType: 'space_entry',
                pendingTargets: [
                    makePendingTarget({ userId: userAId }),
                    makePendingTarget({ userId: userBId }),
                ],
            })
        ).resolves.not.toThrow()

        expect(mocks.SpaceEntryPersonalImpact.create).toHaveBeenCalledTimes(2)
    })

    it('pending de settlement_payment incluye accountImpactAmount', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [
                makePendingTarget({
                    impactKind: 'payer_full_amount',
                    actionType: 'impact_space_expense',
                    accountImpactAmount: 1000,
                    operationalAmount: 500,
                }),
            ],
        })

        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.accountImpactAmount).toBe(1000)
        expect(created.operationalAmount).toBe(500)
    })

    it('crea pending payment para settlement pagado por el usuario target', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'debt_payment',
            pendingTargets: [
                makePendingTarget({
                    impactKind: 'settlement_paid',
                    actionType: 'impact_space_payment',
                    amount: 750,
                    currency: 'ARS',
                    counterpartyNameSnapshot: 'Roro',
                }),
            ],
        })

        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.status).toBe('pending')
        expect(created.sourceType).toBe('debt_payment')
        expect(created.impactKind).toBe('settlement_paid')
        expect(created.actionType).toBe('impact_space_payment')
        expect(created.amount).toBe(750)
        expect(mocks.buildNotificationFromPendingAction).toHaveBeenCalledOnce()
    })

    it('crea pending collect para settlement recibido por el usuario target', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'debt_collect',
            pendingTargets: [
                makePendingTarget({
                    impactKind: 'settlement_received',
                    actionType: 'impact_space_collect',
                    amount: 900,
                    currency: 'USD',
                    counterpartyNameSnapshot: 'Ana',
                }),
            ],
        })

        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.sourceType).toBe('debt_collect')
        expect(created.impactKind).toBe('settlement_received')
        expect(created.actionType).toBe('impact_space_collect')
        expect(created.currency).toBe('USD')
    })

    it('no crea pending para usuario no involucrado si no viene en pendingTargets', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [makePendingTarget({ userId: userAId })],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).toHaveBeenCalledTimes(1)
        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.userId.toString()).toBe(userAId)
        expect(created.userId.toString()).not.toBe(userBId)
    })

    it('pending conserva metadata mínima de origen, contraparte y montos', async () => {
        const debtId = new Types.ObjectId().toString()
        const debtMovementId = new Types.ObjectId().toString()

        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'debt_payment',
            debtId,
            debtMovementId,
            pendingTargets: [
                makePendingTarget({
                    counterpartyParticipantId: participantBId,
                    counterpartyNameSnapshot: 'Roro',
                    accountImpactAmount: 1200,
                    operationalAmount: 600,
                }),
            ],
        })

        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.actorUserId.toString()).toBe(actorUserId)
        expect(created.counterpartyNameSnapshot).toBe('Roro')
        expect(created.counterpartyParticipantId.toString()).toBe(participantBId)
        expect(created.sourceType).toBe('debt_payment')
        expect(created.amount).toBe(500)
        expect(created.currency).toBe('ARS')
        expect(created.accountImpactAmount).toBe(1200)
        expect(created.operationalAmount).toBe(600)
        expect(created.debtId.toString()).toBe(debtId)
        expect(created.debtMovementId.toString()).toBe(debtMovementId)
    })

    it('privacy: no guarda accountId/categoryId de otro usuario en pending ni notification input', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [
                makePendingTarget({
                    accountId: new Types.ObjectId().toString(),
                    categoryId: new Types.ObjectId().toString(),
                }),
            ],
        })

        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.accountId).toBeUndefined()
        expect(created.categoryId).toBeUndefined()
        const notificationTarget = mocks.buildNotificationFromPendingAction.mock.calls[0][0]
        expect(notificationTarget.accountId).toBeUndefined()
        expect(notificationTarget.categoryId).toBeUndefined()
    })
})
