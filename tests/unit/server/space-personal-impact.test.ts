import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import type { ISpaceEntry, ISpaceEntryPersonalImpact, ISpaceParticipant } from '@/types'

const mocks = vi.hoisted(() => {
    const makeLean = (result: unknown) => ({ lean: () => Promise.resolve(result) })
    const SpaceEntryPersonalImpact = {
        find: vi.fn(),
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
    }
    return {
        makeLean,
        Category: { findOne: vi.fn() },
        Transaction: { findOne: vi.fn() },
        SpaceEntryPersonalImpact,
        createTransactionFromSpaceEntry: vi.fn(),
        resolveNotificationsForTarget: vi.fn().mockResolvedValue(undefined),
    }
})

vi.mock('@/lib/models', () => ({
    Category: mocks.Category,
    Transaction: mocks.Transaction,
    SpaceEntryPersonalImpact: mocks.SpaceEntryPersonalImpact,
}))

vi.mock('@/lib/server/space-transactions', () => ({
    createTransactionFromSpaceEntry: mocks.createTransactionFromSpaceEntry,
}))

vi.mock('@/lib/server/notifications', () => ({
    resolveNotificationsForTarget: mocks.resolveNotificationsForTarget,
}))

const {
    getPersonalImpactForEntries,
    markLinkedImpactsAsNeedsReview,
    resolveCurrentUserEntryShare,
    resolveSuggestedImpactKind,
    upsertLinkedPersonalImpact,
} = await import('@/lib/server/space-personal-impact')

function participant(overrides: Record<string, unknown>): ISpaceParticipant {
    return {
        _id: new Types.ObjectId(),
        spaceId: new Types.ObjectId(),
        kind: 'finp_user',
        userId: new Types.ObjectId(),
        displayName: 'Participante',
        role: 'participant',
        inviteStatus: 'accepted',
        isActive: true,
        createdAt: new Date('2026-04-01'),
        updatedAt: new Date('2026-04-01'),
        ...overrides,
    } as unknown as ISpaceParticipant
}

function entry(overrides: Record<string, unknown>): ISpaceEntry {
    return {
        _id: new Types.ObjectId(),
        spaceId: new Types.ObjectId(),
        createdByUserId: new Types.ObjectId(),
        createdByParticipantId: new Types.ObjectId(),
        type: 'expense',
        status: 'confirmed',
        title: 'Cena',
        amount: 100,
        currency: 'ARS',
        reportingAmount: 100,
        date: new Date('2026-04-10'),
        paidByParticipantId: new Types.ObjectId(),
        sharedWithParticipantIds: [],
        splitMode: 'equal',
        confirmationRequired: false,
        createdAt: new Date('2026-04-10'),
        updatedAt: new Date('2026-04-10'),
        ...overrides,
    } as unknown as ISpaceEntry
}

function impact(overrides: Partial<ISpaceEntryPersonalImpact>): ISpaceEntryPersonalImpact {
    return {
        _id: new Types.ObjectId(),
        spaceId: new Types.ObjectId(),
        entryId: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        participantId: new Types.ObjectId(),
        impactKind: 'participant_share',
        amount: 50,
        currency: 'ARS',
        status: 'pending',
        createdAt: new Date('2026-04-10'),
        updatedAt: new Date('2026-04-10'),
        ...overrides,
    } as ISpaceEntryPersonalImpact
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.SpaceEntryPersonalImpact.find.mockReturnValue(mocks.makeLean([]))
    mocks.SpaceEntryPersonalImpact.findOne.mockReturnValue(mocks.makeLean(null))
    mocks.SpaceEntryPersonalImpact.findOneAndUpdate.mockReturnValue(mocks.makeLean(null))
    mocks.SpaceEntryPersonalImpact.updateMany.mockResolvedValue({ modifiedCount: 0 })
    mocks.SpaceEntryPersonalImpact.create.mockImplementation(async (data: unknown) => ({
        _id: new Types.ObjectId(),
        ...(data as object),
    }))
})

describe('space personal impact helpers', () => {
    const userGonzaloId = new Types.ObjectId()
    const userRoroId = new Types.ObjectId()
    const participantGonzaloId = new Types.ObjectId()
    const participantRoroId = new Types.ObjectId()
    const participants = [
        participant({ _id: participantGonzaloId, userId: userGonzaloId, displayName: 'Gonzalo' }),
        participant({ _id: participantRoroId, userId: userRoroId, displayName: 'Roro' }),
    ]

    it('sugiere monto completo para el pagador', () => {
        const result = resolveCurrentUserEntryShare(
            entry({
                amount: 120,
                reportingAmount: 120,
                paidByParticipantId: participantGonzaloId,
                sharedWithParticipantIds: [participantGonzaloId, participantRoroId],
            }),
            participants,
            userGonzaloId.toString()
        )

        expect(result?.impactKind).toBe('payer_full_amount')
        expect(result?.amount).toBe(120)
    })

    it('sugiere la parte del participante no pagador', () => {
        const result = resolveCurrentUserEntryShare(
            entry({
                amount: 120,
                reportingAmount: 120,
                paidByParticipantId: participantGonzaloId,
                sharedWithParticipantIds: [participantGonzaloId, participantRoroId],
            }),
            participants,
            userRoroId.toString()
        )

        expect(result?.impactKind).toBe('participant_share')
        expect(result?.amount).toBe(60)
    })

    it('devuelve null si el participante no tiene share sugerible', () => {
        const result = resolveCurrentUserEntryShare(
            entry({
                paidByParticipantId: participantGonzaloId,
                sharedWithParticipantIds: [participantGonzaloId],
                splitMode: 'none',
            }),
            participants,
            userRoroId.toString()
        )

        expect(result).toBeNull()
    })

    it('distingue pagador y receptor en settlements', () => {
        const settlement = entry({
            type: 'settlement',
            amount: 80,
            reportingAmount: 80,
            paidByParticipantId: participantRoroId,
            sharedWithParticipantIds: [participantGonzaloId],
            splitMode: 'none',
        })

        expect(resolveSuggestedImpactKind(settlement, participantRoroId.toString())).toBe('settlement_paid')
        expect(resolveSuggestedImpactKind(settlement, participantGonzaloId.toString())).toBe('settlement_received')
        expect(resolveCurrentUserEntryShare(settlement, participants, userRoroId.toString())?.impactKind).toBe('settlement_paid')
        expect(resolveCurrentUserEntryShare(settlement, participants, userGonzaloId.toString())?.impactKind).toBe('settlement_received')
        expect(resolveCurrentUserEntryShare(settlement, participants, new Types.ObjectId().toString())).toBeNull()
    })
})

describe('getPersonalImpactForEntries', () => {
    it('separa linked, pending y needs_review sin confundir estados activos', async () => {
        const spaceId = new Types.ObjectId().toString()
        const userId = new Types.ObjectId().toString()
        const entryId = new Types.ObjectId()
        const linked = impact({ entryId, status: 'linked' })
        const pending = impact({ entryId, status: 'pending' })
        const review = impact({ entryId, status: 'needs_review' })

        mocks.SpaceEntryPersonalImpact.find.mockReturnValue(mocks.makeLean([
            linked,
            pending,
            review,
        ]))

        const result = await getPersonalImpactForEntries(spaceId, userId, [entryId.toString()])

        expect(result[entryId.toString()].linkedImpact).toBe(linked)
        expect(result[entryId.toString()].pendingActions).toEqual([pending])
        expect(result[entryId.toString()].reviewImpact).toBe(review)
    })

    it('consulta solo statuses activos y deja removed/ignored/cancelled afuera desde el filtro', async () => {
        const entryId = new Types.ObjectId().toString()

        await getPersonalImpactForEntries(new Types.ObjectId().toString(), new Types.ObjectId().toString(), [entryId])

        const [filter] = mocks.SpaceEntryPersonalImpact.find.mock.calls[0]
        expect(filter.status.$in).toEqual(['linked', 'pending', 'needs_review'])
    })

    it('soporta legacy linkedTransactionId si pertenece al usuario actual', async () => {
        const spaceId = new Types.ObjectId()
        const userId = new Types.ObjectId()
        const participantId = new Types.ObjectId()
        const entryId = new Types.ObjectId()
        const transactionId = new Types.ObjectId()
        const participants = [
            participant({ _id: participantId, userId, displayName: 'Yo' }),
        ]
        const legacyEntry = entry({
            _id: entryId,
            spaceId,
            status: 'linked',
            linkedTransactionId: transactionId,
            paidByParticipantId: participantId,
            sharedWithParticipantIds: [participantId],
            confirmedByUserId: userId,
        })

        const result = await getPersonalImpactForEntries(
            spaceId.toString(),
            userId.toString(),
            [entryId.toString()],
            [legacyEntry],
            participants
        )

        expect(result[entryId.toString()].linkedImpact?.transactionId?.toString()).toBe(transactionId.toString())
        expect(result[entryId.toString()].linkedImpact?.status).toBe('linked')
    })
})

describe('upsertLinkedPersonalImpact', () => {
    const baseParams = {
        spaceId: new Types.ObjectId().toString(),
        entryId: new Types.ObjectId().toString(),
        userId: new Types.ObjectId().toString(),
        participantId: new Types.ObjectId().toString(),
        impactKind: 'participant_share' as const,
        actionType: 'impact_space_expense' as const,
        transactionId: new Types.ObjectId().toString(),
        accountId: new Types.ObjectId().toString(),
        categoryId: new Types.ObjectId().toString(),
        amount: 500,
        currency: 'ARS',
    }

    it('si existe pending con actionType pasa a linked y resuelve notificación', async () => {
        const pending = impact({ _id: new Types.ObjectId(), status: 'linked' })
        mocks.SpaceEntryPersonalImpact.findOneAndUpdate.mockReturnValue(mocks.makeLean(pending))

        const result = await upsertLinkedPersonalImpact(baseParams)

        expect(result).toBe(pending)
        const [filter, update] = mocks.SpaceEntryPersonalImpact.findOneAndUpdate.mock.calls[0]
        expect(filter).toMatchObject({
            userId: baseParams.userId,
            entryId: baseParams.entryId,
            actionType: 'impact_space_expense',
            status: 'pending',
        })
        expect(update.$set.status).toBe('linked')
        expect(update.$set.transactionId.toString()).toBe(baseParams.transactionId)
        expect(update.$set.accountId.toString()).toBe(baseParams.accountId)
        expect(update.$set.categoryId.toString()).toBe(baseParams.categoryId)
        expect(mocks.resolveNotificationsForTarget).toHaveBeenCalledWith({
            recipientUserId: baseParams.userId,
            pendingActionId: pending._id.toString(),
            actionStatus: 'completed',
        })
    })

    it('si ya existe linked retorna existente y no duplica', async () => {
        const linked = impact({ status: 'linked' })
        mocks.SpaceEntryPersonalImpact.findOne.mockReturnValue(mocks.makeLean(linked))

        const result = await upsertLinkedPersonalImpact(baseParams)

        expect(result).toBe(linked)
        expect(mocks.SpaceEntryPersonalImpact.create).not.toHaveBeenCalled()
    })

    it('si no existe pending ni linked crea un linked vigente único por userId + entryId', async () => {
        await upsertLinkedPersonalImpact(baseParams)

        expect(mocks.SpaceEntryPersonalImpact.create).toHaveBeenCalledOnce()
        const created = mocks.SpaceEntryPersonalImpact.create.mock.calls[0][0]
        expect(created.status).toBe('linked')
        expect(created.userId).toBe(baseParams.userId)
        expect(created.entryId).toBe(baseParams.entryId)
        expect(created.transactionId.toString()).toBe(baseParams.transactionId)
    })
})

describe('markLinkedImpactsAsNeedsReview', () => {
    it('marca linked como needs_review y conserva transaction/account/category por no incluir unset', async () => {
        const entryId = new Types.ObjectId().toString()
        const linked = impact({
            status: 'linked',
            transactionId: new Types.ObjectId(),
            accountId: new Types.ObjectId(),
            categoryId: new Types.ObjectId(),
        })
        mocks.SpaceEntryPersonalImpact.find.mockReturnValue(mocks.makeLean([linked]))

        const result = await markLinkedImpactsAsNeedsReview(entryId, 'entry_edited', ['monto'])

        expect(result).toEqual([linked])
        const [filter, update] = mocks.SpaceEntryPersonalImpact.updateMany.mock.calls[0]
        expect(filter).toEqual({ entryId, status: 'linked' })
        expect(update.$set.status).toBe('needs_review')
        expect(update.$set.reviewReason).toBe('entry_edited')
        expect(update.$set.reviewRequestedAt).toBeInstanceOf(Date)
        expect(update.$set.reviewChangedFields).toEqual(['monto'])
        expect(update.$unset).toBeUndefined()
    })

    it('no afecta pending, removed, ignored ni cancelled porque filtra status linked', async () => {
        const entryId = new Types.ObjectId().toString()

        await markLinkedImpactsAsNeedsReview(entryId, 'entry_voided')

        const [findFilter] = mocks.SpaceEntryPersonalImpact.find.mock.calls[0]
        expect(findFilter).toEqual({ entryId, status: 'linked' })
        expect(mocks.SpaceEntryPersonalImpact.updateMany).not.toHaveBeenCalled()
    })
})
