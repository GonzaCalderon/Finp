import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space } from '@/lib/models'
import {
    requireExpectedRevision,
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { createSpaceEntryV2 } from '@/lib/server/space-entry-service-v2'
import { getSpaceDetailV2 } from '@/lib/server/space-read-service-v2'
import { ServiceError } from '@/lib/server/errors'
import { conversionSnapshotSchema, moneyDtoSchema } from '@/lib/validations/space-money-v2'

const spaceEntryV2RequestSchema = z.object({
    expectedRevision: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
    amount: z.number().finite().positive(),
    money: moneyDtoSchema.optional(),
    currency: z.string().min(1).max(12),
    exchangeRate: z.number().finite().positive().optional(),
    exchangeRateDecimal: z.string().regex(/^\d+(?:\.\d+)?$/).optional(),
    conversionSnapshot: conversionSnapshotSchema.optional(),
    expectedQuoteFingerprint: z.string().min(8).max(64).optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paidByParticipantId: z.string().min(1),
    sharedWithParticipantIds: z.array(z.string().min(1)).min(1).max(100),
    splitMode: z.enum(['none', 'equal', 'percentage', 'fixed']),
    splitAllocations: z.array(z.object({
        participantId: z.string().min(1),
        percentage: z.number().finite().nonnegative().optional(),
        amount: z.number().finite().nonnegative().optional(),
    }).strict()).max(100).optional(),
    spaceCategoryId: z.string().optional(),
    notes: z.string().trim().max(1000).optional(),
    personalImpact: z.object({
        accountId: z.string().optional(),
        categoryId: z.string().optional(),
        description: z.string().trim().max(200).optional(),
        linkedTransactionId: z.string().optional(),
    }).strict().superRefine((impact, context) => {
        if (impact.accountId && impact.linkedTransactionId) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Elegí una cuenta nueva o una transacción existente, no ambas.',
                path: ['linkedTransactionId'],
            })
        }
    }).optional(),
}).strict()

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params
        const { searchParams } = new URL(request.url)
        await connectDB()
        const detail = await getSpaceDetailV2({
            spaceId: id,
            actorUserId: session.user.id,
            cursor: searchParams.get('cursor'),
            limit: searchParams.get('limit'),
            originalCurrencies: searchParams.getAll('originalCurrency'),
            paidCurrencies: searchParams.getAll('paidCurrency'),
            debtCurrencies: searchParams.getAll('debtCurrency'),
        })
        return NextResponse.json({
            data: detail.movements,
            readMode: detail.readMode,
            capabilities: detail.capabilities,
            warnings: detail.warnings,
        })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudieron obtener los movimientos.')
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
            throw new ServiceError(409, 'SPACE_LEGACY_WRITE_RETIRED', 'Este Espacio requiere migración antes de registrar movimientos.')
        }

        const parsed = spaceEntryV2RequestSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Datos de movimiento inválidos',
                code: 'SPACE_ENTRY_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        const { expectedRevision, personalImpact: actorPersonalImpact, ...input } = parsed.data
        const execution = await createSpaceEntryV2({
            actorUserId: session.user.id,
            spaceId: id,
            idempotencyKey: requireIdempotencyKey(request),
            expectedRevision: requireExpectedRevision(expectedRevision),
            ...input,
            actorPersonalImpact,
        })
        return NextResponse.json(toSpaceMutationResult(execution), { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo crear el movimiento.')
    }
}
