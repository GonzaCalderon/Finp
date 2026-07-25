import { z } from 'zod'

const amountPolicy = z.enum(['fixed', 'variable'])
const estimationMode = z.enum(['template', 'last', 'average'])

/**
 * Formulario de Compromisos (cliente). Las fechas ya son `Date` porque las
 * produce el date picker.
 */
export const commitmentSchema = z
    .object({
        description: z.string().min(1, 'La descripción es requerida'),
        amount: z.number().min(0, 'El monto no puede ser negativo'),
        currency: z.enum(['ARS', 'USD']),
        recurrence: z.enum(['monthly', 'weekly', 'once']),
        dayOfMonth: z.number().min(1).max(31).optional(),
        applyMode: z.enum(['manual', 'auto_month_start']).optional(),
        categoryId: z.string().optional(),
        accountId: z.string().optional(),
        amountPolicy: amountPolicy.optional(),
        estimationMode: estimationMode.optional(),
        startDate: z.date(),
        endDate: z.date().optional(),
    })
    .refine((data) => data.amountPolicy === 'variable' || data.amount > 0, {
        // Un compromiso variable puede empezar sin importe: se confirma al aplicarlo.
        message: 'El monto debe ser mayor a 0',
        path: ['amount'],
    })
    .refine((data) => !data.endDate || !data.startDate || data.endDate >= data.startDate, {
        message: 'La fecha de fin no puede ser anterior al inicio',
        path: ['endDate'],
    })

export type CommitmentFormData = z.infer<typeof commitmentSchema>

/**
 * Mismo contrato del lado del servidor, donde las fechas llegan como string JSON.
 * Antes las rutas no validaban nada: un `dayOfMonth: 99` o un monto negativo
 * llegaban al modelo y el error de cast salía como 500 en vez de 400.
 */
export const commitmentApiSchema = z
    .object({
        description: z.string().trim().min(1, 'La descripción es requerida').max(200),
        amount: z.number().min(0, 'El monto no puede ser negativo'),
        currency: z.enum(['ARS', 'USD']),
        recurrence: z.enum(['monthly', 'weekly', 'once']),
        dayOfMonth: z.number().int().min(1).max(31).optional(),
        applyMode: z.enum(['manual', 'auto_month_start']).optional(),
        categoryId: z.string().trim().min(1).optional(),
        accountId: z.string().trim().min(1).optional(),
        amountPolicy: amountPolicy.optional(),
        estimationMode: estimationMode.optional(),
        aliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
        createdFrom: z.enum(['web', 'quick_capture']).optional(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().nullish(),
    })
    .refine((data) => data.amountPolicy === 'variable' || data.amount > 0, {
        message: 'El monto debe ser mayor a 0',
        path: ['amount'],
    })
    .refine((data) => !data.endDate || data.endDate >= data.startDate, {
        message: 'La fecha de fin no puede ser anterior al inicio',
        path: ['endDate'],
    })

/** PATCH parcial: todo opcional, pero validado con las mismas reglas por campo. */
export const commitmentPatchApiSchema = z.object({
    description: z.string().trim().min(1).max(200).optional(),
    amount: z.number().min(0).optional(),
    currency: z.enum(['ARS', 'USD']).optional(),
    recurrence: z.enum(['monthly', 'weekly', 'once']).optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullish(),
    applyMode: z.enum(['manual', 'auto_month_start']).optional(),
    categoryId: z.string().trim().nullish(),
    accountId: z.string().trim().nullish(),
    amountPolicy: amountPolicy.optional(),
    estimationMode: estimationMode.optional(),
    aliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    isActive: z.boolean().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().nullish(),
})

/**
 * Un tramo de la agenda de montos: el importe vigente desde una fecha.
 * Agregar un tramo nunca reescribe aplicaciones ya registradas.
 */
export const commitmentAmountEntryApiSchema = z.object({
    effectiveFrom: z.coerce.date(),
    amount: z.number().min(0, 'El monto no puede ser negativo'),
    note: z.string().trim().max(200).optional(),
})
