import { describe, expect, it } from 'vitest'
import {
    resolveCurrentUserEntryShare,
    resolveSuggestedImpactKind,
} from '@/lib/server/space-personal-impact'
import type { ISpaceEntry, ISpaceParticipant } from '@/types'

function participant(overrides: Record<string, unknown>): ISpaceParticipant {
    return {
        _id: 'participant-id',
        spaceId: 'space-id',
        kind: 'finp_user',
        userId: 'user-id',
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
        status: 'confirmed',
        title: 'Cena',
        amount: 100,
        currency: 'ARS',
        reportingAmount: 100,
        date: new Date('2026-04-10'),
        paidByParticipantId: 'participant-gonzalo',
        sharedWithParticipantIds: ['participant-gonzalo', 'participant-roro'],
        splitMode: 'equal',
        confirmationRequired: false,
        createdAt: new Date('2026-04-10'),
        updatedAt: new Date('2026-04-10'),
        ...overrides,
    } as unknown as ISpaceEntry
}

describe('space personal impact helpers', () => {
    const participants = [
        participant({ _id: 'participant-gonzalo', userId: 'user-gonzalo', displayName: 'Gonzalo' }),
        participant({ _id: 'participant-roro', userId: 'user-roro', displayName: 'Roro' }),
    ]

    it('sugiere monto completo para el pagador', () => {
        const result = resolveCurrentUserEntryShare(entry({ amount: 120, reportingAmount: 120 }), participants, 'user-gonzalo')

        expect(result?.impactKind).toBe('payer_full_amount')
        expect(result?.amount).toBe(120)
    })

    it('sugiere la parte del participante no pagador', () => {
        const result = resolveCurrentUserEntryShare(entry({ amount: 120, reportingAmount: 120 }), participants, 'user-roro')

        expect(result?.impactKind).toBe('participant_share')
        expect(result?.amount).toBe(60)
    })

    it('devuelve null si el participante no tiene share sugerible', () => {
        const result = resolveCurrentUserEntryShare(
            entry({
                sharedWithParticipantIds: ['participant-gonzalo'],
                splitMode: 'none',
            }),
            participants,
            'user-roro'
        )

        expect(result).toBeNull()
    })

    it('distingue pagador y receptor en settlements', () => {
        const settlement = entry({
            type: 'settlement',
            amount: 80,
            reportingAmount: 80,
            paidByParticipantId: 'participant-roro',
            sharedWithParticipantIds: ['participant-gonzalo'],
            splitMode: 'none',
        })

        expect(resolveSuggestedImpactKind(settlement, 'participant-roro')).toBe('settlement_paid')
        expect(resolveSuggestedImpactKind(settlement, 'participant-gonzalo')).toBe('settlement_received')
    })
})
