import type { Types } from 'mongoose'
import type {
    AccountType,
    ApplyMode,
    CategoryType,
    CreatedFrom,
    Currency,
    RecurrenceType,
    TransactionStatus,
    TransactionType,
} from '@/lib/constants'

export interface IUser {
    _id: Types.ObjectId
    email: string
    passwordHash: string
    displayName: string
    baseCurrency: Currency
    timezone: string
    createdAt: Date
    updatedAt: Date
}

export interface IAccount {
    _id: Types.ObjectId
    userId: Types.ObjectId
    name: string
    type: AccountType
    currency: Currency
    institution?: string
    description?: string
    color?: string
    isActive: boolean
    includeInNetWorth: boolean
    initialBalance?: number
    creditCardConfig?: {
        closingDay: number
        dueDay: number
        creditLimit?: number
    }
    debtConfig?: {
        creditorName: string
        originalAmount: number
    }
    createdAt: Date
    updatedAt: Date
    allowNegativeBalance?: boolean
}

export interface ICategory {
    _id: Types.ObjectId
    userId: Types.ObjectId
    name: string
    type: CategoryType
    icon?: string
    color?: string
    isDefault: boolean
    isArchived: boolean
    sortOrder: number
    createdAt: Date
    updatedAt: Date
}

export interface ITransaction {
    _id: Types.ObjectId
    userId: Types.ObjectId
    type: TransactionType
    amount: number
    currency: Currency
    date: Date
    description: string
    categoryId?: Types.ObjectId
    sourceAccountId?: Types.ObjectId
    destinationAccountId?: Types.ObjectId
    notes?: string
    tags?: string[]
    merchant?: string
    status?: TransactionStatus
    installmentPlanId?: Types.ObjectId
    createdFrom: CreatedFrom
    createdAt: Date
    updatedAt: Date
}

export interface IInstallmentPlan {
    _id: Types.ObjectId
    userId: Types.ObjectId
    accountId: Types.ObjectId
    categoryId: Types.ObjectId
    description: string
    merchant?: string
    currency: Currency
    totalAmount: number
    installmentCount: number
    installmentAmount: number
    purchaseDate: Date
    firstClosingMonth: string
    createdAt: Date
    updatedAt: Date
}

export interface IScheduledCommitment {
    _id: Types.ObjectId
    userId: Types.ObjectId
    description: string
    amount: number
    currency: Currency
    categoryId?: Types.ObjectId
    accountId?: Types.ObjectId
    recurrence: RecurrenceType
    dayOfMonth?: number
    dueDate?: Date
    applyMode: ApplyMode
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    startDate: Date
    endDate?: Date
    appliedThisMonth?: boolean
}

export interface ICommitmentApplication {
    _id: Types.ObjectId
    userId: Types.ObjectId
    commitmentId: Types.ObjectId
    period: string
    transactionId?: Types.ObjectId
    appliedAt: Date
    appliedBy: 'manual' | 'system'
}