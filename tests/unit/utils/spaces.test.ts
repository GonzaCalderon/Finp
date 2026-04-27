import { describe, expect, it } from 'vitest'
import { buildEntryShares, buildSpaceSummary } from '@/lib/utils/spaces'
import type { ISpace, ISpaceEntry, ISpaceParticipant } from '@/types'

function participant(overrides: Record<string, unknown>): ISpaceParticipant {
    return {
        _id: 'participant-id',
        spaceId: 'space-id',
        kind: 'finp_user',
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
        _id: 'entry-id',
        spaceId: 'space-id',
        createdByUserId: 'user-gonzalo',
        createdByParticipantId: 'participant-gonzalo',
        type: 'expense',
        status: 'linked',
        title: 'Movimiento',
        amount: 0,
        currency: 'ARS',
        reportingAmount: 0,
        date: new Date('2026-04-10'),
        splitMode: 'none',
        confirmationRequired: false,
        createdAt: new Date('2026-04-10'),
        updatedAt: new Date('2026-04-10'),
        ...overrides,
    } as unknown as ISpaceEntry
}

function space(overrides: Record<string, unknown>): ISpace {
    return {
        _id: 'space-id',
        ownerUserId: 'user-gonzalo',
        name: 'Casa con Roro',
        type: 'home',
        mode: 'synchronized',
        status: 'active',
        currencies: ['ARS'],
        reportingCurrency: 'ARS',
        defaultSplitMode: 'equal',
        createdAt: new Date('2026-04-01'),
        updatedAt: new Date('2026-04-01'),
        ...overrides,
    } as unknown as ISpace
}

describe('buildEntryShares', () => {
    it('usa el responsable explicito cuando el split es none', () => {
        const participants = [
            participant({ _id: 'participant-gonzalo', displayName: 'Gonzalo' }),
            participant({ _id: 'participant-roro', displayName: 'Roro' }),
        ]

        const shares = buildEntryShares(
            entry({
                amount: 120,
                reportingAmount: 120,
                paidByParticipantId: 'participant-gonzalo',
                splitMode: 'none',
                sharedWithParticipantIds: ['participant-roro'],
            }),
            participants
        )

        expect(shares).toEqual([
            { participantId: 'participant-roro', amount: 120, reportingAmount: 120 },
        ])
    })

    it('usa el pagador como fallback en split none sin responsable explicito', () => {
        const participants = [
            participant({ _id: 'participant-gonzalo', displayName: 'Gonzalo' }),
            participant({ _id: 'participant-roro', displayName: 'Roro' }),
        ]

        const shares = buildEntryShares(
            entry({
                amount: 80,
                reportingAmount: 80,
                paidByParticipantId: 'participant-gonzalo',
                splitMode: 'none',
            }),
            participants
        )

        expect(shares).toEqual([
            { participantId: 'participant-gonzalo', amount: 80, reportingAmount: 80 },
        ])
    })

    it('mantiene saldado el gasto cuando pagador y responsable son iguales', () => {
        const participants = [
            participant({ _id: 'participant-gonzalo', displayName: 'Gonzalo' }),
            participant({ _id: 'participant-roro', displayName: 'Roro' }),
        ]

        const shares = buildEntryShares(
            entry({
                amount: 60,
                reportingAmount: 60,
                paidByParticipantId: 'participant-gonzalo',
                splitMode: 'none',
                sharedWithParticipantIds: ['participant-gonzalo'],
            }),
            participants
        )

        expect(shares).toEqual([
            { participantId: 'participant-gonzalo', amount: 60, reportingAmount: 60 },
        ])
    })

    it('reparte en partes iguales cuando el split es equal', () => {
        const participants = [
            participant({ _id: 'participant-gonzalo', displayName: 'Gonzalo' }),
            participant({ _id: 'participant-roro', displayName: 'Roro' }),
        ]

        const shares = buildEntryShares(
            entry({
                amount: 100,
                reportingAmount: 100,
                splitMode: 'equal',
                sharedWithParticipantIds: ['participant-gonzalo', 'participant-roro'],
            }),
            participants
        )

        expect(shares).toHaveLength(2)
        expect(shares[0]?.amount).toBe(50)
        expect(shares[1]?.amount).toBe(50)
    })
})

describe('buildSpaceSummary', () => {
    it('calcula balances y excluye liquidaciones del gasto total', () => {
        const participants = [
            participant({
                _id: 'participant-gonzalo',
                userId: 'user-gonzalo',
                displayName: 'Gonzalo',
                role: 'owner',
            }),
            participant({
                _id: 'participant-roro',
                userId: 'user-roro',
                displayName: 'Roro',
            }),
        ]

        const entries = [
            entry({
                _id: 'entry-expense-shared',
                amount: 100,
                reportingAmount: 100,
                paidByParticipantId: 'participant-gonzalo',
                splitMode: 'equal',
                sharedWithParticipantIds: ['participant-gonzalo', 'participant-roro'],
                categoryId: { _id: 'cat-food', name: 'Alimentos', color: '#10B981' },
            }),
            entry({
                _id: 'entry-expense-roro',
                amount: 40,
                reportingAmount: 40,
                paidByParticipantId: 'participant-roro',
                splitMode: 'none',
                categoryId: { _id: 'cat-home', name: 'Hogar', color: '#3B82F6' },
            }),
            entry({
                _id: 'entry-settlement',
                type: 'settlement',
                amount: 50,
                reportingAmount: 50,
                paidByParticipantId: 'participant-roro',
                splitMode: 'fixed',
                sharedWithParticipantIds: ['participant-gonzalo'],
                splitAllocations: [{ participantId: 'participant-gonzalo', amount: 50 }],
            }),
        ]

        const summary = buildSpaceSummary({
            space: space({}),
            entries,
            participants,
            currentUserId: 'user-gonzalo',
        })

        expect(summary.totalReporting).toBe(140)
        expect(summary.yourShareReporting).toBe(50)
        expect(summary.pendingToCollectReporting).toBe(0)
        expect(summary.pendingToPayReporting).toBe(0)
        expect(summary.categoryBreakdown).toHaveLength(2)
        expect(summary.balances[0]?.balanceReporting).toBe(0)
        expect(summary.balances[1]?.balanceReporting).toBe(0)
    })
})
