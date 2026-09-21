import { z } from 'zod'

export const moneyDtoSchema = z.object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    minorUnits: z.string().regex(/^-?\d+$/),
    scale: z.number().int().min(0).max(3),
}).strict()

const conversionPathStepSchema = z.object({
    fromCurrency: z.string().regex(/^[A-Z]{3}$/),
    toCurrency: z.string().regex(/^[A-Z]{3}$/),
    rate: z.string().regex(/^\d+(?:\.\d+)?$/),
    source: z.enum(['dolarapi_official', 'frankfurter', 'manual', 'identity']),
}).strict()

export const conversionSnapshotSchema = z.object({
    rate: z.string().regex(/^\d+(?:\.\d+)?$/),
    direction: z.enum(['multiply', 'divide']),
    source: z.enum(['dolarapi_official', 'frankfurter', 'manual', 'identity']),
    manualAuthorUserId: z.string().optional(),
    observedAt: z.string().datetime(),
    capturedAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    path: z.array(conversionPathStepSchema).min(1).max(3),
}).strict()
