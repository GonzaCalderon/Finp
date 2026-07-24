import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
    getQuickCaptureLearningPattern,
    updateQuickCapturePatternStatus,
} from '@/lib/server/quick-capture-learning'
import {
    serializeQuickCaptureAliases,
    upsertQuickCaptureAlias,
} from '@/lib/server/quick-capture'
import { isServiceError } from '@/lib/server/errors'

const updateSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.enum(['forget', 'restore']),
    }),
    z.object({
        action: z.literal('correct'),
        targetType: z.enum(['account', 'category', 'merchant', 'description']),
        targetId: z.string().trim().min(1).optional(),
        targetValue: z.string().trim().min(1).max(200).optional(),
    }),
])

export async function GET(
    request: Request,
    { params }: { params: Promise<{ key: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const { key } = await params
        if (!/^[a-f0-9]{64}$/.test(key)) {
            return NextResponse.json({ error: 'Patrón inválido' }, { status: 400 })
        }
        await connectDB()
        const pattern = await getQuickCaptureLearningPattern(session.user.id, key)
        if (!pattern) {
            return NextResponse.json({ error: 'Patrón no encontrado' }, { status: 404 })
        }
        return NextResponse.json(
            { pattern },
            { headers: { 'Cache-Control': 'private, no-store' } }
        )
    } catch (error) {
        console.error('Error al obtener patrón de captura:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ key: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const { key } = await params
        if (!/^[a-f0-9]{64}$/.test(key)) {
            return NextResponse.json({ error: 'Patrón inválido' }, { status: 400 })
        }
        const parsed = updateSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Acción de aprendizaje inválida' },
                { status: 400 }
            )
        }
        await connectDB()
        if (parsed.data.action === 'correct') {
            const pattern = await getQuickCaptureLearningPattern(
                session.user.id,
                key
            )
            if (!pattern) {
                return NextResponse.json(
                    { error: 'Patrón no encontrado' },
                    { status: 404 }
                )
            }
            const document = await upsertQuickCaptureAlias({
                userId: session.user.id,
                term: pattern.triggerLabel.slice(0, 80),
                targetType: parsed.data.targetType,
                targetId: parsed.data.targetId,
                targetValue: parsed.data.targetValue,
            })
            const [alias] = await serializeQuickCaptureAliases(
                session.user.id,
                [document]
            )
            await updateQuickCapturePatternStatus({
                userId: session.user.id,
                patternKey: key,
                status: 'forgotten',
            })
            return NextResponse.json({ alias })
        }

        const pattern = await updateQuickCapturePatternStatus({
            userId: session.user.id,
            patternKey: key,
            status: parsed.data.action === 'forget' ? 'forgotten' : 'active',
        })
        if (!pattern) {
            return NextResponse.json(
                { error: 'Patrón no encontrado' },
                { status: 404 }
            )
        }
        return NextResponse.json({ pattern })
    } catch (error) {
        if (isServiceError(error)) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.status }
            )
        }
        console.error('Error al actualizar patrón de captura:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
