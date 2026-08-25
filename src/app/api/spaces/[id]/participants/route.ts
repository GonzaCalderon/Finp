import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space, SpaceInvite, SpaceParticipant, User } from '@/lib/models'
import { SPACE_INVITE_TYPES } from '@/lib/constants'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spaceParticipantSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import { getSpaceDetailV2 } from '@/lib/server/space-read-service-v2'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { addSpaceParticipantV2 } from '@/lib/server/space-management-service-v2'
import { enterLegacySpaceWriteFacade } from '@/lib/server/space-legacy-write-facade'

const participantCreateV2Schema = z.object({
    expectedRevision: z.number().int().nonnegative(),
    kind: z.enum(['finp_user', 'external']),
    displayName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().optional(),
    role: z.enum(['admin', 'participant']),
}).strict()

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        await connectDB()

        const detail = await getSpaceDetailV2({ spaceId: id, actorUserId: session.user.id, limit: 1 })
        return NextResponse.json({ data: detail.participants, capabilities: detail.capabilities })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudieron obtener los participantes.')
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const body: unknown = await request.json()
        await connectDB()
        const contract = await Space.findById(id, { contractVersion: 1 })
            .lean<{ contractVersion?: number } | null>()
        if (!contract) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        if (contract.contractVersion === 2) {
            const parsedV2 = participantCreateV2Schema.safeParse(body)
            if (!parsedV2.success) {
                return NextResponse.json({
                    error: 'Datos de participante inválidos',
                    code: 'SPACE_PARTICIPANT_INVALID',
                    failureState: 'not_started',
                    retryable: false,
                    details: parsedV2.error.flatten(),
                }, { status: 400 })
            }
            const execution = await addSpaceParticipantV2({
                actorUserId: session.user.id,
                spaceId: id,
                idempotencyKey: requireIdempotencyKey(request),
                ...parsedV2.data,
            })
            return NextResponse.json(toSpaceMutationResult(execution), { status: 201 })
        }
        enterLegacySpaceWriteFacade(contract)
        const parsed = spaceParticipantSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de participante inválidos',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        const context = await getAccessibleSpaceContext(id, session.user.id)

        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const canManage =
            context.isOwner ||
            context.currentParticipant?.role === 'owner' ||
            context.currentParticipant?.role === 'admin'

        if (!canManage) {
            return NextResponse.json(
                { error: 'No tenés permisos para invitar participantes en este espacio' },
                { status: 403 }
            )
        }

        if (context.space.mode === 'solo') {
            return NextResponse.json(
                { error: 'Los espacios en modo solo no admiten participantes adicionales.' },
                { status: 400 }
            )
        }

        if (parsed.data.role === 'owner') {
            return NextResponse.json(
                { error: 'No podés invitar a otro participante como dueño del espacio.' },
                { status: 400 }
            )
        }

        const normalizedEmail = parsed.data.email?.toLowerCase()

        if (parsed.data.kind === 'finp_user') {
            const recipient = await User.findOne({ email: normalizedEmail })

            if (!recipient) {
                return NextResponse.json(
                    { error: 'No encontramos una cuenta de Finp con ese email.' },
                    { status: 404 }
                )
            }

            const exists = await SpaceParticipant.findOne({
                spaceId: id,
                userId: recipient._id,
                isActive: true,
            })

            if (exists) {
                return NextResponse.json(
                    { error: 'Ese usuario ya participa en el espacio.' },
                    { status: 400 }
                )
            }

            const participant = await SpaceParticipant.create({
                spaceId: id,
                kind: 'finp_user',
                userId: recipient._id,
                displayName: recipient.displayName,
                email: recipient.email,
                role: parsed.data.role,
                inviteStatus: 'pending',
                isActive: true,
            })

            const invite = await SpaceInvite.create({
                spaceId: id,
                inviteType: SPACE_INVITE_TYPES.DIRECT,
                participantId: participant._id,
                senderUserId: session.user.id,
                recipientUserId: recipient._id,
                status: 'pending',
            })

            createSpaceActivityEvent({
                spaceId: id,
                actorUserId: session.user.id,
                actorParticipantId: extractId(context.currentParticipant?._id),
                type: 'participant_invited',
                entityType: 'participant',
                entityId: extractId(participant._id),
                title: `${context.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} invitó a ${participant.displayName}`,
                metadata: {
                    participantName: participant.displayName,
                    participantUserId: extractId(participant.userId),
                },
            }).catch((err) => console.error('[space-activity]', err))

            return NextResponse.json({ participant, invite }, { status: 201 })
        }

        const duplicateExternal = normalizedEmail
            ? await SpaceParticipant.findOne({
                spaceId: id,
                email: normalizedEmail,
                isActive: true,
            })
            : null

        if (duplicateExternal) {
            return NextResponse.json(
                { error: 'Ya existe un participante activo con ese email.' },
                { status: 400 }
            )
        }

        const participant = await SpaceParticipant.create({
            spaceId: id,
            kind: 'external',
            displayName: parsed.data.displayName,
            email: normalizedEmail,
            role: parsed.data.role,
            inviteStatus: 'accepted',
            isActive: true,
        })

        createSpaceActivityEvent({
            spaceId: id,
            actorUserId: session.user.id,
            actorParticipantId: extractId(context.currentParticipant?._id),
            type: 'participant_joined',
            entityType: 'participant',
            entityId: extractId(participant._id),
            title: `${context.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} agregó a ${participant.displayName}`,
            metadata: {
                participantName: participant.displayName,
                participantKind: participant.kind,
            },
        }).catch((err) => console.error('[space-activity]', err))

        return NextResponse.json({ participant }, { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo agregar el participante.')
    }
}
