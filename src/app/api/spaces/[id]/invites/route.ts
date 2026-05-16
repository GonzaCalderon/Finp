import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
    createOrReuseSpaceInviteLink,
    getSpaceInviteLinkState,
} from '@/lib/server/space-invites'
import { canManageSpaceInvites, getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spaceInviteLinkSchema } from '@/lib/validations'

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

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        if (!canManageSpaceInvites(context)) {
            return NextResponse.json(
                { error: 'No tenés permisos para administrar invitaciones.' },
                { status: 403 }
            )
        }

        const state = await getSpaceInviteLinkState(id)
        return NextResponse.json(state)
    } catch (error) {
        console.error('Error al obtener invitaciones del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
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
        const body = await request.json().catch(() => ({}))
        const parsed = spaceInviteLinkSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de invitación inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        if (!canManageSpaceInvites(context)) {
            return NextResponse.json(
                { error: 'No tenés permisos para administrar invitaciones.' },
                { status: 403 }
            )
        }

        if (context.space.mode === 'solo') {
            return NextResponse.json(
                { error: 'Los espacios en modo solo no admiten invitaciones por link.' },
                { status: 400 }
            )
        }

        const result = await createOrReuseSpaceInviteLink({
            spaceId: id,
            userId: session.user.id,
            origin: new URL(request.url).origin,
            expiresInDays: parsed.data.expiresInDays,
            regenerate: parsed.data.regenerate,
        })

        return NextResponse.json(result, { status: result.created ? 201 : 200 })
    } catch (error) {
        console.error('Error al generar invitación por link:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
