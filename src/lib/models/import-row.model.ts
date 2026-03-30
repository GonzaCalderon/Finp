import mongoose, { Schema } from 'mongoose'
import type { IImportRow } from '@/types'
import { IMPORT_ROW_STATUS } from '@/lib/constants'

const ParsedDataSchema = new Schema(
    {
        date: { type: Date },
        type: { type: String },
        description: { type: String },
        amount: { type: Number },
        currency: { type: String },
        categoryId: { type: String },
        categoryName: { type: String },
        sourceAccountId: { type: String },
        destinationAccountId: { type: String },
        accountName: { type: String },
        destinationAccountName: { type: String },
        paymentMethod: { type: String },
        cardName: { type: String },
        installmentCount: { type: Number },
        installmentNumber: { type: Number },
        firstClosingMonth: { type: String },
        notes: { type: String },
        ignored: { type: Boolean },
    },
    { _id: false }
)

const ImportRowSchema = new Schema<IImportRow>(
    {
        batchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch', required: true },
        rowNumber: { type: Number, required: true },
        rawData: { type: Map, of: String },
        parsedData: { type: ParsedDataSchema },
        reviewedData: { type: ParsedDataSchema },
        status: {
            type: String,
            enum: Object.values(IMPORT_ROW_STATUS),
            required: true,
            default: IMPORT_ROW_STATUS.INCOMPLETE,
        },
        warnings: [{ type: String }],
        errors: [{ type: String }],
        possibleDuplicateId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        createdTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        ignored: { type: Boolean, default: false },
    },
    { timestamps: false }
)

ImportRowSchema.index({ batchId: 1, rowNumber: 1 })
ImportRowSchema.index({ batchId: 1, status: 1 })

export const ImportRow =
    mongoose.models.ImportRow || mongoose.model<IImportRow>('ImportRow', ImportRowSchema)
