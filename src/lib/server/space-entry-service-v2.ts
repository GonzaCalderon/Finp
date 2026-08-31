import { Types, type ClientSession } from 'mongoose'

import {
    SpaceCategory,
    SpaceEntry,
    SpaceEntryPersonalImpact,
    Transaction,
} from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import { getSpaceCapabilitiesV2 } from '@/lib/server/space-capabilities'
import {
    buildSpaceImpactOriginSnapshotV2,
    createSpaceActivityEventV2,
    loadSpaceApplicationContextV2,
    requireObjectId,
} from '@/lib/server/space-application-context-v2'
import { materializeSpaceDebtsV2 } from '@/lib/server/space-debt-materialization-v2'
import { executeSpaceOperation } from '@/lib/server/space-operation-executor'
import { reconcileSpacePendingNotificationsV2 } from '@/lib/server/space-notification-reconciliation-v2'
import {
    createInternalSpaceTransaction,
    type CreateInternalSpaceTransactionInput,
} from '@/lib/server/transactions'
import {
    calculateSpaceSharesV2,
    convertSpaceAmountV2,
    derivePersonalImpactAmountsV2,
    financialDateKeyToInstant,
    financialDateKeyFromInstant,
    normalizeFinancialDateKey,
    type SpaceSplitAllocationV2,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import {
    assertConversionSnapshotConfirmable,
    buildManualConversionSnapshot,
    resolveSpaceReferenceQuote,
} from '@/lib/server/space-quote-service'
import { moneyFromDecimal, moneyMatchesDecimal, type ConversionSnapshot, type MoneyDto } from '@/lib/utils/money'
import type { ISpaceEntry, ISpaceParticipant, ITransaction } from '@/types'
import type { SpaceSplitMode } from '@/lib/constants'

export interface CreateSpaceEntryV2Input {
    actorUserId: string
    spaceId: string
    idempotencyKey: string
    expectedRevision: number
    title: string
    description?: string
    amount: number
    money?: MoneyDto
    currency: string
    exchangeRate?: number
    exchangeRateDecimal?: string
    conversionSnapshot?: ConversionSnapshot
    expectedQuoteFingerprint?: string
    dateKey: string
    paidByParticipantId: string
    sharedWithParticipantIds: string[]
    splitMode: SpaceSplitMode
    splitAllocations?: SpaceSplitAllocationV2[]
    spaceCategoryId?: string
    notes?: string
    actorPersonalImpact?: {
        accountId?: string
        categoryId?: string
        description?: string
        linkedTransactionId?: string
    }
}

function validateNewEntryParticipants(input: {
    participants: ISpaceParticipant[]
    payerId: string
    sharedIds: string[]
}) {
    const activeIds = new Set(
        input.participants
            .filter((participant) => participant.isActive)
            .map((participant) => extractId(participant._id))
            .filter((participantId): participantId is string => Boolean(participantId))
    )
    if (!activeIds.has(input.payerId) || input.sharedIds.some((participantId) => !activeIds.has(participantId))) {
        throw new ServiceError(
            409,
            'SPACE_PARTICIPANT_INACTIVE',
            'El pagador y las personas del reparto deben estar activos.'
        )
    }
}

function resolveImpactVariant(input: {
    kind: 'personal_expense' | 'advance' | 'settlement_paid' | 'settlement_received'
    isPayer: boolean
}) {
    if (input.kind === 'advance') return 'advance' as const
    if (input.kind === 'settlement_paid') return 'settlement_paid' as const
    if (input.kind === 'settlement_received') return 'settlement_received' as const
    return input.isPayer ? 'payer_expense' as const : 'participant_expense' as const
}

async function reconcilePresentation(pendingActionIds: Types.ObjectId[]) {
    if (pendingActionIds.length === 0) return { state: 'not_needed' as const, failures: [] }
    try {
        const result = await reconcileSpacePendingNotificationsV2({
            pendingActionIds: pendingActionIds.map((id) => id.toHexString()),
        })
        return {
            state: result.failures.length === 0 ? 'reconciled' as const : 'retry_required' as const,
            failures: result.failures,
        }
    } catch (error) {
        return {
            state: 'retry_required' as const,
            failures: [{ pendingActionId: 'batch', errorName: error instanceof Error ? error.name : 'UnknownError' }],
        }
    }
}

async function createPersonalImpactsForEntry(input: {
    actorUserId: string
    actorParticipantId: string
    actorPersonalImpact?: CreateSpaceEntryV2Input['actorPersonalImpact']
    spaceName: string
    space: Awaited<ReturnType<typeof loadSpaceApplicationContextV2>>['space']
    entry: ISpaceEntry
    participants: ISpaceParticipant[]
    operationId: Types.ObjectId
    session: ClientSession
}) {
    const originSnapshot = buildSpaceImpactOriginSnapshotV2({ space: input.space, entry: input.entry })
    const shares = calculateSpaceSharesV2({
        amount: input.entry.amount,
        reportingAmount: input.entry.reportingAmount,
        currency: input.entry.currency,
        reportingCurrency: input.space.reportingCurrency,
        splitMode: input.entry.splitMode,
        participantIds: (input.entry.sharedWithParticipantIds ?? []).map((id) => id.toString()),
        allocations: (input.entry.splitAllocations ?? []).map((allocation) => ({
            participantId: allocation.participantId.toString(),
            percentage: allocation.percentage,
            amount: allocation.amount,
        })),
    })
    const pendingActionIds: Types.ObjectId[] = []
    let actorImpactId: Types.ObjectId | undefined
    let actorTransactionId: Types.ObjectId | undefined

    for (const participant of input.participants) {
        const participantId = extractId(participant._id)
        const userId = extractId(participant.userId)
        if (!participantId || !userId) continue
        const ownShareAmount = shares.find((share) => share.participantId === participantId)?.amount ?? 0
        const amounts = derivePersonalImpactAmountsV2({
            entryType: input.entry.type,
            entryAmount: input.entry.amount,
            ownShareAmount,
            currency: input.entry.currency,
            isPayer: extractId(input.entry.paidByParticipantId) === participantId,
        })
        if (amounts.action === 'none') continue

        const shouldRegisterActor = userId === input.actorUserId && Boolean(input.actorPersonalImpact)
        const [impact] = await SpaceEntryPersonalImpact.create([{
            contractVersion: 2,
            spaceId: input.space._id,
            entryId: input.entry._id,
            userId,
            participantId,
            impactKind: amounts.kind,
            amount: amounts.kind === 'advance' ? amounts.accountImpactAmount : amounts.ownShareAmount,
            ownShareAmount: amounts.ownShareAmount,
            accountImpactAmount: amounts.accountImpactAmount,
            operationalAmount: amounts.operationalAmount,
            currency: input.entry.currency,
            status: shouldRegisterActor ? 'linked' : 'pending',
            actionType: 'impact_space_expense',
            sourceType: 'space_entry',
            actorUserId: input.actorUserId,
            originSnapshot,
            revision: 0,
            operationId: input.operationId,
            ...(shouldRegisterActor ? { resolvedAt: new Date() } : {}),
        }], { session: input.session })

        if (!shouldRegisterActor) {
            pendingActionIds.push(impact._id)
            continue
        }

        actorImpactId = impact._id
        const variant = resolveImpactVariant({
            kind: amounts.kind,
            isPayer: extractId(input.entry.paidByParticipantId) === participantId,
        })
        const accountId = input.actorPersonalImpact?.accountId
        if (variant !== 'participant_expense' && !accountId) {
            throw new ServiceError(
                400,
                'SPACE_ACCOUNT_REQUIRED',
                'La salida o entrada real exige una cuenta personal.'
            )
        }
        const linkedTransactionId = input.actorPersonalImpact?.linkedTransactionId
        if (linkedTransactionId) {
            const expectedType: ITransaction['type'] = variant === 'settlement_paid'
                ? 'personal_debt_payment'
                : variant === 'settlement_received'
                    ? 'personal_debt_collect'
                    : 'expense'
            const transaction = await Transaction.findOne({
                _id: linkedTransactionId,
                userId,
                $or: [
                    { spaceImpactId: { $exists: false } },
                    { spaceImpactId: impact._id },
                ],
            }).session(input.session).lean<ITransaction | null>()
            const expectedAmount = amounts.accountImpactAmount > 0
                ? amounts.accountImpactAmount
                : amounts.ownShareAmount
            if (
                !transaction ||
                (transaction.type !== expectedType && !(
                    expectedType === 'expense' && transaction.type === 'credit_card_expense'
                )) ||
                transaction.currency !== input.entry.currency ||
                moneyFromDecimal(input.entry.currency, transaction.amount).minorUnits !==
                    moneyFromDecimal(input.entry.currency, expectedAmount).minorUnits ||
                moneyFromDecimal(input.entry.currency, transaction.operationalAmount ?? transaction.amount).minorUnits !==
                    moneyFromDecimal(input.entry.currency, amounts.operationalAmount).minorUnits ||
                financialDateKeyFromInstant(transaction.date, input.entry.timezone!) !== input.entry.dateKey
            ) {
                throw new ServiceError(
                    409,
                    'SPACE_TRANSACTION_PREVIEW_STALE',
                    'La transacción elegida ya no coincide con el impacto revisado.'
                )
            }
            const link = await Transaction.updateOne(
                {
                    _id: transaction._id,
                    userId,
                    $or: [{ spaceImpactId: { $exists: false } }, { spaceImpactId: impact._id }],
                },
                {
                    $set: {
                        spaceId: input.space._id,
                        spaceEntryId: input.entry._id,
                        spaceImpactId: impact._id,
                        spaceOperationId: input.operationId,
                        spaceContractVersion: 2,
                    },
                },
                { session: input.session }
            )
            if (link.matchedCount !== 1) {
                throw new ServiceError(409, 'SPACE_TRANSACTION_LINK_CONFLICT', 'La transacción cambió antes de confirmar.')
            }
            const resolvedAccountId = extractId(transaction.sourceAccountId) ?? extractId(transaction.destinationAccountId)
            await SpaceEntryPersonalImpact.updateOne(
                { _id: impact._id, contractVersion: 2, revision: 0 },
                {
                    $set: {
                        transactionId: transaction._id,
                        ...(resolvedAccountId ? { accountId: resolvedAccountId } : {}),
                        ...(transaction.categoryId ? { categoryId: transaction.categoryId } : {}),
                    },
                },
                { session: input.session }
            )
            actorTransactionId = transaction._id
            continue
        }

        const transactionInput = {
            variant,
            userId,
            spaceId: input.space._id.toString(),
            spaceEntryId: input.entry._id.toString(),
            spaceImpactId: impact._id.toString(),
            spaceOperationId: input.operationId.toString(),
            amount: amounts.accountImpactAmount > 0 ? amounts.accountImpactAmount : amounts.ownShareAmount,
            operationalAmount: amounts.operationalAmount,
            currency: input.entry.currency as 'ARS' | 'USD',
            date: input.entry.date,
            description: input.actorPersonalImpact?.description?.trim() || input.entry.title,
            categoryId: input.actorPersonalImpact?.categoryId,
            spaceNameSnapshot: input.spaceName,
            ...(variant === 'participant_expense'
                ? {}
                : variant === 'settlement_received'
                    ? { destinationAccountId: accountId! }
                    : { sourceAccountId: accountId! }),
        } as CreateInternalSpaceTransactionInput
        const transaction = await createInternalSpaceTransaction(transactionInput, input.session)
        const resolvedAccountId = extractId(transaction.sourceAccountId) ?? extractId(transaction.destinationAccountId)
        await SpaceEntryPersonalImpact.updateOne(
            { _id: impact._id, contractVersion: 2, revision: 0 },
            {
                $set: {
                    transactionId: transaction._id,
                    ...(resolvedAccountId ? { accountId: resolvedAccountId } : {}),
                    ...(input.actorPersonalImpact?.categoryId ? { categoryId: input.actorPersonalImpact.categoryId } : {}),
                },
            },
            { session: input.session }
        )
        actorTransactionId = transaction._id
    }
    return { pendingActionIds, actorImpactId, actorTransactionId }
}

export async function createSpaceEntryV2(input: CreateSpaceEntryV2Input) {
    const payload = { ...input, idempotencyKey: undefined }
    const execution = await executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'create_entry',
        idempotencyKey: input.idempotencyKey,
        payload,
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'create_entry',
            })
            if ((context.space.revision ?? 0) !== input.expectedRevision) {
                throw new ServiceError(
                    409,
                    'SPACE_VERSION_CONFLICT',
                    'La configuración del Espacio cambió. Revisá la última versión antes de confirmar.',
                    { expectedRevision: input.expectedRevision, actualRevision: context.space.revision ?? 0 }
                )
            }
            if (!context.space.timezone) {
                throw new ServiceError(409, 'SPACE_TIMEZONE_REQUIRED', 'El Espacio necesita una zona horaria IANA.')
            }
            if (!context.space.currencies.includes(input.currency)) {
                throw new ServiceError(400, 'SPACE_CURRENCY_UNSUPPORTED', 'La moneda no está habilitada en el Espacio.')
            }
            if (input.actorPersonalImpact && input.currency !== 'ARS' && input.currency !== 'USD') {
                throw new ServiceError(
                    400,
                    'PERSONAL_CURRENCY_UNSUPPORTED',
                    'Mi Finp no admite esa moneda personal.'
                )
            }
            const actorParticipantId = requireObjectId(context.currentParticipant._id)
            const paidByParticipantId = requireObjectId(input.paidByParticipantId)
            const sharedWithParticipantIds = input.sharedWithParticipantIds.map((id) => requireObjectId(id))
            validateNewEntryParticipants({
                participants: context.participants,
                payerId: paidByParticipantId,
                sharedIds: sharedWithParticipantIds,
            })
            if (paidByParticipantId !== actorParticipantId) {
                const canActForOthers = getSpaceCapabilitiesV2({
                    status: context.space.status,
                    role: context.currentParticipant.role,
                    isActiveParticipant: true,
                    isOwnerRecord: context.isOwnerRecord,
                }).has('act_for_participant')
                if (!canActForOthers) {
                    throw new ServiceError(403, 'SPACE_REPRESENTATION_DENIED', 'No podés registrar en nombre de otra persona.')
                }
            }
            if (!input.title.trim()) {
                throw new ServiceError(400, 'SPACE_ENTRY_TITLE_REQUIRED', 'El movimiento necesita un título.')
            }
            const dateKey = normalizeFinancialDateKey(input.dateKey)
            const date = financialDateKeyToInstant(dateKey, context.space.timezone)
            const conversionSnapshot = input.currency === context.space.reportingCurrency
                ? undefined
                : input.conversionSnapshot ?? buildManualConversionSnapshot({
                    sourceCurrency: input.currency,
                    targetCurrency: context.space.reportingCurrency,
                    rate: input.exchangeRateDecimal ?? input.exchangeRate?.toString() ?? '',
                    actorUserId: input.actorUserId,
                })
            if (conversionSnapshot) assertConversionSnapshotConfirmable(conversionSnapshot)
            if (conversionSnapshot && conversionSnapshot.source !== 'manual') {
                const currentQuote = await resolveSpaceReferenceQuote({
                    sourceCurrency: input.currency,
                    targetCurrency: context.space.reportingCurrency,
                })
                if (!currentQuote || !input.expectedQuoteFingerprint || currentQuote.fingerprint !== input.expectedQuoteFingerprint) {
                    throw new ServiceError(409, 'SPACE_QUOTE_CHANGED', 'La cotización cambió. Revisá el nuevo importe antes de confirmar.', {
                        currentQuote,
                    })
                }
            }
            const conversion = convertSpaceAmountV2({
                amount: input.amount,
                currency: input.currency,
                reportingCurrency: context.space.reportingCurrency,
                exchangeRate: input.exchangeRate,
                exchangeRateDecimal: input.exchangeRateDecimal ?? conversionSnapshot?.rate,
                direction: conversionSnapshot?.direction,
                snapshot: conversionSnapshot,
            })
            if (input.money) {
                if (!moneyMatchesDecimal(input.money, input.currency, input.amount)) {
                    throw new ServiceError(400, 'SPACE_MONEY_MISMATCH', 'El monto exacto no coincide con el movimiento.')
                }
            }
            calculateSpaceSharesV2({
                amount: input.amount,
                reportingAmount: conversion.reportingAmount,
                currency: input.currency,
                reportingCurrency: context.space.reportingCurrency,
                splitMode: input.splitMode,
                participantIds: sharedWithParticipantIds,
                allocations: input.splitAllocations,
            })
            if (input.spaceCategoryId) {
                const category = await SpaceCategory.findOne({
                    _id: input.spaceCategoryId,
                    spaceId: input.spaceId,
                    isArchived: false,
                }).session(session)
                if (!category) {
                    throw new ServiceError(404, 'SPACE_CATEGORY_NOT_FOUND', 'La categoría compartida no existe.')
                }
            }

            const [createdEntry] = await SpaceEntry.create([{
                contractVersion: 2,
                spaceId: input.spaceId,
                createdByUserId: input.actorUserId,
                createdByParticipantId: actorParticipantId,
                type: 'expense',
                status: 'recorded',
                title: input.title.trim(),
                description: input.description?.trim() || undefined,
                amount: input.amount,
                currency: input.currency,
                reportingAmount: conversion.reportingAmount,
                exchangeRate: conversion.exchangeRate,
                originalMoney: input.money ?? conversion.originalMoney,
                reportingMoney: conversion.reportingMoney,
                conversionSnapshot,
                date,
                dateKey,
                timezone: context.space.timezone,
                spaceCategoryId: input.spaceCategoryId,
                paidByParticipantId,
                sharedWithParticipantIds,
                splitMode: input.splitMode,
                splitAllocations: input.splitAllocations,
                notes: input.notes?.trim() || undefined,
                revision: 0,
                operationId,
            }], { session })
            const entry = createdEntry.toObject() as ISpaceEntry
            const impacts = await createPersonalImpactsForEntry({
                actorUserId: input.actorUserId,
                actorParticipantId,
                actorPersonalImpact: input.actorPersonalImpact,
                spaceName: context.space.name,
                space: context.space,
                entry,
                participants: context.participants,
                operationId,
                session,
            })
            const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 })
                .session(session)
                .lean<ISpaceEntry[]>()
            const debts = await materializeSpaceDebtsV2({
                space: context.space,
                participants: context.participants,
                entries,
                operationId,
                session,
            })
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId,
                operationId,
                type: 'entry_created',
                entityType: 'entry',
                entityId: entry._id.toString(),
                title: 'Movimiento registrado',
                metadata: { contractVersion: 2, representedParticipant: paidByParticipantId !== actorParticipantId },
                participants: context.participants,
                session,
            })
            return {
                value: { entryId: entry._id.toString() },
                resultRefs: {
                    spaceEntryId: entry._id,
                    personalImpactId: impacts.actorImpactId,
                    transactionId: impacts.actorTransactionId,
                    pendingActionIds: impacts.pendingActionIds,
                    debtIds: debts.debtIds.map((id) => new Types.ObjectId(id)),
                    debtMovementIds: debts.movementIds.map((id) => new Types.ObjectId(id)),
                    activityEventIds: [activity._id],
                },
            }
        },
    })

    return {
        ...execution,
        presentation: await reconcilePresentation(execution.resultRefs.pendingActionIds ?? []),
    }
}
