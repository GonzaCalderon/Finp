import mongoose, { Schema } from 'mongoose'
import type { ISpaceCategory } from '@/types'
import { SPACE_ENTRY_TYPES } from '@/lib/constants'

const SpaceCategorySchema = new Schema<ISpaceCategory>(
    {
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
        name: { type: String, required: true, trim: true, maxlength: 50 },
        color: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: [
                SPACE_ENTRY_TYPES.EXPENSE,
                SPACE_ENTRY_TYPES.INCOME,
                SPACE_ENTRY_TYPES.ADJUSTMENT,
            ],
            required: true,
            default: SPACE_ENTRY_TYPES.EXPENSE,
        },
        isDefault: { type: Boolean, default: false },
        isArchived: { type: Boolean, default: false },
    },
    { timestamps: true }
)

SpaceCategorySchema.index({ spaceId: 1, isArchived: 1 })
SpaceCategorySchema.index({ spaceId: 1, type: 1, name: 1 })

export const SpaceCategory =
    (mongoose.models.SpaceCategory as mongoose.Model<ISpaceCategory> | undefined) ||
    mongoose.model<ISpaceCategory>('SpaceCategory', SpaceCategorySchema)
