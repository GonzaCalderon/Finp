import mongoose, { Schema } from 'mongoose'
import type { IDebt } from '@/types/debt'
import {
    DEBT_DIRECTIONS,
    DEBT_ORIGIN_MODES,
    DEBT_SOURCE_TYPES,
    DEBT_STATUSES,
} from '@/lib/constants'

const DebtSchema = new Schema<IDebt>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        direction: { type: String, enum: Object.values(DEBT_DIRECTIONS), required: true },
        sourceType: { type: String, enum: Object.values(DEBT_SOURCE_TYPES), required: true },

        // Solo para deudas derivadas de Espacios
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space' },
        counterpartyParticipantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant' },

        // Contraparte
        counterpartyUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        counterpartyNameSnapshot: { type: String, required: true, trim: true },

        // Financiero
        amount: { type: Number, required: true, min: 0 },
        remainingAmount: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true, trim: true },

        // Estado
        status: {
            type: String,
            enum: Object.values(DEBT_STATUSES),
            required: true,
            default: DEBT_STATUSES.ACTIVE,
        },
        originMode: { type: String, enum: Object.values(DEBT_ORIGIN_MODES) },

        // Clave de idempotencia (solo deudas de espacio)
        // Formato: "{userId}:{spaceId}:{counterpartyParticipantId}:{currency}"
        spaceDebtKey: { type: String },

        notes: { type: String, trim: true, maxlength: 500 },
        metadata: {
            type: {
                sourceEntryIds: [{ type: String }],
                sourceSettlementIds: [{ type: String }],
                syncSnapshot: {
                    debtMode: { type: String, enum: Object.values(DEBT_ORIGIN_MODES) },
                    calculatedAt: { type: String },
                },
            },
        },
    },
    { timestamps: true }
)

DebtSchema.index({ userId: 1, status: 1, direction: 1, createdAt: -1 })
DebtSchema.index({ userId: 1, spaceId: 1, status: 1 })
DebtSchema.index({ spaceDebtKey: 1 }, { unique: true, sparse: true })

export const Debt =
    (mongoose.models.Debt as mongoose.Model<IDebt> | undefined) ||
    mongoose.model<IDebt>('Debt', DebtSchema)
