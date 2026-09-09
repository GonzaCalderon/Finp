import { Types } from 'mongoose'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry } from '@/lib/models'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import { resolveSpaceAttachmentStorage } from '@/lib/server/space-attachment-storage'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { extractId } from '@/lib/utils/spaces'
import { sanitizeFileName } from '@/lib/utils/space-categories'
import type { ISpaceEntry, ISpaceEntryAttachment } from '@/types'

function canManageAttachment({
    attachment,
    userId,
    role,
}: {
    attachment: ISpaceEntryAttachment
    userId: string
    role?: string
}) {
    return (
        extractId(attachment.uploadedByUserId) === userId ||
        role === 'owner' ||
        role === 'admin'
    )
}

function buildAttachmentDisposition(fileName: string, mimeType: string) {
    const safeFileName = sanitizeFileName(fileName).replace(/"/g, '')
    return `${mimeType === 'application/pdf' ? 'attachment' : 'inline'}; filename="${safeFileName}"`
}

async function getAttachmentContext(spaceId: string, entryId: string, attachmentId: string, userId: string) {
    if (!Types.ObjectId.isValid(entryId) || !Types.ObjectId.isValid(attachmentId)) {
        return {
            response: NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 }),
            entry: null,
            attachment: null,
            role: undefined,
        }
    }

    const context = await getAccessibleSpaceContext(spaceId, userId)
    if (!context || !context.currentParticipant) {
        return {
            response: NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 }),
            entry: null,
            attachment: null,
            role: undefined,
        }
    }

    const entry = await SpaceEntry.findOne({ _id: entryId, spaceId }).lean<ISpaceEntry | null>()
    if (!entry) {
        return {
            response: NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 }),
            entry: null,
            attachment: null,
            role: context.currentParticipant.role,
        }
    }

    const attachment = (entry.attachments ?? []).find(
        (item) => extractId(item._id) === attachmentId
    ) ?? null

    if (!attachment) {
        return {
            response: NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 }),
            entry,
            attachment: null,
            role: context.currentParticipant.role,
        }
    }

    return {
        response: null,
        entry,
        attachment,
        role: context.currentParticipant.role,
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; entryId: string; attachmentId: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId, attachmentId } = await params
        await connectDB()

        const context = await getAttachmentContext(id, entryId, attachmentId, session.user.id)
        if (context.response) return context.response
        if (!context.attachment) {
            return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
        }

        const result = await resolveSpaceAttachmentStorage().read(context.attachment.storageKey)

        if (!result) {
            return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
        }

        return new NextResponse(result.stream, {
            headers: {
                'Content-Type': context.attachment.mimeType,
                'Content-Disposition': buildAttachmentDisposition(
                    context.attachment.fileName,
                    context.attachment.mimeType
                ),
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo leer el comprobante.')
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; entryId: string; attachmentId: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId, attachmentId } = await params
        await connectDB()

        const context = await getAttachmentContext(id, entryId, attachmentId, session.user.id)
        if (context.response) return context.response
        if (!context.attachment) {
            return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
        }

        if (
            !canManageAttachment({
                attachment: context.attachment,
                userId: session.user.id,
                role: context.role,
            })
        ) {
            return NextResponse.json(
                { error: 'No tenés permisos para borrar este comprobante.' },
                { status: 403 }
            )
        }

        const revoked = await SpaceEntry.updateOne(
            { _id: entryId, spaceId: id },
            { $pull: { attachments: { _id: new Types.ObjectId(attachmentId) } } }
        )
        if (revoked.modifiedCount !== 1) {
            return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
        }
        try {
            await resolveSpaceAttachmentStorage().delete(context.attachment.storageKey)
        } catch {
            console.error('[space-attachment-cleanup]', { spaceId: id, entryId, attachmentId, code: 'DELETE_FAILED' })
        }

        createSpaceActivityEvent({
            spaceId: id,
            actorUserId: session.user.id,
            type: 'attachment_deleted',
            entityType: 'attachment',
            entityId: attachmentId,
            title: `${session.user.name ?? 'Un participante'} eliminó un comprobante`,
            metadata: {
                entryId,
                entryTitle: context.entry?.title,
                fileName: context.attachment.fileName,
            },
        }).catch((err) => console.error('[space-activity]', err))

        return NextResponse.json({ success: true })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo borrar el comprobante.')
    }
}
