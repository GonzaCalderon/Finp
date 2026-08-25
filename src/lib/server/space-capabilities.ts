import type { SpaceParticipantRole, SpaceStatus } from '@/lib/constants'

export type SpaceCapabilityV2 =
    | 'view'
    | 'create_entry'
    | 'edit_own_entry'
    | 'edit_any_entry'
    | 'void_own_entry'
    | 'void_any_entry'
    | 'settle_balance'
    | 'resolve_personal_impact'
    | 'manage_shared_settings'
    | 'manage_invites'
    | 'manage_participants'
    | 'change_roles'
    | 'transfer_ownership'
    | 'pause_space'
    | 'close_space'
    | 'reopen_space'
    | 'archive_space'
    | 'restore_space'
    | 'act_for_participant'

export interface SpaceCapabilityContextV2 {
    status: SpaceStatus
    role?: SpaceParticipantRole
    isActiveParticipant: boolean
    isOwnerRecord: boolean
}

export function getSpaceCapabilitiesV2(
    context: SpaceCapabilityContextV2
): ReadonlySet<SpaceCapabilityV2> {
    const capabilities = new Set<SpaceCapabilityV2>()
    if (!context.isActiveParticipant && !context.isOwnerRecord) {
        if (!context.role) return capabilities
        capabilities.add('view')
        if (context.status !== 'archived') capabilities.add('resolve_personal_impact')
        if (context.status === 'active' || context.status === 'closed') {
            capabilities.add('settle_balance')
        }
        return capabilities
    }

    capabilities.add('view')
    const role = context.isOwnerRecord ? 'owner' : context.role
    const isManager = role === 'owner' || role === 'admin'
    const isOwner = role === 'owner'

    if (context.status !== 'archived') {
        capabilities.add('resolve_personal_impact')
    }

    if (context.status === 'active') {
        capabilities.add('create_entry')
        capabilities.add('edit_own_entry')
        capabilities.add('void_own_entry')
        capabilities.add('settle_balance')
    } else if (context.status === 'closed') {
        capabilities.add('settle_balance')
    }

    if (isManager && context.status !== 'archived') {
        capabilities.add('manage_shared_settings')
        capabilities.add('manage_invites')
        capabilities.add('manage_participants')
        capabilities.add('change_roles')
        capabilities.add('act_for_participant')
        if (context.status === 'active') {
            capabilities.add('edit_any_entry')
            capabilities.add('void_any_entry')
        }
    }

    if (isManager && context.status === 'active') {
        capabilities.add('pause_space')
        capabilities.add('close_space')
    }
    if (isManager && context.status === 'paused') {
        capabilities.add('reopen_space')
        capabilities.add('close_space')
    }
    if (isManager && context.status === 'closed') {
        capabilities.add('reopen_space')
    }

    if (isOwner) {
        capabilities.add('transfer_ownership')
        if (context.status !== 'archived') capabilities.add('archive_space')
        if (context.status === 'archived') capabilities.add('restore_space')
    }

    return capabilities
}

export function assertSpaceCapabilityV2(
    context: SpaceCapabilityContextV2,
    capability: SpaceCapabilityV2
) {
    if (!getSpaceCapabilitiesV2(context).has(capability)) {
        const error = new Error('La acción no está permitida para el rol o estado actual del Espacio.')
        error.name = 'SpaceCapabilityDeniedError'
        throw error
    }
}

export function assertOwnerContinuityV2(input: {
    activeOwnerCount: number
    removesOwner: boolean
    transfersToOwnerInSameOperation: boolean
}) {
    if (
        input.removesOwner &&
        input.activeOwnerCount <= 1 &&
        !input.transfersToOwnerInSameOperation
    ) {
        const error = new Error('El último owner debe transferir la propiedad en la misma operación.')
        error.name = 'LastSpaceOwnerError'
        throw error
    }
}
