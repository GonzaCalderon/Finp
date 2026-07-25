import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { RuleSuggestionDismissal } from '@/lib/models'

const dismissSchema = z.object({
    key: z.string().trim().min(1).max(500),
})

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const parsed = dismissSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Sugerencia inválida' },
                { status: 400 }
            )
        }

        await connectDB()
        await RuleSuggestionDismissal.updateOne(
            {
                userId: session.user.id,
                key: parsed.data.key,
            },
            {
                $setOnInsert: {
                    userId: session.user.id,
                    key: parsed.data.key,
                    dismissedAt: new Date(),
                },
            },
            { upsert: true }
        )

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al descartar sugerencia de regla:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
