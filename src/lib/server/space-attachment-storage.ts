import { del, get, head, put } from '@vercel/blob'
import mongoose from 'mongoose'

import { ServiceError } from '@/lib/server/errors'
import type { SpaceAttachmentMimeType } from '@/lib/server/space-attachment-file'

export interface SpaceAttachmentStorageMetadata {
    exists: boolean
    size?: number
    contentType?: string
}

export interface SpaceAttachmentStorageReadResult {
    stream: ReadableStream<Uint8Array>
    size: number
    contentType: string
}

export interface SpaceAttachmentStorage {
    provider: 'vercel_blob'
    put(input: { storageKey: string; body: Buffer; mimeType: SpaceAttachmentMimeType }): Promise<void>
    inspect(storageKey: string): Promise<SpaceAttachmentStorageMetadata>
    read(storageKey: string): Promise<SpaceAttachmentStorageReadResult | null>
    delete(storageKey: string): Promise<void>
}

function isNotFound(error: unknown) {
    return Boolean(error && typeof error === 'object' && (
        ('status' in error && (error as { status?: unknown }).status === 404) ||
        ('statusCode' in error && (error as { statusCode?: unknown }).statusCode === 404) ||
        ('message' in error && typeof (error as { message?: unknown }).message === 'string' &&
            /404|not found/i.test((error as { message: string }).message))
    ))
}

export function createVercelBlobSpaceAttachmentStorage(token = process.env.BLOB_READ_WRITE_TOKEN): SpaceAttachmentStorage {
    if (!token) {
        throw new ServiceError(503, 'STORAGE_UNAVAILABLE', 'El almacenamiento de archivos no está disponible.')
    }
    return {
        provider: 'vercel_blob',
        async put(input) {
            await put(input.storageKey, input.body, {
                access: 'private',
                token,
                contentType: input.mimeType,
                addRandomSuffix: false,
                allowOverwrite: true,
                maximumSizeInBytes: 10 * 1024 * 1024,
            })
        },
        async inspect(storageKey) {
            try {
                const result = await head(storageKey, { token })
                return { exists: true, size: result.size, contentType: result.contentType }
            } catch (error) {
                if (isNotFound(error)) return { exists: false }
                throw error
            }
        },
        async read(storageKey) {
            const result = await get(storageKey, { access: 'private', token, useCache: false })
            if (!result || result.statusCode !== 200) return null
            return {
                stream: result.stream,
                size: result.blob.size,
                contentType: result.blob.contentType,
            }
        },
        async delete(storageKey) {
            try {
                await del(storageKey, { token })
            } catch (error) {
                if (!isNotFound(error)) throw error
            }
        },
    }
}

const memoryObjects = new Map<string, { body: Buffer; contentType: string }>()

export function createMemorySpaceAttachmentStorage(): SpaceAttachmentStorage {
    return {
        provider: 'vercel_blob',
        async put(input) {
            memoryObjects.set(input.storageKey, { body: Buffer.from(input.body), contentType: input.mimeType })
        },
        async inspect(storageKey) {
            const stored = memoryObjects.get(storageKey)
            return stored
                ? { exists: true, size: stored.body.byteLength, contentType: stored.contentType }
                : { exists: false }
        },
        async read(storageKey) {
            const stored = memoryObjects.get(storageKey)
            if (!stored) return null
            return {
                stream: new Blob([Uint8Array.from(stored.body)]).stream(),
                size: stored.body.byteLength,
                contentType: stored.contentType,
            }
        },
        async delete(storageKey) {
            memoryObjects.delete(storageKey)
        },
    }
}

export function resolveSpaceAttachmentStorage(): SpaceAttachmentStorage {
    if (process.env.SPACE_ATTACHMENT_STORAGE_MODE === 'memory') {
        const databaseName = mongoose.connection.name
        if (process.env.NODE_ENV === 'production' || !/(e2e|test|ci)/i.test(databaseName)) {
            throw new ServiceError(503, 'STORAGE_UNAVAILABLE', 'El almacenamiento de archivos no está disponible.')
        }
        return createMemorySpaceAttachmentStorage()
    }
    return createVercelBlobSpaceAttachmentStorage()
}
