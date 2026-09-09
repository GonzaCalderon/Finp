import mongoose, { Types } from 'mongoose'

import { SpaceEntryDraft } from '@/lib/models'
import { ServiceError, isDuplicateKeyError } from '@/lib/server/errors'
import { loadSpaceApplicationContextV2 } from '@/lib/server/space-application-context-v2'
import { createSpaceEntryV2 } from '@/lib/server/space-entry-service-v2'
import { assertSpaceV2WriteEnabled } from '@/lib/server/space-v2-write-gate'
import { moneyMatchesDecimal } from '@/lib/utils/money'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntryDraft, SpaceEntryDraftDto } from '@/types'
import type { SpaceEntryDraftFieldsInput } from '@/lib/validations/space-entry-draft'

const SNAPSHOT_FIELDS = [
    'title',
    'description',
    'amount',
    'money',
    'currency',
    'exchangeRate',
    'exchangeRateDecimal',
    'conversionSnapshot',
    'expectedQuoteFingerprint',
    'dateKey',
    'paidByParticipantId',
    'sharedWithParticipantIds',
    'splitMode',
    'splitAllocations',
    'spaceCategoryId',
    'notes',
    'actorPersonalImpact',
] as const

export function toSpaceEntryDraftDto(draft: ISpaceEntryDraft): SpaceEntryDraftDto {
    return {
        id: draft._id.toString(),
        contractVersion: 2,
        intent: draft.intent,
        status: draft.status,
        revision: draft.revision,
        step: draft.step,
        expectedSpaceRevision: draft.expectedSpaceRevision,
        fields: {
            title: draft.title,
            description: draft.description,
            amount: draft.amount,
            money: draft.money,
            currency: draft.currency,
            exchangeRate: draft.exchangeRate,
            exchangeRateDecimal: draft.exchangeRateDecimal,
            conversionSnapshot: draft.conversionSnapshot,
            expectedQuoteFingerprint: draft.expectedQuoteFingerprint,
            dateKey: draft.dateKey,
            timezone: draft.timezone,
            paidByParticipantId: extractId(draft.paidByParticipantId),
            sharedWithParticipantIds: draft.sharedWithParticipantIds?.map((id) => id.toString()),
            splitMode: draft.splitMode,
            splitAllocations: draft.splitAllocations?.map((allocation) => ({
                participantId: allocation.participantId.toString(),
                percentage: allocation.percentage,
                amount: allocation.amount,
            })),
            spaceCategoryId: extractId(draft.spaceCategoryId),
            notes: draft.notes,
            personalImpact: draft.actorPersonalImpact ? {
                accountId: extractId(draft.actorPersonalImpact.accountId),
                categoryId: extractId(draft.actorPersonalImpact.categoryId),
                description: draft.actorPersonalImpact.description,
                linkedTransactionId: extractId(draft.actorPersonalImpact.linkedTransactionId),
            } : undefined,
        },
        publishedEntryId: extractId(draft.publishedEntryId),
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
    }
}

export async function getActiveSpaceEntryDraftV2(input: {
    actorUserId: string
    spaceId: string
}) {
    if (!Types.ObjectId.isValid(input.actorUserId) || !Types.ObjectId.isValid(input.spaceId)) {
        throw new ServiceError(400, 'INVALID_SPACE_DRAFT_CONTEXT', 'El contexto del borrador no es válido.')
    }
    const draft = await SpaceEntryDraft.findOne({
        contractVersion: 2,
        creatorUserId: input.actorUserId,
        spaceId: input.spaceId,
        intent: 'new_expense',
        status: 'active',
    }).lean<ISpaceEntryDraft | null>()
    return draft ? toSpaceEntryDraftDto(draft) : null
}

function validateDraftReferences(input: {
    fields: SpaceEntryDraftFieldsInput
    context: Awaited<ReturnType<typeof loadSpaceApplicationContextV2>>
}) {
    if (input.fields.currency && !input.context.space.currencies.includes(input.fields.currency)) {
        throw new ServiceError(400, 'SPACE_DRAFT_CURRENCY_UNSUPPORTED', 'La moneda no está habilitada en el Espacio.')
    }
    if (input.fields.money && input.fields.currency && input.fields.amount !== undefined &&
        !moneyMatchesDecimal(input.fields.money, input.fields.currency, input.fields.amount)) {
        throw new ServiceError(400, 'SPACE_DRAFT_MONEY_MISMATCH', 'El monto exacto no coincide con el borrador.')
    }
    const activeParticipantIds = new Set(input.context.participants
        .filter((participant) => participant.isActive)
        .map((participant) => extractId(participant._id)))
    const referencedParticipantIds = [
        input.fields.paidByParticipantId,
        ...(input.fields.sharedWithParticipantIds ?? []),
        ...(input.fields.splitAllocations ?? []).map((allocation) => allocation.participantId),
    ].filter((id): id is string => Boolean(id))
    if (referencedParticipantIds.some((id) => !activeParticipantIds.has(id))) {
        throw new ServiceError(
            409,
            'SPACE_DRAFT_PARTICIPANT_INACTIVE',
            'El borrador contiene una persona que ya no está activa en el Espacio.'
        )
    }
}

function persistenceSnapshot(fields: SpaceEntryDraftFieldsInput) {
    return {
        title: fields.title || undefined,
        description: fields.description || undefined,
        amount: fields.amount,
        money: fields.money,
        currency: fields.currency?.toUpperCase(),
        exchangeRate: fields.exchangeRate,
        exchangeRateDecimal: fields.exchangeRateDecimal,
        conversionSnapshot: fields.conversionSnapshot,
        expectedQuoteFingerprint: fields.expectedQuoteFingerprint,
        dateKey: fields.dateKey,
        paidByParticipantId: fields.paidByParticipantId
            ? new Types.ObjectId(fields.paidByParticipantId)
            : undefined,
        sharedWithParticipantIds: fields.sharedWithParticipantIds?.map((id) => new Types.ObjectId(id)),
        splitMode: fields.splitMode,
        splitAllocations: fields.splitAllocations?.map((allocation) => ({
            participantId: new Types.ObjectId(allocation.participantId),
            percentage: allocation.percentage,
            amount: allocation.amount,
        })),
        spaceCategoryId: fields.spaceCategoryId ? new Types.ObjectId(fields.spaceCategoryId) : undefined,
        notes: fields.notes || undefined,
        actorPersonalImpact: fields.personalImpact ? {
            accountId: fields.personalImpact.accountId
                ? new Types.ObjectId(fields.personalImpact.accountId)
                : undefined,
            categoryId: fields.personalImpact.categoryId
                ? new Types.ObjectId(fields.personalImpact.categoryId)
                : undefined,
            description: fields.personalImpact.description || undefined,
            linkedTransactionId: fields.personalImpact.linkedTransactionId
                ? new Types.ObjectId(fields.personalImpact.linkedTransactionId)
                : undefined,
        } : undefined,
    }
}

export async function saveSpaceEntryDraftV2(input: {
    actorUserId: string
    spaceId: string
    draftId?: string
    expectedRevision?: number
    expectedSpaceRevision: number
    step: 1 | 2 | 3
    fields: SpaceEntryDraftFieldsInput
}) {
    assertSpaceV2WriteEnabled()
    const session = await mongoose.startSession()
    const context = await loadSpaceApplicationContextV2({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        capability: 'create_entry',
        session,
    }).finally(() => session.endSession())
    if ((context.space.revision ?? 0) !== input.expectedSpaceRevision) {
        throw new ServiceError(
            409,
            'SPACE_DRAFT_SPACE_VERSION_CONFLICT',
            'La configuración del Espacio cambió. Revisá el borrador antes de continuar.',
            { actualSpaceRevision: context.space.revision ?? 0 }
        )
    }
    validateDraftReferences({ fields: input.fields, context })
    const snapshot = persistenceSnapshot(input.fields)
    const existing = await SpaceEntryDraft.findOne({
        contractVersion: 2,
        creatorUserId: input.actorUserId,
        spaceId: input.spaceId,
        intent: 'new_expense',
        status: 'active',
    }).lean<ISpaceEntryDraft | null>()

    if (!existing) {
        if (input.draftId || input.expectedRevision !== undefined) {
            throw new ServiceError(409, 'SPACE_DRAFT_VERSION_CONFLICT', 'El borrador cambió o ya no está activo.')
        }
        try {
            const [created] = await SpaceEntryDraft.create([{
                contractVersion: 2,
                creatorUserId: input.actorUserId,
                spaceId: input.spaceId,
                intent: 'new_expense',
                status: 'active',
                revision: 0,
                step: input.step,
                expectedSpaceRevision: input.expectedSpaceRevision,
                timezone: context.space.timezone,
                ...snapshot,
            }])
            return toSpaceEntryDraftDto(created.toObject() as ISpaceEntryDraft)
        } catch (error) {
            if (!isDuplicateKeyError(error)) throw error
            const concurrent = await getActiveSpaceEntryDraftV2(input)
            throw new ServiceError(
                409,
                'SPACE_DRAFT_VERSION_CONFLICT',
                'El borrador fue creado desde otro cliente. Recargá su última versión.',
                { draft: concurrent }
            )
        }
    }

    if (!input.draftId || existing._id.toString() !== input.draftId || input.expectedRevision !== existing.revision) {
        throw new ServiceError(
            409,
            'SPACE_DRAFT_VERSION_CONFLICT',
            'El borrador fue modificado desde otro cliente. Recargá su última versión.',
            { draft: toSpaceEntryDraftDto(existing) }
        )
    }

    const unset = Object.fromEntries(SNAPSHOT_FIELDS
        .filter((key) => snapshot[key] === undefined)
        .map((key) => [key, 1]))
    const updated = await SpaceEntryDraft.findOneAndUpdate(
        {
            _id: existing._id,
            creatorUserId: input.actorUserId,
            spaceId: input.spaceId,
            status: 'active',
            revision: input.expectedRevision,
        },
        {
            $set: {
                ...snapshot,
                step: input.step,
                expectedSpaceRevision: input.expectedSpaceRevision,
                timezone: context.space.timezone,
            },
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
            $inc: { revision: 1 },
        },
        { new: true }
    ).lean<ISpaceEntryDraft | null>()
    if (!updated) {
        throw new ServiceError(409, 'SPACE_DRAFT_VERSION_CONFLICT', 'El borrador cambió mientras se guardaba.')
    }
    return toSpaceEntryDraftDto(updated)
}

export async function discardSpaceEntryDraftV2(input: {
    actorUserId: string
    spaceId: string
    draftId: string
    expectedRevision: number
}) {
    assertSpaceV2WriteEnabled()
    const draft = await SpaceEntryDraft.findOne({
        _id: input.draftId,
        creatorUserId: input.actorUserId,
        spaceId: input.spaceId,
        contractVersion: 2,
    }).lean<ISpaceEntryDraft | null>()
    if (!draft) throw new ServiceError(404, 'SPACE_DRAFT_NOT_FOUND', 'El borrador no existe.')
    if (draft.status === 'discarded') return toSpaceEntryDraftDto(draft)
    if (draft.status !== 'active' || draft.revision !== input.expectedRevision) {
        throw new ServiceError(409, 'SPACE_DRAFT_VERSION_CONFLICT', 'El borrador cambió antes de descartarse.')
    }
    const updated = await SpaceEntryDraft.findOneAndUpdate(
        { _id: draft._id, creatorUserId: input.actorUserId, status: 'active', revision: input.expectedRevision },
        { $set: { status: 'discarded', discardedAt: new Date() }, $inc: { revision: 1 } },
        { new: true }
    ).lean<ISpaceEntryDraft | null>()
    if (!updated) throw new ServiceError(409, 'SPACE_DRAFT_VERSION_CONFLICT', 'El borrador cambió antes de descartarse.')
    return toSpaceEntryDraftDto(updated)
}

function requirePublishableDraft(draft: ISpaceEntryDraft) {
    if (!draft.title?.trim() || !draft.amount || draft.amount <= 0 || !draft.currency || !draft.dateKey ||
        !draft.paidByParticipantId || !draft.sharedWithParticipantIds?.length || !draft.splitMode) {
        throw new ServiceError(
            400,
            'SPACE_DRAFT_INCOMPLETE',
            'Completá monto, descripción, fecha, pagador y reparto antes de publicar.'
        )
    }
}

export async function publishSpaceEntryDraftV2(input: {
    actorUserId: string
    spaceId: string
    draftId: string
    expectedRevision: number
}) {
    assertSpaceV2WriteEnabled()
    const draft = await SpaceEntryDraft.findOne({
        _id: input.draftId,
        creatorUserId: input.actorUserId,
        spaceId: input.spaceId,
        contractVersion: 2,
    }).lean<ISpaceEntryDraft | null>()
    if (!draft) throw new ServiceError(404, 'SPACE_DRAFT_NOT_FOUND', 'El borrador no existe.')
    if (draft.status !== 'active' && draft.status !== 'published') {
        throw new ServiceError(409, 'SPACE_DRAFT_NOT_ACTIVE', 'El borrador ya no puede publicarse.')
    }
    if (draft.status === 'active' && draft.revision !== input.expectedRevision) {
        throw new ServiceError(
            409,
            'SPACE_DRAFT_VERSION_CONFLICT',
            'El borrador cambió antes de publicarse.',
            { draft: toSpaceEntryDraftDto(draft) }
        )
    }
    requirePublishableDraft(draft)
    return createSpaceEntryV2({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        idempotencyKey: draft.publishIdempotencyKey,
        expectedRevision: draft.expectedSpaceRevision,
        title: draft.title!,
        description: draft.description,
        amount: draft.amount!,
        money: draft.money,
        currency: draft.currency!,
        exchangeRate: draft.exchangeRate,
        exchangeRateDecimal: draft.exchangeRateDecimal,
        conversionSnapshot: draft.conversionSnapshot,
        expectedQuoteFingerprint: draft.expectedQuoteFingerprint,
        dateKey: draft.dateKey!,
        paidByParticipantId: draft.paidByParticipantId!.toString(),
        sharedWithParticipantIds: draft.sharedWithParticipantIds!.map((id) => id.toString()),
        splitMode: draft.splitMode!,
        splitAllocations: draft.splitAllocations?.map((allocation) => ({
            participantId: allocation.participantId.toString(),
            percentage: allocation.percentage,
            amount: allocation.amount,
        })),
        spaceCategoryId: extractId(draft.spaceCategoryId),
        notes: draft.notes,
        actorPersonalImpact: draft.actorPersonalImpact ? {
            accountId: extractId(draft.actorPersonalImpact.accountId),
            categoryId: extractId(draft.actorPersonalImpact.categoryId),
            description: draft.actorPersonalImpact.description,
            linkedTransactionId: extractId(draft.actorPersonalImpact.linkedTransactionId),
        } : undefined,
        draftPublication: {
            draftId: draft._id.toString(),
            expectedRevision: input.expectedRevision,
        },
    })
}
