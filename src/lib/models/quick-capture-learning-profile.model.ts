import mongoose, { Schema } from 'mongoose'

interface IQuickCaptureLearningProfile {
    userId: mongoose.Types.ObjectId
    enabled: boolean
    resetAt?: Date
    introSeenAt?: Date
    createdAt: Date
    updatedAt: Date
}

const QuickCaptureLearningProfileSchema =
    new Schema<IQuickCaptureLearningProfile>(
        {
            userId: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true,
                immutable: true,
                unique: true,
            },
            enabled: { type: Boolean, required: true, default: true },
            resetAt: { type: Date },
            introSeenAt: { type: Date },
        },
        { timestamps: true }
    )

export const QuickCaptureLearningProfile =
    (mongoose.models.QuickCaptureLearningProfile as
        | mongoose.Model<IQuickCaptureLearningProfile>
        | undefined) ||
    mongoose.model<IQuickCaptureLearningProfile>(
        'QuickCaptureLearningProfile',
        QuickCaptureLearningProfileSchema
    )
