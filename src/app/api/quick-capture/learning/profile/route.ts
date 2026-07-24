import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { updateQuickCaptureLearningProfile } from '@/lib/server/quick-capture-learning'

const bodySchema = z.object({
    enabled: z.boolean().optional(),
    markIntroSeen: z.boolean().optional(),
}).refine(
    (value) =>
        typeof value.enabled === 'boolean' || value.markIntroSeen === true,
    { message: 'No hay cambios para guardar' }
)

export async function PATCH(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const parsed = bodySchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Preferencia inválida' },
                { status: 400 }
            )
        }
        await connectDB()
        const profile = await updateQuickCaptureLearningProfile({
            userId: session.user.id,
            ...parsed.data,
        })
        return NextResponse.json({ profile })
    } catch (error) {
        console.error('Error al actualizar aprendizaje de captura:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
