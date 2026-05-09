import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry, SpaceEntryPersonalImpact } from '@/lib/models'
import { SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import type { ISpaceEntry, ISpaceEntryPersonalImpact } from '@/types'
import { extractId } from '@/lib/utils/spaces'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const statusParam = searchParams.get('status') ?? SPACE_PERSONAL_IMPACT_STATUSES.PENDING
        const typeParam = searchParams.get('type')
        const spaceIdParam = searchParams.get('spaceId')
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

        const allowedStatuses = Object.values(SPACE_PERSONAL_IMPACT_STATUSES)
        if (!allowedStatuses.includes(statusParam as typeof allowedStatuses[number])) {
            return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
        }

        await connectDB()

        const query: Record<string, unknown> = {
            userId: new Types.ObjectId(session.user.id),
            status: statusParam,
        }

        if (typeParam) query.actionType = typeParam
        if (spaceIdParam && Types.ObjectId.isValid(spaceIdParam)) {
            query.spaceId = new Types.ObjectId(spaceIdParam)
        }

        const pendingActions = await SpaceEntryPersonalImpact.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean<ISpaceEntryPersonalImpact[]>()

        const total = await SpaceEntryPersonalImpact.countDocuments(query)

        // Enriquecer con datos del entry (título, tipo, monto)
        const entryIds = pendingActions
            .map((a) => extractId(a.entryId))
            .filter((id): id is string => Boolean(id))

        const entriesMap = new Map<string, Pick<ISpaceEntry, 'title' | 'type' | 'amount' | 'currency'>>()
        if (entryIds.length > 0) {
            const entries = await SpaceEntry.find(
                { _id: { $in: entryIds } },
                { title: 1, type: 1, amount: 1, currency: 1 }
            ).lean<ISpaceEntry[]>()
            entries.forEach((e) => {
                const id = extractId(e._id)
                if (id) entriesMap.set(id, e)
            })
        }

        const enriched = pendingActions.map((action) => {
            const entryId = extractId(action.entryId)
            const entry = entryId ? entriesMap.get(entryId) : undefined
            return {
                ...action,
                entrySnapshot: entry
                    ? { title: entry.title, type: entry.type, amount: entry.amount, currency: entry.currency }
                    : undefined,
            }
        })

        return NextResponse.json({ pendingActions: enriched, total })
    } catch (error) {
        console.error('Error al obtener pendientes personales:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
