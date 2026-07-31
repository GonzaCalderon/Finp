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
            operationalStartDate: { type: String, trim: true },
            projectionGrouping: {
                type: String,
                enum: ['type', 'card', 'category'],
                default: 'type',
            },
            projectionMode: {
                type: String,
                enum: ['monthly', 'annual'],
                default: 'monthly',
            },
            projectionMonths: {
                type: Number,
                enum: [1, 3, 6, 9, 12],
                default: 6,
            },
            projectionChartCurrency: {
                type: String,
                enum: ['ARS', 'USD'],
            },
        },
    },
    { timestamps: true }
)

const existingUserModel = mongoose.models.User as mongoose.Model<IUser> | undefined
const hasOperationalStartDatePath = Boolean(existingUserModel?.schema.path('preferences.operationalStartDate'))
const hasProjectionPreferences = Boolean(
    existingUserModel?.schema.path('preferences.projectionGrouping') &&
    existingUserModel?.schema.path('preferences.projectionMode') &&
    existingUserModel?.schema.path('preferences.projectionMonths') &&
    existingUserModel?.schema.path('preferences.projectionChartCurrency')
)

if (existingUserModel && (!hasOperationalStartDatePath || !hasProjectionPreferences)) {
    delete mongoose.models.User
}

export const User =
    ((!existingUserModel || (hasOperationalStartDatePath && hasProjectionPreferences))
        ? (mongoose.models.User as mongoose.Model<IUser> | undefined)
        : undefined) ||
    mongoose.model<IUser>('User', UserSchema)
