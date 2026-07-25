import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { recordQuickCaptureLearningEvents } from '@/lib/server/quick-capture-learning'

const eventSchema = z.object({
    eventId: z.string().trim().min(1).max(120),
    sessionId: z.string().trim().min(1).max(120),
    type: z.enum([
        'capture_opened',
        'suggestion_shown',
        'suggestion_accepted',
        'suggestion_dismissed',
        'suggestion_reverted',
        'field_corrected',
        'capture_abandoned',
        'capture_handoff',
        'capture_confirmed',
        'transaction_edited',
        'transaction_deleted',
        'transaction_undone',
        'intent_detected',
        'intent_accepted',
        'intent_dismissed',
        'intent_completed',
    ]),
    method: z.enum([
        'automatic',
        'enter',
        'tab',
        'space',
        'tap',
        'always',
        'escape',
        'double_space',
        'manual',
        'close',
        'handoff',
        'submit',
        'delete',
        'undo',
        'derive',
        'never',
    ]).optional(),
    inputTerms: z.array(z.string().max(80)).max(20).optional(),
    transactionType: z.enum(['expense', 'income']).optional(),
    currency: z.enum(['ARS', 'USD']).optional(),
    accountId: z.string().trim().max(80).optional(),
    categoryId: z.string().trim().max(80).optional(),
    merchantTerm: z.string().trim().max(200).optional(),
    suggestionId: z.string().trim().max(240).optional(),
    patternKey: z.string().trim().max(80).optional(),
    source: z.enum([
        'alias',
        'rule',
        'learned',
        'frequent',
        'entity',
        'similarity',
        'date',
    ]).optional(),
    targetType: z.enum([
        'account',
        'category',
        'merchant',
        'description',
        'date',
    ]).optional(),
    targetId: z.string().trim().max(80).optional(),
    targetValue: z.string().trim().max(240).optional(),
    confidence: z.number().min(0).max(1).optional(),
    position: z.number().int().min(0).max(50).optional(),
    durationMs: z.number().min(0).max(86_400_000).optional(),
    transactionId: z.string().trim().max(80).optional(),
})

const bodySchema = z.object({
    events: z.array(eventSchema).min(1).max(50),
})

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const parsed = bodySchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Eventos de aprendizaje inválidos' },
                { status: 400 }
            )
        }
        await connectDB()
        await recordQuickCaptureLearningEvents(
            session.user.id,
            parsed.data.events
        )
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al registrar aprendizaje de captura:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
