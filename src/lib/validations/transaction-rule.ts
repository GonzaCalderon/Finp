import { z } from 'zod'
import {
    RULE_APPLIES_TO,
    RULE_CONDITIONS,
    RULE_FIELDS,
} from '@/lib/constants'

export const transactionRuleInputSchema = z.object({
    name: z.string().trim().min(1).max(100),
    isActive: z.boolean().optional().default(true),
    priority: z.number().int().min(0).max(9999).optional().default(0),
    appliesTo: z.enum([
        RULE_APPLIES_TO.EXPENSE,
        RULE_APPLIES_TO.INCOME,
        RULE_APPLIES_TO.ANY,
    ]),
    field: z.enum([RULE_FIELDS.DESCRIPTION, RULE_FIELDS.MERCHANT]),
    condition: z.enum([
        RULE_CONDITIONS.CONTAINS,
        RULE_CONDITIONS.EQUALS,
        RULE_CONDITIONS.STARTS_WITH,
    ]),
    value: z.string().trim().min(1).max(200),
    categoryId: z.string().trim().optional(),
    setType: z.enum(['expense', 'income']).optional(),
    normalizeMerchant: z.string().trim().max(200).optional(),
})

export const transactionRuleSimulationSchema = z.object({
    rule: transactionRuleInputSchema,
    editingRuleId: z.string().trim().optional(),
    sample: z.object({
        type: z.enum(['expense', 'income', 'credit_card_expense']),
        description: z.string().trim().max(200).optional().default(''),
        merchant: z.string().trim().max(200).optional().default(''),
        categoryId: z.string().trim().optional(),
    }).refine(
        (sample) => Boolean(sample.description || sample.merchant),
        {
            message: 'Ingresá una descripción o un comercio para probar la regla.',
        }
    ),
})

export type TransactionRuleSimulationInput = z.infer<
    typeof transactionRuleSimulationSchema
>
