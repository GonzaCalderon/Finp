import { Types } from 'mongoose'
import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry } from '@/lib/models'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import {
    isAllowedMimeType,
    isWithinSizeLimit,
    sanitizeFileName,
} from '@/lib/utils/space-categories'
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

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return NextResponse.json(
                { error: 'El almacenamiento de comprobantes no está configurado.' },
                { status: 503 }
            )
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

        if (!isAllowedMimeType(file.type)) {
            return NextResponse.json(
                { error: 'Formato no permitido. Usá JPG, PNG, WebP o PDF.' },
                { status: 400 }
            )
        }

        if (!isWithinSizeLimit(file.size)) {
            return NextResponse.json(
                { error: 'El archivo debe pesar hasta 10 MB.' },
                { status: 400 }
            )
        }

        const safeFileName = sanitizeFileName(file.name)
        const buffer = Buffer.from(await file.arrayBuffer())
        const blob = await put(
            `spaces/${id}/entries/${entryId}/${Date.now()}-${safeFileName}`,
            buffer,
            {
                access: 'private',
                token: process.env.BLOB_READ_WRITE_TOKEN,
                contentType: file.type,
            }
        )

        const attachmentId = new Types.ObjectId()
        const attachment = {
            _id: attachmentId,
            uploadedByUserId: new Types.ObjectId(session.user.id),
            fileName: safeFileName,
            mimeType: file.type,
            size: file.size,
            storageProvider: 'vercel_blob',
            storageKey: blob.pathname,
            createdAt: new Date(),
        } satisfies ISpaceEntryAttachment

        await SpaceEntry.updateOne(
            { _id: entryId, spaceId: id },
            { $push: { attachments: attachment } }
        )

        return NextResponse.json({ attachment }, { status: 201 })
    } catch (error) {
        console.error('Error al subir comprobante:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
