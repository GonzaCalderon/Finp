import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceInvite, SpaceParticipant } from '@/lib/models'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spaceParticipantResponseSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'

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
        const body = await request.json()
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

        await connectDB()

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
                },
                {
                    $set: {
                        status: parsed.data.inviteStatus,
                        respondedAt: new Date(),
                    },
                }
            )
        }

        return NextResponse.json({ participant })
    } catch (error) {
        console.error('Error al responder invitación del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
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

        participant.isActive = false
        participant.inviteStatus = 'declined'
        await participant.save()

        return NextResponse.json({ participant })
    } catch (error) {
        console.error('Error al quitar participante del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
