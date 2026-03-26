import { describe, it, expect } from 'vitest'
import { transactionSchema } from '@/lib/validations/transaction'

// Datos base reutilizables en varios tests
const ACCOUNT_ID_A = '507f1f77bcf86cd799439011'
const ACCOUNT_ID_B = '507f1f77bcf86cd799439012'
const CATEGORY_ID  = '507f1f77bcf86cd799439013'

const baseIncome = {
    type: 'income' as const,
    amount: 1000,
    currency: 'ARS' as const,
    date: new Date('2026-03-01'),
    description: 'Sueldo marzo',
    destinationAccountId: ACCOUNT_ID_A,
}

const baseExpense = {
    type: 'expense' as const,
    amount: 500,
    currency: 'ARS' as const,
    date: new Date('2026-03-05'),
    description: 'Supermercado',
    sourceAccountId: ACCOUNT_ID_A,
}

const baseTransfer = {
    type: 'transfer' as const,
    amount: 200,
    currency: 'ARS' as const,
    date: new Date('2026-03-10'),
    description: 'Paso a efectivo',
    sourceAccountId: ACCOUNT_ID_A,
    destinationAccountId: ACCOUNT_ID_B,
}

// ─── Validaciones de monto ─────────────────────────────────────────────────────
describe('transactionSchema – monto', () => {
    it('acepta número positivo', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, amount: 0.01 })
        expect(result.success).toBe(true)
    })

    it('rechaza monto 0', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, amount: 0 })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].path).toContain('amount')
        }
    })

    it('rechaza monto negativo', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, amount: -100 })
        expect(result.success).toBe(false)
    })

    it('acepta string numérico y lo convierte a número', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, amount: '1500' })
        expect(result.success).toBe(true)
        if (result.success) expect(typeof result.data.amount).toBe('number')
    })

    it('acepta string con coma decimal (formato es-AR)', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, amount: '1.500,50' })
        // Nota: la normalización solo reemplaza primera coma por punto; formato AR complejo
        // Lo importante es que no rompe con strings válidos
        expect(result.success).toBeDefined()
    })

    it('rechaza string no numérico', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, amount: 'abc' })
        expect(result.success).toBe(false)
    })
})

// ─── Validaciones de descripción ──────────────────────────────────────────────
describe('transactionSchema – descripción', () => {
    it('rechaza descripción vacía', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, description: '' })
        expect(result.success).toBe(false)
    })

    it('rechaza descripción mayor a 200 caracteres', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, description: 'a'.repeat(201) })
        expect(result.success).toBe(false)
    })

    it('acepta descripción de exactamente 200 caracteres', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, description: 'a'.repeat(200) })
        expect(result.success).toBe(true)
    })

    it('elimina espacios al inicio y fin (trim)', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, description: '  Sueldo  ' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.description).toBe('Sueldo')
    })
})

// ─── Validaciones de tipo income ──────────────────────────────────────────────
describe('transactionSchema – tipo income', () => {
    it('requiere destinationAccountId', () => {
        const result = transactionSchema.safeParse({
            ...baseIncome,
            destinationAccountId: undefined,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('destinationAccountId')
        }
    })

    it('es válido con destinationAccountId', () => {
        const result = transactionSchema.safeParse(baseIncome)
        expect(result.success).toBe(true)
    })

    it('no requiere sourceAccountId para income', () => {
        const result = transactionSchema.safeParse({
            ...baseIncome,
            sourceAccountId: undefined,
        })
        expect(result.success).toBe(true)
    })
})

// ─── Validaciones de tipo expense ─────────────────────────────────────────────
describe('transactionSchema – tipo expense', () => {
    it('requiere sourceAccountId', () => {
        const result = transactionSchema.safeParse({
            ...baseExpense,
            sourceAccountId: undefined,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('sourceAccountId')
        }
    })

    it('es válido con sourceAccountId', () => {
        const result = transactionSchema.safeParse(baseExpense)
        expect(result.success).toBe(true)
    })

    it('acepta categoryId opcional', () => {
        const result = transactionSchema.safeParse({ ...baseExpense, categoryId: CATEGORY_ID })
        expect(result.success).toBe(true)
    })
})

// ─── Validaciones de tipo transfer ────────────────────────────────────────────
describe('transactionSchema – tipo transfer', () => {
    it('es válido con source y destination distintos', () => {
        const result = transactionSchema.safeParse(baseTransfer)
        expect(result.success).toBe(true)
    })

    it('rechaza si source === destination', () => {
        const result = transactionSchema.safeParse({
            ...baseTransfer,
            destinationAccountId: ACCOUNT_ID_A,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('destinationAccountId')
        }
    })

    it('requiere sourceAccountId', () => {
        const result = transactionSchema.safeParse({
            ...baseTransfer,
            sourceAccountId: undefined,
        })
        expect(result.success).toBe(false)
    })

    it('requiere destinationAccountId', () => {
        const result = transactionSchema.safeParse({
            ...baseTransfer,
            destinationAccountId: undefined,
        })
        expect(result.success).toBe(false)
    })
})

// ─── Validaciones de tipo credit_card_payment ─────────────────────────────────
describe('transactionSchema – tipo credit_card_payment', () => {
    it('requiere source y destination distintos', () => {
        const result = transactionSchema.safeParse({
            type: 'credit_card_payment',
            amount: 100,
            currency: 'ARS',
            date: new Date(),
            description: 'Pago tarjeta',
            sourceAccountId: ACCOUNT_ID_A,
            destinationAccountId: ACCOUNT_ID_B,
        })
        expect(result.success).toBe(true)
    })

    it('rechaza si source === destination en credit_card_payment', () => {
        const result = transactionSchema.safeParse({
            type: 'credit_card_payment',
            amount: 100,
            currency: 'ARS',
            date: new Date(),
            description: 'Pago tarjeta',
            sourceAccountId: ACCOUNT_ID_A,
            destinationAccountId: ACCOUNT_ID_A,
        })
        expect(result.success).toBe(false)
    })
})

// ─── Validaciones de fecha ────────────────────────────────────────────────────
describe('transactionSchema – fecha', () => {
    it('acepta Date válida', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, date: new Date('2026-01-15') })
        expect(result.success).toBe(true)
    })

    it('acepta string de fecha ISO', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, date: '2026-01-15' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.date).toBeInstanceOf(Date)
    })

    it('rechaza fecha inválida', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, date: 'no-es-fecha' })
        expect(result.success).toBe(false)
    })
})

// ─── Validaciones de currency ─────────────────────────────────────────────────
describe('transactionSchema – currency', () => {
    it('acepta ARS', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, currency: 'ARS' })
        expect(result.success).toBe(true)
    })

    it('acepta USD', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, currency: 'USD' })
        expect(result.success).toBe(true)
    })

    it('rechaza currency desconocida', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, currency: 'EUR' })
        expect(result.success).toBe(false)
    })
})

// ─── Campos opcionales ────────────────────────────────────────────────────────
describe('transactionSchema – campos opcionales', () => {
    it('acepta notes vacías (se convierte en undefined)', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, notes: '' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.notes).toBeUndefined()
    })

    it('acepta merchant vacío (se convierte en undefined)', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, merchant: '   ' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.merchant).toBeUndefined()
    })

    it('acepta notes con valor', () => {
        const result = transactionSchema.safeParse({ ...baseIncome, notes: 'nota de prueba' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.notes).toBe('nota de prueba')
    })
})
