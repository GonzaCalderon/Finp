import type { Types } from 'mongoose'
import type {
    SpaceCurrency,
    SpaceActivityEntityType,
    SpaceActivityEventType,
    SpaceDebtMode,
    SpaceEntryStatus,
    SpaceEntryV2Status,
    SpaceEntryType,
    SpaceInviteStatus,
    SpaceInviteType,
    SpaceMode,
    SpacePersonalCategoryStrategy,
    SpaceParticipantKind,
    SpaceParticipantRole,
    SpacePersonalImpactKind,
    SpacePersonalImpactStatus,
    SpacePersonalImpactSourceType,
    SpacePersonalPendingActionType,
    SpaceOperationStatus,
    SpaceOperationType,
    SpaceSplitMode,
    SpaceStatus,
    SpaceType,
} from '@/lib/constants'
import type { ConversionSnapshot, MoneyDto } from '@/lib/utils/money'

export type SpaceCurrencyTotals = Record<string, number>
export type SpaceCategoryType = 'expense' | 'income' | 'adjustment'

export interface ISpaceCategory {
    _id?: Types.ObjectId
    spaceId: Types.ObjectId
    name: string
    color: string
    type: SpaceCategoryType
    isDefault: boolean
    isArchived: boolean
    createdAt?: Date
    updatedAt?: Date
}

export interface ISpaceCategorySnapshot {
    _id?: Types.ObjectId
    name?: string
    color?: string
    type?: SpaceCategoryType
    isArchived?: boolean
}

export interface ISpace {
    _id: Types.ObjectId
    ownerUserId: Types.ObjectId
    name: string
    description?: string
    type: SpaceType
    mode: SpaceMode
    status: SpaceStatus
    startDate?: Date
    endDate?: Date
    closedAt?: Date
    archivedFromStatus?: Exclude<SpaceStatus, 'archived'>
    currencies: SpaceCurrency[]
    reportingCurrency: SpaceCurrency
    defaultSplitMode: SpaceSplitMode
    simplifyDebts?: boolean | null
    debtMode?: SpaceDebtMode
    contractVersion?: 2
    timezone?: string
    revision?: number
    createdAt: Date
    updatedAt: Date
}

export interface ISpaceParticipant {
    _id: Types.ObjectId
    spaceId: Types.ObjectId
    kind: SpaceParticipantKind
    userId?: Types.ObjectId
    displayName: string
    email?: string
    role: SpaceParticipantRole
    inviteStatus: SpaceInviteStatus
    isActive: boolean
    personalSettings?: {
        categoryStrategy: SpacePersonalCategoryStrategy
        defaultPersonalCategoryId?: Types.ObjectId
        categoryMappings?: Array<{
            spaceCategoryId: Types.ObjectId
            personalCategoryId: Types.ObjectId
        }>
        updatedAt?: Date
    }
    revision?: number
    createdAt: Date
    updatedAt: Date
}

export interface ISpaceEntryAttachment {
    _id?: Types.ObjectId
    entryId?: Types.ObjectId
    uploadedByUserId: Types.ObjectId
    fileName: string
    mimeType: string
    size: number
    storageProvider: 'vercel_blob'
    storageKey: string
    createdAt: Date
}

export interface ISpaceEntrySplitAllocation {
    participantId: Types.ObjectId
    percentage?: number
    amount?: number
}

export interface ISpaceEntrySnapshot {
    snapshotAt: Date
    editedByUserId: Types.ObjectId
    title: string
    description?: string
    amount: number
    currency: string
    reportingAmount: number
    exchangeRate?: number
    originalMoney?: MoneyDto
    reportingMoney?: MoneyDto
    conversionSnapshot?: ConversionSnapshot
    date: Date
    dateKey?: string
    timezone?: string
    spaceCategoryId?: Types.ObjectId
    paidByParticipantId?: Types.ObjectId
    sharedWithParticipantIds?: Types.ObjectId[]
    splitMode: string
    splitAllocations?: ISpaceEntrySplitAllocation[]
    notes?: string
}

export interface ISpaceSettlementApplication {
    debtId?: Types.ObjectId
    debtCurrency: string
    paidMoney: MoneyDto
    appliedMoney: MoneyDto
    conversionSnapshot?: ConversionSnapshot
}

export interface ISpaceSettlementLeg {
    legId: string
    paidMoney: MoneyDto
    reportingMoney: MoneyDto
    accountId?: Types.ObjectId
    linkedTransactionId?: Types.ObjectId
    conversionSnapshot?: ConversionSnapshot
    applications: ISpaceSettlementApplication[]
}

export interface ISpaceEntry {
    _id: Types.ObjectId
    spaceId: Types.ObjectId
    createdByUserId: Types.ObjectId
    createdByParticipantId?: Types.ObjectId
    type: SpaceEntryType
    status: SpaceEntryStatus | SpaceEntryV2Status
    contractVersion?: 2
    title: string
    description?: string
    amount: number
    currency: SpaceCurrency
    reportingAmount: number
    exchangeRate?: number
    originalMoney?: MoneyDto
    reportingMoney?: MoneyDto
    conversionSnapshot?: ConversionSnapshot
    settlementLegs?: ISpaceSettlementLeg[]
    date: Date
    dateKey?: string
    timezone?: string
    categoryId?: Types.ObjectId | { _id?: Types.ObjectId; name?: string; color?: string; type?: string }
    spaceCategoryId?: Types.ObjectId | ISpaceCategorySnapshot
    paidByParticipantId?: Types.ObjectId
    sharedWithParticipantIds?: Types.ObjectId[]
    splitMode: SpaceSplitMode
    splitAllocations?: ISpaceEntrySplitAllocation[]
    resolvedShares?: Array<{
        participantId: string
        amount: number
        reportingAmount: number
        amountMoney?: MoneyDto
        reportingMoney?: MoneyDto
    }>
    notes?: string
    linkedTransactionId?: Types.ObjectId
    confirmationRequired?: boolean
    confirmedByUserId?: Types.ObjectId
    confirmedAt?: Date
    rejectedAt?: Date
    attachments?: ISpaceEntryAttachment[]
    // Anulación lógica
    isVoided?: boolean
    voidedAt?: Date
    voidedByUserId?: Types.ObjectId
    voidReason?: string
    // Edición con historial
    editedAt?: Date
    editedByUserId?: Types.ObjectId
    editCount?: number
    previousVersions?: ISpaceEntrySnapshot[]
    revision?: number
    operationId?: Types.ObjectId
    createdAt: Date
    updatedAt: Date
}

export interface ISpaceEntryPersonalImpact {
    _id: Types.ObjectId
    spaceId: Types.ObjectId
    entryId: Types.ObjectId
    userId: Types.ObjectId
    participantId: Types.ObjectId
    transactionId?: Types.ObjectId
    accountId?: Types.ObjectId
    categoryId?: Types.ObjectId
    impactKind: SpacePersonalImpactKind
    amount: number
    amountMoney?: MoneyDto
    financialLinks?: Array<{
        legId: string
        currency: string
        amountMoney: MoneyDto
        accountId?: Types.ObjectId
        transactionId?: Types.ObjectId
        status: 'pending' | 'linked' | 'ignored' | 'removed'
    }>
    contractVersion?: 2
    ownShareAmount?: number
    currency: SpaceCurrency
    status: SpacePersonalImpactStatus
    // Campos de pendiente accionable (Fase 6F.1)
    actionType?: SpacePersonalPendingActionType
    sourceType?: SpacePersonalImpactSourceType
    actorUserId?: Types.ObjectId
    counterpartyParticipantId?: Types.ObjectId
    counterpartyNameSnapshot?: string
    debtId?: Types.ObjectId
    debtMovementId?: Types.ObjectId
    accountImpactAmount?: number
    operationalAmount?: number
    originSnapshot?: {
        entryRevision: number
        entryStatus: 'recorded' | 'voided'
        payerParticipantId?: Types.ObjectId
        amount: number
        reportingAmount: number
        currency: string
        reportingCurrency: string
        exchangeRate?: number
        dateKey: string
        timezone: string
    }
    revision?: number
    operationId?: Types.ObjectId
    resolvedAt?: Date
    ignoredAt?: Date
    removedAt?: Date
    // Campos de revisión (Fase 6F.4)
    reviewReason?: 'entry_voided' | 'entry_edited'
    reviewRequestedAt?: Date
    reviewChangedFields?: string[]
    reviewedAt?: Date
    reviewedResolution?: 'kept' | 'removed'
    createdAt: Date
    updatedAt: Date
}

export interface ISpaceEntryPersonalImpactByEntry {
    linkedImpact?: ISpaceEntryPersonalImpact
    pendingActions: ISpaceEntryPersonalImpact[]
    reviewImpact?: ISpaceEntryPersonalImpact
}

export interface ISpaceActivityEvent {
    _id: Types.ObjectId
    spaceId: Types.ObjectId
    actorUserId?: Types.ObjectId
    actorParticipantId?: Types.ObjectId
    type: SpaceActivityEventType
    entityType: SpaceActivityEntityType
    entityId?: Types.ObjectId
    title: string
    description?: string
    metadata?: Record<string, unknown>
    operationId?: Types.ObjectId
    visibleToUserIds: Types.ObjectId[]
    readByUserIds: Types.ObjectId[]
    createdAt: Date
}

export interface ISpaceOperation {
    _id: Types.ObjectId
    contractVersion: 2
    spaceId: Types.ObjectId
    actorUserId: Types.ObjectId
    type: SpaceOperationType
    idempotencyKeyHash: string
    payloadHash: string
    status: SpaceOperationStatus
    resultRefs?: {
        spaceEntryId?: Types.ObjectId
        personalImpactId?: Types.ObjectId
        transactionId?: Types.ObjectId
        debtId?: Types.ObjectId
        debtMovementId?: Types.ObjectId
        pendingActionIds?: Types.ObjectId[]
        debtIds?: Types.ObjectId[]
        debtMovementIds?: Types.ObjectId[]
        activityEventIds?: Types.ObjectId[]
    }
    committedAt?: Date
    createdAt: Date
    updatedAt: Date
}

export interface ISpaceInvite {
    _id: Types.ObjectId
    spaceId: Types.ObjectId
    inviteType?: SpaceInviteType
    participantId?: Types.ObjectId
    senderUserId?: Types.ObjectId
    recipientUserId?: Types.ObjectId
    createdByUserId?: Types.ObjectId
    tokenHash?: string
    tokenPreview?: string
    inviteUrl?: string
    status: SpaceInviteStatus
    defaultRole?: SpaceParticipantRole
    expiresAt?: Date
    usedCount?: number
    lastUsedAt?: Date
    revokedAt?: Date
    revokedByUserId?: Types.ObjectId
    message?: string
    respondedAt?: Date
    createdAt: Date
    updatedAt: Date
}

export interface SpaceCategoryBreakdownItem {
    categoryId?: string
    label: string
    color?: string
    amount: number
    percentage: number
}

export interface SpaceBalanceItem {
    participantId: string
    displayName: string
    kind: SpaceParticipantKind
    role: SpaceParticipantRole
    inviteStatus: SpaceInviteStatus
    paidReporting: number
    shareReporting: number
    balanceReporting: number
    userId?: string
}

export interface SpaceTrendPoint {
    month: string
    label: string
    amount: number
}

export interface SpaceSummarySnapshot {
    totalByCurrency: SpaceCurrencyTotals
    totalReporting: number
    yourShareReporting: number
    yourBalanceReporting: number
    pendingToPayReporting: number
    pendingToCollectReporting: number
    participantCount: number
    pendingEntryCount: number
    totalEntryCount: number
    categoryBreakdown: SpaceCategoryBreakdownItem[]
    balances: SpaceBalanceItem[]
    monthlyTrend: SpaceTrendPoint[]
    totalReportingMoney?: MoneyDto
    includedCurrencies?: string[]
    composition?: Array<{
        currency: string
        original: MoneyDto
        historicalReporting: MoneyDto
        currentReporting?: MoneyDto
        difference?: MoneyDto
        snapshots: ConversionSnapshot[]
        currentSnapshot?: ConversionSnapshot
    }>
    balancesByCurrency?: Array<{
        participantId: string
        currency: string
        paid: MoneyDto
        share: MoneyDto
        balance: MoneyDto
        currentReporting?: MoneyDto
        currentSnapshot?: ConversionSnapshot
    }>
}

export interface ISpaceListItem {
    space: ISpace
    participants: ISpaceParticipant[]
    summary: SpaceSummarySnapshot
    recentEntries: ISpaceEntry[]
}

export interface ISpacePendingInvite {
    kind: 'invite'
    space: ISpace
    participant: ISpaceParticipant
    invite: ISpaceInvite
    invitedByName: string
}

export interface ISpacePendingConfirmation {
    kind: 'confirmation'
    space: ISpace
    entry: ISpaceEntry
    requestedByParticipant?: ISpaceParticipant
    paidByParticipant?: ISpaceParticipant
}

export type ISpacePendingAction = ISpacePendingInvite | ISpacePendingConfirmation

export interface ISpaceDetailPayload {
    space: ISpace
    participants: ISpaceParticipant[]
    entries: ISpaceEntry[]
    personalImpactsByEntryId: Record<string, ISpaceEntryPersonalImpactByEntry>
    summary: SpaceSummarySnapshot
    pendingActions: ISpacePendingAction[]
    currentUserId: string
}
