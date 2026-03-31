import mongoose, { Schema } from 'mongoose'
import type { IImportBatch } from '@/types'
import { IMPORT_SOURCE_TYPES, IMPORT_BATCH_STATUS } from '@/lib/constants'

const ImportBatchSchema = new Schema<IImportBatch>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        fileName: { type: String, required: true },
        sourceType: {
            type: String,
            enum: Object.values(IMPORT_SOURCE_TYPES),
            required: true,
            default: IMPORT_SOURCE_TYPES.XLSX_TEMPLATE,
        },
        status: {
            type: String,
            enum: Object.values(IMPORT_BATCH_STATUS),
            required: true,
            default: IMPORT_BATCH_STATUS.DRAFT,
        },
        summary: {
            total: { type: Number, default: 0 },
            valid: { type: Number, default: 0 },
            invalid: { type: Number, default: 0 },
            incomplete: { type: Number, default: 0 },
            possibleDuplicate: { type: Number, default: 0 },
            ignored: { type: Number, default: 0 },
            imported: { type: Number, default: 0 },
        },
        confirmedAt: { type: Date },
        revertedAt: { type: Date },
    },
    { timestamps: true }
)

ImportBatchSchema.index({ userId: 1, createdAt: -1 })
ImportBatchSchema.index({ userId: 1, status: 1 })

export const ImportBatch =
    mongoose.models.ImportBatch || mongoose.model<IImportBatch>('ImportBatch', ImportBatchSchema)
