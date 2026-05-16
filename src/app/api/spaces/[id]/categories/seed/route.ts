import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceCategory } from '@/lib/models'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import {
    getDefaultSpaceCategories,
    normalizeSpaceCategoryName,
} from '@/lib/utils/space-categories'

function canManageSpace(context: { isOwner: boolean; currentParticipant?: { role?: string } | null }) {
    return context.isOwner || context.currentParticipant?.role === 'owner' || context.currentParticipant?.role === 'admin'
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

        const [existingCategories, defaults] = await Promise.all([
            SpaceCategory.find({ spaceId: id }).lean(),
            Promise.resolve(getDefaultSpaceCategories(context.space.type)),
        ])

        const existingKeys = new Set(
            existingCategories.map((category) =>
                `${normalizeSpaceCategoryName(category.name)}:${category.type}`
            )
        )
        const categoriesToCreate = defaults.filter(
            (category) =>
                !existingKeys.has(`${normalizeSpaceCategoryName(category.name)}:${category.type}`)
        )

        const created = categoriesToCreate.length
            ? await SpaceCategory.insertMany(
                categoriesToCreate.map((category) => ({
                    spaceId: id,
                    ...category,
                    isDefault: true,
                    isArchived: false,
                }))
            )
            : []

        const categories = await SpaceCategory.find({
            spaceId: id,
            isArchived: false,
        })
            .sort({ name: 1 })
            .lean()

        return NextResponse.json({ created, categories })
    } catch (error) {
        console.error('Error al crear categorías sugeridas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
