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
import { conversionSnapshotSchema, moneyDtoSchema } from '@/lib/validations/space-money-v2'

const componentSchema = z.object({
    debtId: z.string().min(1).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().finite().positive().optional(),
    money: moneyDtoSchema.optional(),
    order: z.number().int().nonnegative(),
}).strict().refine((value) => value.amount !== undefined || value.money !== undefined, {
    message: 'El componente necesita un monto.',
})

const legSchema = z.object({
    id: z.string().min(1).max(80),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().finite().positive().optional(),
    money: moneyDtoSchema.optional(),
    accountId: z.string().min(1).optional(),
    linkedTransactionId: z.string().min(1).optional(),
    reportingSnapshot: conversionSnapshotSchema.optional(),
    expectedQuoteFingerprint: z.string().min(8).max(64).optional(),
    conversions: z.array(z.object({
        targetCurrency: z.string().regex(/^[A-Z]{3}$/),
        snapshot: conversionSnapshotSchema,
        expectedQuoteFingerprint: z.string().min(8).max(64).optional(),
    }).strict()).max(20).optional(),
}).strict().superRefine((value, context) => {
    if (value.amount === undefined && value.money === undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'El tramo necesita un monto.' })
    }
    if (value.accountId && value.linkedTransactionId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Elegí una cuenta o una transacción vinculada.' })
    }
})

const common = {
    expectedRevision: z.number().int().nonnegative(),
    amount: z.number().finite().positive().optional(),
    currency: z.string().min(1).max(12).optional(),
    exchangeRate: z.number().finite().positive().optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().trim().max(200).optional(),
    components: z.array(componentSchema).min(1).max(50).optional(),
    legs: z.array(legSchema).min(1).max(20).optional(),
}

const settlementSchema = z.discriminatedUnion('mode', [
    z.object({
        ...common,
        mode: z.literal('own'),
        debtId: z.string().min(1).optional(),
        accountId: z.string().min(1).optional(),
    }).strict(),
    z.object({
        ...common,
        mode: z.literal('represented'),
        payerParticipantId: z.string().min(1),
        receiverParticipantId: z.string().min(1),
    }).strict(),
]).superRefine((value, context) => {
    const legacyComplete = value.amount !== undefined && value.currency !== undefined
    if (!legacyComplete && (!value.components?.length || !value.legs?.length)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La liquidación necesita componentes y tramos completos.',
        })
    }
    if (value.mode === 'own' && !value.debtId && !value.components?.some((component) => component.debtId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Elegí la deuda que querés liquidar.' })
    }
})

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
