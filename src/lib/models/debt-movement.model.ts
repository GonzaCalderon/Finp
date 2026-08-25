import mongoose, { Schema } from 'mongoose'
import type { IDebtMovement } from '@/types/debt'
import { DEBT_MOVEMENT_TYPES } from '@/lib/constants'
import { conversionSnapshotSchema, moneySchema } from '@/lib/models/space-money.schemas'

const DebtMovementSchema = new Schema<IDebtMovement>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        debtId: { type: Schema.Types.ObjectId, ref: 'Debt', required: true },
        type: { type: String, enum: Object.values(DEBT_MOVEMENT_TYPES), required: true },

        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true, trim: true },
        paymentMoney: { type: moneySchema },
        appliedMoney: { type: moneySchema },
        conversionSnapshot: { type: conversionSnapshotSchema },

        // Registros relacionados
        accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space' },
        spaceEntryId: { type: Schema.Types.ObjectId, ref: 'SpaceEntry' },
        spaceOperationId: { type: Schema.Types.ObjectId, ref: 'SpaceOperation' },
        balanceBefore: { type: Number, min: 0 },
        balanceAfter: { type: Number, min: 0 },

        date: { type: Date, required: true },
        notes: { type: String, trim: true, maxlength: 500 },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
)

DebtMovementSchema.index({ userId: 1, debtId: 1, createdAt: -1 })
DebtMovementSchema.index({ transactionId: 1 }, { sparse: true })

const existingDebtMovementModel = mongoose.models.DebtMovement as
    | mongoose.Model<IDebtMovement>
    | undefined
const needsDebtMovementSchemaRefresh = Boolean(
    existingDebtMovementModel &&
    (!existingDebtMovementModel.schema.path('spaceOperationId') ||
        !existingDebtMovementModel.schema.path('balanceBefore') ||
        !existingDebtMovementModel.schema.path('balanceAfter') ||
        !existingDebtMovementModel.schema.path('paymentMoney'))
)

if (needsDebtMovementSchemaRefresh) delete mongoose.models.DebtMovement

export const DebtMovement =
    (needsDebtMovementSchemaRefresh ? undefined : existingDebtMovementModel) ||
    mongoose.model<IDebtMovement>('DebtMovement', DebtMovementSchema)
