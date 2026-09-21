import { createHash } from 'node:crypto'

import { ServiceError } from '@/lib/server/errors'
import {
    ALLOWED_ATTACHMENT_MIME_TYPES,
    MAX_ATTACHMENT_SIZE,
    isAllowedMimeType,
    isWithinSizeLimit,
    sanitizeFileName,
} from '@/lib/utils/space-categories'

export type SpaceAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]

const MIME_EXTENSIONS: Record<SpaceAttachmentMimeType, readonly string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
}

function detectMimeType(buffer: Buffer): SpaceAttachmentMimeType | null {
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg'
    }
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png'
    }
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return 'image/webp'
    }
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
        return 'application/pdf'
    }
    return null
}

export async function validateSpaceAttachmentFile(file: File) {
    if (!isWithinSizeLimit(file.size)) {
        throw new ServiceError(413, 'ATTACHMENT_TOO_LARGE', 'El archivo debe pesar hasta 10 MB.')
    }
    if (!isAllowedMimeType(file.type)) {
        throw new ServiceError(415, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'Usá un archivo JPG, PNG, WebP o PDF.')
    }

    const fileName = sanitizeFileName(file.name)
    const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.byteLength > MAX_ATTACHMENT_SIZE) {
        throw new ServiceError(413, 'ATTACHMENT_TOO_LARGE', 'El archivo debe pesar hasta 10 MB.')
    }
    const mimeType = detectMimeType(buffer)
    if (!mimeType || mimeType !== file.type || !MIME_EXTENSIONS[mimeType].includes(extension)) {
        throw new ServiceError(
            415,
            'ATTACHMENT_TYPE_NOT_ALLOWED',
            'El contenido, el formato y la extensión del archivo no coinciden.'
        )
    }

    return {
        buffer,
        fileName,
        mimeType,
        size: buffer.byteLength,
        contentSha256: createHash('sha256').update(buffer).digest('hex'),
        extension: MIME_EXTENSIONS[mimeType][0],
    }
}
