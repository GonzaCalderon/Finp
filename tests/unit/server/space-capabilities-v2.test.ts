import { describe, expect, it } from 'vitest'

import {
    assertOwnerContinuityV2,
    getSpaceCapabilitiesV2,
} from '@/lib/server/space-capabilities'

describe('space capabilities v2', () => {
    it('participante activo registra gastos y sólo administra su impacto', () => {
        const capabilities = getSpaceCapabilitiesV2({
            status: 'active', role: 'participant', isActiveParticipant: true, isOwnerRecord: false,
        })
        expect(capabilities.has('create_entry')).toBe(true)
        expect(capabilities.has('resolve_personal_impact')).toBe(true)
        expect(capabilities.has('manage_shared_settings')).toBe(false)
    })

    it('cerrado permite liquidar y revisar, pero no crear ni editar', () => {
        const capabilities = getSpaceCapabilitiesV2({
            status: 'closed', role: 'admin', isActiveParticipant: true, isOwnerRecord: false,
        })
        expect(capabilities.has('settle_balance')).toBe(true)
        expect(capabilities.has('resolve_personal_impact')).toBe(true)
        expect(capabilities.has('create_entry')).toBe(false)
        expect(capabilities.has('edit_any_entry')).toBe(false)
    })

    it('archivado es sólo lectura y sólo owner puede restaurar', () => {
        const owner = getSpaceCapabilitiesV2({
            status: 'archived', role: 'owner', isActiveParticipant: true, isOwnerRecord: true,
        })
        const admin = getSpaceCapabilitiesV2({
            status: 'archived', role: 'admin', isActiveParticipant: true, isOwnerRecord: false,
        })
        expect([...owner]).toEqual(expect.arrayContaining(['view', 'restore_space', 'transfer_ownership']))
        expect(owner.has('resolve_personal_impact')).toBe(false)
        expect(admin.has('restore_space')).toBe(false)
    })

    it('impide dejar el Espacio sin owner salvo transferencia atómica', () => {
        expect(() => assertOwnerContinuityV2({
            activeOwnerCount: 1,
            removesOwner: true,
            transfersToOwnerInSameOperation: false,
        })).toThrow('último owner')
        expect(() => assertOwnerContinuityV2({
            activeOwnerCount: 1,
            removesOwner: true,
            transfersToOwnerInSameOperation: true,
        })).not.toThrow()
    })
})
