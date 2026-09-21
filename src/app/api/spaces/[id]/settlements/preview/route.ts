import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import {
    previewSpaceSettlementMultiV2,
    previewSpaceSettlementV2,
} from '@/lib/server/space-financial-preview-v2'
import { conversionSnapshotSchema, moneyDtoSchema } from '@/lib/validations/space-money-v2'

const componentSchema = z.object({
    debtId: z.string().min(1).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().finite().positive().optional(),
    money: moneyDtoSchema.optional(),
    order: z.number().int().nonnegative(),
}).strict()

const legSchema = z.object({
    id: z.string().min(1),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().finite().positive().optional(),
    money: moneyDtoSchema.optional(),
    reportingSnapshot: conversionSnapshotSchema.optional(),
    conversions: z.array(z.object({
        targetCurrency: z.string().regex(/^[A-Z]{3}$/),
        snapshot: conversionSnapshotSchema,
    }).strict()).optional(),
}).strict()

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

const multiPreviewSchema = z.discriminatedUnion('mode', [
    z.object({
        mode: z.literal('own'),
        components: z.array(componentSchema).min(1).max(50),
        legs: z.array(legSchema).min(1).max(20),
    }).strict(),
    z.object({
        mode: z.literal('represented'),
        payerParticipantId: z.string().min(1),
        receiverParticipantId: z.string().min(1),
        components: z.array(componentSchema).min(1).max(50),
        legs: z.array(legSchema).min(1).max(20),
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
        const body: unknown = await request.json()
        const isMulti = Boolean(body && typeof body === 'object' && 'legs' in body)
        const parsed = (isMulti ? multiPreviewSchema : previewSchema).safeParse(body)
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
        const preview = isMulti ? await previewSpaceSettlementMultiV2({
            actorUserId: session.user.id,
            spaceId: id,
            ...(parsed.data as z.infer<typeof multiPreviewSchema>),
        }) : await previewSpaceSettlementV2({
            actorUserId: session.user.id,
            spaceId: id,
            ...(parsed.data as z.infer<typeof previewSchema>),
        })
        return NextResponse.json({ data: preview })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo calcular la liquidación.')
    }
}
