import { Types, type ClientSession } from 'mongoose'

import {
    SpaceCategory,
    SpaceEntry,
    SpaceEntryPersonalImpact,
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
import { detectSpaceEntryMaterialChanges } from '@/lib/server/space-entry-changes'
import {
    calculateSpaceSharesV2,
    convertSpaceAmountV2,
    derivePersonalImpactAmountsV2,
    financialDateKeyToInstant,
    normalizeFinancialDateKey,
    type SpaceSplitAllocationV2,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import type { ISpace, ISpaceEntry, ISpaceParticipant } from '@/types'
import type { SpaceSplitMode } from '@/lib/constants'
import { buildManualConversionSnapshot } from '@/lib/server/space-quote-service'

export interface EditSpaceEntryV2Input {
    actorUserId: string
    spaceId: string
    entryId: string
    idempotencyKey: string
    expectedRevision: number
    title: string
    description?: string
    amount: number
    currency: string
    exchangeRate?: number
    dateKey: string
    paidByParticipantId: string
    sharedWithParticipantIds: string[]
    splitMode: SpaceSplitMode
    splitAllocations?: SpaceSplitAllocationV2[]
    spaceCategoryId?: string
    notes?: string
}

function entrySnapshot(entry: ISpaceEntry, actorUserId: string) {
    return {
        snapshotAt: new Date(),
        editedByUserId: actorUserId,
        title: entry.title,
        description: entry.description,
        amount: entry.amount,
        currency: entry.currency,
        reportingAmount: entry.reportingAmount,
        exchangeRate: entry.exchangeRate,
        originalMoney: entry.originalMoney,
        reportingMoney: entry.reportingMoney,
        conversionSnapshot: entry.conversionSnapshot,
        date: entry.date,
        dateKey: entry.dateKey,
        timezone: entry.timezone,
        spaceCategoryId: extractId(entry.spaceCategoryId),
        paidByParticipantId: extractId(entry.paidByParticipantId),
        sharedWithParticipantIds: (entry.sharedWithParticipantIds ?? []).map(extractId).filter(Boolean),
        splitMode: entry.splitMode,
        splitAllocations: (entry.splitAllocations ?? []).map((allocation) => ({
            participantId: extractId(allocation.participantId),
            percentage: allocation.percentage,
            amount: allocation.amount,
        })),
        notes: entry.notes,
    }
}

function assertCanMutateEntry(input: {
    space: ISpace
    currentParticipant: ISpaceParticipant
    isOwnerRecord: boolean
    entry: ISpaceEntry
    actorUserId: string
    action: 'edit' | 'void'
}) {
    const capabilities = getSpaceCapabilitiesV2({
        status: input.space.status,
        role: input.currentParticipant.role,
        isActiveParticipant: input.currentParticipant.isActive,
        isOwnerRecord: input.isOwnerRecord,
    })
    const isCreator = extractId(input.entry.createdByUserId) === input.actorUserId
    const allowed = input.action === 'edit'
        ? capabilities.has('edit_any_entry') || (isCreator && capabilities.has('edit_own_entry'))
        : capabilities.has('void_any_entry') || (isCreator && capabilities.has('void_own_entry'))
    if (!allowed) {
        throw new ServiceError(403, 'SPACE_ENTRY_MUTATION_DENIED', 'No podés modificar este movimiento.')
    }
}

async function validateCategory(spaceId: string, categoryId: string | undefined, session: ClientSession) {
    if (!categoryId) return
    const category = await SpaceCategory.findOne({ _id: categoryId, spaceId, isArchived: false }).session(session)
    if (!category) throw new ServiceError(404, 'SPACE_CATEGORY_NOT_FOUND', 'La categoría compartida no existe.')
}

async function reconcileImpactsForChangedEntry(input: {
    space: ISpace
    entry: ISpaceEntry
    previousEntry: ISpaceEntry
    participants: ISpaceParticipant[]
    actorUserId: string
    operationId: Types.ObjectId
    reason: 'entry_edited' | 'entry_voided'
    changedFields: string[]
    session: ClientSession
}) {
    const existing = await SpaceEntryPersonalImpact.find({
        contractVersion: 2,
        spaceId: input.space._id,
        entryId: input.entry._id,
    }).session(input.session)
    const byUserId = new Map(existing.map((impact) => [impact.userId.toString(), impact]))
    const actionIds: Types.ObjectId[] = []
    const originSnapshot = buildSpaceImpactOriginSnapshotV2({ space: input.space, entry: input.entry })
    const shares = input.entry.status === 'voided' ? [] : calculateSpaceSharesV2({
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

    for (const participant of input.participants) {
        const participantId = extractId(participant._id)
        const userId = extractId(participant.userId)
        if (!participantId || !userId) continue
        const current = byUserId.get(userId)
        const ownShareAmount = shares.find((share) => share.participantId === participantId)?.amount ?? 0
        const amounts = input.entry.status === 'voided' ? { action: 'none' as const } : derivePersonalImpactAmountsV2({
            entryType: input.entry.type,
            entryAmount: input.entry.amount,
            ownShareAmount,
            isPayer: extractId(input.entry.paidByParticipantId) === participantId,
        })

        if (current?.status === 'linked' || current?.status === 'needs_review') {
            await SpaceEntryPersonalImpact.updateOne(
                { _id: current._id, contractVersion: 2, revision: current.revision ?? 0 },
                {
                    $set: {
                        status: 'needs_review',
                        reviewReason: input.reason,
                        reviewRequestedAt: new Date(),
                        reviewChangedFields: input.changedFields,
                        actorUserId: input.actorUserId,
                        operationId: input.operationId,
                    },
                    $inc: { revision: 1 },
                },
                { session: input.session }
            )
            actionIds.push(current._id)
            continue
        }
        if (amounts.action === 'none') {
            if (current?.status === 'pending') {
                await SpaceEntryPersonalImpact.updateOne(
                    { _id: current._id, contractVersion: 2, revision: current.revision ?? 0 },
                    {
                        $set: {
                            status: 'cancelled',
                            originSnapshot,
                            operationId: input.operationId,
                            resolvedAt: new Date(),
                        },
                        $inc: { revision: 1 },
                    },
                    { session: input.session }
                )
            }
            continue
        }
        if (current) {
            if (current.status !== 'pending') continue
            await SpaceEntryPersonalImpact.updateOne(
                { _id: current._id, contractVersion: 2, revision: current.revision ?? 0 },
                {
                    $set: {
                        impactKind: amounts.kind,
                        amount: amounts.kind === 'advance' ? amounts.accountImpactAmount : amounts.ownShareAmount,
                        ownShareAmount: amounts.ownShareAmount,
                        accountImpactAmount: amounts.accountImpactAmount,
                        operationalAmount: amounts.operationalAmount,
                        originSnapshot,
                        actorUserId: input.actorUserId,
                        operationId: input.operationId,
                    },
                    $inc: { revision: 1 },
                },
                { session: input.session }
            )
            actionIds.push(current._id)
            continue
        }
        const [created] = await SpaceEntryPersonalImpact.create([{
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
            status: 'pending',
            actionType: 'impact_space_expense',
            sourceType: 'space_entry',
            actorUserId: input.actorUserId,
            originSnapshot,
            revision: 0,
            operationId: input.operationId,
        }], { session: input.session })
        actionIds.push(created._id)
    }
    return actionIds
}

async function presentationAfterCommit(actionIds: Types.ObjectId[]) {
    if (actionIds.length === 0) return { state: 'not_needed' as const, failures: [] }
    try {
        const result = await reconcileSpacePendingNotificationsV2({
            pendingActionIds: actionIds.map((id) => id.toHexString()),
        })
        return {
            state: result.failures.length ? 'retry_required' as const : 'reconciled' as const,
            failures: result.failures,
        }
    } catch (error) {
        return {
            state: 'retry_required' as const,
            failures: [{ pendingActionId: 'batch', errorName: error instanceof Error ? error.name : 'UnknownError' }],
        }
    }
}

export async function editSpaceEntryV2(input: EditSpaceEntryV2Input) {
    const execution = await executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'edit_entry',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'view',
            })
            const current = await SpaceEntry.findOne({
                _id: input.entryId,
                spaceId: input.spaceId,
                contractVersion: 2,
            }).session(session).lean<ISpaceEntry | null>()
            if (!current) throw new ServiceError(404, 'SPACE_ENTRY_V2_NOT_FOUND', 'El movimiento no existe.')
            if (current.status !== 'recorded') {
                throw new ServiceError(409, 'SPACE_ENTRY_NOT_EDITABLE', 'El movimiento anulado no puede editarse.')
            }
            if (current.type === 'settlement') {
                throw new ServiceError(
                    409,
                    'SPACE_SETTLEMENT_IMMUTABLE',
                    'Una liquidación confirmada no se edita: anulala y registrá una nueva.'
                )
            }
            assertCanMutateEntry({ ...context, entry: current, actorUserId: input.actorUserId, action: 'edit' })
            if (!context.space.timezone) throw new ServiceError(409, 'SPACE_TIMEZONE_REQUIRED', 'El Espacio necesita zona horaria.')
            if (!context.space.currencies.includes(input.currency)) {
                throw new ServiceError(400, 'SPACE_CURRENCY_UNSUPPORTED', 'La moneda no está habilitada.')
            }
            const activeIds = new Set(context.participants.filter((participant) => participant.isActive).map((participant) => extractId(participant._id)))
            const payerId = requireObjectId(input.paidByParticipantId)
            const sharedIds = input.sharedWithParticipantIds.map((id) => requireObjectId(id))
            if (!activeIds.has(payerId) || sharedIds.some((id) => !activeIds.has(id))) {
                throw new ServiceError(409, 'SPACE_PARTICIPANT_INACTIVE', 'El nuevo reparto sólo admite participantes activos.')
            }
            await validateCategory(input.spaceId, input.spaceCategoryId, session)
            const dateKey = normalizeFinancialDateKey(input.dateKey)
            const date = financialDateKeyToInstant(dateKey, context.space.timezone)
            const conversionSnapshot = input.currency === context.space.reportingCurrency
                ? undefined
                : buildManualConversionSnapshot({
                    sourceCurrency: input.currency,
                    targetCurrency: context.space.reportingCurrency,
                    rate: input.exchangeRate?.toString() ?? '',
                    actorUserId: input.actorUserId,
                })
            const conversion = convertSpaceAmountV2({
                amount: input.amount,
                currency: input.currency,
                reportingCurrency: context.space.reportingCurrency,
                exchangeRate: input.exchangeRate,
                exchangeRateDecimal: conversionSnapshot?.rate,
                snapshot: conversionSnapshot,
            })
            calculateSpaceSharesV2({
                amount: input.amount,
                reportingAmount: conversion.reportingAmount,
                currency: input.currency,
                reportingCurrency: context.space.reportingCurrency,
                splitMode: input.splitMode,
                participantIds: sharedIds,
                allocations: input.splitAllocations,
            })
            const changes = detectSpaceEntryMaterialChanges(current, {
                amount: input.amount,
                currency: input.currency,
                exchangeRate: conversion.exchangeRate,
                date,
                paidByParticipantId: payerId,
                sharedWithParticipantIds: sharedIds,
                splitMode: input.splitMode,
                splitAllocations: input.splitAllocations,
            })
            const updated = await SpaceEntry.findOneAndUpdate(
                {
                    _id: input.entryId,
                    spaceId: input.spaceId,
                    contractVersion: 2,
                    status: 'recorded',
                    revision: input.expectedRevision,
                },
                {
                    $set: {
                        title: input.title.trim(),
                        description: input.description?.trim() || undefined,
                        amount: input.amount,
                        currency: input.currency,
                        reportingAmount: conversion.reportingAmount,
                        exchangeRate: conversion.exchangeRate,
                        originalMoney: conversion.originalMoney,
                        reportingMoney: conversion.reportingMoney,
                        conversionSnapshot,
                        date,
                        dateKey,
                        timezone: context.space.timezone,
                        spaceCategoryId: input.spaceCategoryId,
                        paidByParticipantId: payerId,
                        sharedWithParticipantIds: sharedIds,
                        splitMode: input.splitMode,
                        splitAllocations: input.splitAllocations,
                        notes: input.notes?.trim() || undefined,
                        editedAt: new Date(),
                        editedByUserId: input.actorUserId,
                        operationId,
                    },
                    $inc: { revision: 1, editCount: 1 },
                    $push: { previousVersions: entrySnapshot(current, input.actorUserId) },
                },
                { new: true, session }
            ).lean<ISpaceEntry | null>()
            if (!updated) {
                throw new ServiceError(409, 'SPACE_ENTRY_VERSION_CONFLICT', 'El movimiento cambió. Revisalo antes de guardar.')
            }
            const actionIds = changes.isMaterial
                ? await reconcileImpactsForChangedEntry({
                    space: context.space,
                    entry: updated,
                    previousEntry: current,
                    participants: context.participants,
                    actorUserId: input.actorUserId,
                    operationId,
                    reason: 'entry_edited',
                    changedFields: changes.changedFields,
                    session,
                })
                : []
            const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 })
                .session(session).lean<ISpaceEntry[]>()
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
                actorParticipantId: context.currentParticipant._id.toString(),
                operationId,
                type: 'entry_edited',
                entityType: 'entry',
                entityId: input.entryId,
                title: 'Movimiento editado',
                metadata: { contractVersion: 2, changedFields: changes.changedFields },
                participants: context.participants,
                session,
            })
            return {
                value: { entryId: input.entryId, revision: updated.revision ?? input.expectedRevision + 1 },
                resultRefs: {
                    spaceEntryId: updated._id,
                    pendingActionIds: actionIds,
                    debtIds: debts.debtIds.map((id) => new Types.ObjectId(id)),
                    debtMovementIds: debts.movementIds.map((id) => new Types.ObjectId(id)),
                    activityEventIds: [activity._id],
                },
            }
        },
    })
    return {
        ...execution,
        presentation: await presentationAfterCommit(execution.resultRefs.pendingActionIds ?? []),
    }
}

export async function voidSpaceEntryV2(input: {
    actorUserId: string
    spaceId: string
    entryId: string
    idempotencyKey: string
    expectedRevision: number
    reason: string
}) {
    const execution = await executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'void_entry',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'view',
            })
            const current = await SpaceEntry.findOne({
                _id: input.entryId,
                spaceId: input.spaceId,
                contractVersion: 2,
            }).session(session).lean<ISpaceEntry | null>()
            if (!current) throw new ServiceError(404, 'SPACE_ENTRY_V2_NOT_FOUND', 'El movimiento no existe.')
            if (current.status === 'voided') {
                throw new ServiceError(409, 'SPACE_ENTRY_ALREADY_VOIDED', 'El movimiento ya está anulado.')
            }
            assertCanMutateEntry({ ...context, entry: current, actorUserId: input.actorUserId, action: 'void' })
            const updated = await SpaceEntry.findOneAndUpdate(
                {
                    _id: input.entryId,
                    spaceId: input.spaceId,
                    contractVersion: 2,
                    status: 'recorded',
                    revision: input.expectedRevision,
                },
                {
                    $set: {
                        status: 'voided',
                        voidedAt: new Date(),
                        voidedByUserId: input.actorUserId,
                        voidReason: input.reason.trim(),
                        operationId,
                    },
                    $inc: { revision: 1 },
                    $push: { previousVersions: entrySnapshot(current, input.actorUserId) },
                },
                { new: true, session }
            ).lean<ISpaceEntry | null>()
            if (!updated) {
                throw new ServiceError(409, 'SPACE_ENTRY_VERSION_CONFLICT', 'El movimiento cambió. Revisalo antes de anular.')
            }
            const actionIds = await reconcileImpactsForChangedEntry({
                space: context.space,
                entry: updated,
                previousEntry: current,
                participants: context.participants,
                actorUserId: input.actorUserId,
                operationId,
                reason: 'entry_voided',
                changedFields: ['status'],
                session,
            })
            const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 })
                .session(session).lean<ISpaceEntry[]>()
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
                actorParticipantId: context.currentParticipant._id.toString(),
                operationId,
                type: 'entry_voided',
                entityType: 'entry',
                entityId: input.entryId,
                title: 'Movimiento anulado',
                metadata: { contractVersion: 2 },
                participants: context.participants,
                session,
            })
            return {
                value: { entryId: input.entryId, revision: updated.revision ?? input.expectedRevision + 1 },
                resultRefs: {
                    spaceEntryId: updated._id,
                    pendingActionIds: actionIds,
                    debtIds: debts.debtIds.map((id) => new Types.ObjectId(id)),
                    debtMovementIds: debts.movementIds.map((id) => new Types.ObjectId(id)),
                    activityEventIds: [activity._id],
                },
            }
        },
    })
    return {
        ...execution,
        presentation: await presentationAfterCommit(execution.resultRefs.pendingActionIds ?? []),
    }
}
