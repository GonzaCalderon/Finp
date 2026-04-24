import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space } from '@/lib/models'
import {
    buildSpaceDetailPayload,
    getAccessibleSpaceContext,
} from '@/lib/server/spaces'
import { spaceSchema } from '@/lib/validations'
import {
    normalizeSpaceCurrencies,
} from '@/lib/utils/spaces'

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

        const payload = await buildSpaceDetailPayload(id, session.user.id)

        if (!payload) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ ...payload, currentUserId: session.user.id })
    } catch (error) {
        console.error('Error al obtener espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()
        const parsed = spaceSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de espacio inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

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
                { error: 'No tenés permisos para editar este espacio' },
                { status: 403 }
            )
        }

        if (
            parsed.data.mode === 'solo' &&
            context.participants.filter((participant) => participant.isActive).length > 1
        ) {
            return NextResponse.json(
                {
                    error: 'No podés pasar un espacio con más de un participante activo a modo solo.',
                },
                { status: 400 }
            )
        }

        const normalizedCurrencies = normalizeSpaceCurrencies(
            parsed.data.currencies,
            parsed.data.reportingCurrency
        )

        const update =
            parsed.data.status === 'closed'
                ? {
                    $set: {
                        ...parsed.data,
                        currencies: normalizedCurrencies,
                        defaultSplitMode:
                            parsed.data.mode === 'solo' ? 'none' : parsed.data.defaultSplitMode,
                        closedAt: context.space.closedAt ?? new Date(),
                    },
                }
                : {
                    $set: {
                        ...parsed.data,
                        currencies: normalizedCurrencies,
                        defaultSplitMode:
                            parsed.data.mode === 'solo' ? 'none' : parsed.data.defaultSplitMode,
                    },
                    $unset: {
                        closedAt: 1,
                    },
                }

        const space = await Space.findByIdAndUpdate(
            id,
            update,
            { new: true }
        )

        if (!space) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ space })
    } catch (error) {
        console.error('Error al actualizar espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
