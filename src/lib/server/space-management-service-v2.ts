import { Types } from 'mongoose'

import {
    Space,
    SpaceEntry,
    SpaceParticipant,
} from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import {
    assertOwnerContinuityV2,
    type SpaceCapabilityV2,
} from '@/lib/server/space-capabilities'
import {
    createSpaceActivityEventV2,
    loadSpaceApplicationContextV2,
} from '@/lib/server/space-application-context-v2'
import { materializeSpaceDebtsV2 } from '@/lib/server/space-debt-materialization-v2'
import { executeSpaceOperation } from '@/lib/server/space-operation-executor'
import { extractId } from '@/lib/utils/spaces'
import type { ISpace, ISpaceEntry, ISpaceParticipant } from '@/types'
import type { SpaceParticipantRole, SpaceStatus } from '@/lib/constants'

function lifecycleCapability(current: SpaceStatus, target: SpaceStatus): SpaceCapabilityV2 {
    if (target === 'archived') return 'archive_space'
    if (current === 'archived') return 'restore_space'
    if (target === 'paused') return 'pause_space'
    if (target === 'closed') return 'close_space'
    return 'reopen_space'
}

function assertLifecycleTransition(current: SpaceStatus, target: SpaceStatus) {
    const allowed = new Set([
        'active:paused',
        'active:closed',
        'active:archived',
        'paused:active',
        'paused:closed',
        'paused:archived',
        'closed:active',
        'closed:archived',
        'archived:active',
        'archived:paused',
        'archived:closed',
    ])
    if (!allowed.has(`${current}:${target}`)) {
        throw new ServiceError(409, 'SPACE_LIFECYCLE_INVALID', 'La transición de estado no está permitida.')
    }
}

export async function changeSpaceLifecycleV2(input: {
    actorUserId: string
    spaceId: string
    idempotencyKey: string
    expectedRevision: number
    targetStatus: SpaceStatus
}) {
    return executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'change_lifecycle',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const initial = await Space.findOne({ _id: input.spaceId, contractVersion: 2 })
                .session(session).lean<ISpace | null>()
            if (!initial) throw new ServiceError(404, 'SPACE_V2_NOT_FOUND', 'El Espacio no existe.')
            assertLifecycleTransition(initial.status, input.targetStatus)
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: lifecycleCapability(initial.status, input.targetStatus),
            })
            const updateSet: Record<string, unknown> = {
                status: input.targetStatus,
            }
            const unset: Record<string, 1> = {}
            if (input.targetStatus === 'archived') updateSet.archivedFromStatus = initial.status
            if (initial.status === 'archived') unset.archivedFromStatus = 1
            if (input.targetStatus === 'closed') updateSet.closedAt = new Date()
            if (input.targetStatus === 'active') unset.closedAt = 1
            const updated = await Space.findOneAndUpdate(
                { _id: input.spaceId, contractVersion: 2, revision: input.expectedRevision },
                {
                    $set: updateSet,
                    ...(Object.keys(unset).length ? { $unset: unset } : {}),
                    $inc: { revision: 1 },
                },
                { new: true, session }
            ).lean<ISpace | null>()
            if (!updated) throw new ServiceError(409, 'SPACE_VERSION_CONFLICT', 'El Espacio cambió. Revisalo antes de continuar.')
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId: context.currentParticipant._id.toString(),
                operationId,
                type: 'space_updated',
                entityType: 'space',
                entityId: input.spaceId,
                title: 'Estado del Espacio actualizado',
                metadata: { contractVersion: 2, from: initial.status, to: input.targetStatus },
                participants: context.participants,
                session,
            })
            return {
                value: { status: updated.status, revision: updated.revision ?? input.expectedRevision + 1 },
                resultRefs: { activityEventIds: [activity._id] },
            }
        },
    })
}

export async function changeSpaceDebtModeV2(input: {
    actorUserId: string
    spaceId: string
    idempotencyKey: string
    expectedRevision: number
    debtMode: 'direct' | 'simplified'
}) {
    return executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'change_debt_mode',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'manage_shared_settings',
            })
            const updated = await Space.findOneAndUpdate(
                { _id: input.spaceId, contractVersion: 2, revision: input.expectedRevision },
                { $set: { debtMode: input.debtMode }, $inc: { revision: 1 } },
                { new: true, session }
            ).lean<ISpace | null>()
            if (!updated) throw new ServiceError(409, 'SPACE_VERSION_CONFLICT', 'El Espacio cambió. Revisalo antes de continuar.')
            const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 })
                .session(session).lean<ISpaceEntry[]>()
            const debts = await materializeSpaceDebtsV2({
                space: updated,
                participants: context.participants,
                entries,
                operationId,
                session,
            })
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId: context.currentParticipant._id.toString(),
                operationId,
                type: 'space_updated',
                entityType: 'space',
                entityId: input.spaceId,
                title: 'Criterio de deuda actualizado',
                metadata: { contractVersion: 2, debtMode: input.debtMode },
                participants: context.participants,
                session,
            })
            return {
                value: { debtMode: input.debtMode, revision: updated.revision ?? input.expectedRevision + 1 },
                resultRefs: {
                    debtIds: debts.debtIds.map((id) => new Types.ObjectId(id)),
                    debtMovementIds: debts.movementIds.map((id) => new Types.ObjectId(id)),
                    activityEventIds: [activity._id],
                },
            }
        },
    })
}

export async function changeSpaceParticipantRoleV2(input: {
    actorUserId: string
    spaceId: string
    participantId: string
    idempotencyKey: string
    expectedParticipantRevision: number
    role: SpaceParticipantRole
}) {
    return executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'change_role',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'change_roles',
            })
            const target = context.participants.find(
                (participant) => extractId(participant._id) === input.participantId
            )
            if (!target || !target.isActive) {
                throw new ServiceError(404, 'SPACE_PARTICIPANT_NOT_FOUND', 'El participante no está activo.')
            }
            const changesOwnership = target.role === 'owner' || input.role === 'owner'
            if (changesOwnership && !context.isOwnerRecord) {
                throw new ServiceError(403, 'SPACE_OWNER_ROLE_REQUIRED', 'Sólo el owner puede cambiar propiedad.')
            }
            if (extractId(target.userId) === extractId(context.space.ownerUserId)) {
                throw new ServiceError(409, 'SPACE_OWNER_TRANSFER_REQUIRED', 'La propiedad se transfiere con la operación específica.')
            }
            const activeOwnerCount = context.participants.filter(
                (participant) => participant.isActive && participant.role === 'owner'
            ).length
            try {
                assertOwnerContinuityV2({
                    activeOwnerCount,
                    removesOwner: target.role === 'owner' && input.role !== 'owner',
                    transfersToOwnerInSameOperation: false,
                })
            } catch {
                throw new ServiceError(409, 'SPACE_LAST_OWNER', 'El último owner debe transferir la propiedad.')
            }
            const updated = await SpaceParticipant.findOneAndUpdate(
                {
                    _id: input.participantId,
                    spaceId: input.spaceId,
                    isActive: true,
                    revision: input.expectedParticipantRevision,
                },
                { $set: { role: input.role }, $inc: { revision: 1 } },
                { new: true, session }
            ).lean<ISpaceParticipant | null>()
            if (!updated) throw new ServiceError(409, 'SPACE_PARTICIPANT_VERSION_CONFLICT', 'El participante cambió.')
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId: context.currentParticipant._id.toString(),
                operationId,
                type: 'role_changed',
                entityType: 'participant',
                entityId: input.participantId,
                title: 'Rol actualizado',
                metadata: { contractVersion: 2, from: target.role, to: input.role },
                participants: context.participants,
                session,
            })
            return {
                value: { participantId: input.participantId, role: input.role, revision: updated.revision ?? input.expectedParticipantRevision + 1 },
                resultRefs: { activityEventIds: [activity._id] },
            }
        },
    })
}

export async function transferSpaceOwnershipV2(input: {
    actorUserId: string
    spaceId: string
    targetParticipantId: string
    idempotencyKey: string
    expectedSpaceRevision: number
    expectedActorParticipantRevision: number
    expectedTargetParticipantRevision: number
}) {
    return executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'transfer_ownership',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'transfer_ownership',
            })
            if (!context.isOwnerRecord) {
                throw new ServiceError(403, 'SPACE_OWNER_REQUIRED', 'Sólo el owner actual puede transferir la propiedad.')
            }
            const target = context.participants.find(
                (participant) => extractId(participant._id) === input.targetParticipantId
            )
            const targetUserId = extractId(target?.userId)
            if (!target || !target.isActive || !targetUserId || targetUserId === input.actorUserId) {
                throw new ServiceError(409, 'SPACE_OWNER_TARGET_INVALID', 'La nueva persona owner debe ser un usuario activo distinto.')
            }
            const actorParticipantId = context.currentParticipant._id.toString()
            const targetUpdate = await SpaceParticipant.updateOne(
                {
                    _id: input.targetParticipantId,
                    spaceId: input.spaceId,
                    isActive: true,
                    revision: input.expectedTargetParticipantRevision,
                },
                { $set: { role: 'owner' }, $inc: { revision: 1 } },
                { session }
            )
            const actorUpdate = await SpaceParticipant.updateOne(
                {
                    _id: actorParticipantId,
                    spaceId: input.spaceId,
                    isActive: true,
                    revision: input.expectedActorParticipantRevision,
                },
                { $set: { role: 'admin' }, $inc: { revision: 1 } },
                { session }
            )
            const spaceUpdate = await Space.updateOne(
                {
                    _id: input.spaceId,
                    contractVersion: 2,
                    ownerUserId: input.actorUserId,
                    revision: input.expectedSpaceRevision,
                },
                { $set: { ownerUserId: targetUserId }, $inc: { revision: 1 } },
                { session }
            )
            if (
                targetUpdate.modifiedCount !== 1 ||
                actorUpdate.modifiedCount !== 1 ||
                spaceUpdate.modifiedCount !== 1
            ) {
                throw new ServiceError(409, 'SPACE_OWNERSHIP_VERSION_CONFLICT', 'La propiedad o los roles cambiaron.')
            }
            const updatedParticipants = context.participants.map((participant) => {
                const id = extractId(participant._id)
                if (id === input.targetParticipantId) return { ...participant, role: 'owner' as const }
                if (id === actorParticipantId) return { ...participant, role: 'admin' as const }
                return participant
            })
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId,
                operationId,
                type: 'role_changed',
                entityType: 'participant',
                entityId: input.targetParticipantId,
                title: 'Propiedad transferida',
                metadata: { contractVersion: 2 },
                participants: updatedParticipants,
                session,
            })
            return {
                value: {
                    ownerUserId: targetUserId,
                    spaceRevision: input.expectedSpaceRevision + 1,
                },
                resultRefs: { activityEventIds: [activity._id] },
            }
        },
    })
}
