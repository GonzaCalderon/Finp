import mongoose, { Schema } from 'mongoose'

import type {
    QuickCaptureLearningEventType,
    QuickCaptureLearningMethod,
    QuickCaptureSuggestionSource,
} from '@/types'

interface IQuickCaptureLearningEvent {
    userId: mongoose.Types.ObjectId
    eventId: string
    sessionId: string
    type: QuickCaptureLearningEventType
    method?: QuickCaptureLearningMethod
    inputTerms?: string[]
    transactionType?: 'expense' | 'income'
    currency?: 'ARS' | 'USD'
    accountId?: mongoose.Types.ObjectId
    categoryId?: mongoose.Types.ObjectId
    merchantTerm?: string
    suggestionId?: string
    patternKey?: string
    source?: QuickCaptureSuggestionSource
    targetType?: 'account' | 'category' | 'merchant' | 'description' | 'date'
    targetId?: mongoose.Types.ObjectId
    targetValue?: string
    confidence?: number
    position?: number
    durationMs?: number
    transactionId?: mongoose.Types.ObjectId
    createdAt: Date
}

const EVENT_TYPES: QuickCaptureLearningEventType[] = [
    'capture_opened',
    'suggestion_shown',
    'suggestion_accepted',
    'suggestion_dismissed',
    'suggestion_reverted',
    'field_corrected',
    'capture_abandoned',
    'capture_handoff',
    'capture_confirmed',
    'transaction_edited',
    'transaction_deleted',
    'transaction_undone',
]

const METHODS: QuickCaptureLearningMethod[] = [
    'automatic',
    'enter',
    'tab',
    'space',
    'tap',
    'always',
    'escape',
    'double_space',
    'manual',
    'close',
    'handoff',
    'submit',
    'delete',
    'undo',
]

const QuickCaptureLearningEventSchema =
    new Schema<IQuickCaptureLearningEvent>(
        {
            userId: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true,
                immutable: true,
            },
            eventId: {
                type: String,
                required: true,
                immutable: true,
                trim: true,
                maxlength: 120,
            },
            sessionId: {
                type: String,
                required: true,
                immutable: true,
                trim: true,
                maxlength: 120,
            },
            type: {
                type: String,
                enum: EVENT_TYPES,
                required: true,
                immutable: true,
            },
            method: { type: String, enum: METHODS, immutable: true },
            inputTerms: [{
                type: String,
                trim: true,
                maxlength: 40,
                immutable: true,
            }],
            transactionType: {
                type: String,
                enum: ['expense', 'income'],
                immutable: true,
            },
            currency: {
                type: String,
                enum: ['ARS', 'USD'],
                immutable: true,
            },
            accountId: { type: Schema.Types.ObjectId, ref: 'Account', immutable: true },
            categoryId: { type: Schema.Types.ObjectId, ref: 'Category', immutable: true },
            merchantTerm: {
                type: String,
                trim: true,
                maxlength: 120,
                immutable: true,
            },
            suggestionId: {
                type: String,
                trim: true,
                maxlength: 240,
                immutable: true,
            },
            patternKey: {
                type: String,
                trim: true,
                maxlength: 80,
                immutable: true,
            },
            source: {
                type: String,
                enum: [
                    'alias',
                    'rule',
                    'learned',
                    'frequent',
                    'entity',
                    'similarity',
                    'date',
                ],
                immutable: true,
            },
            targetType: {
                type: String,
                enum: ['account', 'category', 'merchant', 'description', 'date'],
                immutable: true,
            },
            targetId: { type: Schema.Types.ObjectId, immutable: true },
            targetValue: {
                type: String,
                trim: true,
                maxlength: 200,
                immutable: true,
            },
            confidence: { type: Number, min: 0, max: 1, immutable: true },
            position: { type: Number, min: 0, max: 50, immutable: true },
            durationMs: { type: Number, min: 0, max: 86_400_000, immutable: true },
            transactionId: {
                type: Schema.Types.ObjectId,
                ref: 'Transaction',
                immutable: true,
            },
        },
        { timestamps: { createdAt: true, updatedAt: false } }
    )

QuickCaptureLearningEventSchema.index(
    { userId: 1, eventId: 1 },
    { unique: true }
)
QuickCaptureLearningEventSchema.index({ userId: 1, createdAt: -1 })
QuickCaptureLearningEventSchema.index({ userId: 1, patternKey: 1, createdAt: -1 })
QuickCaptureLearningEventSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 180 * 24 * 60 * 60 }
)

export const QuickCaptureLearningEvent =
    (mongoose.models.QuickCaptureLearningEvent as
        | mongoose.Model<IQuickCaptureLearningEvent>
        | undefined) ||
    mongoose.model<IQuickCaptureLearningEvent>(
        'QuickCaptureLearningEvent',
        QuickCaptureLearningEventSchema
    )
