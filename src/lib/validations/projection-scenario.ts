import { z } from 'zod'

const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período inválido')
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day, 12)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}, 'Fecha inválida')
const identifierSchema = z.string().trim().min(1).max(100)
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido')
const amountSchema = z.number().finite().positive().max(1_000_000_000_000)

const targetSchema = z.object({
    sourceType: z.enum(['scheduled_commitment', 'installment_plan', 'transaction']),
    sourceId: identifierSchema,
    period: periodSchema,
}).strict()

const adjustSchema = z.object({
    id: identifierSchema,
    type: z.literal('adjust'),
    target: targetSchema,
    scope: z.enum(['occurrence', 'forward']),
    amount: amountSchema,
    destinationPeriod: periodSchema.optional(),
}).strict()

const omitSchema = z.object({
    id: identifierSchema,
    type: z.literal('omit'),
    target: targetSchema,
    scope: z.enum(['occurrence', 'forward']),
}).strict()

const commitmentExpenseSchema = z.object({
    type: z.literal('commitment'),
    recurrence: z.discriminatedUnion('type', [
        z.object({ type: z.literal('once'), date: dateSchema }).strict(),
        z.object({
            type: z.literal('weekly'),
            startDate: dateSchema,
            endDate: dateSchema.optional(),
        }).strict(),
        z.object({
            type: z.literal('monthly'),
            dayOfMonth: z.number().int().min(1).max(31),
            startDate: dateSchema,
            endDate: dateSchema.optional(),
        }).strict(),
    ]),
}).strict()

const cardExpenseBase = {
    accountId: objectIdSchema,
    purchaseDate: dateSchema,
    firstClosingMonth: periodSchema,
}

const hypotheticalSchema = z.object({
    id: identifierSchema,
    type: z.literal('hypothetical'),
    description: z.string().trim().min(1).max(200),
    amount: amountSchema,
    currency: z.enum(['ARS', 'USD']),
    categoryId: objectIdSchema.optional(),
    expense: z.discriminatedUnion('type', [
        commitmentExpenseSchema,
        z.object({ type: z.literal('card_single'), ...cardExpenseBase }).strict(),
        z.object({
            type: z.literal('card_installment'),
            ...cardExpenseBase,
            installmentCount: z.number().int().min(2).max(60),
        }).strict(),
    ]),
}).strict()

export const projectionScenarioRequestSchema = z.object({
    view: z.object({
        mode: z.enum(['monthly', 'annual']),
        months: z.number().int().min(1).max(24).optional(),
        year: z.number().int().min(2000).max(2100).optional(),
    }).strict(),
    changes: z.array(z.discriminatedUnion('type', [adjustSchema, omitSchema, hypotheticalSchema])).max(50),
}).strict().superRefine((input, context) => {
    if (input.view.mode === 'annual' && input.view.months !== undefined) {
        context.addIssue({ code: 'custom', path: ['view', 'months'], message: 'months sólo aplica al modo mensual' })
    }
    if (input.view.mode === 'monthly' && input.view.year !== undefined) {
        context.addIssue({ code: 'custom', path: ['view', 'year'], message: 'year sólo aplica al modo anual' })
    }

    const ids = new Set<string>()
    input.changes.forEach((change, index) => {
        if (ids.has(change.id)) {
            context.addIssue({ code: 'custom', path: ['changes', index, 'id'], message: 'El id del cambio está repetido' })
        }
        ids.add(change.id)

        if (change.type === 'adjust' && change.destinationPeriod && change.scope !== 'occurrence') {
            context.addIssue({
                code: 'custom',
                path: ['changes', index, 'destinationPeriod'],
                message: 'Sólo una ocurrencia puede moverse de período',
            })
        }
        if (change.type === 'adjust' && change.destinationPeriod === change.target.period) {
            context.addIssue({
                code: 'custom',
                path: ['changes', index, 'destinationPeriod'],
                message: 'El destino debe ser otro período',
            })
        }
        if (
            change.type === 'hypothetical' &&
            change.expense.type === 'commitment' &&
            'endDate' in change.expense.recurrence
        ) {
            const endDate = change.expense.recurrence.endDate
            if (endDate && endDate < change.expense.recurrence.startDate) {
                context.addIssue({
                    code: 'custom',
                    path: ['changes', index, 'expense', 'recurrence', 'endDate'],
                    message: 'La fecha de fin no puede ser anterior al inicio',
                })
            }
        }
        if (
            change.type === 'hypothetical' &&
            change.expense.type !== 'commitment' &&
            change.expense.firstClosingMonth < change.expense.purchaseDate.slice(0, 7)
        ) {
            context.addIssue({
                code: 'custom',
                path: ['changes', index, 'expense', 'firstClosingMonth'],
                message: 'El primer cierre no puede ser anterior a la compra',
            })
        }
    })
})

export type ProjectionScenarioRequest = z.infer<typeof projectionScenarioRequestSchema>
