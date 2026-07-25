import mongoose, { Schema } from 'mongoose'

/**
 * Descarte persistente de una sugerencia funcional ("No volver a sugerir esto").
 *
 * Es lo único que se persiste del ciclo de orientación: los candidatos se
 * calculan en vivo desde el contexto, pero un descarte tiene que sobrevivir a la
 * sesión para que la captura no se vuelva invasiva.
 */
export interface IFunctionalSuggestionDismissal {
    userId: mongoose.Types.ObjectId
    intent: string
    /** Clave estable de aquello sobre lo que se sugirió. */
    subjectKey: string
    dismissedAt: Date
}

const FunctionalSuggestionDismissalSchema = new Schema<IFunctionalSuggestionDismissal>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        intent: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60,
        },
        subjectKey: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300,
        },
        dismissedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    { timestamps: true }
)

FunctionalSuggestionDismissalSchema.index({ userId: 1, subjectKey: 1 }, { unique: true })

export const FunctionalSuggestionDismissal =
    (mongoose.models.FunctionalSuggestionDismissal as
        | mongoose.Model<IFunctionalSuggestionDismissal>
        | undefined) ||
    mongoose.model<IFunctionalSuggestionDismissal>(
        'FunctionalSuggestionDismissal',
        FunctionalSuggestionDismissalSchema
    )
