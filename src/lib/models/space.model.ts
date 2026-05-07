import mongoose, { Schema } from 'mongoose'
import type { ISpace } from '@/types'
import {
    CURRENCIES,
    SPACE_DEBT_MODES,
    SPACE_MODES,
    SPACE_SPLIT_MODES,
    SPACE_STATUSES,
    SPACE_TYPES,
} from '@/lib/constants'

const SpaceSchema = new Schema<ISpace>(
    {
        ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        type: { type: String, enum: Object.values(SPACE_TYPES), required: true },
        mode: { type: String, enum: Object.values(SPACE_MODES), required: true },
        status: {
            type: String,
            enum: Object.values(SPACE_STATUSES),
            required: true,
            default: SPACE_STATUSES.ACTIVE,
        },
        startDate: { type: Date },
        endDate: { type: Date },
        closedAt: { type: Date },
        currencies: {
            type: [{ type: String }],
            required: true,
            default: [CURRENCIES.ARS],
        },
        reportingCurrency: {
            type: String,
            required: true,
            default: CURRENCIES.ARS,
        },
        defaultSplitMode: {
            type: String,
            enum: Object.values(SPACE_SPLIT_MODES),
            required: true,
            default: SPACE_SPLIT_MODES.EQUAL,
        },
        simplifyDebts: { type: Boolean },
        debtMode: {
            type: String,
            enum: Object.values(SPACE_DEBT_MODES),
            default: SPACE_DEBT_MODES.SIMPLIFIED,
        },
    },
    { timestamps: true }
)

SpaceSchema.index({ ownerUserId: 1, status: 1, createdAt: -1 })

export const Space =
    (mongoose.models.Space as mongoose.Model<ISpace> | undefined) ||
    mongoose.model<ISpace>('Space', SpaceSchema)
