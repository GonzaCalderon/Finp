import mongoose, { Schema } from 'mongoose'
import type { IScheduledCommitment, ICommitmentApplication } from '@/types'
import { CURRENCIES, RECURRENCE_TYPES, APPLY_MODES } from '@/lib/constants'

const ScheduledCommitmentSchema = new Schema<IScheduledCommitment>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        description: { type: String, required: true, trim: true },
        amount: { type: Number, required: true },
        currency: { type: String, enum: Object.values(CURRENCIES), required: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        recurrence: { type: String, enum: Object.values(RECURRENCE_TYPES), required: true },
        dayOfMonth: { type: Number },
        dueDate: { type: Date },
        applyMode: { type: String, enum: Object.values(APPLY_MODES), required: true, default: 'manual' },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
)

ScheduledCommitmentSchema.index({ userId: 1, isActive: 1 })

const CommitmentApplicationSchema = new Schema<ICommitmentApplication>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    commitmentId: { type: Schema.Types.ObjectId, ref: 'ScheduledCommitment', required: true },
    period: { type: String, required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    appliedAt: { type: Date, required: true, default: Date.now },
    appliedBy: { type: String, enum: ['manual', 'system'], required: true },
})

CommitmentApplicationSchema.index({ userId: 1, commitmentId: 1, period: 1 }, { unique: true })

export const ScheduledCommitment = mongoose.models.ScheduledCommitment || mongoose.model<IScheduledCommitment>('ScheduledCommitment', ScheduledCommitmentSchema)
export const CommitmentApplication = mongoose.models.CommitmentApplication || mongoose.model<ICommitmentApplication>('CommitmentApplication', CommitmentApplicationSchema)