import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space, SpaceCategory, SpaceParticipant } from '@/lib/models'
import { getUnreadActivityCount } from '@/lib/server/space-activity'
import { buildSpaceListItems, getPendingSpaceActions } from '@/lib/server/spaces'
import { spaceSchema } from '@/lib/validations'
import { getDefaultSpaceCategories } from '@/lib/utils/space-categories'
import { normalizeSpaceCurrencies } from '@/lib/utils/spaces'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const [spaces, pendingActions, unreadActivityCount] = await Promise.all([
            buildSpaceListItems(session.user.id),
            getPendingSpaceActions(session.user.id),
            getUnreadActivityCount(session.user.id),
        ])

        return NextResponse.json({
            spaces,
            pendingActions,
            pendingCount: pendingActions.length + unreadActivityCount,
            unreadActivityCount,
            currentUserId: session.user.id,
        })
    } catch (error) {
        console.error('Error al obtener espacios:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const parsed = spaceSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de espacio inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const normalizedCurrencies = normalizeSpaceCurrencies(
            parsed.data.currencies,
            parsed.data.reportingCurrency
        )

        const space = await Space.create({
            ownerUserId: session.user.id,
            ...parsed.data,
            currencies: normalizedCurrencies,
            defaultSplitMode: parsed.data.mode === 'solo' ? 'none' : parsed.data.defaultSplitMode,
            closedAt: parsed.data.status === 'closed' ? new Date() : undefined,
        })

        await SpaceParticipant.create({
            spaceId: space._id,
            kind: 'finp_user',
            userId: session.user.id,
            displayName: session.user.name ?? session.user.email ?? 'Vos',
            email: session.user.email ?? undefined,
            role: 'owner',
            inviteStatus: 'accepted',
            isActive: true,
        })

        const defaults = getDefaultSpaceCategories(space.type)
        if (defaults.length > 0) {
            await SpaceCategory.insertMany(
                defaults.map((category) => ({
                    spaceId: space._id,
                    ...category,
                    isDefault: true,
                    isArchived: false,
                }))
            )
        }

        return NextResponse.json({ space }, { status: 201 })
    } catch (error) {
        console.error('Error al crear espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
