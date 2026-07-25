import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { FunctionalSuggestionDismissal } from '@/lib/models'

const dismissSchema = z.object({
    intent: z.string().trim().min(1).max(60),
    subjectKey: z.string().trim().min(1).max(300),
})

/**
 * Silencia una sugerencia funcional de forma persistente.
 *
 * Es idempotente: volver a descartar la misma propuesta no falla. El descarte no
 * borra ni modifica nada financiero, sólo deja de proponer.
 */
export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const parsed = dismissSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Descarte inválido', code: 'INVALID_SUGGESTION_DISMISSAL' },
                { status: 400 }
            )
        }

        await connectDB()

        await FunctionalSuggestionDismissal.updateOne(
            { userId: session.user.id, subjectKey: parsed.data.subjectKey },
            {
                $set: { intent: parsed.data.intent },
                $setOnInsert: { dismissedAt: new Date() },
            },
            { upsert: true }
        )

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al descartar la sugerencia:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

/** Deshace el silenciamiento, para que la propuesta pueda volver a aparecer. */
export async function DELETE(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const subjectKey = new URL(request.url).searchParams.get('subjectKey')
        if (!subjectKey) {
            return NextResponse.json(
                { error: 'Falta subjectKey', code: 'MISSING_SUBJECT_KEY' },
                { status: 400 }
            )
        }

        await connectDB()
        await FunctionalSuggestionDismissal.deleteOne({ userId: session.user.id, subjectKey })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al restaurar la sugerencia:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
