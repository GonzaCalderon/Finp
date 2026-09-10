import { Types } from 'mongoose'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry } from '@/lib/models'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import { validateSpaceAttachmentFile } from '@/lib/server/space-attachment-file'
import { resolveSpaceAttachmentStorage } from '@/lib/server/space-attachment-storage'
import { getAccessibleSpaceContext, getContextCapabilities } from '@/lib/server/spaces'
import {
    sanitizeFileName,
} from '@/lib/utils/space-categories'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryAttachment } from '@/types'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; entryId: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento inválido' }, { status: 400 })
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context || !context.currentParticipant) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id }).lean<ISpaceEntry | null>()
        if (!entry) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        // Adjuntar es una edición del movimiento compartido: exige la misma
        // capacidad, para que un Espacio pausado, cerrado o archivado no acepte
        // archivos nuevos ni un movimiento anulado siga creciendo.
        const capabilities = getContextCapabilities(context)
        const isOwnEntry = extractId(entry.createdByParticipantId) === extractId(context.currentParticipant._id)
        const canAttach = entry.isVoided !== true && (
            capabilities.has('edit_any_entry') ||
            (isOwnEntry && capabilities.has('edit_own_entry'))
        )
        if (!canAttach) {
            return NextResponse.json(
                { error: 'No podés adjuntar comprobantes a este movimiento.' },
                { status: 403 }
            )
        }

        if ((entry.attachments?.length ?? 0) >= 5) {
            return NextResponse.json(
                { error: 'Cada movimiento puede tener hasta 5 comprobantes.' },
                { status: 400 }
            )
        }

        const formData = await request.formData()
        const file = formData.get('file')
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
        }

        const validated = await validateSpaceAttachmentFile(file)
        const attachmentId = new Types.ObjectId()
        const storageKey = `spaces/${id}/entries/${entryId}/${attachmentId.toString()}.${validated.extension}`
        const storage = resolveSpaceAttachmentStorage()
        await storage.put({ storageKey, body: validated.buffer, mimeType: validated.mimeType })
        const attachment = {
            _id: attachmentId,
            uploadedByUserId: new Types.ObjectId(session.user.id),
            fileName: sanitizeFileName(validated.fileName),
            mimeType: validated.mimeType,
            size: validated.size,
            storageProvider: 'vercel_blob',
            storageKey,
            contentSha256: validated.contentSha256,
            createdAt: new Date(),
        } satisfies ISpaceEntryAttachment

        const stored = await SpaceEntry.updateOne(
            { _id: entryId, spaceId: id, $expr: { $lt: [{ $size: { $ifNull: ['$attachments', []] } }, 5] } },
            { $push: { attachments: attachment } }
        )
        if (stored.modifiedCount !== 1) {
            await storage.delete(storageKey).catch(() => undefined)
            return NextResponse.json({ error: 'No se pudo vincular el archivo.', code: 'ATTACHMENT_LIMIT_REACHED' }, { status: 409 })
        }

        createSpaceActivityEvent({
            spaceId: id,
            actorUserId: session.user.id,
            actorParticipantId: extractId(context.currentParticipant._id),
            type: 'attachment_uploaded',
            entityType: 'attachment',
            entityId: extractId(attachment._id),
            title: `${context.currentParticipant.displayName} subió un comprobante`,
            metadata: {
                entryId,
                entryTitle: entry.title,
                fileName: attachment.fileName,
            },
        }).catch((err) => console.error('[space-activity]', err))

        return NextResponse.json({ attachment }, { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo subir el comprobante.')
    }
}
