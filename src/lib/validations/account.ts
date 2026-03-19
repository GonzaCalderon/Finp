import { z } from 'zod'

export const accountSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    type: z.enum(['bank', 'cash', 'wallet', 'credit_card', 'debt', 'savings']),
    currency: z.enum(['ARS', 'USD']),
    institution: z.string().optional(),
    initialBalance: z.number().optional(),
    color: z.string().optional(),
    creditCardConfig: z.object({
        closingDay: z.number().min(1).max(31),
        dueDay: z.number().min(1).max(31),
        creditLimit: z.number().optional(),
    }).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'credit_card') {
        if (!data.creditCardConfig?.closingDay) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'El día de cierre es requerido',
                path: ['creditCardConfig', 'closingDay'],
            })
        }
        if (!data.creditCardConfig?.dueDay) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'El día de vencimiento es requerido',
                path: ['creditCardConfig', 'dueDay'],
            })
        }
    }
})

export type AccountFormData = z.infer<typeof accountSchema>