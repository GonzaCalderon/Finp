import { Schema } from 'mongoose'

export const moneySchema = new Schema(
    {
        currency: { type: String, required: true, trim: true, uppercase: true },
        minorUnits: { type: String, required: true, match: /^-?\d+$/ },
        scale: { type: Number, required: true, min: 0, max: 3 },
    },
    { _id: false }
)

const conversionPathStepSchema = new Schema(
    {
        fromCurrency: { type: String, required: true, uppercase: true },
        toCurrency: { type: String, required: true, uppercase: true },
        rate: { type: String, required: true },
        source: {
            type: String,
            enum: ['dolarapi_official', 'frankfurter', 'manual', 'identity', 'legacy'],
            required: true,
        },
    },
    { _id: false }
)

export const conversionSnapshotSchema = new Schema(
    {
        rate: { type: String, required: true },
        direction: { type: String, enum: ['multiply', 'divide'], required: true },
        source: {
            type: String,
            enum: ['dolarapi_official', 'frankfurter', 'manual', 'identity', 'legacy'],
            required: true,
        },
        manualAuthorUserId: { type: String },
        observedAt: { type: String, required: true },
        capturedAt: { type: String, required: true },
        expiresAt: { type: String },
        path: { type: [conversionPathStepSchema], required: true, default: [] },
    },
    { _id: false }
)
