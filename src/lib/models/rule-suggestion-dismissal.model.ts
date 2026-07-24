import mongoose, { Schema } from 'mongoose'

interface IRuleSuggestionDismissal {
    userId: mongoose.Types.ObjectId
    key: string
    dismissedAt: Date
}

const RuleSuggestionDismissalSchema = new Schema<IRuleSuggestionDismissal>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        key: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },
        dismissedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    { timestamps: true }
)

RuleSuggestionDismissalSchema.index(
    { userId: 1, key: 1 },
    { unique: true }
)

export const RuleSuggestionDismissal =
    (mongoose.models.RuleSuggestionDismissal as
        | mongoose.Model<IRuleSuggestionDismissal>
        | undefined) ||
    mongoose.model<IRuleSuggestionDismissal>(
        'RuleSuggestionDismissal',
        RuleSuggestionDismissalSchema
    )
