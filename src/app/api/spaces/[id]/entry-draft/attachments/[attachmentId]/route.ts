import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import {
    prepareSpaceEntryDraftAttachment,
    readSpaceEntryDraftAttachment,
    removeSpaceEntryDraftAttachment,
} from '@/lib/server/space-entry-draft-attachment-service'
import {
    deleteSpaceEntryDraftAttachmentSchema,
    mutateSpaceEntryDraftAttachmentSchema,
} from '@/lib/validations/space-entry-draft'
import { sanitizeFileName } from '@/lib/utils/space-categories'

function contentDisposition(fileName: string, mimeType: string) {
    const disposition = mimeType === 'application/pdf' ? 'attachment' : 'inline'
    return `${disposition}; filename="${sanitizeFileName(fileName).replace(/"/g, '')}"`
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id, attachmentId } = await params
        await connectDB()
        const result = await readSpaceEntryDraftAttachment({
            actorUserId: session.user.id,
            spaceId: id,
            attachmentId,
        })
        return new NextResponse(result.stream, {
            headers: {
                'Content-Type': result.attachment.mimeType!,
                'Content-Length': String(result.size),
                'Content-Disposition': contentDisposition(result.attachment.fileName!, result.attachment.mimeType!),
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo recuperar el archivo.', 'INTERNAL_ERROR')
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id, attachmentId } = await params
        const formData = await request.formData()
        const parsed = mutateSpaceEntryDraftAttachmentSchema.safeParse({
            draftId: formData.get('draftId'),
            expectedRevision: formData.get('expectedRevision'),
            idempotencyKey: formData.get('idempotencyKey'),
        })
        const file = formData.get('file')
        if (!parsed.success || !(file instanceof File)) {
            return NextResponse.json(
                { error: 'El archivo o la identidad del borrador no son válidos.', code: 'INVALID_ATTACHMENT' },
                { status: 400 }
            )
        }
        await connectDB()
        const result = await prepareSpaceEntryDraftAttachment({
            actorUserId: session.user.id,
            spaceId: id,
            attachmentId,
            file,
            ...parsed.data,
        })
        return NextResponse.json(result)
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo reintentar el archivo.', 'INTERNAL_ERROR')
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id, attachmentId } = await params
        const parsed = deleteSpaceEntryDraftAttachmentSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'La identidad del borrador no es válida.', code: 'INVALID_ATTACHMENT' },
                { status: 400 }
            )
        }
        await connectDB()
        const result = await removeSpaceEntryDraftAttachment({
            actorUserId: session.user.id,
            spaceId: id,
            attachmentId,
            ...parsed.data,
        })
        return NextResponse.json(result)
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo quitar el archivo.', 'INTERNAL_ERROR')
    }
}
