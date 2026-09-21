import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space } from '@/lib/models'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { ServiceError } from '@/lib/server/errors'
import { getSpaceDetailV2 } from '@/lib/server/space-read-service-v2'
import { addSpaceParticipantV2 } from '@/lib/server/space-management-service-v2'

const participantCreateV2Schema = z.object({
    expectedRevision: z.number().int().nonnegative(),
    kind: z.enum(['finp_user', 'external']),
    displayName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().optional(),
    role: z.enum(['admin', 'participant']),
}).strict()

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        await connectDB()
        const detail = await getSpaceDetailV2({ spaceId: id, actorUserId: session.user.id, limit: 1 })
        return NextResponse.json({ data: detail.participants, capabilities: detail.capabilities })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudieron obtener los participantes.')
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const body: unknown = await request.json()
        await connectDB()
        const contract = await Space.findById(id, { contractVersion: 1 }).lean<{ contractVersion?: number } | null>()
        if (!contract) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        if (contract.contractVersion !== 2) {
            throw new ServiceError(409, 'SPACE_LEGACY_WRITE_RETIRED', 'Este Espacio requiere migración antes de sumar participantes.')
        }
        const parsed = participantCreateV2Schema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Datos de participante inválidos',
                code: 'SPACE_PARTICIPANT_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        const execution = await addSpaceParticipantV2({
            actorUserId: session.user.id,
            spaceId: id,
            idempotencyKey: requireIdempotencyKey(request),
            ...parsed.data,
        })
        return NextResponse.json(toSpaceMutationResult(execution), { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo agregar el participante.')
    }
}
