import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { QuickCaptureAlias } from '@/lib/models'
import { isServiceError } from '@/lib/server/errors'
import {
    serializeQuickCaptureAliases,
    upsertQuickCaptureAlias,
} from '@/lib/server/quick-capture'

const aliasSchema = z.object({
    term: z.string().trim().min(2).max(80),
    targetType: z.enum(['account', 'category', 'merchant', 'description']),
    targetId: z.string().trim().min(1).optional(),
    targetValue: z.string().trim().min(1).max(200).optional(),
})

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        await connectDB()
        const documents = await QuickCaptureAlias.find({ userId: session.user.id })
            .sort({ updatedAt: -1 })
            .lean()
        const aliases = await serializeQuickCaptureAliases(session.user.id, documents)
        return NextResponse.json(
            { aliases },
            { headers: { 'Cache-Control': 'private, no-store' } }
        )
    } catch (error) {
        console.error('Error al obtener atajos de captura:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const parsed = aliasSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Atajo invalido', details: parsed.error.flatten() },
                { status: 400 }
            )
        }
        await connectDB()
        const document = await upsertQuickCaptureAlias({
            userId: session.user.id,
            ...parsed.data,
        })
        const [alias] = await serializeQuickCaptureAliases(session.user.id, [document])
        return NextResponse.json({ alias }, { status: 201 })
    } catch (error) {
        if (isServiceError(error)) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.status }
            )
        }
        console.error('Error al crear atajo de captura:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
