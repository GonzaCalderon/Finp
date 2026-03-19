import mongoose, { Schema } from 'mongoose'
import type { IAccount } from '@/types'
import { ACCOUNT_TYPES, CURRENCIES } from '@/lib/constants'

const AccountSchema = new Schema<IAccount>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: Object.values(ACCOUNT_TYPES), required: true },
        currency: { type: String, enum: Object.values(CURRENCIES), required: true },
        institution: { type: String },
        description: { type: String },
        color: { type: String },
        isActive: { type: Boolean, default: true },
        includeInNetWorth: { type: Boolean, default: true },
        initialBalance: { type: Number, default: 0 },
        creditCardConfig: {
            closingDay: { type: Number },
            dueDay: { type: Number },
            creditLimit: { type: Number },
        },
        debtConfig: {
            creditorName: { type: String },
            originalAmount: { type: Number },
        },
    },
    { timestamps: true }
)

AccountSchema.index({ userId: 1, isActive: 1 })
AccountSchema.index({ userId: 1, type: 1 })

export const Account = mongoose.models.Account || mongoose.model<IAccount>('Account', AccountSchema)