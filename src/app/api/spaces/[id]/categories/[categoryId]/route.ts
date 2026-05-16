import { Types } from 'mongoose'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceCategory, SpaceEntry } from '@/lib/models'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spaceCategoryUpdateSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'

function canManageSpace(context: { isOwner: boolean; currentParticipant?: { role?: string } | null }) {
    return context.isOwner || context.currentParticipant?.role === 'owner' || context.currentParticipant?.role === 'admin'
}

async function getEditableContext(spaceId: string, userId: string) {
    const context = await getAccessibleSpaceContext(spaceId, userId)
    if (!context) return { context: null, response: NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 }) }
    if (!canManageSpace(context)) {
        return {
            context: null,
            response: NextResponse.json(
                { error: 'No tenés permisos para editar categorías.' },
                { status: 403 }
            ),
        }
    }
    return { context, response: null }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, categoryId } = await params
        if (!Types.ObjectId.isValid(categoryId)) {
            return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
        }

        const body = await request.json()
        const parsed = spaceCategoryUpdateSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de categoría inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const editable = await getEditableContext(id, session.user.id)
        if (editable.response) return editable.response

        const previousCategory = await SpaceCategory.findOne({ _id: categoryId, spaceId: id }).lean()

        const category = await SpaceCategory.findOneAndUpdate(
            { _id: categoryId, spaceId: id },
            { $set: parsed.data },
            { new: true }
        )

        if (!category) {
            return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
        }

        const becameArchived = previousCategory?.isArchived !== true && category.isArchived === true
        const becameRestored = previousCategory?.isArchived === true && category.isArchived === false

        if (becameArchived || becameRestored) {
            createSpaceActivityEvent({
                spaceId: id,
                actorUserId: session.user.id,
                actorParticipantId: extractId(editable.context?.currentParticipant?._id),
                type: becameArchived ? 'category_archived' : 'category_restored',
                entityType: 'category',
                entityId: extractId(category._id),
                title: `${editable.context?.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} ${becameArchived ? 'archivó' : 'restauró'} la categoría ${category.name}`,
                metadata: {
                    categoryName: category.name,
                },
            }).catch((err) => console.error('[space-activity]', err))
        }

        return NextResponse.json({ category })
    } catch (error) {
        console.error('Error al actualizar categoría del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, categoryId } = await params
        if (!Types.ObjectId.isValid(categoryId)) {
            return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
        }

        await connectDB()

        const editable = await getEditableContext(id, session.user.id)
        if (editable.response) return editable.response

        const category = await SpaceCategory.findOne({ _id: categoryId, spaceId: id })
        if (!category) {
            return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
        }

        const categoryInUse = await SpaceEntry.exists({
            spaceId: id,
            spaceCategoryId: categoryId,
        })

        if (categoryInUse) {
            category.isArchived = true
            await category.save()
            createSpaceActivityEvent({
                spaceId: id,
                actorUserId: session.user.id,
                actorParticipantId: extractId(editable.context?.currentParticipant?._id),
                type: 'category_archived',
                entityType: 'category',
                entityId: extractId(category._id),
                title: `${editable.context?.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} archivó la categoría ${category.name}`,
                metadata: {
                    categoryName: category.name,
                },
            }).catch((err) => console.error('[space-activity]', err))
            return NextResponse.json({ category, archived: true })
        }

        await SpaceCategory.deleteOne({ _id: categoryId, spaceId: id })
        createSpaceActivityEvent({
            spaceId: id,
            actorUserId: session.user.id,
            actorParticipantId: extractId(editable.context?.currentParticipant?._id),
            type: 'category_archived',
            entityType: 'category',
            entityId: extractId(category._id),
            title: `${editable.context?.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} archivó la categoría ${category.name}`,
            metadata: {
                categoryName: category.name,
            },
        }).catch((err) => console.error('[space-activity]', err))
        return NextResponse.json({ success: true, archived: false })
    } catch (error) {
        console.error('Error al eliminar categoría del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
