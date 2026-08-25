import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space, SpaceInvite, SpaceParticipant } from '@/lib/models'
import { SPACE_INVITE_TYPES } from '@/lib/constants'
import {
    buildActivityAudience,
    createSpaceActivityEvent,
} from '@/lib/server/space-activity'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spaceParticipantResponseSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import {
    changeSpaceParticipantRoleV2,
    setSpaceParticipantActiveV2,
    respondSpaceInviteV2,
    transferSpaceOwnershipV2,
} from '@/lib/server/space-management-service-v2'
import { enterLegacySpaceWriteFacade } from '@/lib/server/space-legacy-write-facade'

const participantPatchV2Schema = z.discriminatedUnion('intent', [
    z.object({
        intent: z.literal('invite_response'),
        expectedParticipantRevision: z.number().int().nonnegative(),
        inviteStatus: z.enum(['accepted', 'declined']),
    }).strict(),
    z.object({
        intent: z.literal('role'),
        expectedParticipantRevision: z.number().int().nonnegative(),
        role: z.enum(['owner', 'admin', 'participant']),
    }).strict(),
    z.object({
        intent: z.literal('active'),
        expectedParticipantRevision: z.number().int().nonnegative(),
        isActive: z.boolean(),
    }).strict(),
    z.object({
        intent: z.literal('ownership'),
        expectedSpaceRevision: z.number().int().nonnegative(),
        expectedActorParticipantRevision: z.number().int().nonnegative(),
        expectedTargetParticipantRevision: z.number().int().nonnegative(),
    }).strict(),
])

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; participantId: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, participantId } = await params
        const body: unknown = await request.json()
        await connectDB()
        const contract = await Space.findById(id, { contractVersion: 1 })
            .lean<{ contractVersion?: number } | null>()
        if (!contract) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        if (contract.contractVersion === 2) {
            const parsedV2 = participantPatchV2Schema.safeParse(body)
            if (!parsedV2.success) {
                return NextResponse.json({
                    error: 'La mutación del participante no es válida.',
                    code: 'SPACE_PARTICIPANT_MUTATION_INVALID',
                    failureState: 'not_started',
                    retryable: false,
                    details: parsedV2.error.flatten(),
                }, { status: 400 })
            }
            const idempotencyKey = requireIdempotencyKey(request)
            const data = parsedV2.data
            const execution = data.intent === 'invite_response'
                ? await respondSpaceInviteV2({
                    actorUserId: session.user.id,
                    spaceId: id,
                    participantId,
                    idempotencyKey,
                    expectedParticipantRevision: data.expectedParticipantRevision,
                    inviteStatus: data.inviteStatus,
                })
                : data.intent === 'role'
                ? await changeSpaceParticipantRoleV2({
                    actorUserId: session.user.id,
                    spaceId: id,
                    participantId,
                    idempotencyKey,
                    expectedParticipantRevision: data.expectedParticipantRevision,
                    role: data.role,
                })
                : data.intent === 'active'
                    ? await setSpaceParticipantActiveV2({
                        actorUserId: session.user.id,
                        spaceId: id,
                        participantId,
                        idempotencyKey,
                        expectedParticipantRevision: data.expectedParticipantRevision,
                        isActive: data.isActive,
                    })
                    : await transferSpaceOwnershipV2({
                        actorUserId: session.user.id,
                        spaceId: id,
                        targetParticipantId: participantId,
                        idempotencyKey,
                        expectedSpaceRevision: data.expectedSpaceRevision,
                        expectedActorParticipantRevision: data.expectedActorParticipantRevision,
                        expectedTargetParticipantRevision: data.expectedTargetParticipantRevision,
                    })
            return NextResponse.json(toSpaceMutationResult<unknown>(execution))
        }
        enterLegacySpaceWriteFacade(contract)
        const parsed = spaceParticipantResponseSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Respuesta de invitación inválida',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        const context = await getAccessibleSpaceContext(id, session.user.id)

        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const participant = await SpaceParticipant.findOne({
            _id: participantId,
            spaceId: id,
        })

        if (!participant) {
            return NextResponse.json(
                { error: 'Participante no encontrado' },
                { status: 404 }
            )
        }

        const previousInviteStatus = participant.inviteStatus
        const previousRole = participant.role

        const canManage =
            context.isOwner ||
            context.currentParticipant?.role === 'owner' ||
            context.currentParticipant?.role === 'admin'
        const isSelf = extractId(participant.userId) === session.user.id

        if (!isSelf && !canManage) {
            return NextResponse.json(
                { error: 'No tenés permisos para responder esta invitación.' },
                { status: 403 }
            )
        }

        if (parsed.data.inviteStatus) {
            if (participant.role === 'owner') {
                return NextResponse.json(
                    { error: 'No podés cambiar el estado del dueño del espacio.' },
                    { status: 400 }
                )
            }
            participant.inviteStatus = parsed.data.inviteStatus
            participant.isActive = parsed.data.inviteStatus === 'accepted'
        }

        if (parsed.data.role) {
            const actorRole = context.currentParticipant?.role
            const isOwner = context.isOwner || actorRole === 'owner'
            const isAdmin = actorRole === 'admin'

            if (participant.role === 'owner' || isSelf) {
                return NextResponse.json(
                    { error: 'No podés cambiar este rol.' },
                    { status: 400 }
                )
            }

            if (!isOwner && !(isAdmin && participant.role === 'participant' && parsed.data.role === 'participant')) {
                return NextResponse.json(
                    { error: 'No tenés permisos para cambiar este rol.' },
                    { status: 403 }
                )
            }

            participant.role = parsed.data.role
        }

        await participant.save()

        if (parsed.data.inviteStatus) {
            await SpaceInvite.updateMany(
                {
                    spaceId: id,
                    participantId,
                    status: 'pending',
                    $or: [
                        { inviteType: SPACE_INVITE_TYPES.DIRECT },
                        { inviteType: { $exists: false } },
                    ],
                },
                {
                    $set: {
                        status: parsed.data.inviteStatus,
                        respondedAt: new Date(),
                    },
                }
            )
        }

        if (previousInviteStatus !== 'accepted' && participant.inviteStatus === 'accepted') {
            createSpaceActivityEvent({
                spaceId: id,
                actorUserId: session.user.id,
                actorParticipantId: extractId(participant._id),
                type: 'participant_joined',
                entityType: 'participant',
                entityId: extractId(participant._id),
                title: `${participant.displayName} aceptó la invitación`,
                metadata: {
                    participantName: participant.displayName,
                },
            }).catch((err) => console.error('[space-activity]', err))
        }

        if (parsed.data.role && previousRole !== participant.role) {
            createSpaceActivityEvent({
                spaceId: id,
                actorUserId: session.user.id,
                actorParticipantId: extractId(context.currentParticipant?._id),
                type: 'role_changed',
                entityType: 'participant',
                entityId: extractId(participant._id),
                title: `${context.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} cambió el rol de ${participant.displayName}`,
                metadata: {
                    previousRole,
                    nextRole: participant.role,
                },
            }).catch((err) => console.error('[space-activity]', err))
        }

        return NextResponse.json({ participant })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo actualizar el participante.')
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; participantId: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, participantId } = await params

        await connectDB()
        const contract = await Space.findById(id, { contractVersion: 1 })
            .lean<{ contractVersion?: number } | null>()
        if (!contract) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        if (contract.contractVersion === 2) {
            const revisionHeader = request.headers.get('Expected-Revision')
            const expectedParticipantRevision = Number(revisionHeader)
            if (!revisionHeader || !Number.isInteger(expectedParticipantRevision) || expectedParticipantRevision < 0) {
                return NextResponse.json({
                    error: 'La operación requiere Expected-Revision.',
                    code: 'EXPECTED_REVISION_REQUIRED',
                    failureState: 'not_started',
                    retryable: false,
                }, { status: 400 })
            }
            const execution = await setSpaceParticipantActiveV2({
                actorUserId: session.user.id,
                spaceId: id,
                participantId,
                idempotencyKey: requireIdempotencyKey(request),
                expectedParticipantRevision,
                isActive: false,
            })
            return NextResponse.json(toSpaceMutationResult(execution))
        }

        enterLegacySpaceWriteFacade(contract)

        const context = await getAccessibleSpaceContext(id, session.user.id)

        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const participant = await SpaceParticipant.findOne({
            _id: participantId,
            spaceId: id,
        })

        if (!participant) {
            return NextResponse.json(
                { error: 'Participante no encontrado' },
                { status: 404 }
            )
        }

        const actorRole = context.currentParticipant?.role
        const isOwner = context.isOwner || actorRole === 'owner'
        const isAdmin = actorRole === 'admin'
        const isSelf = extractId(participant.userId) === session.user.id

        if (participant.role === 'owner' || isSelf) {
            return NextResponse.json(
                { error: 'No podés quitar este participante.' },
                { status: 400 }
            )
        }

        if (!isOwner && !(isAdmin && participant.role === 'participant')) {
            return NextResponse.json(
                { error: 'No tenés permisos para quitar este participante.' },
                { status: 403 }
            )
        }

        const visibleToUserIds = await buildActivityAudience(id)

        participant.isActive = false
        participant.inviteStatus = 'declined'
        await participant.save()

        createSpaceActivityEvent({
            spaceId: id,
            actorUserId: session.user.id,
            actorParticipantId: extractId(context.currentParticipant?._id),
            type: 'participant_removed',
            entityType: 'participant',
            entityId: extractId(participant._id),
            title: `${context.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} removió a ${participant.displayName}`,
            metadata: {
                participantName: participant.displayName,
                participantUserId: extractId(participant.userId),
            },
            visibleToUserIds,
        }).catch((err) => console.error('[space-activity]', err))

        return NextResponse.json({ participant })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo remover el participante.')
    }
}
