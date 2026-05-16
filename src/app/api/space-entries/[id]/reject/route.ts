import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry } from '@/lib/models'
import { getEntryConfirmationContext } from '@/lib/server/spaces'

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

        await connectDB()

        const context = await getEntryConfirmationContext(id, session.user.id)

        if (!context) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        if (context.entry.status !== 'pending_confirmation') {
            return NextResponse.json(
                { error: 'Este movimiento ya fue resuelto.' },
                { status: 400 }
            )
        }

        const entry = await SpaceEntry.findByIdAndUpdate(
            id,
            {
                $set: {
                    status: 'rejected',
                    rejectedAt: new Date(),
                },
            },
            { new: true }
        )
            .populate('categoryId', 'name color type')

        return NextResponse.json({ entry })
    } catch (error) {
        console.error('Error al rechazar movimiento del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
