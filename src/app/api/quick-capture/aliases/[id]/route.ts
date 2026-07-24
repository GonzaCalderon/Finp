import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { QuickCaptureAlias } from '@/lib/models'
import { isServiceError } from '@/lib/server/errors'
import {
    serializeQuickCaptureAliases,
    validateQuickCaptureAliasTarget,
} from '@/lib/server/quick-capture'
import { normalizeQuickCaptureTerm } from '@/lib/utils/quick-capture'

const updateAliasSchema = z.object({
    term: z.string().trim().min(2).max(80),
    targetType: z.enum(['account', 'category', 'merchant', 'description']),
    targetId: z.string().trim().min(1).optional(),
    targetValue: z.string().trim().min(1).max(200).optional(),
})

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const parsed = updateAliasSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({ error: 'Atajo invalido' }, { status: 400 })
        }
        const { id } = await params
        await connectDB()
        await validateQuickCaptureAliasTarget({
            userId: session.user.id,
            ...parsed.data,
        })
        const document = await QuickCaptureAlias.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            {
                $set: {
                    term: parsed.data.term,
                    normalizedTerm: normalizeQuickCaptureTerm(parsed.data.term),
                    targetType: parsed.data.targetType,
                    targetId:
                        parsed.data.targetType === 'account' || parsed.data.targetType === 'category'
                            ? parsed.data.targetId
                            : undefined,
                    targetValue:
                        parsed.data.targetType === 'merchant' || parsed.data.targetType === 'description'
                            ? parsed.data.targetValue
                            : undefined,
                },
                $unset: {
                    ...(parsed.data.targetType === 'account' || parsed.data.targetType === 'category'
                        ? { targetValue: 1 }
                        : { targetId: 1 }),
                },
            },
            { new: true }
        )
        if (!document) {
            return NextResponse.json({ error: 'Atajo no encontrado' }, { status: 404 })
        }
        const [alias] = await serializeQuickCaptureAliases(session.user.id, [document])
        return NextResponse.json({ alias })
    } catch (error) {
        if (isServiceError(error)) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.status }
            )
        }
        console.error('Error al actualizar atajo de captura:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const { id } = await params
        await connectDB()
        const deleted = await QuickCaptureAlias.findOneAndDelete({
            _id: id,
            userId: session.user.id,
        })
        if (!deleted) {
            return NextResponse.json({ error: 'Atajo no encontrado' }, { status: 404 })
        }
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al eliminar atajo de captura:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
