import mongoose, { Schema } from 'mongoose'
import type { ITransactionRule } from '@/types'
import { RULE_APPLIES_TO, RULE_FIELDS, RULE_CONDITIONS } from '@/lib/constants'

const TransactionRuleSchema = new Schema<ITransactionRule>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true },
        isActive: { type: Boolean, default: true },
        priority: { type: Number, default: 0 },
        appliesTo: {
            type: String,
            enum: Object.values(RULE_APPLIES_TO),
            required: true,
            default: RULE_APPLIES_TO.ANY,
        },
        field: {
            type: String,
            enum: Object.values(RULE_FIELDS),
            required: true,
        },
        condition: {
            type: String,
            enum: Object.values(RULE_CONDITIONS),
            required: true,
        },
        value: { type: String, required: true, trim: true },
        // Actions
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        setType: { type: String, enum: ['expense', 'income'] },
        normalizeMerchant: { type: String, trim: true },
    },
    { timestamps: true }
)

TransactionRuleSchema.index({ userId: 1, isActive: 1, priority: -1 })

export const TransactionRule =
    mongoose.models.TransactionRule ||
    mongoose.model<ITransactionRule>('TransactionRule', TransactionRuleSchema)
