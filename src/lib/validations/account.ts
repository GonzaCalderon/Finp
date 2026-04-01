import { z } from 'zod'
import { normalizeDefaultPaymentMethods, normalizeSupportedCurrencies } from '@/lib/utils/accounts'

const currencySchema = z.enum(['ARS', 'USD'])
const defaultPaymentMethodSchema = z.enum(['cash', 'debit', 'credit_card'])

export const accountSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    type: z.enum(['bank', 'cash', 'wallet', 'credit_card', 'debt', 'savings']),
    currency: currencySchema.optional(),
    supportedCurrencies: z.array(currencySchema).min(1, 'Seleccioná al menos una moneda').max(2).optional(),
    defaultPaymentMethods: z.array(defaultPaymentMethodSchema).max(1).optional(),
    institution: z.string().optional(),
    initialBalance: z.number().optional(),
    initialBalances: z.object({
        ARS: z.number().optional(),
        USD: z.number().optional(),
    }).optional(),
    color: z.string().optional(),
    allowNegativeBalance: z.boolean().default(true),
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
}).transform((data) => {
    const supportedCurrencies = normalizeSupportedCurrencies(data.supportedCurrencies, data.currency, data.type)
    const defaultPaymentMethods = normalizeDefaultPaymentMethods(data.defaultPaymentMethods, data.type)
    const primaryCurrency = supportedCurrencies[0] ?? 'ARS'
    const initialBalances = {
        ARS: data.initialBalances?.ARS ?? 0,
        USD: data.initialBalances?.USD ?? 0,
    }

    if ((data.initialBalance ?? 0) !== 0 && initialBalances[primaryCurrency] === 0) {
        initialBalances[primaryCurrency] = data.initialBalance ?? 0
    }

    return {
        ...data,
        supportedCurrencies,
        defaultPaymentMethods,
        currency: supportedCurrencies[0],
        initialBalances,
        initialBalance: initialBalances[primaryCurrency],
    }
})

export type AccountFormData = z.infer<typeof accountSchema>
export type AccountFormInput = z.input<typeof accountSchema>
