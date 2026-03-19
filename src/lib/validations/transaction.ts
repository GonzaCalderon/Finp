import { z } from 'zod'

export const transactionSchema = z.object({
    type: z.enum(['income', 'expense', 'transfer', 'credit_card_payment', 'debt_payment', 'adjustment']),
    amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
    currency: z.enum(['ARS', 'USD']),
    date: z.date(),
    description: z.string().min(1, 'La descripción es requerida'),
    categoryId: z.string().optional(),
    sourceAccountId: z.string().optional(),
    destinationAccountId: z.string().optional(),
    notes: z.string().optional(),
    merchant: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'income' && !data.destinationAccountId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La cuenta destino es requerida',
            path: ['destinationAccountId'],
        })
    }
    if (['expense', 'transfer', 'credit_card_payment', 'debt_payment'].includes(data.type) && !data.sourceAccountId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La cuenta origen es requerida',
            path: ['sourceAccountId'],
        })
    }
    if (['transfer', 'credit_card_payment', 'debt_payment'].includes(data.type) && !data.destinationAccountId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La cuenta destino es requerida',
            path: ['destinationAccountId'],
        })
    }
})

export type TransactionFormData = z.infer<typeof transactionSchema>