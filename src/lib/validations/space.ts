import { z } from 'zod'

const currencySchema = z
    .string()
    .min(2, 'Moneda inválida')
    .max(6, 'Moneda inválida')
    .regex(/^[A-Z]{2,6}$/, 'El código de moneda debe ser de letras mayúsculas')

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
}, z.number().positive('El monto debe ser mayor a 0'))

const optionalAmountSchema = z.preprocess((value) => {
    if (typeof value === 'number') return value

    if (typeof value === 'string') {
        const normalized = value.replace(',', '.').trim()
        if (normalized === '') return undefined
        const parsed = Number(normalized)
        return Number.isNaN(parsed) ? value : parsed
    }

    return value
}, z.number().optional())

const dateSchema = z.preprocess((value) => {
    if (value instanceof Date) return value

    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) return parsed
    }

    return value
}, z.date({ message: 'La fecha es inválida' }))

export const spaceSchema = z
    .object({
        name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
        description: optionalTrimmedString.refine(
            (value) => value === undefined || value.length <= 240,
            'La descripción no puede superar los 240 caracteres'
        ),
        type: z.enum(['couple', 'home', 'travel', 'project', 'event', 'personal', 'other']),
        mode: z.enum(['solo', 'managed', 'synchronized']),
        status: z.enum(['active', 'paused', 'closed', 'archived']).default('active'),
        startDate: dateSchema.optional(),
        endDate: dateSchema.optional(),
        currencies: z.array(currencySchema).min(1, 'Seleccioná al menos una moneda'),
        reportingCurrency: currencySchema,
        defaultSplitMode: z.enum(['none', 'equal', 'percentage', 'fixed']).default('equal'),
    })
    .superRefine((data, ctx) => {
        if (!data.currencies.includes(data.reportingCurrency)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La moneda de reporte debe estar incluida entre las monedas del espacio',
                path: ['reportingCurrency'],
            })
        }

        if (data.endDate && data.startDate && data.endDate < data.startDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
                path: ['endDate'],
            })
        }

        if (data.mode === 'solo' && data.defaultSplitMode !== 'none') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Un espacio solo no puede dividir gastos entre participantes',
                path: ['defaultSplitMode'],
            })
        }
    })

export const spaceParticipantSchema = z.object({
    kind: z.enum(['finp_user', 'external']),
    displayName: z
        .string()
        .trim()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(80, 'El nombre no puede superar los 80 caracteres'),
    email: optionalTrimmedString.refine(
        (value) => value === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        'Ingresá un email válido'
    ),
    role: z.enum(['owner', 'admin', 'participant']).default('participant'),
})
    .superRefine((data, ctx) => {
        if (data.kind === 'finp_user' && !data.email) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'El email es obligatorio para invitar a un usuario de Finp',
                path: ['email'],
            })
        }
    })

const splitAllocationSchema = z.object({
    participantId: z.string().min(1, 'Participante inválido'),
    percentage: optionalAmountSchema,
    amount: optionalAmountSchema,
})

export const spaceEntrySchema = z
    .object({
        type: z.enum(['expense', 'income', 'adjustment', 'settlement']),
        title: z.string().trim().min(2, 'La descripción breve es obligatoria').max(120),
        description: optionalTrimmedString.refine(
            (value) => value === undefined || value.length <= 240,
            'La descripción no puede superar los 240 caracteres'
        ),
        amount: amountSchema,
        currency: currencySchema,
        exchangeRate: optionalAmountSchema.refine(
            (value) => value === undefined || value > 0,
            'La cotización debe ser mayor a 0'
        ),
        date: dateSchema,
        categoryId: optionalObjectIdString,
        paidByParticipantId: optionalObjectIdString,
        sharedWithParticipantIds: z.array(z.string().min(1)).optional(),
        splitMode: z.enum(['none', 'equal', 'percentage', 'fixed']).default('none'),
        splitAllocations: z.array(splitAllocationSchema).optional(),
        notes: optionalTrimmedString.refine(
            (value) => value === undefined || value.length <= 400,
            'Las notas no pueden superar los 400 caracteres'
        ),
        personalAccountId: optionalObjectIdString,
        linkedTransactionId: optionalObjectIdString,
    })
    .superRefine((data, ctx) => {
        if (data.splitMode !== 'none') {
            const participantCount = data.sharedWithParticipantIds?.length ?? 0

            if (participantCount === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Seleccioná al menos un participante para el split',
                    path: ['sharedWithParticipantIds'],
                })
            }
        }

        if (data.splitMode === 'percentage') {
            const total = (data.splitAllocations ?? []).reduce(
                (acc, allocation) => acc + (allocation.percentage ?? 0),
                0
            )

            if (Math.abs(total - 100) > 0.01) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Los porcentajes deben sumar 100%',
                    path: ['splitAllocations'],
                })
            }
        }

        if (data.splitMode === 'fixed') {
            const total = (data.splitAllocations ?? []).reduce(
                (acc, allocation) => acc + (allocation.amount ?? 0),
                0
            )

            if (Math.abs(total - data.amount) > 0.01) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Los montos fijos deben sumar el total del movimiento',
                    path: ['splitAllocations'],
                })
            }
        }

        if (data.type !== 'settlement' && !data.paidByParticipantId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Indicá quién pagó el movimiento',
                path: ['paidByParticipantId'],
            })
        }
    })

export const spaceParticipantResponseSchema = z.object({
    inviteStatus: z.enum(['accepted', 'declined']),
})

export const spaceEntryConfirmSchema = z
    .object({
        mode: z.enum(['create', 'link']).default('create'),
        description: optionalTrimmedString,
        categoryId: optionalObjectIdString,
        accountId: optionalObjectIdString,
        linkedTransactionId: optionalObjectIdString,
    })
    .superRefine((data, ctx) => {
        if (data.mode === 'create' && !data.accountId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Seleccioná una cuenta para registrar la transacción',
                path: ['accountId'],
            })
        }

        if (data.mode === 'link' && !data.linkedTransactionId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Seleccioná una transacción existente para vincular',
                path: ['linkedTransactionId'],
            })
        }
    })

export type SpaceFormInput = z.input<typeof spaceSchema>
export type SpaceFormData = z.output<typeof spaceSchema>
export type SpaceParticipantFormInput = z.input<typeof spaceParticipantSchema>
export type SpaceParticipantFormData = z.output<typeof spaceParticipantSchema>
export type SpaceEntryFormInput = z.input<typeof spaceEntrySchema>
export type SpaceEntryFormData = z.output<typeof spaceEntrySchema>
export type SpaceEntryConfirmInput = z.input<typeof spaceEntryConfirmSchema>
export type SpaceEntryConfirmData = z.output<typeof spaceEntryConfirmSchema>
