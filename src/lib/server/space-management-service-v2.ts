import { Types } from 'mongoose'

import {
    Space,
    SpaceEntry,
    SpaceInvite,
    SpaceParticipant,
    User,
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
import { assertIanaTimezone } from '@/lib/utils/space-financial-v2'
import type { ISpace, ISpaceEntry, ISpaceParticipant } from '@/types'
import type { SpaceParticipantRole, SpaceStatus } from '@/lib/constants'
import { SPACE_INVITE_TYPES } from '@/lib/constants'
import { isActiveLegalTenderCurrency } from '@/lib/constants/iso-currencies'

export async function addSpaceParticipantV2(input: {
    actorUserId: string
    spaceId: string
    idempotencyKey: string
    expectedRevision: number
    kind: 'finp_user' | 'external'
    displayName: string
    email?: string
    role: 'admin' | 'participant'
}) {
    return executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'add_participant',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'manage_participants',
            })
            if ((context.space.revision ?? 0) !== input.expectedRevision) {
                throw new ServiceError(409, 'SPACE_VERSION_CONFLICT', 'El Espacio cambió. Revisalo antes de invitar.')
            }
            if (context.space.mode === 'solo') {
                throw new ServiceError(409, 'SPACE_SOLO_PARTICIPANTS_DISABLED', 'Un Espacio solo no admite más participantes.')
            }
            const normalizedEmail = input.email?.trim().toLowerCase()
            let userId: Types.ObjectId | undefined
            let displayName = input.displayName.trim()
            let inviteStatus: 'pending' | 'accepted' = 'accepted'
            if (input.kind === 'finp_user') {
                if (!normalizedEmail) throw new ServiceError(400, 'SPACE_PARTICIPANT_EMAIL_REQUIRED', 'Ingresá el email de Finp.')
                const user = await User.findOne({ email: normalizedEmail }).session(session)
                if (!user) throw new ServiceError(404, 'SPACE_PARTICIPANT_USER_NOT_FOUND', 'No encontramos esa cuenta de Finp.')
                userId = user._id
                displayName = user.displayName
                inviteStatus = 'pending'
                const existing = await SpaceParticipant.findOne({ spaceId: input.spaceId, userId }).session(session)
                if (existing) {
                    throw new ServiceError(
                        409,
                        'SPACE_PARTICIPANT_EXISTS',
                        existing.isActive ? 'La persona ya participa del Espacio.' : 'La persona tiene historia; reactivala en lugar de crearla otra vez.'
                    )
                }
            }
            if (!displayName) throw new ServiceError(400, 'SPACE_PARTICIPANT_NAME_REQUIRED', 'La persona necesita un nombre.')
            const [participant] = await SpaceParticipant.create([{
                spaceId: input.spaceId,
                kind: input.kind,
                userId,
                displayName,
                email: normalizedEmail,
                role: input.role,
                inviteStatus,
                isActive: true,
                revision: 0,
            }], { session })
            let inviteId: string | undefined
            if (userId) {
                const [invite] = await SpaceInvite.create([{
                    spaceId: input.spaceId,
                    inviteType: SPACE_INVITE_TYPES.DIRECT,
                    participantId: participant._id,
                    senderUserId: input.actorUserId,
                    recipientUserId: userId,
                    status: 'pending',
                }], { session })
                inviteId = invite._id.toString()
            }
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId: context.currentParticipant._id.toString(),
                operationId,
                type: userId ? 'participant_invited' : 'participant_joined',
                entityType: 'participant',
                entityId: participant._id.toString(),
                title: userId ? 'Participante invitado' : 'Participante agregado',
                metadata: { contractVersion: 2, kind: input.kind },
                participants: [...context.participants, participant.toObject() as ISpaceParticipant],
                session,
            })
            return {
                value: { participantId: participant._id.toString(), inviteId },
                resultRefs: { activityEventIds: [activity._id] },
            }
        },
    })
}

export async function respondSpaceInviteV2(input: {
    actorUserId: string
    spaceId: string
    participantId: string
    idempotencyKey: string
    expectedParticipantRevision: number
    inviteStatus: 'accepted' | 'declined'
}) {
    return executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'respond_invite',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'view',
            })
            const target = context.participants.find(
                (participant) => extractId(participant._id) === input.participantId
            )
            if (!target || extractId(target.userId) !== input.actorUserId || target.inviteStatus !== 'pending') {
                throw new ServiceError(404, 'SPACE_INVITE_NOT_FOUND', 'La invitación no está disponible.')
            }
            const updated = await SpaceParticipant.findOneAndUpdate(
                {
                    _id: input.participantId,
                    spaceId: input.spaceId,
                    inviteStatus: 'pending',
                    revision: input.expectedParticipantRevision,
                },
                {
                    $set: {
                        inviteStatus: input.inviteStatus,
                        isActive: input.inviteStatus === 'accepted',
                    },
                    $inc: { revision: 1 },
                },
                { new: true, session }
            ).lean<ISpaceParticipant | null>()
            if (!updated) throw new ServiceError(409, 'SPACE_PARTICIPANT_VERSION_CONFLICT', 'La invitación cambió.')
            await SpaceInvite.updateMany(
                { spaceId: input.spaceId, participantId: input.participantId, status: 'pending' },
                { $set: { status: input.inviteStatus, respondedAt: new Date() } },
                { session }
            )
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId: input.participantId,
                operationId,
                type: input.inviteStatus === 'accepted' ? 'participant_joined' : 'participant_removed',
                entityType: 'participant',
                entityId: input.participantId,
                title: input.inviteStatus === 'accepted' ? 'Invitación aceptada' : 'Invitación rechazada',
                metadata: { contractVersion: 2 },
                participants: context.participants,
                session,
            })
            return {
                value: {
                    participantId: input.participantId,
                    inviteStatus: input.inviteStatus,
                    revision: updated.revision ?? input.expectedParticipantRevision + 1,
                },
                resultRefs: { activityEventIds: [activity._id] },
            }
        },
    })
}

export async function updateSpaceSettingsV2(input: {
    actorUserId: string
    spaceId: string
    idempotencyKey: string
    expectedRevision: number
    name: string
    description?: string
    currencies: string[]
    reportingCurrency: string
    defaultSplitMode: 'none' | 'equal' | 'percentage' | 'fixed'
    timezone: string
}) {
    return executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'update_settings',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'manage_shared_settings',
            })
            const name = input.name.trim()
            if (!name) throw new ServiceError(400, 'SPACE_NAME_REQUIRED', 'El Espacio necesita un nombre.')
            const currencies = Array.from(new Set(
                input.currencies.map((currency) => currency.trim().toUpperCase()).filter(Boolean)
            ))
            if (currencies.some((currency) => !isActiveLegalTenderCurrency(currency))) {
                throw new ServiceError(400, 'SPACE_CURRENCY_INVALID', 'Todas las monedas deben ser ISO 4217 de curso legal.')
            }
            const reportingCurrency = input.reportingCurrency.trim().toUpperCase()
            if (!currencies.includes(reportingCurrency) || currencies.length === 0) {
                throw new ServiceError(400, 'SPACE_CURRENCY_INVALID', 'La moneda de reporte debe estar habilitada.')
            }
            const usedCurrencies = await SpaceEntry.distinct('currency', { spaceId: input.spaceId }).session(session)
            const removedUsedCurrency = usedCurrencies.find((currency) => !currencies.includes(currency))
            if (removedUsedCurrency) {
                throw new ServiceError(
                    409,
                    'SPACE_CURRENCY_IN_USE',
                    `No se puede retirar ${removedUsedCurrency} porque tiene movimientos históricos.`
                )
            }
            const hasMovements = usedCurrencies.length > 0
            if (hasMovements && reportingCurrency !== context.space.reportingCurrency) {
                throw new ServiceError(
                    409,
                    'SPACE_REPORTING_CURRENCY_LOCKED',
                    'La moneda de reporte queda fija desde el primer movimiento histórico.'
                )
            }
            const timezone = assertIanaTimezone(input.timezone)
            const updated = await Space.findOneAndUpdate(
                { _id: input.spaceId, contractVersion: 2, revision: input.expectedRevision },
                {
                    $set: {
                        name,
                        description: input.description?.trim() || undefined,
                        currencies,
                        reportingCurrency,
                        defaultSplitMode: context.space.mode === 'solo' ? 'none' : input.defaultSplitMode,
                        timezone,
                    },
                    $inc: { revision: 1 },
                },
                { new: true, session }
            ).lean<ISpace | null>()
            if (!updated) {
                throw new ServiceError(409, 'SPACE_VERSION_CONFLICT', 'El Espacio cambió. Revisalo antes de continuar.')
            }
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId: context.currentParticipant._id.toString(),
                operationId,
                type: 'space_updated',
                entityType: 'space',
                entityId: input.spaceId,
                title: 'Configuración del Espacio actualizada',
                metadata: { contractVersion: 2 },
                participants: context.participants,
                session,
            })
            return {
                value: {
                    revision: updated.revision ?? input.expectedRevision + 1,
                    name: updated.name,
                    description: updated.description,
                    currencies: updated.currencies,
                    reportingCurrency: updated.reportingCurrency,
                    defaultSplitMode: updated.defaultSplitMode,
                    timezone: updated.timezone,
                },
                resultRefs: { activityEventIds: [activity._id] },
            }
        },
    })
}

export async function setSpaceParticipantActiveV2(input: {
    actorUserId: string
    spaceId: string
    participantId: string
    idempotencyKey: string
    expectedParticipantRevision: number
    isActive: boolean
}) {
    return executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'change_participant_state',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'manage_participants',
            })
            const target = context.participants.find(
                (participant) => extractId(participant._id) === input.participantId
            )
            if (!target) throw new ServiceError(404, 'SPACE_PARTICIPANT_NOT_FOUND', 'La persona no pertenece al Espacio.')
            if (!input.isActive && target.role === 'owner') {
                throw new ServiceError(409, 'SPACE_OWNER_TRANSFER_REQUIRED', 'Transferí la propiedad antes de remover al owner.')
            }
            const updated = await SpaceParticipant.findOneAndUpdate(
                {
                    _id: input.participantId,
                    spaceId: input.spaceId,
                    revision: input.expectedParticipantRevision,
                },
                { $set: { isActive: input.isActive }, $inc: { revision: 1 } },
                { new: true, session }
            ).lean<ISpaceParticipant | null>()
            if (!updated) {
                throw new ServiceError(409, 'SPACE_PARTICIPANT_VERSION_CONFLICT', 'La persona cambió. Revisá la última versión.')
            }
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId: context.currentParticipant._id.toString(),
                operationId,
                type: 'space_updated',
                entityType: 'participant',
                entityId: input.participantId,
                title: input.isActive ? 'Participante reactivado' : 'Participante removido',
                metadata: { contractVersion: 2, isActive: input.isActive },
                participants: context.participants,
                session,
            })
            return {
                value: {
                    participantId: input.participantId,
                    isActive: updated.isActive,
                    revision: updated.revision ?? input.expectedParticipantRevision + 1,
                },
                resultRefs: { activityEventIds: [activity._id] },
            }
        },
    })
}

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
