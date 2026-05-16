import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntryPersonalImpact } from '@/lib/models'
import { resolveNotificationsForTarget } from '@/lib/server/notifications'
import { NOTIFICATION_ACTION_STATUSES, SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import type { ISpaceEntryPersonalImpact } from '@/types'

type Params = Promise<{ id: string; entryId: string }>

export async function PATCH(_request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })

        // Marcar el impacto needs_review como revisado y mantener el vínculo con la transacción
        const resolved = await SpaceEntryPersonalImpact.findOneAndUpdate(
            {
                spaceId: id,
                entryId,
                userId: session.user.id,
                status: SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
            },
            {
                $set: {
                    status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
                    reviewedAt: new Date(),
                    reviewedResolution: 'kept',
                },
            },
            { new: false }
        ).lean<ISpaceEntryPersonalImpact | null>()

        if (!resolved) {
            return NextResponse.json({ error: 'Impacto no encontrado o ya resuelto' }, { status: 404 })
        }

        await resolveNotificationsForTarget({
            personalImpactId: resolved._id.toString(),
            actionStatus: NOTIFICATION_ACTION_STATUSES.COMPLETED,
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al resolver impacto personal:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
