import { z } from 'zod'

const currencySchema = z.enum(['ARS', 'USD'])

const optionalTrimmedString = z.preprocess((value) => {
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
}, z.number().min(0.01, 'El monto debe ser mayor a 0'))

const installmentCountSchema = z.preprocess((value) => {
    if (typeof value === 'number') return value

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed === '') return undefined

        const parsed = Number(trimmed)
        return Number.isNaN(parsed) ? value : parsed
    }

    return value
}, z.number().int().min(1, 'Mínimo 1 cuota'))

const dateSchema = z.preprocess((value) => {
    if (value instanceof Date) return value

    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) return parsed
    }

    return value
}, z.date({ message: 'La fecha es inválida' }))

export const installmentSchema = z.object({
    description: z
        .string()
        .trim()
        .min(1, 'La descripción es requerida')
        .max(200, 'La descripción no puede superar los 200 caracteres'),
    totalAmount: amountSchema,
    currency: currencySchema,
    installmentCount: installmentCountSchema,
    accountId: z.string().trim().min(1, 'La tarjeta es requerida'),
    categoryId: optionalTrimmedString,
    purchaseDate: dateSchema,
    firstClosingMonth: z.string().trim().min(1, 'El mes de primera cuota es requerido'),
    merchant: optionalTrimmedString,
    notes: optionalTrimmedString,
})

export type InstallmentFormInput = z.input<typeof installmentSchema>
export type InstallmentFormData = z.output<typeof installmentSchema>
