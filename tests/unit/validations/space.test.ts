import { describe, expect, it } from 'vitest'
import {
    spaceEntrySchema,
    spaceInviteLinkSchema,
    spaceParticipantSchema,
    spacePersonalSettingsSchema,
    spaceSchema,
} from '@/lib/validations/space'

const PARTICIPANT_A = '507f1f77bcf86cd799439011'
const PARTICIPANT_B = '507f1f77bcf86cd799439012'

describe('spaceSchema', () => {
    it('rechaza un espacio solo con split por defecto distinto de none', () => {
        const result = spaceSchema.safeParse({
            name: 'Viaje solo',
            type: 'travel',
            mode: 'solo',
            status: 'active',
            currencies: ['ARS'],
            reportingCurrency: 'ARS',
            defaultSplitMode: 'equal',
        })

        expect(result.success).toBe(false)
    })

    it('acepta un espacio sincronizado multi-moneda con moneda de reporte incluida', () => {
        const result = spaceSchema.safeParse({
            name: 'Chile abril 2026',
            type: 'travel',
            mode: 'synchronized',
            status: 'active',
            currencies: ['ARS', 'USD'],
            reportingCurrency: 'USD',
            defaultSplitMode: 'equal',
        })

        expect(result.success).toBe(true)
    })
})

describe('spaceParticipantSchema', () => {
    it('requiere email cuando el participante es un usuario Finp', () => {
        const result = spaceParticipantSchema.safeParse({
            kind: 'finp_user',
            displayName: 'Roro',
            role: 'participant',
        })

        expect(result.success).toBe(false)
    })

    it('acepta participantes externos sin email', () => {
        const result = spaceParticipantSchema.safeParse({
            kind: 'external',
            displayName: 'Proveedor',
            role: 'participant',
        })

        expect(result.success).toBe(true)
    })
})

describe('spaceInviteLinkSchema', () => {
    it('acepta duraciones cerradas entre 1 y 7 dias', () => {
        expect(spaceInviteLinkSchema.safeParse({ expiresInDays: 1 }).success).toBe(true)
        expect(spaceInviteLinkSchema.safeParse({ expiresInDays: 3 }).success).toBe(true)
        expect(spaceInviteLinkSchema.safeParse({ expiresInDays: 7 }).success).toBe(true)
        expect(spaceInviteLinkSchema.safeParse({ expiresInDays: 9 }).success).toBe(false)
    })
})

describe('spacePersonalSettingsSchema', () => {
    it('manual no requiere categorias personales', () => {
        const result = spacePersonalSettingsSchema.safeParse({
            categoryStrategy: 'manual',
        })

        expect(result.success).toBe(true)
    })

    it('fixed_personal_category requiere categoria fija', () => {
        const result = spacePersonalSettingsSchema.safeParse({
            categoryStrategy: 'fixed_personal_category',
        })

        expect(result.success).toBe(false)
    })
})

describe('spaceEntrySchema', () => {
    it('rechaza splits porcentuales que no suman 100%', () => {
        const result = spaceEntrySchema.safeParse({
            type: 'expense',
            title: 'Cena',
            amount: 100,
            currency: 'ARS',
            date: new Date('2026-04-10'),
            paidByParticipantId: PARTICIPANT_A,
            splitMode: 'percentage',
            sharedWithParticipantIds: [PARTICIPANT_A, PARTICIPANT_B],
            splitAllocations: [
                { participantId: PARTICIPANT_A, percentage: 70 },
                { participantId: PARTICIPANT_B, percentage: 20 },
            ],
        })

        expect(result.success).toBe(false)
    })

    it('acepta liquidaciones con splitMode none y un receptor', () => {
        const result = spaceEntrySchema.safeParse({
            type: 'settlement',
            title: 'Pago de B a A',
            amount: 50,
            currency: 'ARS',
            date: new Date('2026-04-15'),
            paidByParticipantId: PARTICIPANT_B,
            splitMode: 'none',
            sharedWithParticipantIds: [PARTICIPANT_A],
        })

        expect(result.success).toBe(true)
    })

    it('rechaza liquidación sin pagador', () => {
        const result = spaceEntrySchema.safeParse({
            type: 'settlement',
            title: 'Pago',
            amount: 50,
            currency: 'ARS',
            date: new Date('2026-04-15'),
            splitMode: 'none',
            sharedWithParticipantIds: [PARTICIPANT_A],
        })

        expect(result.success).toBe(false)
    })

    it('rechaza liquidación sin receptor', () => {
        const result = spaceEntrySchema.safeParse({
            type: 'settlement',
            title: 'Pago',
            amount: 50,
            currency: 'ARS',
            date: new Date('2026-04-15'),
            paidByParticipantId: PARTICIPANT_B,
            splitMode: 'none',
            sharedWithParticipantIds: [],
        })

        expect(result.success).toBe(false)
    })

    it('rechaza liquidación con pagador igual al receptor', () => {
        const result = spaceEntrySchema.safeParse({
            type: 'settlement',
            title: 'Pago',
            amount: 50,
            currency: 'ARS',
            date: new Date('2026-04-15'),
            paidByParticipantId: PARTICIPANT_A,
            splitMode: 'none',
            sharedWithParticipantIds: [PARTICIPANT_A],
        })

        expect(result.success).toBe(false)
    })
})
