import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    debtFind: vi.fn(),
    debtCreate: vi.fn(),
    debtUpdateOne: vi.fn(),
    movementCreate: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    Debt: {
        find: mocks.debtFind,
        create: mocks.debtCreate,
        updateOne: mocks.debtUpdateOne,
    },
    DebtMovement: { create: mocks.movementCreate },
}))

import { materializeSpaceDebtsV2 } from '@/lib/server/space-debt-materialization-v2'
import type { ISpace, ISpaceEntry, ISpaceParticipant } from '@/types'

const spaceId = new Types.ObjectId()
const userA = new Types.ObjectId()
const userB = new Types.ObjectId()
const participantA = new Types.ObjectId()
const participantB = new Types.ObjectId()
const operationId = new Types.ObjectId()
const session = {} as never

const space = {
    _id: spaceId,
    contractVersion: 2,
    reportingCurrency: 'ARS',
    debtMode: 'direct',
    revision: 4,
} as ISpace

const participants = [
    {
        _id: participantA, spaceId, userId: userA, kind: 'finp_user', displayName: 'A',
        role: 'owner', inviteStatus: 'accepted', isActive: true,
    },
    {
        _id: participantB, spaceId, userId: userB, kind: 'finp_user', displayName: 'B',
        role: 'participant', inviteStatus: 'accepted', isActive: true,
    },
] as ISpaceParticipant[]

function entry(input: Partial<ISpaceEntry>): ISpaceEntry {
    return {
        _id: new Types.ObjectId(),
        spaceId,
        contractVersion: 2,
        createdByUserId: userA,
        type: 'expense',
        status: 'recorded',
        title: 'Movimiento',
        amount: 100,
        reportingAmount: 100,
        currency: 'ARS',
        date: new Date(),
        dateKey: '2026-08-24',
        timezone: 'America/Argentina/Buenos_Aires',
        paidByParticipantId: participantA,
        sharedWithParticipantIds: [participantB],
        splitMode: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
    }
}

function findResult(value: unknown[]) {
    return { session: vi.fn().mockResolvedValue(value) }
}

describe('space debt materialization v2', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.debtFind.mockReturnValue(findResult([]))
        mocks.debtCreate.mockImplementation(async ([data]: [Record<string, unknown>]) => [{
            _id: new Types.ObjectId(), ...data,
        }])
        mocks.debtUpdateOne.mockResolvedValue({ modifiedCount: 1 })
        mocks.movementCreate.mockImplementation(async ([data]: [Record<string, unknown>]) => [{
            _id: new Types.ObjectId(), ...data,
        }])
    })

    it('usa el balance que ya contiene settlement y no descuenta pagos otra vez', async () => {
        const debtId = new Types.ObjectId()
        const keyA = `${userA}:${spaceId}:${participantB}:ARS:direct`
        const keyB = `${userB}:${spaceId}:${participantA}:ARS:direct`
        mocks.debtFind.mockReturnValue(findResult([
            {
                _id: debtId,
                userId: userA,
                spaceDebtKey: keyA,
                amount: 100,
                remainingAmount: 60,
                direction: 'receivable',
                counterpartyNameSnapshot: 'B',
                status: 'partially_paid',
            },
            {
                _id: new Types.ObjectId(),
                userId: userB,
                spaceDebtKey: keyB,
                amount: 100,
                remainingAmount: 60,
                direction: 'payable',
                counterpartyNameSnapshot: 'A',
                status: 'partially_paid',
            },
        ]))
        const entries = [
            entry({}),
            entry({
                type: 'settlement',
                amount: 40,
                reportingAmount: 40,
                paidByParticipantId: participantB,
                sharedWithParticipantIds: [participantA],
            }),
        ]

        const result = await materializeSpaceDebtsV2({
            space, participants, entries, operationId, session,
        })

        expect(mocks.debtUpdateOne).toHaveBeenCalledWith(
            { _id: debtId, contractVersion: 2 },
            expect.objectContaining({
                $set: expect.objectContaining({ amount: 60, remainingAmount: 60 }),
            }),
            { session }
        )
        expect(result.created).toBe(0)
        expect(result.updated).toBe(0)
        expect(mocks.movementCreate).not.toHaveBeenCalled()
    })

    it('cierra relaciones que ya no tienen saldo sin dejar deuda activa en cero', async () => {
        const debtId = new Types.ObjectId()
        mocks.debtFind.mockReturnValue(findResult([{
            _id: debtId,
            userId: userA,
            spaceDebtKey: `${userA}:${spaceId}:${participantB}:ARS:direct`,
            amount: 100,
            remainingAmount: 100,
            direction: 'receivable',
            counterpartyNameSnapshot: 'B',
            status: 'active',
            currency: 'ARS',
        }]))
        const result = await materializeSpaceDebtsV2({
            space,
            participants,
            entries: [
                entry({}),
                entry({
                    type: 'settlement', amount: 100, reportingAmount: 100,
                    paidByParticipantId: participantB, sharedWithParticipantIds: [participantA],
                }),
            ],
            operationId,
            session,
        })
        expect(mocks.debtUpdateOne).toHaveBeenCalledWith(
            { _id: debtId, contractVersion: 2 },
            expect.objectContaining({ $set: expect.objectContaining({ remainingAmount: 0, status: 'paid' }) }),
            { session }
        )
        expect(result.settled).toBe(1)
    })
})
