import mongoose, { Schema } from 'mongoose'
import type { ITransaction } from '@/types'
import { TRANSACTION_TYPES, CURRENCIES, TRANSACTION_STATUS, CREATED_FROM, IMPORT_SOURCE_TYPES } from '@/lib/constants'

const TransactionSchema = new Schema<ITransaction>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: Object.values(TRANSACTION_TYPES), required: true },
        amount: { type: Number, required: true },
        currency: { type: String, enum: Object.values(CURRENCIES), required: true },
        date: { type: Date, required: true },
        description: { type: String, required: true, trim: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        sourceAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        destinationAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        destinationAmount: { type: Number },
        destinationCurrency: { type: String, enum: Object.values(CURRENCIES) },
        exchangeRate: { type: Number },
        paymentGroupId: { type: String },
        notes: { type: String },
        tags: [{ type: String }],
        merchant: { type: String },
        status: { type: String, enum: Object.values(TRANSACTION_STATUS) },
        installmentPlanId: { type: Schema.Types.ObjectId, ref: 'InstallmentPlan' },
        createdFrom: { type: String, enum: Object.values(CREATED_FROM), required: true, default: 'web' },
        appliedRuleId: { type: Schema.Types.ObjectId, ref: 'TransactionRule' },
        appliedRuleNameSnapshot: { type: String },
        importBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch' },
        importedAt: { type: Date },
        importSourceType: { type: String, enum: Object.values(IMPORT_SOURCE_TYPES) },
    },
    { timestamps: true }
)

TransactionSchema.index({ userId: 1, date: -1 })
TransactionSchema.index({ userId: 1, type: 1, date: -1 })
TransactionSchema.index({ userId: 1, sourceAccountId: 1, date: -1 })
TransactionSchema.index({ userId: 1, destinationAccountId: 1, date: -1 })
TransactionSchema.index({ userId: 1, categoryId: 1, date: -1 })
TransactionSchema.index({ userId: 1, paymentGroupId: 1, date: -1 })

const existingTransactionModel = mongoose.models.Transaction as mongoose.Model<ITransaction> | undefined
const currentTypeEnum = existingTransactionModel?.schema.path('type')?.options?.enum as string[] | undefined
const hasDestinationAmountPath = Boolean(existingTransactionModel?.schema.path('destinationAmount'))
const hasPaymentGroupIdPath = Boolean(existingTransactionModel?.schema.path('paymentGroupId'))
const needsSchemaRefresh =
    !!existingTransactionModel &&
    (!currentTypeEnum ||
        !currentTypeEnum.includes(TRANSACTION_TYPES.CREDIT_CARD_EXPENSE) ||
        !currentTypeEnum.includes(TRANSACTION_TYPES.EXCHANGE) ||
        !hasDestinationAmountPath ||
        !hasPaymentGroupIdPath)

if (needsSchemaRefresh) {
    delete mongoose.models.Transaction
}

export const Transaction =
    (needsSchemaRefresh ? undefined : (mongoose.models.Transaction as mongoose.Model<ITransaction> | undefined)) ||
    mongoose.model<ITransaction>('Transaction', TransactionSchema)
