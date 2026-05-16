import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

const mocks = vi.hoisted(() => {
    function makeLean(result: unknown) {
        return { lean: () => Promise.resolve(result) }
    }

    const SpaceEntryPersonalImpact = {
        findOne: vi.fn(),
        create: vi.fn(),
    }

    const safeUpsertNotificationByDedupeKey = vi.fn().mockResolvedValue(undefined)
    const buildNotificationFromPendingAction = vi.fn().mockReturnValue({ dedupeKey: 'mocked-key' })

    return {
        SpaceEntryPersonalImpact,
        safeUpsertNotificationByDedupeKey,
        buildNotificationFromPendingAction,
        makeLean,
    }
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
const userId = new Types.ObjectId().toString()
const participantId = new Types.ObjectId().toString()
const createdPendingId = new Types.ObjectId()

function leanNull() {
    return { lean: () => Promise.resolve(null) }
}

function makePendingTarget() {
    return {
        userId,
        participantId,
        impactKind: 'participant_share' as const,
        actionType: 'impact_space_expense' as const,
        amount: 1000,
        currency: 'ARS',
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.SpaceEntryPersonalImpact.findOne.mockReturnValue(leanNull())
    mocks.SpaceEntryPersonalImpact.create.mockResolvedValue({ _id: createdPendingId })
})

describe('emitPersonalSyncEvent — integración con notificaciones', () => {
    it('llama a safeUpsertNotificationByDedupeKey cuando crea un pending nuevo', async () => {
        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [makePendingTarget()],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).toHaveBeenCalledOnce()
        expect(mocks.safeUpsertNotificationByDedupeKey).toHaveBeenCalledOnce()
        expect(mocks.buildNotificationFromPendingAction).toHaveBeenCalledOnce()
    })

    it('llama a safeUpsertNotificationByDedupeKey incluso cuando el pending ya existía (idempotencia)', async () => {
        // Linked no existe, pero pending sí
        mocks.SpaceEntryPersonalImpact.findOne
            .mockReturnValueOnce(leanNull()) // linked check
            .mockReturnValueOnce({ lean: () => Promise.resolve({ _id: new Types.ObjectId() }) }) // pending existente

        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [makePendingTarget()],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).not.toHaveBeenCalled()
        // Notificación sí se upserta aunque el pending ya existía
        expect(mocks.safeUpsertNotificationByDedupeKey).toHaveBeenCalledOnce()
    })

    it('NO llama a safeUpsertNotificationByDedupeKey si ya existe linked (skip total)', async () => {
        mocks.SpaceEntryPersonalImpact.findOne.mockReturnValueOnce({
            lean: () => Promise.resolve({ _id: new Types.ObjectId(), status: 'linked' }),
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

    it('no bloquea el flujo si safeUpsertNotificationByDedupeKey falla', async () => {
        mocks.safeUpsertNotificationByDedupeKey.mockRejectedValueOnce(new Error('Notification DB error'))

        await expect(
            emitPersonalSyncEvent({
                actorUserId,
                spaceId,
                entryId,
                sourceType: 'space_entry',
                pendingTargets: [makePendingTarget()],
            })
        ).resolves.not.toThrow()
    })

    it('crea pendientes y notificaciones para múltiples targets', async () => {
        const userId2 = new Types.ObjectId().toString()
        const participantId2 = new Types.ObjectId().toString()

        await emitPersonalSyncEvent({
            actorUserId,
            spaceId,
            entryId,
            sourceType: 'space_entry',
            pendingTargets: [
                makePendingTarget(),
                { ...makePendingTarget(), userId: userId2, participantId: participantId2 },
            ],
        })

        expect(mocks.SpaceEntryPersonalImpact.create).toHaveBeenCalledTimes(2)
        expect(mocks.safeUpsertNotificationByDedupeKey).toHaveBeenCalledTimes(2)
    })
})
