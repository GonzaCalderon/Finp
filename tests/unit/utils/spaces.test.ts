import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'
import { buildEntryShares, buildSpaceBalances, buildSpaceSummary, extractId } from '@/lib/utils/spaces'
import { simplifyDebts } from '@/lib/utils/space-debts'
import type { ISpace, ISpaceEntry, ISpaceParticipant, SpaceBalanceItem } from '@/types'

describe('extractId', () => {
    it('acepta string, ObjectId y documentos poblados priorizando _id', () => {
        const objectId = new Types.ObjectId()
        const populated = {
            _id: objectId,
            toString: () => 'Documento poblado completo',
        }

        expect(extractId(objectId.toString())).toBe(objectId.toString())
        expect(extractId(objectId)).toBe(objectId.toString())
        expect(extractId(populated)).toBe(objectId.toString())
    })

    it('rechaza valores nulos, vacios y objetos sin identidad', () => {
        expect(extractId(null)).toBeUndefined()
        expect(extractId('   ')).toBeUndefined()
        expect(extractId({ toString: () => 'objeto completo' })).toBeUndefined()
    })
})

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

describe('buildEntryShares — settlements', () => {
    const participants = [
        participant({ _id: 'p-gonzalo', displayName: 'Gonzalo' }),
        participant({ _id: 'p-roro', displayName: 'Roro' }),
    ]

    it('settlement: registra share en el receptor', () => {
        const shares = buildEntryShares(
            entry({
                type: 'settlement',
                amount: 60000,
                reportingAmount: 60000,
                paidByParticipantId: 'p-roro',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-gonzalo'],
            }),
            participants
        )
        expect(shares).toEqual([{ participantId: 'p-gonzalo', amount: 60000, reportingAmount: 60000 }])
    })

    it('settlement parcial: solo registra el monto pagado', () => {
        const shares = buildEntryShares(
            entry({
                type: 'settlement',
                amount: 40000,
                reportingAmount: 40000,
                paidByParticipantId: 'p-roro',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-gonzalo'],
            }),
            participants
        )
        expect(shares).toEqual([{ participantId: 'p-gonzalo', amount: 40000, reportingAmount: 40000 }])
    })
})

describe('buildSpaceBalances — settlements', () => {
    const participants = [
        participant({ _id: 'p-gonzalo', userId: 'u-gonzalo', displayName: 'Gonzalo' }),
        participant({ _id: 'p-roro', userId: 'u-roro', displayName: 'Roro' }),
    ]

    it('settlement parcial reduce la deuda correctamente', () => {
        const entries = [
            entry({
                amount: 100000,
                reportingAmount: 100000,
                paidByParticipantId: 'p-gonzalo',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-roro'],
            }),
            entry({
                type: 'settlement',
                amount: 40000,
                reportingAmount: 40000,
                paidByParticipantId: 'p-roro',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-gonzalo'],
            }),
        ]
        const balances = buildSpaceBalances(entries, participants)
        const gonzalo = balances.find((b) => b.participantId === 'p-gonzalo')
        const roro = balances.find((b) => b.participantId === 'p-roro')
        expect(gonzalo?.balanceReporting).toBe(60000)
        expect(roro?.balanceReporting).toBe(-60000)
    })

    it('settlement total deja balances en 0', () => {
        const entries = [
            entry({
                amount: 100000,
                reportingAmount: 100000,
                paidByParticipantId: 'p-gonzalo',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-roro'],
            }),
            entry({
                type: 'settlement',
                amount: 100000,
                reportingAmount: 100000,
                paidByParticipantId: 'p-roro',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-gonzalo'],
            }),
        ]
        const balances = buildSpaceBalances(entries, participants)
        expect(balances.every((b) => b.balanceReporting === 0)).toBe(true)
    })

    it('settlement pending_confirmation no reduce balances', () => {
        const entries = [
            entry({
                amount: 100000,
                reportingAmount: 100000,
                paidByParticipantId: 'p-gonzalo',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-roro'],
            }),
            entry({
                type: 'settlement',
                status: 'pending_confirmation',
                amount: 100000,
                reportingAmount: 100000,
                paidByParticipantId: 'p-roro',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-gonzalo'],
            }),
        ]
        const balances = buildSpaceBalances(entries, participants)
        const gonzalo = balances.find((b) => b.participantId === 'p-gonzalo')
        const roro = balances.find((b) => b.participantId === 'p-roro')
        expect(gonzalo?.balanceReporting).toBe(100000)
        expect(roro?.balanceReporting).toBe(-100000)
    })

    it('entry rechazado no afecta balances', () => {
        const entries = [
            entry({
                amount: 50000,
                reportingAmount: 50000,
                status: 'rejected',
                paidByParticipantId: 'p-gonzalo',
                splitMode: 'none',
                sharedWithParticipantIds: ['p-roro'],
            }),
        ]
        const balances = buildSpaceBalances(entries, participants)
        expect(balances.every((b) => b.balanceReporting === 0)).toBe(true)
    })
})

function balance(participantId: string, balanceReporting: number): SpaceBalanceItem {
    return {
        participantId,
        displayName: participantId,
        kind: 'finp_user',
        role: 'participant',
        inviteStatus: 'accepted',
        paidReporting: 0,
        shareReporting: 0,
        balanceReporting,
    }
}

describe('simplifyDebts', () => {
    it('dos participantes directos', () => {
        const payments = simplifyDebts([balance('A', 100), balance('B', -100)])
        expect(payments).toEqual([{ fromParticipantId: 'B', toParticipantId: 'A', amount: 100 }])
    })

    it('tres participantes con deuda circular A→B $10, B→C $10 → A paga $10 a C', () => {
        // A pagó todo, B y C deben
        // A: +20, B: -10, C: -10
        const payments = simplifyDebts([balance('A', 20), balance('B', -10), balance('C', -10)])
        expect(payments).toHaveLength(2)
        expect(payments[0]).toMatchObject({ fromParticipantId: 'B', toParticipantId: 'A', amount: 10 })
        expect(payments[1]).toMatchObject({ fromParticipantId: 'C', toParticipantId: 'A', amount: 10 })
    })

    it('simplifica: A debe a B $10, B debe a C $10 → A paga $10 a C', () => {
        // A: -10, B: 0, C: +10
        const payments = simplifyDebts([balance('A', -10), balance('B', 0), balance('C', 10)])
        expect(payments).toEqual([{ fromParticipantId: 'A', toParticipantId: 'C', amount: 10 }])
    })

    it('pagos menores a 0.01 se ignoran', () => {
        const payments = simplifyDebts([balance('A', 0.005), balance('B', -0.005)])
        expect(payments).toHaveLength(0)
    })

    it('participante con balance 0 no genera pagos', () => {
        const payments = simplifyDebts([balance('A', 0), balance('B', 0)])
        expect(payments).toHaveLength(0)
    })

    it('redondeo a 2 decimales', () => {
        const payments = simplifyDebts([balance('A', 33.337), balance('B', -33.337)])
        expect(payments[0]?.amount).toBe(33.34)
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
                spaceCategoryId: { _id: 'cat-food', name: 'Alimentos', color: '#10B981' },
            }),
            entry({
                _id: 'entry-expense-roro',
                amount: 40,
                reportingAmount: 40,
                paidByParticipantId: 'participant-roro',
                splitMode: 'none',
                spaceCategoryId: { _id: 'cat-home', name: 'Hogar', color: '#3B82F6' },
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
