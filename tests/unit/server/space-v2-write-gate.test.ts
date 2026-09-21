import { beforeEach, describe, expect, it, vi } from 'vitest'

const connection = vi.hoisted(() => ({
    readyState: 1,
    name: 'finm',
}))

vi.mock('mongoose', () => ({
    default: { connection },
}))

import {
    assertSpaceV2WriteEnabled,
    isSpaceV2WriteEnabled,
} from '@/lib/server/space-v2-write-gate'

describe('space v2 write gate', () => {
    beforeEach(() => {
        connection.readyState = 1
        connection.name = 'finm'
    })

    it.each(['finm', 'finp-e2e'])('habilita la base autorizada %s', (databaseName) => {
        connection.name = databaseName

        expect(isSpaceV2WriteEnabled()).toBe(true)
        expect(() => assertSpaceV2WriteEnabled()).not.toThrow()
    })

    it.each(['finp', 'production', 'finm-production', 'finp-test'])(
        'mantiene cerrado el destino no autorizado %s',
        (databaseName) => {
            connection.name = databaseName

            expect(isSpaceV2WriteEnabled()).toBe(false)
            expect(() => assertSpaceV2WriteEnabled()).toThrowError(
                expect.objectContaining({
                    status: 503,
                    code: 'SPACE_V2_WRITE_DISABLED',
                })
            )
        }
    )

    it('rechaza aunque el nombre sea correcto si la conexión no está lista', () => {
        connection.readyState = 0

        expect(isSpaceV2WriteEnabled()).toBe(false)
    })
})
