import mongoose, { Schema } from 'mongoose'

interface IQuickCapturePatternControl {
    userId: mongoose.Types.ObjectId
    patternKey: string
    status: 'active' | 'forgotten'
    updatedAt: Date
    createdAt: Date
}

const QuickCapturePatternControlSchema =
    new Schema<IQuickCapturePatternControl>(
        {
            userId: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            patternKey: {
                type: String,
                required: true,
                trim: true,
                maxlength: 80,
            },
            status: {
                type: String,
                enum: ['active', 'forgotten'],
                required: true,
                default: 'active',
            },
        },
        { timestamps: true }
    )

QuickCapturePatternControlSchema.index(
    { userId: 1, patternKey: 1 },
    { unique: true }
)

export const QuickCapturePatternControl =
    (mongoose.models.QuickCapturePatternControl as
        | mongoose.Model<IQuickCapturePatternControl>
        | undefined) ||
    mongoose.model<IQuickCapturePatternControl>(
        'QuickCapturePatternControl',
        QuickCapturePatternControlSchema
    )
