import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space } from '@/lib/models'
import {
    getAccessibleSpaceContext,
} from '@/lib/server/spaces'
import { getSpaceDetailV2 } from '@/lib/server/space-read-service-v2'
import { enterLegacySpaceWriteFacade } from '@/lib/server/space-legacy-write-facade'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import {
    requireIdempotencyKey,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
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
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { syncSpaceDebtsForActiveParticipants } from '@/lib/server/debt-sync'
import { updateSpaceVirtualCategoryNames } from '@/lib/server/space-personal-settings'
import { spaceSchema } from '@/lib/validations'
import {
    extractId,
    normalizeSpaceCurrencies,
} from '@/lib/utils/spaces'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const body: unknown = await request.json()
        await connectDB()
        const contract = await Space.findById(id, { contractVersion: 1, migration: 1 })
            .lean<{ contractVersion?: number; migration?: { state?: string } } | null>()
        if (!contract) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        if (contract.contractVersion === 2) {
            const parsedV2 = spacePatchV2Schema.safeParse(body)
            if (!parsedV2.success) {
                return NextResponse.json({
                    error: 'Datos de Espacio inválidos',
                    code: 'SPACE_PATCH_INVALID',
                    failureState: 'not_started',
                    retryable: false,
                    details: parsedV2.error.flatten(),
                }, { status: 400 })
            }
            const idempotencyKey = requireIdempotencyKey(request)
            const data = parsedV2.data
            const execution = data.intent === 'settings'
                ? await updateSpaceSettingsV2({
                    actorUserId: session.user.id,
                    spaceId: id,
                    idempotencyKey,
                    ...data,
                })
                : data.intent === 'lifecycle'
                    ? await changeSpaceLifecycleV2({
                        actorUserId: session.user.id,
                        spaceId: id,
                        idempotencyKey,
                        expectedRevision: data.expectedRevision,
                        targetStatus: data.targetStatus,
                    })
                    : await changeSpaceDebtModeV2({
                        actorUserId: session.user.id,
                        spaceId: id,
                        idempotencyKey,
                        expectedRevision: data.expectedRevision,
                        debtMode: data.debtMode,
                    })
            return NextResponse.json(toSpaceMutationResult<unknown>(execution))
        }
        enterLegacySpaceWriteFacade(contract)
        const parsed = spaceSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de espacio inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const context = await getAccessibleSpaceContext(id, session.user.id)

        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const canManage =
            context.isOwner ||
            context.currentParticipant?.role === 'owner' ||
            context.currentParticipant?.role === 'admin'

        if (!canManage) {
            return NextResponse.json(
                { error: 'No tenés permisos para editar este espacio' },
                { status: 403 }
            )
        }

        if (
            parsed.data.mode === 'solo' &&
            context.participants.filter((participant) => participant.isActive).length > 1
        ) {
            return NextResponse.json(
                {
                    error: 'No podés pasar un espacio con más de un participante activo a modo solo.',
                },
                { status: 400 }
            )
        }

        const normalizedCurrencies = normalizeSpaceCurrencies(
            parsed.data.currencies,
            parsed.data.reportingCurrency
        )

        const { simplifyDebts, endDate, ...restData } = parsed.data
        const shouldUnsetSimplifyDebts = simplifyDebts === null || simplifyDebts === undefined
        const shouldUnsetEndDate = endDate === null

        const baseSet: Record<string, unknown> = {
            ...restData,
            currencies: normalizedCurrencies,
            defaultSplitMode: parsed.data.mode === 'solo' ? 'none' : parsed.data.defaultSplitMode,
        }
        if (!shouldUnsetSimplifyDebts) {
            baseSet.simplifyDebts = simplifyDebts
        }
        if (!shouldUnsetEndDate && endDate !== undefined) {
            baseSet.endDate = endDate
        }

        const unsetFields: Record<string, 1> = {
            ...(shouldUnsetSimplifyDebts ? { simplifyDebts: 1 } : {}),
            ...(shouldUnsetEndDate ? { endDate: 1 } : {}),
        }

        const update =
            parsed.data.status === 'closed'
                ? {
                    $set: { ...baseSet, closedAt: context.space.closedAt ?? new Date() },
                    ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
                }
                : {
                    $set: baseSet,
                    $unset: { closedAt: 1, ...unsetFields },
                }

        const space = await Space.findByIdAndUpdate(
            id,
            update,
            { new: true }
        )

        if (!space) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const changedFields = Object.entries({
            name: parsed.data.name,
            description: parsed.data.description,
            type: parsed.data.type,
            mode: parsed.data.mode,
            status: parsed.data.status,
            reportingCurrency: parsed.data.reportingCurrency,
            defaultSplitMode: parsed.data.defaultSplitMode,
        })
            .filter(([key, value]) => context.space[key as keyof typeof context.space] !== value)
            .map(([key]) => key)

        createSpaceActivityEvent({
            spaceId: id,
            actorUserId: session.user.id,
            actorParticipantId: extractId(context.currentParticipant?._id),
            type: 'space_updated',
            entityType: 'space',
            entityId: extractId(space._id),
            title: `${context.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} actualizó la configuración del espacio`,
            metadata: {
                changedFields,
            },
        }).catch((err) => console.error('[space-activity]', err))

        if (parsed.data.debtMode !== undefined) {
            try {
                await syncSpaceDebtsForActiveParticipants(id)
            } catch (err) {
                console.error('[debt-sync] space PATCH debtMode:', err)
            }
        }

        if (context.space.name !== space.name) {
            await updateSpaceVirtualCategoryNames(id, space.name)
        }

        return NextResponse.json({ space })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo actualizar el Espacio.')
    }
}
