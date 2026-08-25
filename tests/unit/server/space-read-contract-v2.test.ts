import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'

import {
    normalizeSpaceMovementLimit,
    parseSpaceMovementCursor,
} from '@/lib/server/space-read-service-v2'

describe('paginación pública de movimientos de Espacios', () => {
    it('usa 50 por defecto y limita a 100', () => {
        expect(normalizeSpaceMovementLimit()).toBe(50)
        expect(normalizeSpaceMovementLimit('75')).toBe(75)
        expect(normalizeSpaceMovementLimit(1000)).toBe(100)
        expect(() => normalizeSpaceMovementLimit('0')).toThrow('límite')
    })

    it('decodifica un cursor dateKey + _id y rechaza datos ambiguos', () => {
        const id = new Types.ObjectId().toString()
        const cursor = Buffer.from(JSON.stringify({ dateKey: '2026-08-24', id })).toString('base64url')
        expect(parseSpaceMovementCursor(cursor)).toEqual({ dateKey: '2026-08-24', id })
        expect(() => parseSpaceMovementCursor(Buffer.from('{}').toString('base64url'))).toThrow('cursor')
    })
})
