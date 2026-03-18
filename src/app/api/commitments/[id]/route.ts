import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ScheduledCommitment } from '@/lib/models'

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

        await connectDB()

        const commitment = await ScheduledCommitment.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: body },
            { new: true }
        )

        if (!commitment) {
            return NextResponse.json({ error: 'Compromiso no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ commitment })
    } catch (error) {
        console.error('Error al actualizar compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
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

        const commitment = await ScheduledCommitment.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: { isActive: false } },
            { new: true }
        )

        if (!commitment) {
            return NextResponse.json({ error: 'Compromiso no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ message: 'Compromiso desactivado correctamente' })
    } catch (error) {
        console.error('Error al desactivar compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}