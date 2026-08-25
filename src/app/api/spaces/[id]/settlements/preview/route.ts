import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import { previewSpaceSettlementV2 } from '@/lib/server/space-financial-preview-v2'

const previewSchema = z.discriminatedUnion('mode', [
    z.object({
        mode: z.literal('own'),
        debtId: z.string().min(1),
        amount: z.number().finite().positive(),
        currency: z.string().min(1).max(12),
        exchangeRate: z.number().finite().positive().optional(),
    }).strict(),
    z.object({
        mode: z.literal('represented'),
        payerParticipantId: z.string().min(1),
        receiverParticipantId: z.string().min(1),
        amount: z.number().finite().positive(),
        currency: z.string().min(1).max(12),
        exchangeRate: z.number().finite().positive().optional(),
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
        const parsed = previewSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Datos de preview inválidos',
                code: 'SPACE_SETTLEMENT_PREVIEW_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        await connectDB()
        const preview = await previewSpaceSettlementV2({
            actorUserId: session.user.id,
            spaceId: id,
            ...parsed.data,
        })
        return NextResponse.json({ data: preview })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo calcular la liquidación.')
    }
}
