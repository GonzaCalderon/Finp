import type { Types } from 'mongoose'
import type {
    AccountType,
    ApplyMode,
    CategoryType,
    CreatedFrom,
    Currency,
    ImportBatchStatus,
    ImportRowStatus,
    ImportSourceType,
    RecurrenceType,
    RuleAppliesTo,
    RuleCondition,
    RuleField,
    TransactionStatus,
    TransactionType,
} from '@/lib/constants'

export interface UserPreferences {
    defaultView: 'dashboard' | 'transactions' | 'accounts' | 'projection'
    monthStartDay: number // 1-28
    defaultAccountId?: string // ObjectId as string
}

export interface IUser {
    _id: Types.ObjectId
    email: string
    passwordHash: string
    displayName: string
    baseCurrency: Currency
    timezone: string
    preferences: UserPreferences
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
    appliedRuleId?: Types.ObjectId
    appliedRuleNameSnapshot?: string
    importBatchId?: Types.ObjectId
    importedAt?: Date
    importSourceType?: ImportSourceType
    createdAt: Date
    updatedAt: Date
}

export interface ImportParsedData {
    date?: Date
    type?: string
    description?: string
    amount?: number
    currency?: string
    categoryId?: string
    categoryName?: string
    sourceAccountId?: string
    destinationAccountId?: string
    accountName?: string
    paymentMethod?: string
    cardName?: string
    installmentCount?: number
    installmentNumber?: number
    notes?: string
    ignored?: boolean
}

export interface IImportBatch {
    _id: Types.ObjectId
    userId: Types.ObjectId
    fileName: string
    sourceType: ImportSourceType
    status: ImportBatchStatus
    summary: {
        total: number
        valid: number
        invalid: number
        incomplete: number
        possibleDuplicate: number
        ignored: number
        imported: number
    }
    createdAt: Date
    confirmedAt?: Date
    revertedAt?: Date
    updatedAt: Date
}

export interface IImportRow {
    _id: Types.ObjectId
    batchId: Types.ObjectId
    rowNumber: number
    rawData: Record<string, string>
    parsedData: ImportParsedData
    reviewedData?: ImportParsedData
    status: ImportRowStatus
    warnings: string[]
    errors: string[]
    possibleDuplicateId?: Types.ObjectId
    createdTransactionId?: Types.ObjectId
    ignored: boolean
}

export interface ITransactionRule {
    _id: Types.ObjectId
    userId: Types.ObjectId
    name: string
    isActive: boolean
    priority: number
    appliesTo: RuleAppliesTo
    field: RuleField
    condition: RuleCondition
    value: string
    // Actions
    categoryId?: Types.ObjectId
    setType?: 'expense' | 'income'
    normalizeMerchant?: string
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