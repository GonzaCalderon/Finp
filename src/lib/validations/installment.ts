import { z } from 'zod'

export const installmentSchema = z.object({
    description: z.string().min(1, 'La descripción es requerida'),
    totalAmount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
    currency: z.enum(['ARS', 'USD']),
    installmentCount: z.number().min(2, 'Mínimo 2 cuotas'),
    accountId: z.string().min(1, 'La tarjeta es requerida'),
    categoryId: z.string().optional(),
    purchaseDate: z.date(),
    firstClosingMonth: z.string().min(1, 'El mes de primera cuota es requerido'),
    merchant: z.string().optional(),
    notes: z.string().optional(),
})

export type InstallmentFormData = z.infer<typeof installmentSchema>