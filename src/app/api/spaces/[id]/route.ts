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
import {
    changeSpaceDebtModeV2,
    changeSpaceLifecycleV2,
    updateSpaceSettingsV2,
} from '@/lib/server/space-management-service-v2'

const spacePatchV2Schema = z.discriminatedUnion('intent', [
    z.object({
        intent: z.literal('settings'),
        expectedRevision: z.number().int().nonnegative(),
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).optional(),
        currencies: z.array(z.string().min(1).max(12)).min(1).max(20),
        reportingCurrency: z.string().min(1).max(12),
        defaultSplitMode: z.enum(['none', 'equal', 'percentage', 'fixed']),
        timezone: z.string().trim().min(1).max(100),
    }).strict(),
    z.object({
        intent: z.literal('lifecycle'),
        expectedRevision: z.number().int().nonnegative(),
        targetStatus: z.enum(['active', 'paused', 'closed', 'archived']),
    }).strict(),
    z.object({
        intent: z.literal('debt_mode'),
        expectedRevision: z.number().int().nonnegative(),
        debtMode: z.enum(['direct', 'simplified']),
    }).strict(),
])

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const { searchParams } = new URL(request.url)
        await connectDB()
        const payload = await getSpaceDetailV2({
            spaceId: id,
            actorUserId: session.user.id,
            cursor: searchParams.get('cursor'),
            limit: searchParams.get('limit'),
            originalCurrencies: searchParams.getAll('originalCurrency'),
            paidCurrencies: searchParams.getAll('paidCurrency'),
            debtCurrencies: searchParams.getAll('debtCurrency'),
        })
        return NextResponse.json({ data: payload })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo obtener el Espacio.')
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params
        const body: unknown = await request.json()
        await connectDB()
        const contract = await Space.findById(id, { contractVersion: 1 }).lean<{ contractVersion?: number } | null>()
        if (!contract) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        if (contract.contractVersion !== 2) {
            throw new ServiceError(409, 'SPACE_LEGACY_WRITE_RETIRED', 'Este Espacio requiere migración antes de modificarse.')
        }
        const parsed = spacePatchV2Schema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({
                error: 'La modificación del Espacio no es válida.',
                code: 'SPACE_MUTATION_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        const idempotencyKey = requireIdempotencyKey(request)
        const data = parsed.data
        const execution = data.intent === 'settings'
            ? await updateSpaceSettingsV2({ actorUserId: session.user.id, spaceId: id, idempotencyKey, ...data })
            : data.intent === 'lifecycle'
                ? await changeSpaceLifecycleV2({ actorUserId: session.user.id, spaceId: id, idempotencyKey, ...data })
                : await changeSpaceDebtModeV2({ actorUserId: session.user.id, spaceId: id, idempotencyKey, ...data })
        return NextResponse.json(toSpaceMutationResult<unknown>(execution))
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo actualizar el Espacio.')
    }
}
