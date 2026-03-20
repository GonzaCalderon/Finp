import { z } from 'zod'

export const commitmentSchema = z.object({
    description: z.string().min(1, 'La descripción es requerida'),
    amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
    currency: z.enum(['ARS', 'USD']),
    recurrence: z.enum(['monthly', 'weekly', 'once']),
    dayOfMonth: z.number().min(1).max(31).optional(),
    applyMode: z.enum(['manual', 'auto_month_start']).optional(),
    categoryId: z.string().optional(),
    startDate: z.date(),
    endDate: z.date().optional(),
})

export type CommitmentFormData = z.infer<typeof commitmentSchema>