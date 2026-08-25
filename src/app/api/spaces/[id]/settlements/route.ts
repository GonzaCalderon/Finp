import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { settleSpaceDebtV2 } from '@/lib/server/space-settlement-service-v2'

const common = {
    expectedRevision: z.number().int().nonnegative(),
    amount: z.number().finite().positive(),
    currency: z.string().min(1).max(12),
    exchangeRate: z.number().finite().positive().optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().trim().max(200).optional(),
}

const settlementSchema = z.discriminatedUnion('mode', [
    z.object({
        ...common,
        mode: z.literal('own'),
        debtId: z.string().min(1),
        accountId: z.string().min(1),
    }).strict(),
    z.object({
        ...common,
        mode: z.literal('represented'),
        payerParticipantId: z.string().min(1),
        receiverParticipantId: z.string().min(1),
    }).strict(),
])

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const parsed = settlementSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Datos de liquidación inválidos',
                code: 'SPACE_SETTLEMENT_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        await connectDB()
        const execution = await settleSpaceDebtV2({
            actorUserId: session.user.id,
            spaceId: id,
            idempotencyKey: requireIdempotencyKey(request),
            originSurface: 'spaces',
            ...parsed.data,
        })
        return NextResponse.json(toSpaceMutationResult(execution), { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo registrar la liquidación.')
    }
}
