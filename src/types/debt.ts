import type { Types } from 'mongoose'
import type {
    DebtDirection,
    DebtMovementType,
    DebtOriginMode,
    DebtSourceType,
    DebtStatus,
} from '@/lib/constants'

export interface IDebtMetadata {
    sourceEntryIds?: string[]
    sourceSettlementIds?: string[]
    syncSnapshot?: {
        debtMode: 'direct' | 'simplified'
        calculatedAt: string
    }
    balanceSnapshot?: {
        operationId: string
        spaceRevision: number
        calculatedAt: string
    }
}

export interface IDebt {
    _id: Types.ObjectId
    userId: Types.ObjectId
    direction: DebtDirection
    sourceType: DebtSourceType

    // Solo para deudas derivadas de Espacios
    spaceId?: Types.ObjectId
    counterpartyParticipantId?: Types.ObjectId

    // Contraparte
    counterpartyUserId?: Types.ObjectId
    counterpartyNameSnapshot: string

    // Financiero
    amount: number
    remainingAmount: number
    currency: string

    // Estado
    status: DebtStatus
    originMode?: DebtOriginMode

    // Clave de idempotencia (solo deudas de espacio)
    // Formato: "{userId}:{spaceId}:{counterpartyParticipantId}:{currency}"
    spaceDebtKey?: string
    contractVersion?: 2
    spaceOperationId?: Types.ObjectId

    notes?: string
    metadata?: IDebtMetadata

    createdAt: Date
    updatedAt: Date
}

export interface IDebtMovement {
    _id: Types.ObjectId
    userId: Types.ObjectId
    debtId: Types.ObjectId
    type: DebtMovementType

    amount: number
    currency: string

    // Registros relacionados
    accountId?: Types.ObjectId
    transactionId?: Types.ObjectId
    spaceId?: Types.ObjectId
    spaceEntryId?: Types.ObjectId
    spaceOperationId?: Types.ObjectId
    balanceBefore?: number
    balanceAfter?: number

    date: Date
    notes?: string

    createdAt: Date
}
