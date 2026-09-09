import { z } from 'zod'
import { moneyFromDecimal } from '@/lib/utils/money'

function fixedAllocationsMatchTotal(amounts: number[], total: number, currency: string) {
    try {
        const allocatedMinorUnits = amounts.reduce(
            (sum, amount) => sum + BigInt(moneyFromDecimal(currency, amount).minorUnits),
            BigInt(0)
        )
        return allocatedMinorUnits === BigInt(moneyFromDecimal(currency, total).minorUnits)
    } catch {
        return Math.abs(amounts.reduce((sum, amount) => sum + amount, 0) - total) <= 0.01
    }
}

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

const optionalMongoId = optionalObjectIdString.refine(
    (value) => value === undefined || /^[0-9a-fA-F]{24}$/.test(value),
    'ID inválido'
)

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
        endDate: z.preprocess((value) => {
            if (value === null) return null
            if (value instanceof Date) return value
            if (typeof value === 'string' || typeof value === 'number') {
                const parsed = new Date(value)
                if (!Number.isNaN(parsed.getTime())) return parsed
            }
            return value
        }, z.date({ message: 'La fecha es inválida' }).nullable()).optional(),
        currencies: z.array(currencySchema).min(1, 'Seleccioná al menos una moneda'),
        reportingCurrency: currencySchema,
        defaultSplitMode: z.enum(['none', 'equal', 'percentage', 'fixed']).default('equal'),
        simplifyDebts: z.boolean().nullable().optional(),
        debtMode: z.enum(['direct', 'simplified']).optional(),
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
        spaceCategoryId: optionalMongoId,
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
            const amounts = (data.splitAllocations ?? []).map((allocation) => allocation.amount ?? 0)

            if (!fixedAllocationsMatchTotal(amounts, data.amount, data.currency)) {
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

        if (data.type === 'settlement') {
            if (!data.paidByParticipantId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Indicá quién realizó el pago',
                    path: ['paidByParticipantId'],
                })
            }

            const receivers = data.sharedWithParticipantIds ?? []
            if (receivers.length !== 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Un pago requiere exactamente un receptor',
                    path: ['sharedWithParticipantIds'],
                })
            }

            if (
                data.paidByParticipantId &&
                receivers.length === 1 &&
                data.paidByParticipantId === receivers[0]
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'El pagador y el receptor no pueden ser la misma persona',
                    path: ['sharedWithParticipantIds'],
                })
            }

            if (data.splitMode !== 'none') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Los pagos deben usar splitMode none',
                    path: ['splitMode'],
                })
            }
        }
    })

export const spaceParticipantResponseSchema = z.object({
    inviteStatus: z.enum(['accepted', 'declined']).optional(),
    role: z.enum(['admin', 'participant']).optional(),
})
    .refine((data) => data.inviteStatus || data.role, 'No hay cambios para guardar')

export const spaceCategorySchema = z.object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(50),
    color: z.string().trim().min(1, 'El color es obligatorio'),
    type: z.enum(['expense', 'income', 'adjustment']).default('expense'),
})

export const spaceCategoryUpdateSchema = spaceCategorySchema.partial().extend({
    isArchived: z.boolean().optional(),
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

export const spacePersonalImpactSchema = z
    .object({
        mode: z.enum(['create_transaction', 'link_existing']),
        accountId: optionalObjectIdString,
        categoryId: optionalObjectIdString,
        linkedTransactionId: optionalObjectIdString,
        impactKind: z
            .enum(['payer_full_amount', 'participant_share', 'settlement_paid', 'settlement_received'])
            .optional(),
        amount: optionalAmountSchema.refine(
            (value) => value === undefined || value > 0,
            'El monto debe ser mayor a 0'
        ),
    })
    .superRefine((data, ctx) => {
        if (data.mode === 'create_transaction' && !data.accountId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Selecciona una cuenta para registrar en tu Finp',
                path: ['accountId'],
            })
        }

        if (data.mode === 'link_existing' && !data.linkedTransactionId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Selecciona una transaccion existente para vincular',
                path: ['linkedTransactionId'],
            })
        }
    })

export const spaceSettlementSchema = z
    .object({
        payerId: z.string().min(1, 'Indicá quién realizó el pago'),
        receiverId: z.string().min(1, 'Indicá quién recibió el pago'),
        amount: amountSchema,
        currency: currencySchema,
        date: dateSchema,
        notes: optionalTrimmedString.refine(
            (value) => value === undefined || value.length <= 400,
            'Las notas no pueden superar los 400 caracteres'
        ),
    })
    .refine((data) => data.payerId !== data.receiverId, {
        message: 'El pagador y el receptor no pueden ser la misma persona',
        path: ['receiverId'],
    })

export const spaceEntryEditSchema = z
    .object({
        title: z.string().trim().min(2, 'La descripción breve es obligatoria').max(120).optional(),
        description: optionalTrimmedString.refine(
            (value) => value === undefined || value.length <= 240,
            'La descripción no puede superar los 240 caracteres'
        ),
        amount: amountSchema.optional(),
        currency: currencySchema.optional(),
        exchangeRate: optionalAmountSchema.refine(
            (value) => value === undefined || value > 0,
            'La cotización debe ser mayor a 0'
        ),
        date: dateSchema.optional(),
        spaceCategoryId: optionalMongoId,
        paidByParticipantId: optionalObjectIdString,
        sharedWithParticipantIds: z.array(z.string().min(1)).optional(),
        splitMode: z.enum(['none', 'equal', 'percentage', 'fixed']).optional(),
        splitAllocations: z.array(splitAllocationSchema).optional(),
        notes: optionalTrimmedString.refine(
            (value) => value === undefined || value.length <= 400,
            'Las notas no pueden superar los 400 caracteres'
        ),
    })
    .superRefine((data, ctx) => {
        if (data.splitMode && data.splitMode !== 'none') {
            const participantCount = data.sharedWithParticipantIds?.length ?? 0
            if (participantCount === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Seleccioná al menos un participante para el split',
                    path: ['sharedWithParticipantIds'],
                })
            }
        }

        if (data.splitMode === 'percentage' && data.splitAllocations) {
            const total = data.splitAllocations.reduce(
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

        if (data.splitMode === 'fixed' && data.splitAllocations && data.amount !== undefined) {
            const amounts = data.splitAllocations.map((allocation) => allocation.amount ?? 0)
            if (!fixedAllocationsMatchTotal(amounts, data.amount, data.currency ?? 'ARS')) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Los montos fijos deben sumar el total del movimiento',
                    path: ['splitAllocations'],
                })
            }
        }
    })

export const spaceEntryVoidSchema = z.object({
    voidReason: optionalTrimmedString.refine(
        (value) => value === undefined || value.length <= 200,
        'El motivo no puede superar los 200 caracteres'
    ),
})

export const spaceInviteLinkSchema = z.object({
    expiresInDays: z
        .union([z.literal(1), z.literal(3), z.literal(7)])
        .default(7),
    regenerate: z.boolean().optional(),
})

export const spacePersonalSettingsSchema = z
    .object({
        categoryStrategy: z.enum([
            'manual',
            'space_name_virtual',
            'fixed_personal_category',
            'map_space_categories',
        ]),
        defaultPersonalCategoryId: optionalMongoId,
        categoryMappings: z
            .array(
                z.object({
                    spaceCategoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'CategorÃ­a del espacio invÃ¡lida'),
                    personalCategoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'CategorÃ­a personal invÃ¡lida'),
                })
            )
            .default([]),
    })
    .superRefine((data, ctx) => {
        if (data.categoryStrategy === 'fixed_personal_category' && !data.defaultPersonalCategoryId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'ElegÃ­ una categorÃ­a personal.',
                path: ['defaultPersonalCategoryId'],
            })
        }
    })

export const migrateSpaceVirtualCategorySchema = z.object({
    targetCategoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'CategorÃ­a destino invÃ¡lida'),
})

export type SpaceEntryEditInput = z.input<typeof spaceEntryEditSchema>
export type SpaceEntryEditData = z.output<typeof spaceEntryEditSchema>
export type SpaceEntryVoidInput = z.input<typeof spaceEntryVoidSchema>
export type SpaceEntryVoidData = z.output<typeof spaceEntryVoidSchema>
export type SpaceInviteLinkInput = z.input<typeof spaceInviteLinkSchema>
export type SpaceInviteLinkData = z.output<typeof spaceInviteLinkSchema>
export type SpacePersonalSettingsInput = z.input<typeof spacePersonalSettingsSchema>
export type SpacePersonalSettingsData = z.output<typeof spacePersonalSettingsSchema>

export type SpaceSettlementInput = z.input<typeof spaceSettlementSchema>
export type SpaceSettlementData = z.output<typeof spaceSettlementSchema>

export type SpaceFormInput = z.input<typeof spaceSchema>
export type SpaceFormData = z.output<typeof spaceSchema>
export type SpaceParticipantFormInput = z.input<typeof spaceParticipantSchema>
export type SpaceParticipantFormData = z.output<typeof spaceParticipantSchema>
export type SpaceEntryFormInput = z.input<typeof spaceEntrySchema>
export type SpaceEntryFormData = z.output<typeof spaceEntrySchema>
export type SpaceCategoryFormData = z.output<typeof spaceCategorySchema>
export type SpaceEntryConfirmInput = z.input<typeof spaceEntryConfirmSchema>
export type SpaceEntryConfirmData = z.output<typeof spaceEntryConfirmSchema>
