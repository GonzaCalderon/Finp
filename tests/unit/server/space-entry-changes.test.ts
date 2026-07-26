import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'
import { detectSpaceEntryMaterialChanges } from '@/lib/server/space-entry-changes'
import { buildSpaceEntry } from '../../helpers/factories'

describe('detectSpaceEntryMaterialChanges', () => {
    const payerId = new Types.ObjectId()
    const participantAId = new Types.ObjectId()
    const participantBId = new Types.ObjectId()

    const baseEntry = buildSpaceEntry({
        amount: 1000,
        currency: 'ARS',
        exchangeRate: undefined,
        date: new Date('2026-05-10T00:00:00.000Z'),
        paidByParticipantId: payerId,
        sharedWithParticipantIds: [participantAId, participantBId],
        splitMode: 'equal',
        splitAllocations: [
            { participantId: participantAId, percentage: 50 },
            { participantId: participantBId, percentage: 50 },
        ],
        title: 'Cena',
        description: 'Descripcion vieja',
        notes: 'Notas viejas',
    })

    it('title, description y notes no son materiales', () => {
        const result = detectSpaceEntryMaterialChanges(baseEntry, {})

        expect(result).toEqual({
            isMaterial: false,
            changedFields: [],
            changedLabels: [],
        })
    })

    it('detecta amount, currency, exchangeRate y date como materiales', () => {
        const result = detectSpaceEntryMaterialChanges(baseEntry, {
            amount: 1200,
            currency: 'USD',
            exchangeRate: 1100,
            date: '2026-05-11T00:00:00.000Z',
        })

        expect(result.isMaterial).toBe(true)
        expect(result.changedFields).toEqual(['amount', 'currency', 'exchangeRate', 'date'])
        expect(result.changedLabels).toEqual(['monto', 'moneda', 'cotización', 'fecha'])
    })

    it('detecta pagador, participantes, splitMode y splitAllocations como materiales', () => {
        const nextPayerId = new Types.ObjectId()
        const result = detectSpaceEntryMaterialChanges(baseEntry, {
            paidByParticipantId: nextPayerId.toString(),
            sharedWithParticipantIds: [participantAId.toString()],
            splitMode: 'fixed',
            splitAllocations: [
                { participantId: participantAId.toString(), amount: 700 },
                { participantId: participantBId.toString(), amount: 300 },
            ],
        })

        expect(result.changedFields).toEqual([
            'paidByParticipantId',
            'splitMode',
            'sharedWithParticipantIds',
            'splitAllocations',
        ])
        expect(result.changedLabels).toEqual([
            'pagador',
            'modo de división',
            'participantes',
            'división',
        ])
    })

    it('no marca arrays como distintos si solo cambia el orden', () => {
        const result = detectSpaceEntryMaterialChanges(baseEntry, {
            sharedWithParticipantIds: [participantBId.toString(), participantAId.toString()],
            splitAllocations: [
                { participantId: participantBId.toString(), percentage: 50 },
                { participantId: participantAId.toString(), percentage: 50 },
            ],
        })

        expect(result.isMaterial).toBe(false)
    })

    // Qué pasa con los pendientes cuando el cambio es material —monto nuevo,
    // participante removido o agregado— se verifica en `pending-actions-sync.test.ts`:
    // esta función sólo detecta el cambio, no decide sus consecuencias.
})
