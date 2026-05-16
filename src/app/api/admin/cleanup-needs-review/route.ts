import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import { resolveNotificationsForTarget } from '@/lib/server/notifications'
import { NOTIFICATION_ACTION_STATUSES, SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import type { ISpaceEntryPersonalImpact } from '@/types'

export async function POST() {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        await connectDB()

        const userId = new Types.ObjectId(session.user.id)

        // Buscar todos los impactos propios varados en needs_review sin reviewedAt
        const stale = await SpaceEntryPersonalImpact.find({
            userId,
            status: SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
            reviewedAt: { $exists: false },
        }).lean<ISpaceEntryPersonalImpact[]>()

        if (stale.length === 0) {
            return NextResponse.json({ resolved: 0, kept: 0, removed: 0 })
        }

        // Verificar cuáles siguen teniendo su transacción en la DB
        const txIds = stale
            .map((i) => i.transactionId)
            .filter((id): id is Types.ObjectId => !!id)

        const existingTxIds = new Set(
            (await Transaction.find({ _id: { $in: txIds } }, { _id: 1 }).lean<{ _id: Types.ObjectId }[]>())
                .map((t) => t._id.toString())
        )

        let kept = 0
        let removed = 0

        await Promise.all(
            stale.map(async (impact) => {
                const impactId = impact._id.toString()
                const txExists = impact.transactionId && existingTxIds.has(impact.transactionId.toString())

                if (txExists) {
                    // Transacción mantenida: volver a linked
                    await SpaceEntryPersonalImpact.updateOne(
                        { _id: impact._id },
                        {
                            $set: {
                                status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
                                reviewedAt: new Date(),
                                reviewedResolution: 'kept',
                            },
                        }
                    )
                    kept++
                } else {
                    // Transacción eliminada o inexistente
                    await SpaceEntryPersonalImpact.updateOne(
                        { _id: impact._id },
                        {
                            $set: {
                                status: SPACE_PERSONAL_IMPACT_STATUSES.REMOVED,
                                removedAt: new Date(),
                                reviewedAt: new Date(),
                                reviewedResolution: 'removed',
                            },
                            $unset: { transactionId: 1, accountId: 1 },
                        }
                    )
                    removed++
                }

                await resolveNotificationsForTarget({
                    personalImpactId: impactId,
                    actionStatus: NOTIFICATION_ACTION_STATUSES.COMPLETED,
                })
            })
        )

        return NextResponse.json({ resolved: stale.length, kept, removed })
    } catch (err) {
        console.error('[cleanup-needs-review]', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
