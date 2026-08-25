import mongoose, { Schema } from 'mongoose'

import {
    SPACE_OPERATION_STATUSES,
    SPACE_OPERATION_TYPES,
} from '@/lib/constants'
import type { ISpaceOperation } from '@/types'

const resultRefsSchema = new Schema(
    {
        spaceEntryId: { type: Schema.Types.ObjectId, ref: 'SpaceEntry' },
        personalImpactId: { type: Schema.Types.ObjectId, ref: 'SpaceEntryPersonalImpact' },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        debtId: { type: Schema.Types.ObjectId, ref: 'Debt' },
        debtMovementId: { type: Schema.Types.ObjectId, ref: 'DebtMovement' },
        pendingActionIds: [{ type: Schema.Types.ObjectId, ref: 'SpaceEntryPersonalImpact' }],
        debtIds: [{ type: Schema.Types.ObjectId, ref: 'Debt' }],
        debtMovementIds: [{ type: Schema.Types.ObjectId, ref: 'DebtMovement' }],
        activityEventIds: [{ type: Schema.Types.ObjectId, ref: 'SpaceActivityEvent' }],
    },
    { _id: false }
)

const SpaceOperationSchema = new Schema<ISpaceOperation>(
    {
        contractVersion: { type: Number, enum: [2], required: true, immutable: true },
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true, immutable: true },
        actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
        type: {
            type: String,
            enum: Object.values(SPACE_OPERATION_TYPES),
            required: true,
            immutable: true,
        },
        idempotencyKeyHash: { type: String, required: true, immutable: true },
        payloadHash: { type: String, required: true, immutable: true },
        status: {
            type: String,
            enum: Object.values(SPACE_OPERATION_STATUSES),
            required: true,
            default: SPACE_OPERATION_STATUSES.PENDING,
        },
        resultRefs: { type: resultRefsSchema },
        committedAt: { type: Date },
    },
    {
        timestamps: true,
        // Los índices v2 se despliegan sólo mediante el comando protegido. Esto
        // evita que Mongoose los aplique por accidente en development.
        autoIndex: false,
    }
)

export const SpaceOperation =
    (mongoose.models.SpaceOperation as mongoose.Model<ISpaceOperation> | undefined) ||
    mongoose.model<ISpaceOperation>('SpaceOperation', SpaceOperationSchema)
