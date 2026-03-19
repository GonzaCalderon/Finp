import { z } from 'zod'

export const categorySchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    type: z.enum(['income', 'expense']),
    color: z.string().optional(),
})

export type CategoryFormData = z.infer<typeof categorySchema>