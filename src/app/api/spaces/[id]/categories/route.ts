import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceCategory } from '@/lib/models'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { extractId } from '@/lib/utils/spaces'
import { normalizeSpaceCategoryName } from '@/lib/utils/space-categories'
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
        const { searchParams } = new URL(request.url)
        const includeArchived = searchParams.get('includeArchived') === 'true'

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const categories = await SpaceCategory.find({
            spaceId: id,
            ...(includeArchived ? {} : { isArchived: false }),
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

        const normalizedName = normalizeSpaceCategoryName(parsed.data.name)
        const existingCategories = await SpaceCategory.find({
            spaceId: id,
            type: parsed.data.type,
        }).lean()
        const duplicate = existingCategories.find(
            (category) => normalizeSpaceCategoryName(category.name) === normalizedName
        )

        if (duplicate) {
            return NextResponse.json(
                {
                    error: duplicate.isArchived
                        ? 'Ya existe una categoría archivada con ese nombre y tipo. Restaurala para volver a usarla.'
                        : 'Ya existe una categoría con ese nombre y tipo en este espacio.',
                },
                { status: 409 }
            )
        }

        const category = await SpaceCategory.create({
            spaceId: id,
            ...parsed.data,
            isDefault: false,
            isArchived: false,
        })

        createSpaceActivityEvent({
            spaceId: id,
            actorUserId: session.user.id,
            actorParticipantId: extractId(context.currentParticipant?._id),
            type: 'category_created',
            entityType: 'category',
            entityId: extractId(category._id),
            title: `${context.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} creó la categoría ${category.name}`,
            metadata: {
                categoryName: category.name,
            },
        }).catch((err) => console.error('[space-activity]', err))

        return NextResponse.json({ category }, { status: 201 })
    } catch (error) {
        console.error('Error al crear categoría del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
