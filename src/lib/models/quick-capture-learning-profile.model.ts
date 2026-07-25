import mongoose, { Schema } from 'mongoose'

interface IQuickCaptureLearningProfile {
    userId: mongoose.Types.ObjectId
    enabled: boolean
    resetAt?: Date
    /** Intro del aprendizaje personal (patrones aprendidos). */
    introSeenAt?: Date
    /**
     * Intro de Captura rápida como orientador. Es un campo aparte: el banner de
     * aprendizaje sólo aparece cuando ya hay patrones, así que un usuario nuevo
     * nunca lo veía y no puede servir para anunciar las capacidades del diálogo.
     */
    captureIntroSeenAt?: Date
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
            captureIntroSeenAt: { type: Date },
        },
        { timestamps: true }
    )

// Sin migraciones: si el modelo cacheado no conoce un path nuevo, Mongoose lo
// descarta silenciosamente al escribir y al leer. Hay que descartar la caché.
const existingProfileModel = mongoose.models.QuickCaptureLearningProfile as
    | mongoose.Model<IQuickCaptureLearningProfile>
    | undefined

const profileNeedsRefresh =
    !!existingProfileModel && !existingProfileModel.schema.path('captureIntroSeenAt')

if (profileNeedsRefresh) {
    delete mongoose.models.QuickCaptureLearningProfile
}

export const QuickCaptureLearningProfile =
    (profileNeedsRefresh
        ? undefined
        : (mongoose.models.QuickCaptureLearningProfile as
              | mongoose.Model<IQuickCaptureLearningProfile>
              | undefined)) ||
    mongoose.model<IQuickCaptureLearningProfile>(
        'QuickCaptureLearningProfile',
        QuickCaptureLearningProfileSchema
    )
