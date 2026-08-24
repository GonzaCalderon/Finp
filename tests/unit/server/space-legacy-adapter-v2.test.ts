import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'

import {
    SpaceLegacyAdapterError,
    adaptPersonalImpactToV2,
    adaptSpaceDebtBalanceV2,
    adaptSpaceEntryToV2,
    selectCanonicalPersonalImpact,
} from '@/lib/server/space-legacy-adapter'
import type { ISpace, ISpaceEntry, ISpaceEntryPersonalImpact, ISpaceParticipant } from '@/types'
import type { IDebt } from '@/types/debt'

const ids = {
    space: new Types.ObjectId(),
    owner: new Types.ObjectId(),
    entry: new Types.ObjectId(),
    payer: new Types.ObjectId(),
    participant: new Types.ObjectId(),
    payerUser: new Types.ObjectId(),
    participantUser: new Types.ObjectId(),
}

function space(overrides: Partial<ISpace> = {}): ISpace {
    return {
        _id: ids.space,
        ownerUserId: ids.owner,
        name: 'Viaje',
        type: 'travel',
        mode: 'managed',
        status: 'active',
        currencies: ['ARS'],
        reportingCurrency: 'ARS',
        defaultSplitMode: 'equal',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
        ...overrides,
    }
}

const participants: ISpaceParticipant[] = [
    {
        _id: ids.payer, spaceId: ids.space, kind: 'finp_user', userId: ids.payerUser,
        displayName: 'Paga', role: 'owner', inviteStatus: 'accepted', isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
    },
    {
        _id: ids.participant, spaceId: ids.space, kind: 'finp_user', userId: ids.participantUser,
        displayName: 'Participa', role: 'participant', inviteStatus: 'accepted', isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
    },
]

function entry(overrides: Partial<ISpaceEntry> = {}): ISpaceEntry {
    return {
        _id: ids.entry,
        spaceId: ids.space,
        createdByUserId: ids.payerUser,
        type: 'expense',
        status: 'linked',
        title: 'Cena',
        amount: 100,
        currency: 'ARS',
        reportingAmount: 100,
        date: new Date('2026-08-24T02:00:00Z'),
        paidByParticipantId: ids.payer,
        sharedWithParticipantIds: [ids.payer, ids.participant],
        splitMode: 'equal',
        createdAt: new Date('2026-08-24T02:00:00Z'),
        updatedAt: new Date('2026-08-24T02:00:00Z'),
        ...overrides,
    }
}

function impact(overrides: Partial<ISpaceEntryPersonalImpact> = {}): ISpaceEntryPersonalImpact {
    return {
        _id: new Types.ObjectId(),
        spaceId: ids.space,
        entryId: ids.entry,
        userId: ids.payerUser,
        participantId: ids.payer,
        impactKind: 'payer_full_amount',
        amount: 100,
        currency: 'ARS',
        status: 'linked',
        createdAt: new Date('2026-08-24T02:00:00Z'),
        updatedAt: new Date('2026-08-24T02:00:00Z'),
        ...overrides,
    }
}

describe('space legacy adapter v2', () => {
    it('normaliza estado compartido y usa la zona del owner sin adoptar vínculos globales', () => {
        const adapted = adaptSpaceEntryToV2({
            space: space(),
            entry: entry({ linkedTransactionId: new Types.ObjectId(), confirmedByUserId: ids.payerUser }),
            participants,
            ownerTimezone: 'America/Argentina/Buenos_Aires',
        })
        expect(adapted.entry.status).toBe('recorded')
        expect(adapted.entry.dateKey).toBe('2026-08-23')
        expect(adapted.entry).not.toHaveProperty('linkedTransactionId')
        expect(adapted.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
            'LEGACY_TIMEZONE_FROM_OWNER',
            'LEGACY_ENTRY_STATUS_NORMALIZED',
        ]))
    })

    it('falla tipado si ni el Espacio ni su owner aportan zona horaria', () => {
        expect(() => adaptSpaceEntryToV2({ space: space(), entry: entry(), participants }))
            .toThrow(SpaceLegacyAdapterError)
    })

    it('recomputa gasto propio, salida y adelanto sin confiar en amount legacy', () => {
        const adaptedEntry = adaptSpaceEntryToV2({
            space: space({ timezone: 'America/Argentina/Buenos_Aires' }),
            entry: entry(),
            participants,
        }).entry
        const adaptedImpact = adaptPersonalImpactToV2({
            impact: impact({ amount: 999_999 }),
            entry: adaptedEntry,
        })
        expect(adaptedImpact.impact).toMatchObject({
            kind: 'personal_expense',
            ownShareAmount: 50,
            accountImpactAmount: 100,
            operationalAmount: 50,
            recoverableAdvanceAmount: 50,
        })
        expect(adaptedImpact.warnings[0]?.code).toBe('LEGACY_IMPACT_AMOUNT_RECOMPUTED')
    })

    it('elige duplicados con precedencia estable por estado, fecha e id', () => {
        const olderReview = impact({ status: 'needs_review', updatedAt: new Date('2026-08-20T00:00:00Z') })
        const newerLinked = impact({ status: 'linked', updatedAt: new Date('2026-08-25T00:00:00Z') })
        const result = selectCanonicalPersonalImpact([newerLinked, olderReview])
        expect(result.impact?._id.toString()).toBe(olderReview._id.toString())
        expect(result.warnings).toHaveLength(1)
    })

    it('expone el saldo calculado como autoridad y marca deriva de deuda', () => {
        const debt = {
            _id: new Types.ObjectId(),
            remainingAmount: 60,
        } as IDebt
        expect(adaptSpaceDebtBalanceV2({ debt, calculatedBalance: 60 })).toMatchObject({
            consistent: true, delta: 0,
        })
        expect(adaptSpaceDebtBalanceV2({ debt, calculatedBalance: 20 })).toMatchObject({
            consistent: false, delta: 40,
        })
    })
})
