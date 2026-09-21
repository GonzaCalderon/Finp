import mongoose, { Types } from 'mongoose'

import { SpaceEntryDraft } from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import { validateSpaceAttachmentFile, type SpaceAttachmentMimeType } from '@/lib/server/space-attachment-file'
import {
    resolveSpaceAttachmentStorage,
    type SpaceAttachmentStorage,
} from '@/lib/server/space-attachment-storage'
import { loadSpaceApplicationContextV2 } from '@/lib/server/space-application-context-v2'
import { assertSpaceV2WriteEnabled } from '@/lib/server/space-v2-write-gate'
import type {
    ISpaceEntryDraft,
    ISpaceEntryDraftAttachment,
    SpaceEntryDraftAttachmentDto,
    SpaceEntryDraftAttachmentMutationDto,
} from '@/types'

const VISIBLE_STATUSES = new Set(['preparing', 'ready', 'upload_failed'])
const PREPARATION_STALE_MS = 15 * 60 * 1000

function publicErrorCode(attachment: ISpaceEntryDraftAttachment) {
    if (attachment.status !== 'upload_failed') return undefined
    return attachment.lastErrorCode === 'RECOVERY_REQUIRED' ? 'RECOVERY_REQUIRED' as const : 'UPLOAD_FAILED' as const
}

export function toSpaceEntryDraftAttachmentDto(
    attachment: ISpaceEntryDraftAttachment
): SpaceEntryDraftAttachmentDto | null {
    if (!VISIBLE_STATUSES.has(attachment.status)) return null
    return {
        id: attachment._id.toString(),
        fileName: attachment.fileName ?? 'archivo',
        mimeType: (attachment.mimeType ?? attachment.declaredMimeType ?? 'application/pdf') as SpaceAttachmentMimeType,
        size: attachment.size ?? 0,
        status: attachment.status as SpaceEntryDraftAttachmentDto['status'],
        createdAt: attachment.createdAt.toISOString(),
        errorCode: publicErrorCode(attachment),
    }
}

function requireDraft(input: {
    draft: ISpaceEntryDraft | null
    draftId: string
    expectedRevision?: number
}) {
    if (!input.draft || input.draft._id.toString() !== input.draftId) {
        throw new ServiceError(404, 'DRAFT_NOT_FOUND', 'El borrador no existe.')
    }
    if (input.draft.status !== 'active') {
        throw new ServiceError(409, 'DRAFT_NOT_FOUND', 'El borrador ya no está activo.')
    }
    if (input.expectedRevision !== undefined && input.draft.revision !== input.expectedRevision) {
        throw new ServiceError(409, 'DRAFT_REVISION_CONFLICT', 'El borrador cambió. Recargalo antes de continuar.')
    }
    return input.draft
}

async function requirePreparationCapability(actorUserId: string, spaceId: string) {
    const session = await mongoose.startSession()
    try {
        await loadSpaceApplicationContextV2({ actorUserId, spaceId, capability: 'create_entry', session })
    } finally {
        await session.endSession()
    }
}

function deterministicStorageKey(input: {
    spaceId: string
    draftId: string
    attachmentId: string
    extension: string
}) {
    return `spaces/${input.spaceId}/drafts/${input.draftId}/${input.attachmentId}.${input.extension}`
}

async function markUploadFailed(input: {
    draftId: string
    actorUserId: string
    attachmentId: Types.ObjectId
    reservedRevision: number
    errorCode: string
}) {
    const failed = await SpaceEntryDraft.findOneAndUpdate(
        {
            _id: input.draftId,
            creatorUserId: input.actorUserId,
            status: 'active',
            revision: input.reservedRevision,
            attachments: { $elemMatch: { _id: input.attachmentId, status: 'preparing' } },
        },
        {
            $set: {
                'attachments.$.status': 'upload_failed',
                'attachments.$.lastAttemptAt': new Date(),
                'attachments.$.lastErrorCode': input.errorCode,
            },
            $inc: { revision: 1 },
        },
        { new: true }
    ).lean<ISpaceEntryDraft | null>()
    return failed
}

async function confirmReady(input: {
    draftId: string
    actorUserId: string
    attachmentId: Types.ObjectId
    reservedRevision: number
}) {
    const confirmed = await SpaceEntryDraft.findOneAndUpdate(
        {
            _id: input.draftId,
            creatorUserId: input.actorUserId,
            status: 'active',
            revision: input.reservedRevision,
            attachments: { $elemMatch: { _id: input.attachmentId, status: 'preparing' } },
        },
        {
            $set: {
                'attachments.$.status': 'ready',
                'attachments.$.confirmedAt': new Date(),
                'attachments.$.lastAttemptAt': new Date(),
            },
            $unset: { 'attachments.$.lastErrorCode': 1 },
            $inc: { revision: 1 },
        },
        { new: true }
    ).lean<ISpaceEntryDraft | null>()
    if (!confirmed) {
        throw new ServiceError(409, 'DRAFT_REVISION_CONFLICT', 'El borrador cambió al confirmar el archivo.')
    }
    const attachment = confirmed.attachments?.find((item) => item._id.equals(input.attachmentId))
    const dto = attachment ? toSpaceEntryDraftAttachmentDto(attachment) : null
    if (!dto) throw new ServiceError(500, 'INTERNAL_ERROR', 'No se pudo confirmar el archivo.')
    return { draftRevision: confirmed.revision, attachment: dto } satisfies SpaceEntryDraftAttachmentMutationDto
}

export async function prepareSpaceEntryDraftAttachment(input: {
    actorUserId: string
    spaceId: string
    draftId: string
    expectedRevision: number
    idempotencyKey: string
    file: File
    attachmentId?: string
    storage?: SpaceAttachmentStorage
}) {
    assertSpaceV2WriteEnabled()
    await requirePreparationCapability(input.actorUserId, input.spaceId)
    const validated = await validateSpaceAttachmentFile(input.file)
    const current = requireDraft({
        draft: await SpaceEntryDraft.findOne({
            _id: input.draftId,
            creatorUserId: input.actorUserId,
            spaceId: input.spaceId,
            contractVersion: 2,
        }).lean<ISpaceEntryDraft | null>(),
        draftId: input.draftId,
    })

    const existingByKey = current.attachments?.find(
        (attachment) => attachment.uploadIdempotencyKey === input.idempotencyKey
    )
    if (existingByKey) {
        if (existingByKey.contentSha256 !== validated.contentSha256) {
            throw new ServiceError(409, 'IDEMPOTENCY_KEY_REUSED', 'La clave de carga ya se usó con otro archivo.')
        }
        const dto = toSpaceEntryDraftAttachmentDto(existingByKey)
        if (existingByKey.status === 'ready' && dto) {
            return { draftRevision: current.revision, attachment: dto } satisfies SpaceEntryDraftAttachmentMutationDto
        }
    }

    if (!existingByKey && current.revision !== input.expectedRevision) {
        throw new ServiceError(409, 'DRAFT_REVISION_CONFLICT', 'El borrador cambió. Recargalo antes de continuar.')
    }

    const existingById = input.attachmentId
        ? current.attachments?.find((attachment) => attachment._id.toString() === input.attachmentId)
        : existingByKey
    if (input.attachmentId && current.revision !== input.expectedRevision) {
        throw new ServiceError(409, 'DRAFT_REVISION_CONFLICT', 'El borrador cambió. Recargalo antes de continuar.')
    }
    if (input.attachmentId && (!existingById || existingById.status !== 'upload_failed')) {
        throw new ServiceError(409, 'ATTACHMENT_NOT_READY', 'Ese archivo no admite reintento.')
    }

    const visibleCount = (current.attachments ?? []).filter((attachment) => VISIBLE_STATUSES.has(attachment.status)).length
    if (!existingById && visibleCount >= 5) {
        throw new ServiceError(409, 'ATTACHMENT_LIMIT_REACHED', 'Cada movimiento puede tener hasta 5 archivos.')
    }

    const attachmentId = existingById?._id ?? new Types.ObjectId()
    const storageKey = deterministicStorageKey({
        spaceId: input.spaceId,
        draftId: input.draftId,
        attachmentId: attachmentId.toString(),
        extension: validated.extension,
    })
    if (existingById?.storageKey && !existingById.storageKey.endsWith(`.${validated.extension}`)) {
        throw new ServiceError(409, 'ATTACHMENT_NOT_READY', 'Reintentá el archivo con el mismo formato.')
    }
    const now = new Date()
    const attachment: ISpaceEntryDraftAttachment = {
        _id: attachmentId,
        uploadedByUserId: new Types.ObjectId(input.actorUserId),
        uploadIdempotencyKey: existingById?.uploadIdempotencyKey ?? input.idempotencyKey,
        status: 'preparing',
        fileName: validated.fileName,
        declaredMimeType: input.file.type,
        mimeType: validated.mimeType,
        size: validated.size,
        contentSha256: validated.contentSha256,
        storageProvider: 'vercel_blob',
        storageKey,
        createdAt: existingById?.createdAt ?? now,
        lastAttemptAt: now,
    }

    const reservation = existingById?.status === 'preparing'
        ? current
        : existingById
            ? await SpaceEntryDraft.findOneAndUpdate(
            { _id: current._id, creatorUserId: input.actorUserId, status: 'active', revision: current.revision,
                attachments: { $elemMatch: { _id: attachmentId, status: 'upload_failed' } } },
            { $set: { 'attachments.$': attachment }, $inc: { revision: 1 } },
            { new: true }
        ).lean<ISpaceEntryDraft | null>()
        : await SpaceEntryDraft.findOneAndUpdate(
            { _id: current._id, creatorUserId: input.actorUserId, status: 'active', revision: current.revision },
            { $push: { attachments: attachment }, $inc: { revision: 1 } },
            { new: true }
        ).lean<ISpaceEntryDraft | null>()
    if (!reservation) throw new ServiceError(409, 'DRAFT_REVISION_CONFLICT', 'El borrador cambió al reservar el archivo.')

    let storage: SpaceAttachmentStorage | undefined = input.storage
    try {
        storage ??= resolveSpaceAttachmentStorage()
        const stored = await storage.inspect(storageKey)
        if (!stored.exists || stored.size !== validated.size || stored.contentType !== validated.mimeType) {
            await storage.put({ storageKey, body: validated.buffer, mimeType: validated.mimeType })
        }
    } catch {
        const failed = await markUploadFailed({
            draftId: input.draftId,
            actorUserId: input.actorUserId,
            attachmentId,
            reservedRevision: reservation.revision,
            errorCode: 'STORAGE_UNAVAILABLE',
        })
        console.error('[space-draft-attachment]', {
            draftId: input.draftId,
            attachmentId: attachmentId.toString(),
            transition: 'preparing_to_upload_failed',
            provider: storage?.provider ?? 'vercel_blob',
            code: 'STORAGE_UNAVAILABLE',
        })
        throw new ServiceError(
            503,
            'STORAGE_UNAVAILABLE',
            'No pudimos subir el archivo. Podés reintentarlo.',
            { draftRevision: failed?.revision, attachmentId: attachmentId.toString() }
        )
    }

    return confirmReady({
        draftId: input.draftId,
        actorUserId: input.actorUserId,
        attachmentId,
        reservedRevision: reservation.revision,
    })
}

export async function readSpaceEntryDraftAttachment(input: {
    actorUserId: string
    spaceId: string
    attachmentId: string
    storage?: SpaceAttachmentStorage
}) {
    if (!Types.ObjectId.isValid(input.attachmentId)) {
        throw new ServiceError(404, 'DRAFT_NOT_FOUND', 'El archivo no existe.')
    }
    const draft = await SpaceEntryDraft.findOne({
        creatorUserId: input.actorUserId,
        spaceId: input.spaceId,
        contractVersion: 2,
        status: 'active',
        attachments: { $elemMatch: { _id: input.attachmentId, status: 'ready' } },
    }).lean<ISpaceEntryDraft | null>()
    const attachment = draft?.attachments?.find((item) => item._id.toString() === input.attachmentId && item.status === 'ready')
    if (!attachment?.storageKey || !attachment.mimeType || !attachment.fileName) {
        throw new ServiceError(404, 'DRAFT_NOT_FOUND', 'El archivo no existe.')
    }
    let result
    try {
        result = await (input.storage ?? resolveSpaceAttachmentStorage()).read(attachment.storageKey)
    } catch {
        throw new ServiceError(503, 'STORAGE_UNAVAILABLE', 'No pudimos recuperar el archivo.')
    }
    if (!result) throw new ServiceError(404, 'DRAFT_NOT_FOUND', 'El archivo no existe.')
    if (result.size !== attachment.size || result.contentType !== attachment.mimeType) {
        throw new ServiceError(409, 'ATTACHMENT_NOT_READY', 'El archivo necesita recuperación antes de descargarse.')
    }
    return { attachment, ...result }
}

export async function removeSpaceEntryDraftAttachment(input: {
    actorUserId: string
    spaceId: string
    draftId: string
    attachmentId: string
    expectedRevision: number
    storage?: SpaceAttachmentStorage
}) {
    assertSpaceV2WriteEnabled()
    if (!Types.ObjectId.isValid(input.attachmentId)) throw new ServiceError(404, 'DRAFT_NOT_FOUND', 'El archivo no existe.')
    const updated = await SpaceEntryDraft.findOneAndUpdate(
        {
            _id: input.draftId,
            creatorUserId: input.actorUserId,
            spaceId: input.spaceId,
            contractVersion: 2,
            status: 'active',
            revision: input.expectedRevision,
            attachments: { $elemMatch: { _id: input.attachmentId, status: { $in: [...VISIBLE_STATUSES] } } },
        },
        {
            $set: {
                'attachments.$.status': 'cleanup_pending',
                'attachments.$.deletedAt': new Date(),
                'attachments.$.lastAttemptAt': new Date(),
            },
            $inc: { revision: 1 },
        },
        { new: true }
    ).lean<ISpaceEntryDraft | null>()
    if (!updated) throw new ServiceError(409, 'DRAFT_REVISION_CONFLICT', 'El borrador cambió antes de quitar el archivo.')
    const attachment = updated.attachments?.find((item) => item._id.toString() === input.attachmentId)
    if (!attachment) throw new ServiceError(404, 'DRAFT_NOT_FOUND', 'El archivo no existe.')
    let storage: SpaceAttachmentStorage
    try {
        storage = input.storage ?? resolveSpaceAttachmentStorage()
    } catch {
        return { draftRevision: updated.revision, cleanupPending: true } satisfies SpaceEntryDraftAttachmentMutationDto
    }
    const cleaned = await cleanupPendingAttachment({ draft: updated, attachment, storage })
    return { draftRevision: cleaned.revision, cleanupPending: cleaned.pending } satisfies SpaceEntryDraftAttachmentMutationDto
}

async function cleanupPendingAttachment(input: {
    draft: ISpaceEntryDraft
    attachment: ISpaceEntryDraftAttachment
    storage: SpaceAttachmentStorage
}) {
    try {
        if (input.attachment.storageKey) await input.storage.delete(input.attachment.storageKey)
    } catch {
        console.error('[space-draft-attachment]', {
            draftId: input.draft._id.toString(),
            attachmentId: input.attachment._id.toString(),
            transition: 'cleanup_pending',
            provider: input.storage.provider,
            code: 'DELETE_FAILED',
        })
        return { revision: input.draft.revision, pending: true }
    }
    const cleaned = await SpaceEntryDraft.findOneAndUpdate(
        { _id: input.draft._id, revision: input.draft.revision,
            attachments: { $elemMatch: { _id: input.attachment._id, status: 'cleanup_pending' } } },
        {
            $set: { 'attachments.$.status': 'deleted', 'attachments.$.deletedAt': new Date() },
            $unset: {
                'attachments.$.storageKey': 1,
                'attachments.$.fileName': 1,
                'attachments.$.declaredMimeType': 1,
                'attachments.$.mimeType': 1,
                'attachments.$.size': 1,
                'attachments.$.contentSha256': 1,
                'attachments.$.lastErrorCode': 1,
            },
            $inc: { revision: 1 },
        },
        { new: true }
    ).lean<ISpaceEntryDraft | null>()
    return { revision: cleaned?.revision ?? input.draft.revision, pending: !cleaned }
}

export async function reconcileSpaceEntryDraftAttachments(input: {
    draftId?: string
    dryRun?: boolean
    limit?: number
    storage?: SpaceAttachmentStorage
    now?: Date
}) {
    const now = input.now ?? new Date()
    const limit = Math.max(1, Math.min(input.limit ?? 50, 200))
    const query: Record<string, unknown> = {
        contractVersion: 2,
        attachments: { $elemMatch: { status: { $in: ['preparing', 'cleanup_pending'] } } },
    }
    if (input.draftId) query._id = input.draftId
    const drafts = await SpaceEntryDraft.find(query).sort({ updatedAt: 1 }).limit(limit).lean<ISpaceEntryDraft[]>()
    let storage = input.storage
    const counters = { inspected: 0, ready: 0, uploadFailed: 0, cleanupPending: 0, deleted: 0, failures: 0 }

    for (const draft of drafts) {
        for (const attachment of draft.attachments ?? []) {
            if (attachment.status === 'preparing' && now.getTime() - attachment.lastAttemptAt.getTime() < PREPARATION_STALE_MS) continue
            if (attachment.status !== 'preparing' && attachment.status !== 'cleanup_pending') continue
            counters.inspected += 1
            if (input.dryRun !== false) {
                if (attachment.status === 'cleanup_pending') counters.cleanupPending += 1
                continue
            }
            if (attachment.status === 'cleanup_pending') {
                storage ??= resolveSpaceAttachmentStorage()
                const result = await cleanupPendingAttachment({ draft, attachment, storage })
                draft.revision = result.revision
                if (result.pending) counters.failures += 1
                else counters.deleted += 1
                continue
            }
            try {
                storage ??= resolveSpaceAttachmentStorage()
                const metadata = attachment.storageKey ? await storage.inspect(attachment.storageKey) : { exists: false }
                const matches = metadata.exists && metadata.size === attachment.size && metadata.contentType === attachment.mimeType
                const nextStatus = matches ? 'ready' : metadata.exists ? 'cleanup_pending' : 'upload_failed'
                const updated = await SpaceEntryDraft.findOneAndUpdate(
                    { _id: draft._id, revision: draft.revision,
                        attachments: { $elemMatch: { _id: attachment._id, status: 'preparing' } } },
                    { $set: {
                        'attachments.$.status': nextStatus,
                        'attachments.$.lastAttemptAt': now,
                        ...(nextStatus === 'ready' ? { 'attachments.$.confirmedAt': now } : {}),
                        ...(nextStatus === 'upload_failed' ? { 'attachments.$.lastErrorCode': 'RECOVERY_REQUIRED' } : {}),
                    }, $inc: { revision: 1 } },
                    { new: true }
                ).lean<ISpaceEntryDraft | null>()
                if (!updated) { counters.failures += 1; continue }
                draft.revision = updated.revision
                if (nextStatus === 'ready') counters.ready += 1
                else if (nextStatus === 'upload_failed') counters.uploadFailed += 1
                else counters.cleanupPending += 1
            } catch {
                counters.failures += 1
            }
        }
    }
    return counters
}

export function visibleDraftAttachments(draft: ISpaceEntryDraft) {
    return (draft.attachments ?? [])
        .map(toSpaceEntryDraftAttachmentDto)
        .filter((attachment): attachment is SpaceEntryDraftAttachmentDto => Boolean(attachment))
}

export function publishedAttachmentsFromDraft(draft: ISpaceEntryDraft) {
    const visible = (draft.attachments ?? []).filter((attachment) => VISIBLE_STATUSES.has(attachment.status))
    if (visible.some((attachment) => attachment.status !== 'ready')) {
        throw new ServiceError(409, 'ATTACHMENT_NOT_READY', 'Resolvé o quitá los archivos pendientes antes de publicar.')
    }
    return visible.map((attachment) => {
        if (!attachment.fileName || !attachment.mimeType || attachment.size === undefined || !attachment.storageKey) {
            throw new ServiceError(409, 'ATTACHMENT_NOT_READY', 'El archivo necesita recuperación antes de publicar.')
        }
        return {
            _id: attachment._id,
            uploadedByUserId: attachment.uploadedByUserId,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            size: attachment.size,
            storageProvider: attachment.storageProvider,
            storageKey: attachment.storageKey,
            contentSha256: attachment.contentSha256,
            createdAt: attachment.createdAt,
        }
    })
}

export async function cleanupDiscardedDraftAttachments(input: {
    draft: ISpaceEntryDraft
    storage?: SpaceAttachmentStorage
}) {
    const pending = (input.draft.attachments ?? []).filter((attachment) => attachment.status === 'cleanup_pending')
    if (pending.length === 0) return
    const storage = input.storage ?? resolveSpaceAttachmentStorage()
    for (const attachment of pending) {
        if (attachment.status === 'cleanup_pending') {
            const fresh = await SpaceEntryDraft.findById(input.draft._id).lean<ISpaceEntryDraft | null>()
            const current = fresh?.attachments?.find((item) => item._id.equals(attachment._id))
            if (fresh && current?.status === 'cleanup_pending') {
                await cleanupPendingAttachment({ draft: fresh, attachment: current, storage })
            }
        }
    }
}
