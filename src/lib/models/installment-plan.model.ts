import mongoose, { Schema } from 'mongoose'
import type { IInstallmentPlan } from '@/types'
import { CURRENCIES } from '@/lib/constants'

const InstallmentPlanSchema = new Schema<IInstallmentPlan>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
        description: { type: String, required: true, trim: true },
        merchant: { type: String },
        currency: { type: String, enum: Object.values(CURRENCIES), required: true },
        totalAmount: { type: Number, required: true },
        installmentCount: { type: Number, required: true },
        installmentAmount: { type: Number, required: true },
        purchaseDate: { type: Date, required: true },
        firstClosingMonth: { type: String, required: true },
    },
    { timestamps: true }
)

InstallmentPlanSchema.index({ userId: 1, accountId: 1 })
InstallmentPlanSchema.index({ userId: 1, firstClosingMonth: 1 })

export const InstallmentPlan = mongoose.models.InstallmentPlan || mongoose.model<IInstallmentPlan>('InstallmentPlan', InstallmentPlanSchema)