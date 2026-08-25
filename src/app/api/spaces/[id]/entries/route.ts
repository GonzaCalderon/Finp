import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
    Category,
    Space,
    SpaceCategory,
    SpaceEntry,
    Transaction,
} from '@/lib/models'
import {
    createPersonalImpactFromSpaceEntry,
} from '@/lib/server/space-personal-impact'
import {
    getAccessibleSpaceContext,
} from '@/lib/server/spaces'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { syncSpaceDebtsForActiveParticipants } from '@/lib/server/debt-sync'
import {
    buildEntryPendingTargets,
    emitPersonalSyncEvent,
} from '@/lib/server/personal-sync-events'
import { spaceEntrySchema } from '@/lib/validations'
import { calculateReportingAmount, extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry } from '@/types'
import { getSpaceDetailV2 } from '@/lib/server/space-read-service-v2'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import {
    requireExpectedRevision,
    requireIdempotencyKey,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { createSpaceEntryV2 } from '@/lib/server/space-entry-service-v2'
import { enterLegacySpaceWriteFacade } from '@/lib/server/space-legacy-write-facade'
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

export async function POST(
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
        const contract = await Space.findById(id, { contractVersion: 1 }).lean<{ contractVersion?: number } | null>()
        if (!contract) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        if (contract.contractVersion === 2) {
            const parsedV2 = spaceEntryV2RequestSchema.safeParse(body)
            if (!parsedV2.success) {
                return NextResponse.json({
                    error: 'Datos de movimiento inválidos',
                    code: 'SPACE_ENTRY_INVALID',
                    failureState: 'not_started',
                    retryable: false,
                    details: parsedV2.error.flatten(),
                }, { status: 400 })
            }
            const execution = await createSpaceEntryV2({
                actorUserId: session.user.id,
                spaceId: id,
                idempotencyKey: requireIdempotencyKey(request),
                expectedRevision: requireExpectedRevision(parsedV2.data.expectedRevision),
                title: parsedV2.data.title,
                description: parsedV2.data.description,
                amount: parsedV2.data.amount,
                money: parsedV2.data.money,
                currency: parsedV2.data.currency,
                exchangeRate: parsedV2.data.exchangeRate,
                exchangeRateDecimal: parsedV2.data.exchangeRateDecimal,
                conversionSnapshot: parsedV2.data.conversionSnapshot,
                expectedQuoteFingerprint: parsedV2.data.expectedQuoteFingerprint,
                dateKey: parsedV2.data.dateKey,
                paidByParticipantId: parsedV2.data.paidByParticipantId,
                sharedWithParticipantIds: parsedV2.data.sharedWithParticipantIds,
                splitMode: parsedV2.data.splitMode,
                splitAllocations: parsedV2.data.splitAllocations,
                spaceCategoryId: parsedV2.data.spaceCategoryId,
                notes: parsedV2.data.notes,
                actorPersonalImpact: parsedV2.data.personalImpact,
            })
            return NextResponse.json(toSpaceMutationResult(execution), { status: 201 })
        }
        enterLegacySpaceWriteFacade(contract)
        const parsed = spaceEntrySchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de movimiento inválidos',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        if (parsed.data.personalAccountId && parsed.data.linkedTransactionId) {
            return NextResponse.json(
                {
                    error: 'Elegí crear una transacción nueva o vincular una existente, no ambas.',
                },
                { status: 400 }
            )
        }

        const context = await getAccessibleSpaceContext(id, session.user.id)

        if (!context || !context.currentParticipant) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const participantsById = new Map(
            context.participants.map((participant) => [extractId(participant._id) ?? '', participant])
        )
        const paidByParticipant = parsed.data.paidByParticipantId
            ? participantsById.get(parsed.data.paidByParticipantId)
            : undefined

        if (parsed.data.type !== 'settlement' && !paidByParticipant) {
            return NextResponse.json(
                { error: 'El participante pagador no es válido.' },
                { status: 400 }
            )
        }

        if (parsed.data.type === 'settlement' && (parsed.data.sharedWithParticipantIds?.length ?? 0) === 0) {
            return NextResponse.json(
                {
                    error: 'Para una liquidación necesitás indicar al menos un participante contraparte.',
                },
                { status: 400 }
            )
        }

        const invalidSharedParticipant = (parsed.data.sharedWithParticipantIds ?? []).find(
            (participantId) => !participantsById.has(participantId)
        )

        if (invalidSharedParticipant) {
            return NextResponse.json(
                { error: 'El split incluye participantes inválidos.' },
                { status: 400 }
            )
        }

        const invalidSplitAllocation = (parsed.data.splitAllocations ?? []).find(
            (allocation) => !participantsById.has(allocation.participantId)
        )

        if (invalidSplitAllocation) {
            return NextResponse.json(
                { error: 'El split incluye participantes inválidos.' },
                { status: 400 }
            )
        }

        if (
            parsed.data.currency !== context.space.reportingCurrency &&
            !parsed.data.exchangeRate
        ) {
            return NextResponse.json(
                {
                    error: 'Ingresá una cotización para convertir el movimiento a la moneda de reporte.',
                },
                { status: 400 }
            )
        }

        if (!context.space.currencies.includes(parsed.data.currency)) {
            return NextResponse.json(
                { error: 'La moneda no está habilitada en este espacio.' },
                { status: 400 }
            )
        }

        if (parsed.data.categoryId) {
            const category = await Category.findOne({
                _id: parsed.data.categoryId,
                userId: session.user.id,
            })

            if (!category) {
                return NextResponse.json(
                    { error: 'La categoría seleccionada no es válida.' },
                    { status: 400 }
                )
            }
        }

        if (parsed.data.spaceCategoryId) {
            const category = await SpaceCategory.findOne({
                _id: parsed.data.spaceCategoryId,
                spaceId: id,
                isArchived: false,
            })

            if (!category) {
                return NextResponse.json(
                    { error: 'La categoría seleccionada no es válida.' },
                    { status: 400 }
                )
            }
        }

        if (parsed.data.linkedTransactionId) {
            const linkedTransaction = await Transaction.findOne({
                _id: parsed.data.linkedTransactionId,
                userId: session.user.id,
            })

            if (!linkedTransaction) {
                return NextResponse.json(
                    { error: 'La transacción a vincular no existe o no te pertenece.' },
                    { status: 400 }
                )
            }
        }

        const payerUserId = extractId(paidByParticipant?.userId)
        const currentParticipantId = extractId(context.currentParticipant._id)
        const isPayerSelf = Boolean(
            parsed.data.paidByParticipantId &&
            currentParticipantId === parsed.data.paidByParticipantId
        )

        if (
            (parsed.data.personalAccountId || parsed.data.linkedTransactionId) &&
            !isPayerSelf
        ) {
            return NextResponse.json(
                {
                    error: 'Solo el pagador puede crear o vincular una transacción personal al movimiento.',
                },
                { status: 400 }
            )
        }

        // Los settlements impactan el balance del espacio inmediatamente.
        // La "confirmación" del pagador real (cuando alguien registra un pago de otro)
        // se canaliza por SpacePersonalImpact: el pagador recibe la notificación
        // para impactar (o no) el movimiento en su Finp personal.
        const confirmationRequired = parsed.data.type === 'settlement'
            ? false
            : Boolean(!isPayerSelf && payerUserId && payerUserId !== session.user.id)

        const personalCategoryId = parsed.data.categoryId

        const entry = await SpaceEntry.create({
            spaceId: id,
            createdByUserId: session.user.id,
            createdByParticipantId: context.currentParticipant._id,
            type: parsed.data.type,
            status: confirmationRequired ? 'pending_confirmation' : 'confirmed',
            title: parsed.data.title,
            description: parsed.data.description,
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            reportingAmount: calculateReportingAmount({
                amount: parsed.data.amount,
                currency: parsed.data.currency,
                reportingCurrency: context.space.reportingCurrency,
                exchangeRate: parsed.data.exchangeRate,
            }),
            exchangeRate:
                parsed.data.currency !== context.space.reportingCurrency
                    ? parsed.data.exchangeRate
                    : undefined,
            date: parsed.data.date,
            spaceCategoryId: parsed.data.spaceCategoryId,
            paidByParticipantId: parsed.data.paidByParticipantId,
            sharedWithParticipantIds: parsed.data.sharedWithParticipantIds,
            splitMode: context.space.mode === 'solo' ? 'none' : parsed.data.splitMode,
            splitAllocations:
                parsed.data.splitMode === 'percentage' || parsed.data.splitMode === 'fixed'
                    ? parsed.data.splitAllocations
                    : undefined,
            notes: parsed.data.notes,
            confirmationRequired,
            confirmedByUserId: confirmationRequired ? undefined : session.user.id,
            confirmedAt: confirmationRequired ? undefined : new Date(),
        })

        let updatedEntry: ISpaceEntry | null = null

        if (!confirmationRequired && (parsed.data.personalAccountId || parsed.data.linkedTransactionId)) {
            try {
                await createPersonalImpactFromSpaceEntry({
                    spaceId: id,
                    entry: entry.toObject() as ISpaceEntry,
                    participants: context.participants,
                    userId: session.user.id,
                    participantId: extractId(context.currentParticipant._id) ?? '',
                    mode: parsed.data.personalAccountId ? 'create_transaction' : 'link_existing',
                    accountId: parsed.data.personalAccountId,
                    categoryId: personalCategoryId,
                    linkedTransactionId: parsed.data.linkedTransactionId,
                    description: parsed.data.title,
                    spaceNameSnapshot: context.space.name,
                })

                updatedEntry = await SpaceEntry.findById(entry._id)
                    .populate('categoryId', 'name color type')
                    .populate('spaceCategoryId', 'name color type isArchived')
                    .lean<ISpaceEntry | null>()
            } catch (error) {
                await SpaceEntry.findByIdAndDelete(entry._id)

                return NextResponse.json(
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : 'No se pudo registrar la transacción asociada.',
                    },
                    { status: 400 }
                )
            }
        } else {
            updatedEntry = await SpaceEntry.findById(entry._id)
                .populate('categoryId', 'name color type')
                .populate('spaceCategoryId', 'name color type isArchived')
                .lean<ISpaceEntry | null>()
        }

        const savedEntry = updatedEntry ?? (entry.toObject() as ISpaceEntry)
        const actor = context.currentParticipant.displayName
        const isSettlement = savedEntry.type === 'settlement'

        createSpaceActivityEvent({
            spaceId: id,
            actorUserId: session.user.id,
            actorParticipantId: extractId(context.currentParticipant._id),
            type: isSettlement ? 'settlement_created' : 'entry_created',
            entityType: isSettlement ? 'settlement' : 'entry',
            entityId: extractId(savedEntry._id),
            title: isSettlement
                ? `${actor} registró un pago`
                : `${actor} registró ${savedEntry.title}`,
            metadata: isSettlement
                ? {
                    amount: savedEntry.amount,
                    currency: savedEntry.currency,
                    payerParticipantId: extractId(savedEntry.paidByParticipantId),
                    receiverParticipantId: extractId(savedEntry.sharedWithParticipantIds?.[0]),
                }
                : {
                    entryTitle: savedEntry.title,
                    amount: savedEntry.amount,
                    currency: savedEntry.currency,
                },
        }).catch((err) => console.error('[space-activity]', err))

        try {
            await syncSpaceDebtsForActiveParticipants(id)
        } catch (err) {
            console.error('[debt-sync] entries POST:', err)
        }

        // Crear pendientes accionables para los participantes involucrados
        try {
            const entryId = extractId(savedEntry._id)
            if (entryId) {
                const actorAlreadyLinked = Boolean(
                    parsed.data.personalAccountId || parsed.data.linkedTransactionId
                )
                const pendingTargets = buildEntryPendingTargets({
                    entry: savedEntry,
                    participants: context.participants,
                    actorUserId: session.user.id,
                    actorAlreadyLinked,
                })

                await emitPersonalSyncEvent({
                    actorUserId: session.user.id,
                    spaceId: id,
                    entryId,
                    sourceType: 'space_entry',
                    pendingTargets,
                })
            }
        } catch (err) {
            console.error('[personal-sync] entries POST:', err)
        }

        return NextResponse.json({ entry: savedEntry }, { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo crear el movimiento.')
    }
}
