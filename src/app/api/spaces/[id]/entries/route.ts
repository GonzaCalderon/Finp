import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
    Category,
    SpaceEntry,
    Transaction,
} from '@/lib/models'
import { createTransactionFromSpaceEntry } from '@/lib/server/space-transactions'
import {
    getAccessibleSpaceContext,
    getSpaceEntries,
} from '@/lib/server/spaces'
import { spaceEntrySchema } from '@/lib/validations'
import {
    calculateReportingAmount,
    extractId,
} from '@/lib/utils/spaces'
import type { ISpaceEntry } from '@/types'

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
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const status = searchParams.get('status')

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)

        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const entries = await getSpaceEntries(id)
        const filteredEntries = entries.filter((entry) => {
            if (type && entry.type !== type) return false
            if (status && entry.status !== status) return false
            return true
        })

        return NextResponse.json({ entries: filteredEntries })
    } catch (error) {
        console.error('Error al obtener movimientos del espacio:', error)
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
        const body = await request.json()
        const parsed = spaceEntrySchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de movimiento inválidos',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        if (parsed.data.personalAccountId && parsed.data.linkedTransactionId) {
            return NextResponse.json(
                {
                    error: 'Elegí crear una transacción nueva o vincular una existente, no ambas.',
                },
                { status: 400 }
            )
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)

        if (!context || !context.currentParticipant) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const participantsById = new Map(
            context.participants.map((participant) => [extractId(participant._id) ?? '', participant])
        )
        const paidByParticipant = parsed.data.paidByParticipantId
            ? participantsById.get(parsed.data.paidByParticipantId)
            : undefined

        if (parsed.data.type !== 'settlement' && !paidByParticipant) {
            return NextResponse.json(
                { error: 'El participante pagador no es válido.' },
                { status: 400 }
            )
        }

        if (parsed.data.type === 'settlement' && (parsed.data.sharedWithParticipantIds?.length ?? 0) === 0) {
            return NextResponse.json(
                {
                    error: 'Para una liquidación necesitás indicar al menos un participante contraparte.',
                },
                { status: 400 }
            )
        }

        const invalidSharedParticipant = (parsed.data.sharedWithParticipantIds ?? []).find(
            (participantId) => !participantsById.has(participantId)
        )

        if (invalidSharedParticipant) {
            return NextResponse.json(
                { error: 'El split incluye participantes inválidos.' },
                { status: 400 }
            )
        }

        const invalidSplitAllocation = (parsed.data.splitAllocations ?? []).find(
            (allocation) => !participantsById.has(allocation.participantId)
        )

        if (invalidSplitAllocation) {
            return NextResponse.json(
                { error: 'El split incluye participantes inválidos.' },
                { status: 400 }
            )
        }

        if (
            parsed.data.currency !== context.space.reportingCurrency &&
            !parsed.data.exchangeRate
        ) {
            return NextResponse.json(
                {
                    error: 'Ingresá una cotización para convertir el movimiento a la moneda de reporte.',
                },
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

        if (parsed.data.linkedTransactionId) {
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
        }

        const payerUserId = extractId(paidByParticipant?.userId)
        if (
            (parsed.data.personalAccountId || parsed.data.linkedTransactionId) &&
            payerUserId !== session.user.id
        ) {
            return NextResponse.json(
                {
                    error: 'Solo el pagador puede crear o vincular una transacción personal al movimiento.',
                },
                { status: 400 }
            )
        }

        const confirmationRequired = Boolean(
            payerUserId && payerUserId !== session.user.id
        )

        const entry = await SpaceEntry.create({
            spaceId: id,
            createdByUserId: session.user.id,
            createdByParticipantId: context.currentParticipant._id,
            type: parsed.data.type,
            status: confirmationRequired ? 'pending_confirmation' : 'confirmed',
            title: parsed.data.title,
            description: parsed.data.description,
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            reportingAmount: calculateReportingAmount({
                amount: parsed.data.amount,
                currency: parsed.data.currency,
                reportingCurrency: context.space.reportingCurrency,
                exchangeRate: parsed.data.exchangeRate,
            }),
            exchangeRate:
                parsed.data.currency !== context.space.reportingCurrency
                    ? parsed.data.exchangeRate
                    : undefined,
            date: parsed.data.date,
            categoryId: parsed.data.categoryId,
            paidByParticipantId: parsed.data.paidByParticipantId,
            sharedWithParticipantIds:
                parsed.data.splitMode === 'none'
                    ? undefined
                    : parsed.data.sharedWithParticipantIds,
            splitMode: context.space.mode === 'solo' ? 'none' : parsed.data.splitMode,
            splitAllocations:
                parsed.data.splitMode === 'percentage' || parsed.data.splitMode === 'fixed'
                    ? parsed.data.splitAllocations
                    : undefined,
            notes: parsed.data.notes,
            linkedTransactionId: confirmationRequired ? undefined : parsed.data.linkedTransactionId,
            confirmationRequired,
            confirmedByUserId: confirmationRequired ? undefined : session.user.id,
            confirmedAt: confirmationRequired ? undefined : new Date(),
        })

        let updatedEntry: ISpaceEntry | null = null

        if (!confirmationRequired && parsed.data.personalAccountId) {
            try {
                const transaction = await createTransactionFromSpaceEntry({
                    entry: entry.toObject() as ISpaceEntry,
                    userId: session.user.id,
                    accountId: parsed.data.personalAccountId,
                    description: parsed.data.title,
                    categoryId: parsed.data.categoryId,
                })

                updatedEntry = await SpaceEntry.findByIdAndUpdate(
                    entry._id,
                    {
                        $set: {
                            linkedTransactionId: transaction._id,
                            status: 'linked',
                            confirmedByUserId: session.user.id,
                            confirmedAt: new Date(),
                        },
                    },
                    { new: true }
                )
                    .populate('categoryId', 'name color type')
                    .lean<ISpaceEntry | null>()
            } catch (error) {
                await SpaceEntry.findByIdAndDelete(entry._id)

                return NextResponse.json(
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : 'No se pudo registrar la transacción asociada.',
                    },
                    { status: 400 }
                )
            }
        } else {
            updatedEntry = await SpaceEntry.findByIdAndUpdate(
                entry._id,
                parsed.data.linkedTransactionId && !confirmationRequired
                    ? {
                        $set: {
                            linkedTransactionId: parsed.data.linkedTransactionId,
                            status: 'linked',
                        },
                    }
                    : {},
                { new: true }
            )
                .populate('categoryId', 'name color type')
                .lean<ISpaceEntry | null>()
        }

        return NextResponse.json({ entry: updatedEntry ?? entry }, { status: 201 })
    } catch (error) {
        console.error('Error al crear movimiento del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
