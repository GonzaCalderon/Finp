import mongoose, { Schema } from 'mongoose'

import type { QuickCaptureAliasTargetType } from '@/types'

interface IQuickCaptureAlias {
    userId: mongoose.Types.ObjectId
    term: string
    normalizedTerm: string
    targetType: QuickCaptureAliasTargetType
    targetId?: mongoose.Types.ObjectId
    targetValue?: string
    usageCount: number
    lastUsedAt?: Date
    createdAt: Date
    updatedAt: Date
}

const QuickCaptureAliasSchema = new Schema<IQuickCaptureAlias>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        term: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
        normalizedTerm: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
        targetType: {
            type: String,
            enum: ['account', 'category', 'merchant', 'description'],
            required: true,
        },
        targetId: {
            type: Schema.Types.ObjectId,
        },
        targetValue: {
            type: String,
            trim: true,
            maxlength: 200,
        },
        usageCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastUsedAt: {
            type: Date,
        },
    },
    { timestamps: true }
)

QuickCaptureAliasSchema.index(
    { userId: 1, normalizedTerm: 1, targetType: 1 },
    { unique: true }
)
QuickCaptureAliasSchema.index({ userId: 1, lastUsedAt: -1 })

export const QuickCaptureAlias =
    (mongoose.models.QuickCaptureAlias as
        | mongoose.Model<IQuickCaptureAlias>
        | undefined) ||
    mongoose.model<IQuickCaptureAlias>(
        'QuickCaptureAlias',
        QuickCaptureAliasSchema
    )
