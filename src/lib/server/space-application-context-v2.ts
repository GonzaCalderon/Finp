import { Types, type ClientSession } from 'mongoose'

import {
    Space,
    SpaceActivityEvent,
    SpaceParticipant,
    User,
} from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import {
    assertSpaceCapabilityV2,
    type SpaceCapabilityV2,
} from '@/lib/server/space-capabilities'
import type { ISpace, ISpaceEntry, ISpaceParticipant } from '@/types'
import { extractId } from '@/lib/utils/spaces'

export interface SpaceApplicationContextV2 {
    space: ISpace
    participants: ISpaceParticipant[]
    currentParticipant: ISpaceParticipant
    isOwnerRecord: boolean
}

export async function loadSpaceApplicationContextV2(input: {
    spaceId: string
    actorUserId: string
    session: ClientSession
    capability: SpaceCapabilityV2
}): Promise<SpaceApplicationContextV2> {
    const [space, participants] = await Promise.all([
        Space.findOne({ _id: input.spaceId, contractVersion: 2 })
            .session(input.session)
            .lean<ISpace | null>(),
        SpaceParticipant.find({ spaceId: input.spaceId })
            .session(input.session)
            .lean<ISpaceParticipant[]>(),
    ])
    if (!space) {
        throw new ServiceError(404, 'SPACE_V2_NOT_FOUND', 'El Espacio v2 no existe o todavía no fue migrado.')
    }
    const currentParticipant = participants.find(
        (participant) =>
            participant.isActive && extractId(participant.userId) === input.actorUserId
    )
    const isOwnerRecord = extractId(space.ownerUserId) === input.actorUserId
    if (!currentParticipant) {
        throw new ServiceError(404, 'SPACE_V2_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    }
    try {
        assertSpaceCapabilityV2({
            status: space.status,
            role: currentParticipant.role,
            isActiveParticipant: currentParticipant.isActive,
            isOwnerRecord,
        }, input.capability)
    } catch {
        throw new ServiceError(409, 'SPACE_CAPABILITY_DENIED', 'La acción no está permitida en el estado actual del Espacio.')
    }
    return { space, participants, currentParticipant, isOwnerRecord }
}

export function buildSpaceImpactOriginSnapshotV2(input: {
    space: ISpace
    entry: ISpaceEntry
}) {
    if (!input.space.timezone || !input.entry.dateKey) {
        throw new ServiceError(409, 'SPACE_V2_SNAPSHOT_INCOMPLETE', 'El origen no tiene fecha financiera completa.')
    }
    return {
        entryRevision: input.entry.revision ?? 0,
        entryStatus: input.entry.status === 'voided' ? 'voided' as const : 'recorded' as const,
        payerParticipantId: input.entry.paidByParticipantId,
        amount: input.entry.amount,
        reportingAmount: input.entry.reportingAmount,
        currency: input.entry.currency,
        reportingCurrency: input.space.reportingCurrency,
        exchangeRate: input.entry.exchangeRate,
        dateKey: input.entry.dateKey,
        timezone: input.entry.timezone ?? input.space.timezone,
    }
}

export async function createSpaceActivityEventV2(input: {
    spaceId: string
    actorUserId: string
    actorParticipantId: string
    operationId: Types.ObjectId
    type: 'entry_created' | 'entry_edited' | 'entry_voided' | 'settlement_created' | 'role_changed' | 'space_updated'
    entityType: 'space' | 'entry' | 'settlement' | 'participant'
    entityId: string
    title: string
    metadata?: Record<string, unknown>
    participants: ISpaceParticipant[]
    session: ClientSession
}) {
    const candidateUserIds = Array.from(new Set(
        input.participants
            .filter((participant) => participant.isActive)
            .map((participant) => extractId(participant.userId))
            .filter((userId): userId is string => Boolean(userId))
    ))
    const users = candidateUserIds.length
        ? await User.find({ _id: { $in: candidateUserIds } }, { _id: 1 })
            .session(input.session)
            .lean<Array<{ _id: Types.ObjectId }>>()
        : []
    const [activity] = await SpaceActivityEvent.create([{
        spaceId: input.spaceId,
        actorUserId: input.actorUserId,
        actorParticipantId: input.actorParticipantId,
        operationId: input.operationId,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        metadata: input.metadata,
        visibleToUserIds: users.map((user) => user._id),
        readByUserIds: [new Types.ObjectId(input.actorUserId)],
    }], { session: input.session })
    return activity
}

export function requireObjectId(value: unknown, code = 'INVALID_SPACE_REFERENCE') {
    const id = extractId(value)
    if (!id || !Types.ObjectId.isValid(id)) {
        throw new ServiceError(400, code, 'La referencia de Espacios no es válida.')
    }
    return id
}
