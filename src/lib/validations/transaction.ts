import { z } from 'zod'

const transactionTypeSchema = z.enum([
    'income',
    'expense',
    'credit_card_expense',
    'transfer',
    'credit_card_payment',
    'debt_payment',
    'adjustment',
])

const currencySchema = z.enum(['ARS', 'USD'])

const optionalTrimmedString = z.preprocess((value) => {
    if (typeof value !== 'string') return value

    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}, z.string().optional())

const optionalObjectIdString = z.preprocess((value) => {
    if (typeof value !== 'string') return value

    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}, z.string().optional())

const amountSchema = z.preprocess((value) => {
    if (typeof value === 'number') return value

    if (typeof value === 'string') {
        const normalized = value.replace(',', '.').trim()
        if (normalized === '') return undefined

        const parsed = Number(normalized)
        return Number.isNaN(parsed) ? value : parsed
    }

    return value
}, z.number().refine(n => n !== 0, 'El monto debe ser distinto de cero'))

const dateSchema = z.preprocess((value) => {
    if (value instanceof Date) return value

    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) return parsed
    }

    return value
}, z.date({ message: 'La fecha es inválida' }))

export const transactionSchema = z
    .object({
        type: transactionTypeSchema,
        amount: amountSchema,
        currency: currencySchema,
        date: dateSchema,
        description: z
            .string()
            .trim()
            .min(1, 'La descripción es requerida')
            .max(200, 'La descripción no puede superar los 200 caracteres'),
        categoryId: optionalObjectIdString,
        sourceAccountId: optionalObjectIdString,
        destinationAccountId: optionalObjectIdString,
        notes: optionalTrimmedString,
        merchant: optionalTrimmedString,
    })
    .superRefine((data, ctx) => {
        if (data.type !== 'adjustment' && data.amount < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'El monto debe ser mayor a 0',
                path: ['amount'],
            })
        }

        if (data.type === 'income' && !data.destinationAccountId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La cuenta destino es requerida',
                path: ['destinationAccountId'],
            })
        }

        if (
            ['expense', 'credit_card_expense', 'transfer', 'credit_card_payment', 'debt_payment', 'adjustment'].includes(
                data.type
            ) &&
            !data.sourceAccountId
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La cuenta origen es requerida',
                path: ['sourceAccountId'],
            })
        }

        if (
            ['transfer', 'credit_card_payment', 'debt_payment'].includes(data.type) &&
            !data.destinationAccountId
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La cuenta destino es requerida',
                path: ['destinationAccountId'],
            })
        }

        if (
            ['transfer', 'credit_card_payment', 'debt_payment'].includes(data.type) &&
            data.sourceAccountId &&
            data.destinationAccountId &&
            data.sourceAccountId === data.destinationAccountId
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La cuenta origen y destino no pueden ser la misma',
                path: ['destinationAccountId'],
            })
        }
    })

export type TransactionFormInput = z.input<typeof transactionSchema>
export type TransactionFormData = z.output<typeof transactionSchema>