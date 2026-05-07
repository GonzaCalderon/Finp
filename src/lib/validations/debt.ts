import { z } from 'zod'

const mongoIdSchema = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'ID inválido')

const amountSchema = z.preprocess((value) => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const normalized = value.replace(',', '.').trim()
        if (normalized === '') return undefined
        const parsed = Number(normalized)
        return Number.isNaN(parsed) ? value : parsed
    }
    return value
}, z.number().positive('El monto debe ser mayor a 0'))

const dateSchema = z.preprocess((value) => {
    if (value instanceof Date) return value
    if (typeof value === 'string') {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? value : parsed
    }
    return value
}, z.date())

export const createManualDebtSchema = z.object({
    direction: z.enum(['payable', 'receivable']),
    counterpartyName: z.string().trim().min(1, 'El nombre es requerido').max(100),
    amount: amountSchema,
    currency: z.string().trim().min(2, 'Moneda inválida').max(6).regex(/^[A-Z]{2,6}$/, 'Código de moneda inválido'),
    date: dateSchema,
    notes: z.string().trim().max(500).optional(),
})

export const payDebtSchema = z.object({
    amount: amountSchema,
    accountId: mongoIdSchema,
    date: dateSchema,
    notes: z.string().trim().max(500).optional(),
})

export const collectDebtSchema = z.object({
    amount: amountSchema,
    accountId: mongoIdSchema,
    date: dateSchema,
    notes: z.string().trim().max(500).optional(),
})

export const adjustDebtSchema = z
    .object({
        amount: z.preprocess((value) => {
            if (typeof value === 'number') return value
            if (typeof value === 'string') {
                const normalized = value.replace(',', '.').trim()
                if (normalized === '') return undefined
                const parsed = Number(normalized)
                return Number.isNaN(parsed) ? value : parsed
            }
            return value
        }, z.number().positive('El monto debe ser mayor a 0').optional()),
        notes: z.string().trim().max(500).optional(),
        status: z.literal('cancelled').optional(),
    })
    .refine((data) => data.amount !== undefined || data.notes !== undefined || data.status !== undefined, {
        message: 'Se debe proveer al menos un campo a actualizar',
    })

export type CreateManualDebtInput = z.infer<typeof createManualDebtSchema>
export type PayDebtInput = z.infer<typeof payDebtSchema>
export type CollectDebtInput = z.infer<typeof collectDebtSchema>
export type AdjustDebtInput = z.infer<typeof adjustDebtSchema>
