import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntryPersonalImpact } from '@/lib/models'
import { SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import type { ISpaceEntryPersonalImpact } from '@/types'

type Params = Promise<{ id: string }>

// POST /api/personal-pending-actions/[id]/ignore — ignorar un pendiente
export async function POST(_request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        if (!Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Pendiente no encontrado' }, { status: 404 })
        }

        await connectDB()

        const updated = await SpaceEntryPersonalImpact.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                userId: new Types.ObjectId(session.user.id),
                status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING,
            },
            {
                $set: {
                    status: SPACE_PERSONAL_IMPACT_STATUSES.IGNORED,
                    ignoredAt: new Date(),
                },
            },
            { new: true }
        ).lean<ISpaceEntryPersonalImpact | null>()

        if (!updated) {
            return NextResponse.json(
                { error: 'Pendiente no encontrado o no está en estado pendiente' },
                { status: 404 }
            )
        }

        return NextResponse.json({ action: updated })
    } catch (error) {
        console.error('Error al ignorar pendiente:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

// DELETE /api/personal-pending-actions/[id]/ignore — restaurar ignorado a pendiente
export async function DELETE(_request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        if (!Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Pendiente no encontrado' }, { status: 404 })
        }

        await connectDB()

        const updated = await SpaceEntryPersonalImpact.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                userId: new Types.ObjectId(session.user.id),
                status: SPACE_PERSONAL_IMPACT_STATUSES.IGNORED,
            },
            {
                $set: { status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING },
                $unset: { ignoredAt: 1 },
            },
            { new: true }
        ).lean<ISpaceEntryPersonalImpact | null>()

        if (!updated) {
            return NextResponse.json(
                { error: 'Pendiente no encontrado o no está ignorado' },
                { status: 404 }
            )
        }

        return NextResponse.json({ action: updated })
    } catch (error) {
        console.error('Error al restaurar pendiente ignorado:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
