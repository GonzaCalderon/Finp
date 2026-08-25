import type { Types } from 'mongoose'
import type { ProjectionGrouping, ProjectionMode } from './projection'
import type {
    AccountType,
    ApplyMode,
    CategoryType,
    CommitmentAmountPolicy,
    CommitmentAmountSource,
    CommitmentApplicationOrigin,
    CommitmentApplicationStatus,
    CommitmentEstimationMode,
    CommitmentLifecycleStatus,
    CommitmentReminderState,
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

export type {
    QuickCaptureAliasDto,
    QuickCaptureAliasTargetType,
    QuickCaptureAppliedPersonalization,
    QuickCaptureContextResponse,
    QuickCaptureDraft,
    QuickCaptureCommitmentDto,
    QuickCaptureFrequent,
    QuickCaptureInterpretation,
    QuickCaptureLearnedPatternDto,
    QuickCaptureLearningContext,
    QuickCaptureLearningEventInput,
    QuickCaptureLearningEventType,
    QuickCaptureLearningMethod,
    QuickCaptureLearningMetrics,
    QuickCaptureLearningProfileDto,
    QuickCapturePatternTriggerKind,
    QuickCaptureSuggestion,
    QuickCaptureSuggestionSource,
    QuickCaptureToken,
    TransactionAccountImpact,
    TransactionPreviewIssue,
    TransactionPreviewResponse,
} from './quick-capture'

export interface UserPreferences {
    defaultView: 'dashboard' | 'transactions' | 'accounts' | 'projection'
    monthStartDay: number // 1-28
    defaultAccountId?: string // ObjectId as string
    consolidatedCurrency?: Currency
    referenceArsPerUsdRate?: number
    operationalStartDate?: string
    projectionGrouping?: ProjectionGrouping
    projectionMode?: ProjectionMode
    projectionMonths?: number
    projectionChartCurrency?: Currency
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
    supportedCurrencies?: Currency[]
    defaultPaymentMethods?: Array<'cash' | 'debit' | 'credit_card'>
    institution?: string
    description?: string
    color?: string
    isActive: boolean
    includeInNetWorth: boolean
    initialBalance?: number
    initialBalances?: Partial<Record<Currency, number>>
    balancesByCurrency?: Partial<Record<Currency, number>>
    balance?: number
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
    isVirtual?: boolean
    hiddenFromSettings?: boolean
    sourceType?: 'space'
    sourceSpaceId?: Types.ObjectId
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
    destinationAmount?: number
    destinationCurrency?: Currency
    exchangeRate?: number
    paymentGroupId?: string
    notes?: string
    tags?: string[]
    merchant?: string
    status?: TransactionStatus
    installmentPlanId?: Types.ObjectId
    createdFrom: CreatedFrom
    appliedRuleId?: Types.ObjectId
    appliedRuleNameSnapshot?: string
    appliedRuleMatchSnapshot?: {
        field: RuleField
        condition: RuleCondition
        value: string
        normalizedFieldValue: string
        normalizedRuleValue: string
    }
    appliedRuleActions?: {
        categoryId?: Types.ObjectId
        setType?: 'expense' | 'income'
        normalizeMerchant?: string
    }
    importBatchId?: Types.ObjectId
    importedAt?: Date
    importSourceType?: ImportSourceType
    spaceId?: Types.ObjectId
    spaceEntryId?: Types.ObjectId
    spaceImpactId?: Types.ObjectId
    spaceOperationId?: Types.ObjectId
    spaceContractVersion?: 2
    spaceNameSnapshot?: string
    /**
     * For space payer transactions: the portion of the amount that counts for
     * personal reporting (their own share, not the full payment they advanced).
     * Undefined for most transactions — falls back to `amount`.
     */
    operationalAmount?: number
    /**
     * Procedencia de compromiso. Se escribe al aplicar y permite mostrar
     * `Compromiso: Alquiler · julio 2026` sin resolver la relación inversa.
     * `commitmentNameSnapshot` sobrevive al borrado del compromiso.
     */
    commitmentId?: Types.ObjectId
    commitmentApplicationId?: Types.ObjectId
    commitmentPeriod?: string
    commitmentNameSnapshot?: string
    createdAt: Date
    updatedAt: Date
}

export interface ImportParsedData {
    date?: Date
    type?: string
    description?: string
    amount?: number
    currency?: string
    destinationAmount?: number
    destinationCurrency?: string
    exchangeRate?: number
    categoryId?: string
    categoryName?: string
    sourceAccountId?: string
    destinationAccountId?: string
    accountName?: string
    destinationAccountName?: string
    paymentMethod?: string
    cardName?: string
    installmentCount?: number
    installmentNumber?: number
    firstClosingMonth?: string
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
    matchCount?: number
    lastMatchedAt?: Date
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

/**
 * Un tramo de la agenda de montos: el importe vigente a partir de una fecha.
 * Cambiar el monto desde una fecha no reescribe las aplicaciones históricas.
 */
export interface ICommitmentAmountEntry {
    effectiveFrom: Date
    amount: number
    source: 'initial' | 'manual'
    note?: string
    createdAt: Date
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
    /** Días antes del vencimiento en que Finp empieza a recordarlo. */
    reminderLeadDays?: number
    amountPolicy: CommitmentAmountPolicy
    amountSchedule: ICommitmentAmountEntry[]
    estimationMode: CommitmentEstimationMode
    /** `normalizeRuleText(description)`, para el matching de Captura rápida. */
    normalizedDescription?: string
    /** Otras denominaciones conocidas, ya normalizadas. */
    aliases: string[]
    createdFrom: 'web' | 'quick_capture'
    appliedThisMonth?: boolean
    /** Resueltos por el servidor para el período actual; no se persisten. */
    resolvedAmount?: number
    amountSource?: CommitmentAmountSource
    amountCertainty?: 'confirmed' | 'calculated' | 'estimated' | 'pending_amount'
    resolvedAmountEffectiveFrom?: Date
    resolvedDueDate?: Date
    nextDueDate?: Date
    nextReminderDate?: Date
    occursThisPeriod?: boolean
    lifecycleStatus?: CommitmentLifecycleStatus
    reminderState?: CommitmentReminderState
    reminderDate?: Date
    currentApplication?: {
        _id: Types.ObjectId
        appliedAt: Date
        snapshot?: ICommitmentApplicationSnapshot
    }
}

/** Foto financiera de lo que se registró en un período concreto. */
export interface ICommitmentApplicationSnapshot {
    amount: number
    currency: Currency
    description: string
    categoryId?: Types.ObjectId
    accountId?: Types.ObjectId
    amountSource: CommitmentAmountSource
    dueDate?: Date
    computedAt: Date
}

export interface ICommitmentApplication {
    _id: Types.ObjectId
    userId: Types.ObjectId
    commitmentId: Types.ObjectId
    period: string
    transactionId?: Types.ObjectId
    appliedAt: Date
    appliedBy: 'manual' | 'system'
    status: CommitmentApplicationStatus
    snapshot?: ICommitmentApplicationSnapshot
    origin: CommitmentApplicationOrigin
    revertedAt?: Date
    revertedReason?: string
}

export * from './space'
export * from './space-api'
