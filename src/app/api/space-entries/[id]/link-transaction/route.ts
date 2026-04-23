import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Category, SpaceEntry, Transaction } from '@/lib/models'
import { getEntryConfirmationContext } from '@/lib/server/spaces'
import { spaceEntryConfirmSchema } from '@/lib/validations'

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
        const body = await request.json()
        const parsed = spaceEntryConfirmSchema.safeParse({ ...body, mode: 'link' })

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de vínculo inválidos',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        await connectDB()

        const context = await getEntryConfirmationContext(id, session.user.id)

        if (!context) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        if (parsed.data.categoryId) {
            const category = await Category.findOne({
                _id: parsed.data.categoryId,
                userId: session.user.id,
            })

            if (!category) {
                return NextResponse.json(
                    { error: 'La categoría seleccionada no es válida.' },
                    { status: 400 }
                )
            }
        }

        const linkedTransaction = await Transaction.findOne({
            _id: parsed.data.linkedTransactionId,
            userId: session.user.id,
        })

        if (!linkedTransaction) {
            return NextResponse.json(
                { error: 'La transacción a vincular no existe o no te pertenece.' },
                { status: 400 }
            )
        }

        const entry = await SpaceEntry.findByIdAndUpdate(
            id,
            {
                $set: {
                    linkedTransactionId: linkedTransaction._id,
                    status:
                        context.entry.status === 'pending_confirmation' ? 'linked' : context.entry.status,
                    confirmedByUserId: session.user.id,
                    confirmedAt: new Date(),
                    categoryId: parsed.data.categoryId ?? context.entry.categoryId,
                },
            },
            { new: true }
        )
            .populate('categoryId', 'name color type')

        return NextResponse.json({ entry })
    } catch (error) {
        console.error('Error al vincular transacción al movimiento del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
