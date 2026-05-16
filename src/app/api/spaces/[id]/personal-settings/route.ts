import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceCategory } from '@/lib/models'
import {
    getSpaceVirtualCategory,
    getSuggestedPersonalCategoryStrategy,
    updateParticipantPersonalSettings,
} from '@/lib/server/space-personal-settings'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { extractId } from '@/lib/utils/spaces'
import { spacePersonalSettingsSchema } from '@/lib/validations'

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
        if (!context || !context.currentParticipant) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const [virtualCategory, spaceCategories] = await Promise.all([
            getSpaceVirtualCategory(session.user.id, id),
            SpaceCategory.find({ spaceId: id, isArchived: { $ne: true } })
                .sort({ isDefault: -1, name: 1 })
                .lean(),
        ])
        const suggestedStrategy = getSuggestedPersonalCategoryStrategy(context.space.type)

        return NextResponse.json({
            settings: context.currentParticipant.personalSettings ?? null,
            suggestedStrategy,
            virtualCategory,
            spaceCategories,
            recommendation:
                suggestedStrategy === 'space_name_virtual'
                    ? `Recomendado para ${context.space.type === 'travel' ? 'viajes' : 'este espacio'}: usar el nombre del espacio.`
                    : null,
        })
    } catch (error) {
        console.error('Error al obtener configuración personal del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function PATCH(
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
        const parsed = spacePersonalSettingsSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Configuración inválida', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context || !context.currentParticipant) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const participant = await updateParticipantPersonalSettings({
            spaceId: id,
            userId: session.user.id,
            data: parsed.data,
        })

        if (!participant) {
            return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 })
        }

        const virtualCategory = await getSpaceVirtualCategory(session.user.id, id)

        return NextResponse.json({
            settings: participant.personalSettings,
            suggestedStrategy: getSuggestedPersonalCategoryStrategy(context.space.type),
            virtualCategory,
            participantId: extractId(participant._id),
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error interno del servidor'
        const status = message === 'Error interno del servidor' ? 500 : 400
        console.error('Error al guardar configuración personal del espacio:', error)
        return NextResponse.json({ error: message }, { status })
    }
}
