import mongoose, { Schema } from 'mongoose'
import type { ICategory } from '@/types'
import { CATEGORY_TYPES } from '@/lib/constants'

const CategorySchema = new Schema<ICategory>(
    {
            userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            name: { type: String, required: true, trim: true },
            type: { type: String, enum: Object.values(CATEGORY_TYPES), required: true },
            icon: { type: String },
            color: { type: String },
            isDefault: { type: Boolean, default: false },
            isArchived: { type: Boolean, default: false },
            sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
)

CategorySchema.index({ userId: 1, type: 1, isArchived: 1 })
CategorySchema.index({ userId: 1, sortOrder: 1 })

export const Category = mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema)