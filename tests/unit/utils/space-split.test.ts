import { describe, expect, it } from 'vitest'
import { applySmartFixed, applySmartPercentage, round2 } from '@/lib/utils/space-split'

// ── round2 ────────────────────────────────────────────────────────────────────

describe('round2', () => {
    it('rounds to 2 decimal places', () => {
        expect(round2(33.333333)).toBe(33.33)
        expect(round2(66.666666)).toBe(66.67)
        expect(round2(100)).toBe(100)
        expect(round2(0.005)).toBe(0.01)
    })
})

// ── applySmartPercentage ──────────────────────────────────────────────────────

describe('applySmartPercentage', () => {
    it('devuelve null para lista vacía', () => {
        expect(applySmartPercentage([], [], 'id-a', 50)).toBeNull()
    })

    it('devuelve null si el id editado no está en la lista', () => {
        const ids = ['id-a', 'id-b']
        const alloc = [
            { participantId: 'id-a', percentage: 50 },
            { participantId: 'id-b', percentage: 50 },
        ]
        expect(applySmartPercentage(ids, alloc, 'id-x', 30)).toBeNull()
    })

    it('con 1 participante siempre devuelve 100%', () => {
        const result = applySmartPercentage(['id-a'], [], 'id-a', 42)
        expect(result).toEqual([{ participantId: 'id-a', percentage: 100 }])
    })

    describe('2 participantes', () => {
        const ids = ['id-a', 'id-b']
        const base = [
            { participantId: 'id-a', percentage: 50 },
            { participantId: 'id-b', percentage: 50 },
        ]

        it('editar el primero recalcula el segundo como residual', () => {
            const result = applySmartPercentage(ids, base, 'id-a', 70)
            expect(result).toEqual([
                { participantId: 'id-a', percentage: 70 },
                { participantId: 'id-b', percentage: 30 },
            ])
        })

        it('editar el segundo recalcula el primero como residual', () => {
            const result = applySmartPercentage(ids, base, 'id-b', 40)
            expect(result).toEqual([
                { participantId: 'id-a', percentage: 60 },
                { participantId: 'id-b', percentage: 40 },
            ])
        })

        it('clampea a 0 si el valor es negativo', () => {
            const result = applySmartPercentage(ids, base, 'id-a', -10)
            expect(result).toEqual([
                { participantId: 'id-a', percentage: 0 },
                { participantId: 'id-b', percentage: 100 },
            ])
        })

        it('clampea a 100 si el valor supera el total', () => {
            const result = applySmartPercentage(ids, base, 'id-a', 110)
            expect(result).toEqual([
                { participantId: 'id-a', percentage: 100 },
                { participantId: 'id-b', percentage: 0 },
            ])
        })
    })

    describe('3+ participantes', () => {
        const ids = ['id-a', 'id-b', 'id-c']
        const base = [
            { participantId: 'id-a', percentage: 33.33 },
            { participantId: 'id-b', percentage: 33.33 },
            { participantId: 'id-c', percentage: 33.34 },
        ]

        it('el último slot es residual: devuelve null al intentar editarlo', () => {
            expect(applySmartPercentage(ids, base, 'id-c', 50)).toBeNull()
        })

        it('editar el primero recalcula los inferiores, el último absorbe el resto', () => {
            const result = applySmartPercentage(ids, base, 'id-a', 50)
            expect(result).not.toBeNull()
            expect(result![0]).toEqual({ participantId: 'id-a', percentage: 50 })
            // id-b should get (100-50)/2 = 25, id-c gets the rest = 25
            expect(result![1]?.percentage).toBe(25)
            expect(result![2]?.percentage).toBe(25)
            // total must be 100
            const total = result!.reduce((sum, a) => sum + a.percentage, 0)
            expect(round2(total)).toBe(100)
        })

        it('editar el segundo deja el primero intacto y el último absorbe el resto', () => {
            const alloc = [
                { participantId: 'id-a', percentage: 40 },
                { participantId: 'id-b', percentage: 30 },
                { participantId: 'id-c', percentage: 30 },
            ]
            const result = applySmartPercentage(ids, alloc, 'id-b', 20)
            expect(result).not.toBeNull()
            expect(result![0]?.percentage).toBe(40) // unchanged
            expect(result![1]?.percentage).toBe(20) // edited
            expect(result![2]?.percentage).toBe(40) // residual: 100 - 40 - 20 = 40
            const total = result!.reduce((sum, a) => sum + a.percentage, 0)
            expect(round2(total)).toBe(100)
        })

        it('no permite residual negativo — clampea el valor editado', () => {
            const alloc = [
                { participantId: 'id-a', percentage: 60 },
                { participantId: 'id-b', percentage: 20 },
                { participantId: 'id-c', percentage: 20 },
            ]
            // id-a ya es 60; si id-b edita a 50 → restante para id-b sería 100-60-50 = -10
            // debe clampear id-b a máximo permitido = 40
            const result = applySmartPercentage(ids, alloc, 'id-b', 50)
            expect(result).not.toBeNull()
            expect(result![1]?.percentage).toBe(40) // clamped to max (100 - 60 = 40)
            expect(result![2]?.percentage).toBe(0)  // 100 - 60 - 40 = 0
            const total = result!.reduce((sum, a) => sum + a.percentage, 0)
            expect(round2(total)).toBe(100)
        })
    })
})

// ── applySmartFixed ───────────────────────────────────────────────────────────

describe('applySmartFixed', () => {
    it('devuelve null para lista vacía', () => {
        expect(applySmartFixed([], [], 'id-a', 500, 1000)).toBeNull()
    })

    it('devuelve null si el id editado no está en la lista', () => {
        expect(applySmartFixed(['id-a'], [], 'id-x', 500, 1000)).toBeNull()
    })

    it('con 1 participante asigna el total completo', () => {
        const result = applySmartFixed(['id-a'], [], 'id-a', 0, 1200)
        expect(result).toEqual([{ participantId: 'id-a', amount: 1200 }])
    })

    describe('2 participantes', () => {
        const ids = ['id-a', 'id-b']
        const base = [
            { participantId: 'id-a', amount: 500 },
            { participantId: 'id-b', amount: 500 },
        ]
        const total = 1000

        it('editar el primero recalcula el segundo como residual', () => {
            const result = applySmartFixed(ids, base, 'id-a', 700, total)
            expect(result).toEqual([
                { participantId: 'id-a', amount: 700 },
                { participantId: 'id-b', amount: 300 },
            ])
        })

        it('editar el segundo recalcula el primero como residual', () => {
            const result = applySmartFixed(ids, base, 'id-b', 400, total)
            expect(result).toEqual([
                { participantId: 'id-a', amount: 600 },
                { participantId: 'id-b', amount: 400 },
            ])
        })

        it('clampea a 0 si el valor es negativo', () => {
            const result = applySmartFixed(ids, base, 'id-a', -100, total)
            expect(result).toEqual([
                { participantId: 'id-a', amount: 0 },
                { participantId: 'id-b', amount: 1000 },
            ])
        })

        it('clampea al total si supera el máximo', () => {
            const result = applySmartFixed(ids, base, 'id-a', 1500, total)
            expect(result).toEqual([
                { participantId: 'id-a', amount: 1000 },
                { participantId: 'id-b', amount: 0 },
            ])
        })
    })

    describe('3+ participantes', () => {
        const ids = ['id-a', 'id-b', 'id-c']
        const total = 900
        const base = [
            { participantId: 'id-a', amount: 300 },
            { participantId: 'id-b', amount: 300 },
            { participantId: 'id-c', amount: 300 },
        ]

        it('el último slot es residual: devuelve null al intentar editarlo', () => {
            expect(applySmartFixed(ids, base, 'id-c', 400, total)).toBeNull()
        })

        it('editar el primero recalcula los inferiores, el último absorbe el resto', () => {
            const result = applySmartFixed(ids, base, 'id-a', 500, total)
            expect(result).not.toBeNull()
            expect(result![0]).toEqual({ participantId: 'id-a', amount: 500 })
            // remaining = 900 - 500 = 400; 2 lower slots → id-b gets 200, id-c gets remainder (200)
            expect(result![1]?.amount).toBe(200)
            expect(result![2]?.amount).toBe(200)
            const total_sum = result!.reduce((sum, a) => sum + a.amount, 0)
            expect(round2(total_sum)).toBe(total)
        })

        it('editar el segundo deja el primero intacto y el último absorbe el resto', () => {
            const alloc = [
                { participantId: 'id-a', amount: 400 },
                { participantId: 'id-b', amount: 300 },
                { participantId: 'id-c', amount: 200 },
            ]
            const result = applySmartFixed(ids, alloc, 'id-b', 200, total)
            expect(result).not.toBeNull()
            expect(result![0]?.amount).toBe(400) // unchanged
            expect(result![1]?.amount).toBe(200) // edited
            expect(result![2]?.amount).toBe(300) // residual: 900 - 400 - 200 = 300
            const total_sum = result!.reduce((sum, a) => sum + a.amount, 0)
            expect(round2(total_sum)).toBe(total)
        })

        it('no permite residual negativo — clampea el valor editado', () => {
            const alloc = [
                { participantId: 'id-a', amount: 600 },
                { participantId: 'id-b', amount: 150 },
                { participantId: 'id-c', amount: 150 },
            ]
            // id-a=600; if id-b edits to 400 → residual = 900-600-400 = -100 → clamp id-b to 300
            const result = applySmartFixed(ids, alloc, 'id-b', 400, total)
            expect(result).not.toBeNull()
            expect(result![1]?.amount).toBe(300) // clamped: 900 - 600 = 300 max
            expect(result![2]?.amount).toBe(0)   // residual = 0
            const total_sum = result!.reduce((sum, a) => sum + a.amount, 0)
            expect(round2(total_sum)).toBe(total)
        })
    })
})
