import mongoose, { Schema } from 'mongoose'
import type { IScheduledCommitment, ICommitmentApplication } from '@/types'
import {
    APPLY_MODES,
    COMMITMENT_AMOUNT_POLICIES,
    COMMITMENT_AMOUNT_SOURCES,
    COMMITMENT_APPLICATION_ORIGINS,
    COMMITMENT_APPLICATION_STATUSES,
    COMMITMENT_ESTIMATION_MODES,
    CURRENCIES,
    RECURRENCE_TYPES,
} from '@/lib/constants'

const CommitmentAmountEntrySchema = new Schema(
    {
        effectiveFrom: { type: Date, required: true },
        amount: { type: Number, required: true, min: 0 },
        source: { type: String, enum: ['initial', 'manual'], required: true, default: 'manual' },
        note: { type: String, trim: true },
        createdAt: { type: Date, required: true, default: Date.now },
    },
    { _id: false }
)

const ScheduledCommitmentSchema = new Schema<IScheduledCommitment>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        description: { type: String, required: true, trim: true },
        amount: { type: Number, required: true },
        currency: { type: String, enum: Object.values(CURRENCIES), required: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        recurrence: { type: String, enum: Object.values(RECURRENCE_TYPES), required: true },
        dayOfMonth: { type: Number, min: 1, max: 31 },
        dueDate: { type: Date },
        applyMode: { type: String, enum: Object.values(APPLY_MODES), required: true, default: 'manual' },
        isActive: { type: Boolean, default: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: false },
        reminderLeadDays: { type: Number, min: 0, max: 31, required: false },
        amountPolicy: {
            type: String,
            enum: Object.values(COMMITMENT_AMOUNT_POLICIES),
            required: true,
            default: COMMITMENT_AMOUNT_POLICIES.FIXED,
        },
        // Agenda de montos efectivos por fecha. Editarla no toca aplicaciones pasadas.
        amountSchedule: { type: [CommitmentAmountEntrySchema], default: [] },
        estimationMode: {
            type: String,
            enum: Object.values(COMMITMENT_ESTIMATION_MODES),
            required: true,
            default: COMMITMENT_ESTIMATION_MODES.TEMPLATE,
        },
        // Se usa para el matching de Captura rápida, con la misma normalización
        // que el motor de reglas (normalizeRuleText).
        normalizedDescription: { type: String, trim: true },
        aliases: { type: [String], default: [] },
        createdFrom: { type: String, enum: ['web', 'quick_capture'], required: true, default: 'web' },
    },
    { timestamps: true }
)

ScheduledCommitmentSchema.index({ userId: 1, isActive: 1 })
ScheduledCommitmentSchema.index({ userId: 1, isActive: 1, normalizedDescription: 1 })

const CommitmentApplicationSchema = new Schema<ICommitmentApplication>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    commitmentId: { type: Schema.Types.ObjectId, ref: 'ScheduledCommitment', required: true },
    period: { type: String, required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    appliedAt: { type: Date, required: true, default: Date.now },
    appliedBy: { type: String, enum: ['manual', 'system'], required: true },
    status: {
        type: String,
        enum: Object.values(COMMITMENT_APPLICATION_STATUSES),
        required: true,
        default: COMMITMENT_APPLICATION_STATUSES.REGISTERED,
    },
    // Foto financiera de lo aplicado: editar la plantilla no debe reescribir la historia.
    snapshot: {
        _id: false,
        amount: { type: Number },
        currency: { type: String, enum: Object.values(CURRENCIES) },
        description: { type: String },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        amountSource: { type: String, enum: Object.values(COMMITMENT_AMOUNT_SOURCES) },
        dueDate: { type: Date },
        computedAt: { type: Date },
    },
    origin: {
        type: String,
        enum: Object.values(COMMITMENT_APPLICATION_ORIGINS),
        required: true,
        default: COMMITMENT_APPLICATION_ORIGINS.MANUAL,
    },
    revertedAt: { type: Date },
    revertedReason: { type: String },
})

// Un compromiso no puede tener dos aplicaciones para el mismo período. Revertir
// no borra la fila: la deja en `reverted` y una nueva aplicación la reutiliza.
CommitmentApplicationSchema.index({ userId: 1, commitmentId: 1, period: 1 }, { unique: true })
CommitmentApplicationSchema.index({ userId: 1, transactionId: 1 })

// Sin migraciones: en hot-reload hay que descartar el modelo cacheado cuando el
// esquema compilado no conoce todavía los paths nuevos.
const existingCommitmentModel = mongoose.models.ScheduledCommitment as
    | mongoose.Model<IScheduledCommitment>
    | undefined
const commitmentNeedsRefresh =
    !!existingCommitmentModel &&
    (!existingCommitmentModel.schema.path('amountPolicy') ||
        !existingCommitmentModel.schema.path('amountSchedule') ||
        !existingCommitmentModel.schema.path('estimationMode') ||
        !existingCommitmentModel.schema.path('normalizedDescription') ||
        !existingCommitmentModel.schema.path('aliases') ||
        !existingCommitmentModel.schema.path('createdFrom') ||
        !existingCommitmentModel.schema.path('reminderLeadDays'))

const existingApplicationModel = mongoose.models.CommitmentApplication as
    | mongoose.Model<ICommitmentApplication>
    | undefined
const applicationNeedsRefresh =
    !!existingApplicationModel &&
    (!existingApplicationModel.schema.path('status') ||
        !existingApplicationModel.schema.path('origin') ||
        !existingApplicationModel.schema.path('snapshot.amountSource'))

if (commitmentNeedsRefresh) {
    delete mongoose.models.ScheduledCommitment
}

if (applicationNeedsRefresh) {
    delete mongoose.models.CommitmentApplication
}

export const ScheduledCommitment =
    (commitmentNeedsRefresh
        ? undefined
        : (mongoose.models.ScheduledCommitment as mongoose.Model<IScheduledCommitment> | undefined)) ||
    mongoose.model<IScheduledCommitment>('ScheduledCommitment', ScheduledCommitmentSchema)

export const CommitmentApplication =
    (applicationNeedsRefresh
        ? undefined
        : (mongoose.models.CommitmentApplication as mongoose.Model<ICommitmentApplication> | undefined)) ||
    mongoose.model<ICommitmentApplication>('CommitmentApplication', CommitmentApplicationSchema)
