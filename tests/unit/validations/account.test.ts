import { describe, it, expect } from 'vitest'
import { accountSchema } from '@/lib/validations/account'

const baseBank = {
    name: 'Galicia',
    type: 'bank' as const,
    currency: 'ARS' as const,
}

const baseCreditCard = {
    name: 'Visa Galicia',
    type: 'credit_card' as const,
    currency: 'ARS' as const,
}

// ─── Campos básicos ───────────────────────────────────────────────────────────
describe('accountSchema – campos básicos', () => {
    it('es válido con los campos mínimos requeridos', () => {
        const result = accountSchema.safeParse(baseBank)
        expect(result.success).toBe(true)
    })

    it('rechaza nombre vacío', () => {
        const result = accountSchema.safeParse({ ...baseBank, name: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('name')
        }
    })

    it('acepta todos los tipos de cuenta válidos', () => {
        const types = ['bank', 'cash', 'wallet', 'credit_card', 'debt', 'savings'] as const
        for (const type of types) {
            const data = type === 'credit_card'
                ? { ...baseCreditCard, creditCardConfig: { closingDay: 25, dueDay: 10 } }
                : { ...baseBank, type }
            const result = accountSchema.safeParse(data)
            expect(result.success, `Tipo "${type}" debería ser válido`).toBe(true)
        }
    })

    it('rechaza tipo de cuenta desconocido', () => {
        const result = accountSchema.safeParse({ ...baseBank, type: 'crypto' })
        expect(result.success).toBe(false)
    })

    it('acepta ARS y USD como currency', () => {
        for (const currency of ['ARS', 'USD'] as const) {
            const result = accountSchema.safeParse({ ...baseBank, currency })
            expect(result.success).toBe(true)
        }
    })

    it('rechaza currency no soportada', () => {
        const result = accountSchema.safeParse({ ...baseBank, currency: 'EUR' })
        expect(result.success).toBe(false)
    })
})

// ─── Tarjeta de crédito ───────────────────────────────────────────────────────
describe('accountSchema – credit_card', () => {
    it('es válido con creditCardConfig completa', () => {
        const result = accountSchema.safeParse({
            ...baseCreditCard,
            creditCardConfig: { closingDay: 25, dueDay: 10 },
        })
        expect(result.success).toBe(true)
    })

    it('rechaza credit_card sin closingDay', () => {
        const result = accountSchema.safeParse({
            ...baseCreditCard,
            creditCardConfig: { closingDay: 0, dueDay: 10 },
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths.some((p) => p.includes('closingDay'))).toBe(true)
        }
    })

    it('rechaza credit_card sin dueDay', () => {
        const result = accountSchema.safeParse({
            ...baseCreditCard,
            creditCardConfig: { closingDay: 25, dueDay: 0 },
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths.some((p) => p.includes('dueDay'))).toBe(true)
        }
    })

    it('rechaza credit_card sin creditCardConfig', () => {
        const result = accountSchema.safeParse(baseCreditCard)
        expect(result.success).toBe(false)
    })

    it('acepta creditLimit opcional', () => {
        const result = accountSchema.safeParse({
            ...baseCreditCard,
            creditCardConfig: { closingDay: 25, dueDay: 10, creditLimit: 500000 },
        })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.creditCardConfig?.creditLimit).toBe(500000)
    })
})

// ─── Campos opcionales ────────────────────────────────────────────────────────
describe('accountSchema – campos opcionales', () => {
    it('acepta institution opcional', () => {
        const result = accountSchema.safeParse({ ...baseBank, institution: 'Banco Galicia' })
        expect(result.success).toBe(true)
    })

    it('acepta color opcional', () => {
        const result = accountSchema.safeParse({ ...baseBank, color: '#3b82f6' })
        expect(result.success).toBe(true)
    })

    it('acepta initialBalance opcional', () => {
        const result = accountSchema.safeParse({ ...baseBank, initialBalance: 150000 })
        expect(result.success).toBe(true)
    })

    it('allowNegativeBalance es true por defecto', () => {
        const result = accountSchema.safeParse(baseBank)
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.allowNegativeBalance).toBe(true)
    })

    it('acepta allowNegativeBalance: false explícito', () => {
        const result = accountSchema.safeParse({ ...baseBank, allowNegativeBalance: false })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.allowNegativeBalance).toBe(false)
    })
})
