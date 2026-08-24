import { describe, expect, it } from 'vitest'

import {
    parseSpaceV2IndexCliArguments,
    SPACE_V2_INDEXES,
} from '@/lib/server/space-v2-indexes'

describe('space v2 indexes', () => {
    it('dry-run de E2E es el default y apply sólo se admite ahí', () => {
        expect(parseSpaceV2IndexCliArguments([])).toEqual({ env: 'test', apply: false, help: false })
        expect(parseSpaceV2IndexCliArguments(['--env', 'test', '--apply'])).toMatchObject({
            env: 'test', apply: true,
        })
    })

    it('development exige confirmación exacta y rechaza apply', () => {
        expect(() => parseSpaceV2IndexCliArguments(['--env', 'development'])).toThrow('confirm-database')
        expect(() => parseSpaceV2IndexCliArguments([
            '--env', 'development', '--confirm-database', 'finm', '--apply',
        ])).toThrow('sólo pueden aplicarse')
    })

    it('todos los índices únicos nuevos están acotados a v2 o a operationId', () => {
        const unique = SPACE_V2_INDEXES.filter((definition) => definition.options.unique)
        expect(unique.length).toBeGreaterThanOrEqual(5)
        expect(unique.every((definition) => definition.options.partialFilterExpression)).toBe(true)
        expect(SPACE_V2_INDEXES.some((definition) =>
            definition.options.name === 'v2_unique_personal_impact_per_user_entry'
        )).toBe(true)
    })
})
