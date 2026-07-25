import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ScheduledCommitment } from '@/lib/models'
import { commitmentAmountEntryApiSchema } from '@/lib/validations'

/**
 * Agrega un tramo a la agenda de montos del compromiso: el importe vigente a
 * partir de una fecha efectiva.
 *
 * No toca las aplicaciones ya registradas — cada una conserva su snapshot — y
 * tampoco pisa el monto base de la plantilla, que sigue siendo el valor de
 * referencia cuando no hay ningún tramo vigente.
 */
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

        const parsed = commitmentAmountEntryApiSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Tramo de monto inválido',
                    code: 'INVALID_COMMITMENT_AMOUNT_ENTRY',
                    details: parsed.error.issues,
                },
                { status: 400 }
            )
        }

        const { effectiveFrom, amount, note } = parsed.data

        await connectDB()

        const commitment = await ScheduledCommitment.findOne({ _id: id, userId: session.user.id })
        if (!commitment) {
            return NextResponse.json({ error: 'Compromiso no encontrado' }, { status: 404 })
        }

        const entry = {
            effectiveFrom,
            amount,
            source: 'manual' as const,
            note,
            createdAt: new Date(),
        }

        // Un solo tramo por fecha efectiva: repetir la misma fecha corrige el
        // importe en vez de acumular dos tramos ambiguos.
        const schedule = (commitment.amountSchedule ?? []).filter(
            (existing) => new Date(existing.effectiveFrom).getTime() !== effectiveFrom.getTime()
        )
        schedule.push(entry)
        schedule.sort(
            (a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime()
        )

        commitment.amountSchedule = schedule
        await commitment.save()

        return NextResponse.json({ commitment }, { status: 201 })
    } catch (error) {
        console.error('Error al agregar tramo de monto:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

/** Elimina un tramo por su fecha efectiva (`?effectiveFrom=YYYY-MM-DD`). */
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
        const raw = new URL(request.url).searchParams.get('effectiveFrom')
        const effectiveFrom = raw ? new Date(raw) : null

        if (!effectiveFrom || Number.isNaN(effectiveFrom.getTime())) {
            return NextResponse.json(
                { error: 'Fecha efectiva inválida', code: 'INVALID_EFFECTIVE_FROM' },
                { status: 400 }
            )
        }

        await connectDB()

        const commitment = await ScheduledCommitment.findOne({ _id: id, userId: session.user.id })
        if (!commitment) {
            return NextResponse.json({ error: 'Compromiso no encontrado' }, { status: 404 })
        }

        commitment.amountSchedule = (commitment.amountSchedule ?? []).filter(
            (existing) => new Date(existing.effectiveFrom).getTime() !== effectiveFrom.getTime()
        )
        await commitment.save()

        return NextResponse.json({ commitment })
    } catch (error) {
        console.error('Error al eliminar tramo de monto:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
