import type { Types } from 'mongoose'
import type {
    SpaceCurrency,
    SpaceActivityEntityType,
    SpaceActivityEventType,
    SpaceDebtMode,
    SpaceEntryStatus,
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
    SpaceSplitMode,
    SpaceStatus,
    SpaceType,
} from '@/lib/constants'

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
    currencies: SpaceCurrency[]
    reportingCurrency: SpaceCurrency
    defaultSplitMode: SpaceSplitMode
    simplifyDebts?: boolean | null
    debtMode?: SpaceDebtMode
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
    date: Date
    spaceCategoryId?: Types.ObjectId
    paidByParticipantId?: Types.ObjectId
    sharedWithParticipantIds?: Types.ObjectId[]
    splitMode: string
    splitAllocations?: ISpaceEntrySplitAllocation[]
    notes?: string
}

export interface ISpaceEntry {
    _id: Types.ObjectId
    spaceId: Types.ObjectId
    createdByUserId: Types.ObjectId
    createdByParticipantId?: Types.ObjectId
    type: SpaceEntryType
    status: SpaceEntryStatus
    title: string
    description?: string
    amount: number
    currency: SpaceCurrency
    reportingAmount: number
    exchangeRate?: number
    date: Date
    categoryId?: Types.ObjectId | { _id?: Types.ObjectId; name?: string; color?: string; type?: string }
    spaceCategoryId?: Types.ObjectId | ISpaceCategorySnapshot
    paidByParticipantId?: Types.ObjectId
    sharedWithParticipantIds?: Types.ObjectId[]
    splitMode: SpaceSplitMode
    splitAllocations?: ISpaceEntrySplitAllocation[]
    notes?: string
    linkedTransactionId?: Types.ObjectId
    confirmationRequired: boolean
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
    visibleToUserIds: Types.ObjectId[]
    readByUserIds: Types.ObjectId[]
    createdAt: Date
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
