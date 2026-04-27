import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceCategory } from '@/lib/models'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spaceCategorySchema } from '@/lib/validations'

function canManageSpace(context: { isOwner: boolean; currentParticipant?: { role?: string } | null }) {
    return context.isOwner || context.currentParticipant?.role === 'owner' || context.currentParticipant?.role === 'admin'
}

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

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const categories = await SpaceCategory.find({
            spaceId: id,
            isArchived: false,
        })
            .sort({ name: 1 })
            .lean()

        return NextResponse.json({ categories })
    } catch (error) {
        console.error('Error al obtener categorías del espacio:', error)
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
        const parsed = spaceCategorySchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de categoría inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        if (!canManageSpace(context)) {
            return NextResponse.json(
                { error: 'No tenés permisos para editar categorías.' },
                { status: 403 }
            )
        }

        const category = await SpaceCategory.create({
            spaceId: id,
            ...parsed.data,
            isDefault: false,
            isArchived: false,
        })

        return NextResponse.json({ category }, { status: 201 })
    } catch (error) {
        console.error('Error al crear categoría del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
