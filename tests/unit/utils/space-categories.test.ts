import { describe, expect, it } from 'vitest'
import {
    getDefaultSpaceCategories,
    isAllowedMimeType,
    isWithinSizeLimit,
    sanitizeFileName,
} from '@/lib/utils/space-categories'
import type { SpaceType } from '@/lib/constants'

describe('getDefaultSpaceCategories', () => {
    it.each([
        ['travel', 5],
        ['couple', 5],
        ['project', 4],
    ] as const)('devuelve defaults para %s', (spaceType, expectedLength) => {
        const categories = getDefaultSpaceCategories(spaceType)

        expect(categories).toHaveLength(expectedLength)
        expect(categories.every((category) => category.type === 'expense')).toBe(true)
        expect(categories.every((category) => category.name.trim().length > 0)).toBe(true)
        expect(categories.every((category) => category.color.trim().length > 0)).toBe(true)
    })

    it('devuelve General para other', () => {
        const categories = getDefaultSpaceCategories('other')

        expect(categories.length).toBeGreaterThanOrEqual(1)
        expect(categories[0]).toMatchObject({
            name: 'General',
            color: '#6B7280',
            type: 'expense',
        })
    })

    it('usa fallback para tipos desconocidos', () => {
        const categories = getDefaultSpaceCategories('unknown' as SpaceType)

        expect(categories).toEqual([{ name: 'General', color: '#6B7280', type: 'expense' }])
    })
})

describe('sanitizeFileName', () => {
    it('elimina segmentos y caracteres peligrosos', () => {
        expect(sanitizeFileName('../facturas/..\\ticket<>:?.jpg')).toBe('ticket-.jpg')
    })

    it('preserva extensiones válidas comunes', () => {
        expect(sanitizeFileName('comprobante final.pdf')).toBe('comprobante final.pdf')
        expect(sanitizeFileName('foto.png')).toBe('foto.png')
    })

    it('devuelve un nombre no vacío para inputs raros', () => {
        expect(sanitizeFileName('../../')).toBe('archivo')
        expect(sanitizeFileName('\u0000')).toBe('archivo')
    })
})

describe('isAllowedMimeType', () => {
    it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])(
        'acepta %s',
        (mimeType) => {
            expect(isAllowedMimeType(mimeType)).toBe(true)
        }
    )

    it.each(['image/gif', 'application/exe', 'text/plain'])('rechaza %s', (mimeType) => {
        expect(isAllowedMimeType(mimeType)).toBe(false)
    })
})

describe('isWithinSizeLimit', () => {
    it('acepta tamaños entre 1 byte y 10 MB', () => {
        expect(isWithinSizeLimit(1)).toBe(true)
        expect(isWithinSizeLimit(10 * 1024 * 1024)).toBe(true)
    })

    it('rechaza archivos vacíos o mayores a 10 MB', () => {
        expect(isWithinSizeLimit(0)).toBe(false)
        expect(isWithinSizeLimit(10 * 1024 * 1024 + 1)).toBe(false)
    })
})
