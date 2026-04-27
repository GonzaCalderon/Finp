import type { SpaceType } from '@/lib/constants'

export type SpaceCategoryType = 'expense' | 'income' | 'adjustment'

export type DefaultSpaceCategory = {
    name: string
    color: string
    type: SpaceCategoryType
}

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
] as const

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

export function getDefaultSpaceCategories(spaceType: SpaceType): DefaultSpaceCategory[] {
    switch (spaceType) {
        case 'travel':
            return [
                { name: 'Transporte', color: '#3B82F6', type: 'expense' },
                { name: 'Alojamiento', color: '#8B5CF6', type: 'expense' },
                { name: 'Comida', color: '#F59E0B', type: 'expense' },
                { name: 'Actividades', color: '#10B981', type: 'expense' },
                { name: 'Varios', color: '#6B7280', type: 'expense' },
            ]
        case 'couple':
        case 'home':
            return [
                { name: 'Comida', color: '#F59E0B', type: 'expense' },
                { name: 'Servicios', color: '#3B82F6', type: 'expense' },
                { name: 'Alquiler', color: '#8B5CF6', type: 'expense' },
                { name: 'Salidas', color: '#EC4899', type: 'expense' },
                { name: 'Varios', color: '#6B7280', type: 'expense' },
            ]
        case 'project':
        case 'event':
            return [
                { name: 'Materiales', color: '#3B82F6', type: 'expense' },
                { name: 'Servicios', color: '#8B5CF6', type: 'expense' },
                { name: 'Comunicación', color: '#10B981', type: 'expense' },
                { name: 'Varios', color: '#6B7280', type: 'expense' },
            ]
        default:
            return [{ name: 'General', color: '#6B7280', type: 'expense' }]
    }
}

export function normalizeSpaceCategoryName(name: string) {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

export function sanitizeFileName(fileName: string) {
    const rawName = fileName.split(/[\\/]/).pop() ?? ''
    const withoutControlChars = rawName.replace(/[\u0000-\u001f\u007f]/g, '')
    const sanitized = withoutControlChars
        .replace(/\.\.+/g, '.')
        .replace(/[^a-zA-Z0-9._ -]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/-+/g, '-')
        .trim()
        .replace(/^[.\s-]+|[.\s-]+$/g, '')

    return sanitized || 'archivo'
}

export function isAllowedMimeType(mimeType: string) {
    return ALLOWED_ATTACHMENT_MIME_TYPES.includes(
        mimeType as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]
    )
}

export function isWithinSizeLimit(size: number) {
    return Number.isFinite(size) && size > 0 && size <= MAX_ATTACHMENT_SIZE
}
