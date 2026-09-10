import { describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import type { ISpace, ISpaceParticipant } from '@/types'
import type { SpaceStatus } from '@/lib/constants'

vi.mock('@/lib/models', () => ({
    Space: { findById: vi.fn(), find: vi.fn() },
    SpaceEntry: { find: vi.fn() },
    SpaceInvite: { find: vi.fn() },
    SpaceParticipant: { find: vi.fn(), findOne: vi.fn() },
    User: { find: vi.fn() },
}))

vi.mock('@/lib/server/space-personal-impact', () => ({
    getPersonalImpactForEntries: vi.fn(),
}))

const { getContextCapabilities } = await import('@/lib/server/spaces')

function buildContext(input: {
    status: SpaceStatus
    role?: ISpaceParticipant['role']
    isActive?: boolean
    isOwner?: boolean
}) {
    const participantId = new Types.ObjectId()
    return {
        space: { status: input.status } as ISpace,
        currentParticipant: input.role
            ? ({
                _id: participantId,
                role: input.role,
                isActive: input.isActive ?? true,
            } as ISpaceParticipant)
            : null,
        participants: [],
        isOwner: input.isOwner ?? false,
    }
}

describe('getContextCapabilities', () => {
    it('habilita la administración compartida sólo con el Espacio activo', () => {
        const capabilities = getContextCapabilities(buildContext({ status: 'active', role: 'admin' }))
        expect(capabilities.has('manage_shared_settings')).toBe(true)
        expect(capabilities.has('manage_invites')).toBe(true)
        expect(capabilities.has('edit_own_entry')).toBe(true)
    })

    it.each<SpaceStatus>(['paused', 'closed'])(
        'conserva la administración pero bloquea editar movimientos en un Espacio %s',
        (status) => {
            const capabilities = getContextCapabilities(buildContext({ status, role: 'admin' }))
            expect(capabilities.has('manage_shared_settings')).toBe(true)
            expect(capabilities.has('edit_own_entry')).toBe(false)
            expect(capabilities.has('edit_any_entry')).toBe(false)
            expect(capabilities.has('create_entry')).toBe(false)
        }
    )

    it('bloquea toda administración y edición en un Espacio archivado', () => {
        const capabilities = getContextCapabilities(buildContext({ status: 'archived', role: 'owner' }))
        expect(capabilities.has('manage_shared_settings')).toBe(false)
        expect(capabilities.has('manage_invites')).toBe(false)
        expect(capabilities.has('edit_own_entry')).toBe(false)
        expect(capabilities.has('view')).toBe(true)
    })

    it('un participante sin rol de gestión nunca administra el Espacio', () => {
        const capabilities = getContextCapabilities(buildContext({ status: 'active', role: 'participant' }))
        expect(capabilities.has('manage_shared_settings')).toBe(false)
        expect(capabilities.has('manage_invites')).toBe(false)
        expect(capabilities.has('edit_own_entry')).toBe(true)
    })

    it('un owner sin fila de participante conserva su autoridad por el registro del Espacio', () => {
        const capabilities = getContextCapabilities(buildContext({ status: 'active', isOwner: true }))
        expect(capabilities.has('manage_shared_settings')).toBe(true)
        expect(capabilities.has('transfer_ownership')).toBe(true)
    })

    it('un participante inactivo conserva lectura pero pierde la edición', () => {
        const capabilities = getContextCapabilities(
            buildContext({ status: 'active', role: 'admin', isActive: false })
        )
        expect(capabilities.has('view')).toBe(true)
        expect(capabilities.has('manage_shared_settings')).toBe(false)
        expect(capabilities.has('edit_own_entry')).toBe(false)
    })
})
