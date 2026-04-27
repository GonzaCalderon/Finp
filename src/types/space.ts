import type { Types } from 'mongoose'
import type {
    SpaceCurrency,
    SpaceEntryStatus,
    SpaceEntryType,
    SpaceInviteStatus,
    SpaceMode,
    SpaceParticipantKind,
    SpaceParticipantRole,
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
    createdAt: Date
    updatedAt: Date
}

export interface ISpaceInvite {
    _id: Types.ObjectId
    spaceId: Types.ObjectId
    participantId: Types.ObjectId
    senderUserId: Types.ObjectId
    recipientUserId: Types.ObjectId
    status: SpaceInviteStatus
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
    summary: SpaceSummarySnapshot
    pendingActions: ISpacePendingAction[]
    currentUserId: string
}
