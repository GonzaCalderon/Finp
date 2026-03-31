import mongoose, { Schema } from 'mongoose'
import type { IUser } from '@/types'

const UserSchema = new Schema<IUser>(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        displayName: { type: String, required: true, trim: true },
        baseCurrency: { type: String, enum: ['ARS', 'USD'], required: true },
        timezone: { type: String, required: true },
        preferences: {
            defaultView: {
                type: String,
                enum: ['dashboard', 'transactions', 'accounts', 'projection'],
                default: 'dashboard',
            },
            monthStartDay: { type: Number, min: 1, max: 28, default: 1 },
            defaultAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
            consolidatedCurrency: { type: String, enum: ['ARS', 'USD'], default: 'ARS' },
            referenceArsPerUsdRate: { type: Number, min: 0 },
        },
    },
    { timestamps: true }
)

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
