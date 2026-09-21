import { NextResponse } from 'next/server'
import { Types } from 'mongoose'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry } from '@/lib/models'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { ServiceError } from '@/lib/server/errors'
import { voidSpaceEntryV2 } from '@/lib/server/space-entry-history-service-v2'

type Params = Promise<{ id: string; entryId: string }>

export async function POST(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }
        const body: unknown = await request.json()
        const expectedRevision = (body as { expectedRevision?: unknown }).expectedRevision
        if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
            return NextResponse.json({
                error: 'La anulación requiere expectedRevision.',
                code: 'EXPECTED_REVISION_REQUIRED',
                failureState: 'not_started',
                retryable: false,
            }, { status: 400 })
        }

        await connectDB()
        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id }, { contractVersion: 1 })
            .lean<{ contractVersion?: number } | null>()
        if (!entry) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        if (entry.contractVersion !== 2) {
            throw new ServiceError(409, 'SPACE_LEGACY_WRITE_RETIRED', 'Este movimiento requiere migración antes de anularse.')
        }

        const execution = await voidSpaceEntryV2({
            actorUserId: session.user.id,
            spaceId: id,
            entryId,
            expectedRevision: expectedRevision as number,
            idempotencyKey: requireIdempotencyKey(request),
            reason: typeof (body as { reason?: unknown }).reason === 'string'
                ? (body as { reason: string }).reason
                : '',
        })
        return NextResponse.json(toSpaceMutationResult(execution))
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo anular el movimiento.')
    }
}
