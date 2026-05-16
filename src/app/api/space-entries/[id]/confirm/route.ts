import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Category, SpaceEntry, Transaction } from '@/lib/models'
import { createPersonalImpactFromSpaceEntry } from '@/lib/server/space-personal-impact'
import { getEntryConfirmationContext } from '@/lib/server/spaces'
import { spaceEntryConfirmSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry } from '@/types'

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
        const parsed = spaceEntryConfirmSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de confirmación inválidos',
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

        if (context.entry.status !== 'pending_confirmation') {
            return NextResponse.json(
                { error: 'Este movimiento ya fue resuelto.' },
                { status: 400 }
            )
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

        if (parsed.data.mode === 'link') {
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

            await createPersonalImpactFromSpaceEntry({
                spaceId: extractId(context.entry.spaceId) ?? '',
                entry: context.entry,
                participants: context.participants,
                userId: session.user.id,
                participantId: extractId(context.paidByParticipant._id) ?? '',
                mode: 'link_existing',
                categoryId: parsed.data.categoryId,
                linkedTransactionId: parsed.data.linkedTransactionId,
                spaceNameSnapshot: context.space.name,
            })

            const entry = await SpaceEntry.findByIdAndUpdate(
                id,
                {
                    $set: {
                        status: 'confirmed',
                        confirmedByUserId: session.user.id,
                        confirmedAt: new Date(),
                    },
                },
                { new: true }
            )
                .populate('categoryId', 'name color type')

            return NextResponse.json({ entry })
        }

        try {
            await createPersonalImpactFromSpaceEntry({
                spaceId: extractId(context.entry.spaceId) ?? '',
                entry: context.entry,
                participants: context.participants,
                userId: session.user.id,
                participantId: extractId(context.paidByParticipant._id) ?? '',
                mode: 'create_transaction',
                accountId: parsed.data.accountId!,
                description: parsed.data.description ?? context.entry.title,
                categoryId: parsed.data.categoryId,
                spaceNameSnapshot: context.space.name,
            })

            const entry = await SpaceEntry.findByIdAndUpdate(
                id,
                {
                    $set: {
                        status: 'confirmed',
                        confirmedByUserId: session.user.id,
                        confirmedAt: new Date(),
                    },
                },
                { new: true }
            )
                .populate('categoryId', 'name color type')
                .lean<ISpaceEntry | null>()

            return NextResponse.json({ entry })
        } catch (error) {
            return NextResponse.json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'No se pudo confirmar el movimiento.',
                },
                { status: 400 }
            )
        }
    } catch (error) {
        console.error('Error al confirmar movimiento del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
