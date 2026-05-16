import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { migrateSpaceVirtualCategory } from '@/lib/server/space-personal-settings'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { migrateSpaceVirtualCategorySchema } from '@/lib/validations'

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
        const parsed = migrateSpaceVirtualCategorySchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Categoría destino inválida', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context || !context.currentParticipant) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const result = await migrateSpaceVirtualCategory({
            spaceId: id,
            userId: session.user.id,
            targetCategoryId: parsed.data.targetCategoryId,
        })

        return NextResponse.json(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error interno del servidor'
        const status = message === 'Error interno del servidor' ? 500 : 400
        console.error('Error al migrar categoría automática del espacio:', error)
        return NextResponse.json({ error: message }, { status })
    }
}
