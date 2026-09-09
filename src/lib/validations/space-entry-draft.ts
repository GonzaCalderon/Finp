import { z } from 'zod'

import { conversionSnapshotSchema, moneyDtoSchema } from '@/lib/validations/space-money-v2'

const draftObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)

const draftSplitAllocationSchema = z.object({
    participantId: draftObjectIdSchema,
    percentage: z.number().finite().nonnegative().max(100).optional(),
    amount: z.number().finite().nonnegative().optional(),
}).strict()

export const spaceEntryDraftFieldsSchema = z.object({
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    amount: z.number().finite().nonnegative().optional(),
    money: moneyDtoSchema.optional(),
    currency: z.string().trim().min(1).max(12).optional(),
    exchangeRate: z.number().finite().positive().optional(),
    exchangeRateDecimal: z.string().regex(/^\d+(?:\.\d+)?$/).optional(),
    conversionSnapshot: conversionSnapshotSchema.optional(),
    expectedQuoteFingerprint: z.string().min(8).max(64).optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paidByParticipantId: draftObjectIdSchema.optional(),
    sharedWithParticipantIds: z.array(draftObjectIdSchema).max(100).optional(),
    splitMode: z.enum(['none', 'equal', 'percentage', 'fixed']).optional(),
    splitAllocations: z.array(draftSplitAllocationSchema).max(100).optional(),
    spaceCategoryId: draftObjectIdSchema.optional(),
    notes: z.string().trim().max(1000).optional(),
    personalImpact: z.object({
        accountId: draftObjectIdSchema.optional(),
        categoryId: draftObjectIdSchema.optional(),
        description: z.string().trim().max(200).optional(),
        linkedTransactionId: draftObjectIdSchema.optional(),
    }).strict().superRefine((impact, context) => {
        if (impact.accountId && impact.linkedTransactionId) {
            context.addIssue({
                code: 'custom',
                message: 'Elegí una cuenta nueva o una transacción existente, no ambas.',
                path: ['linkedTransactionId'],
            })
        }
    }).optional(),
}).strict()

export const saveSpaceEntryDraftSchema = z.object({
    draftId: draftObjectIdSchema.optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    expectedSpaceRevision: z.number().int().nonnegative(),
    step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    fields: spaceEntryDraftFieldsSchema,
}).strict()

export const publishSpaceEntryDraftSchema = z.object({
    draftId: draftObjectIdSchema,
    expectedRevision: z.number().int().nonnegative(),
}).strict()

export const discardSpaceEntryDraftSchema = publishSpaceEntryDraftSchema

export const mutateSpaceEntryDraftAttachmentSchema = z.object({
    draftId: draftObjectIdSchema,
    expectedRevision: z.coerce.number().int().nonnegative(),
    idempotencyKey: z.string().trim().min(8).max(200),
}).strict()

export const deleteSpaceEntryDraftAttachmentSchema = z.object({
    draftId: draftObjectIdSchema,
    expectedRevision: z.number().int().nonnegative(),
}).strict()

export type SpaceEntryDraftFieldsInput = z.infer<typeof spaceEntryDraftFieldsSchema>
