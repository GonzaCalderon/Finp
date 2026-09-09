import { describe, expect, it } from 'vitest'

import { validateSpaceAttachmentFile } from '@/lib/server/space-attachment-file'
import { sanitizeFileName } from '@/lib/utils/space-categories'

describe('space attachment validation', () => {
    const file = (bytes: Uint8Array, name: string, type: string) => ({
        name,
        type,
        size: bytes.byteLength,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }) as File

    it('detecta firma, normaliza nombre y calcula hash en servidor', async () => {
        const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
        const result = await validateSpaceAttachmentFile(file(bytes, '../ticket raro?.png', 'image/png'))
        expect(result).toMatchObject({ fileName: 'ticket raro-.png', mimeType: 'image/png', size: bytes.length })
        expect(result.contentSha256).toMatch(/^[a-f\d]{64}$/)
    })

    it('rechaza MIME declarado que no coincide con firma o extensión', async () => {
        const pdf = file(new TextEncoder().encode('%PDF-1.7'), 'factura.png', 'image/png')
        await expect(validateSpaceAttachmentFile(pdf)).rejects.toMatchObject({
            status: 415,
            code: 'ATTACHMENT_TYPE_NOT_ALLOWED',
        })
    })

    it('limita el nombre visible a 160 caracteres sin perder la extensión', () => {
        const sanitized = sanitizeFileName(`${'a'.repeat(200)}.pdf`)
        expect(sanitized).toHaveLength(160)
        expect(sanitized.endsWith('.pdf')).toBe(true)
    })
})
