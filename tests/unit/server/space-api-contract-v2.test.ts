import { describe, expect, it } from 'vitest'

import {
    requireExpectedRevision,
    requireIdempotencyKey,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'

describe('contrato público de mutaciones de Espacios v2', () => {
    it('exige idempotencia y revisión esperada', () => {
        expect(() => requireIdempotencyKey(new Request('http://finp.test')))
            .toThrow('Idempotency-Key')
        expect(requireIdempotencyKey(new Request('http://finp.test', {
            headers: { 'Idempotency-Key': 'intento-estable' },
        }))).toBe('intento-estable')
        expect(() => requireExpectedRevision(-1)).toThrow('entero no negativo')
        expect(requireExpectedRevision(0)).toBe(0)
    })

    it('expone estado de commit y presentación pendiente', () => {
        expect(toSpaceMutationResult({
            operationId: 'op-1',
            replayed: false,
            value: { entryId: 'entry-1' },
            presentation: { state: 'retry_required' },
        })).toEqual({
            data: { entryId: 'entry-1' },
            operation: {
                id: 'op-1',
                replayed: false,
                writeState: 'committed',
                presentation: { state: 'retry_required', retryable: true },
            },
        })
    })

    it('reconstruye referencias públicas en un replay idempotente', () => {
        const result = toSpaceMutationResult<{ spaceEntryId: string }>({
            operationId: 'op-2',
            replayed: true,
            resultRefs: { spaceEntryId: 123 },
        })
        expect(result.data).toEqual({ spaceEntryId: '123' })
        expect(result.operation.replayed).toBe(true)
    })
})
