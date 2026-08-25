import type {
    SpaceDebtMode,
    SpaceEntryType,
    SpaceInviteStatus,
    SpaceMode,
    SpaceParticipantKind,
    SpaceParticipantRole,
    SpacePersonalImpactStatus,
    SpaceSplitMode,
    SpaceStatus,
    SpaceType,
} from '@/lib/constants'
import type { ConversionSnapshot, MoneyDto } from '@/lib/utils/money'

export type SpaceApiCapability =
    | 'view'
    | 'create_entry'
    | 'edit_own_entry'
    | 'edit_any_entry'
    | 'void_own_entry'
    | 'void_any_entry'
    | 'settle_balance'
    | 'resolve_personal_impact'
    | 'manage_shared_settings'
    | 'manage_invites'
    | 'manage_participants'
    | 'change_roles'
    | 'transfer_ownership'
    | 'pause_space'
    | 'close_space'
    | 'reopen_space'
    | 'archive_space'
    | 'restore_space'
    | 'act_for_participant'

export type SpaceReadMode = 'full' | 'legacy_read_only' | 'legacy_incompatible'

export interface SpaceParticipantDto {
    id: string
    kind: SpaceParticipantKind
    userId?: string
    displayName: string
    role: SpaceParticipantRole
    inviteStatus: string
    isActive: boolean
    revision: number
}

export interface SpaceShareDto {
    participantId: string
    amount: number
    reportingAmount: number
    amountMoney?: MoneyDto
    reportingMoney?: MoneyDto
}

export interface SpacePersonalImpactDto {
    id: string
    entryId: string
    participantId: string
    transactionId?: string
    accountId?: string
    categoryId?: string
    kind: 'personal_expense' | 'advance' | 'settlement_paid' | 'settlement_received'
    status: SpacePersonalImpactStatus
    currency: string
    ownShareAmount: number
    accountImpactAmount: number
    operationalAmount: number
    recoverableAdvanceAmount: number
    primaryAction: 'create_transaction' | 'link_existing' | 'review' | 'remove_transaction' | 'none'
    revision: number
    updatedAt: string
}

export interface SpaceEntryDto {
    id: string
    type: SpaceEntryType
    status: 'recorded' | 'voided'
    title: string
    description?: string
    amount: number
    currency: string
    reportingAmount: number
    reportingCurrency: string
    exchangeRate?: number
    originalMoney?: MoneyDto
    reportingMoney?: MoneyDto
    conversionSnapshot?: ConversionSnapshot
    settlementLegs?: SpaceSettlementLegDto[]
    dateKey: string
    timezone: string
    paidByParticipantId?: string
    sharedWithParticipantIds: string[]
    splitMode: SpaceSplitMode
    splitAllocations: Array<{ participantId: string; percentage?: number; amount?: number }>
    shares: SpaceShareDto[]
    currentUserImpact?: SpacePersonalImpactDto
    capabilities: Array<'edit' | 'void'>
    revision: number
    createdAt: string
    updatedAt: string
}

export interface SpaceMovementPageDto {
    items: SpaceEntryDto[]
    nextCursor: string | null
    limit: number
    filter?: {
        originalCurrencies: string[]
        paidCurrencies: string[]
        debtCurrencies: string[]
    }
    subtotalByCurrency?: Record<string, MoneyDto>
}

export interface SpaceSummaryDto {
    totalByCurrency: Record<string, number>
    totalReporting: number
    yourShareReporting: number
    yourBalanceReporting: number
    pendingToPayReporting: number
    pendingToCollectReporting: number
    participantCount: number
    pendingEntryCount: number
    totalEntryCount: number
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
    balances: Array<{
        participantId: string
        displayName: string
        kind: SpaceParticipantKind
        role: SpaceParticipantRole
        inviteStatus: SpaceInviteStatus
        userId?: string
        paidReporting: number
        shareReporting: number
        balanceReporting: number
    }>
    categoryBreakdown: Array<{ categoryId?: string; label: string; color?: string; amount: number; percentage: number }>
    monthlyTrend: Array<{ month: string; label: string; amount: number }>
}

export interface SpaceDetailDto {
    contractVersion: 2
    sourceContract: 'legacy' | 'v2'
    readMode: SpaceReadMode
    readOnlyReason?: string
    warnings: Array<{ code: string; recordType: string; recordId?: string }>
    currentUserId: string
    currentParticipantId: string
    capabilities: SpaceApiCapability[]
    space: {
        id: string
        ownerUserId: string
        name: string
        description?: string
        type: SpaceType
        mode: SpaceMode
        status: SpaceStatus
        startDate?: string
        endDate?: string
        currencies: string[]
        reportingCurrency: string
        defaultSplitMode: SpaceSplitMode
        debtMode: SpaceDebtMode
        simplifyDebts?: boolean | null
        timezone: string
        revision: number
        currencyPolicy?: {
            reportingCurrencyLocked: boolean
            usedCurrencies: string[]
        }
        createdAt: string
        updatedAt: string
    }
    participants: SpaceParticipantDto[]
    movements: SpaceMovementPageDto
    summary: SpaceSummaryDto | null
}

export interface SpaceMutationOperationDto {
    id: string
    replayed: boolean
    writeState: 'committed'
    presentation: {
        state: 'not_needed' | 'reconciled' | 'retry_required'
        retryable: boolean
    }
}

export interface SpaceMutationResultDto<T> {
    data: T
    operation: SpaceMutationOperationDto
}

export type SpaceMutationFailureState =
    | 'not_started'
    | 'rolled_back'
    | 'conflict'
    | 'committed_presentation_pending'

export interface SpaceApiErrorDto {
    error: string
    code: string
    failureState: SpaceMutationFailureState
    retryable: boolean
    details?: unknown
}

export interface SpaceEntryPreviewDto {
    currency: string
    reportingCurrency: string
    totalAmount: number
    reportingAmount: number
    ownShareAmount: number
    accountImpactAmount: number
    operationalAmount: number
    recoverableAdvanceAmount: number
    debtDeltaReporting: number
    personalAction: 'optional' | 'account_required' | 'not_applicable'
    originalMoney?: MoneyDto
    reportingMoney?: MoneyDto
    conversionSnapshot?: ConversionSnapshot
    linkExisting?: {
        transactionId: string
        compatible: boolean
        issues: Array<'currency_mismatch' | 'amount_mismatch' | 'transaction_not_found'>
    }
}

export interface SpaceSettlementPreviewDto {
    currency: string
    reportingCurrency: string
    amount: number
    reportingAmount: number
    payerParticipantId: string
    receiverParticipantId: string
    actorMovesPersonalAccount: boolean
    actorAccountImpactAmount: number
    actorOperationalAmount: 0
    remainingBalanceReporting?: number
    components?: SpaceSettlementComponentDto[]
    legs?: SpaceSettlementLegDto[]
    applications?: SpaceSettlementApplicationDto[]
    remainingByCurrency?: MoneyDto[]
}

export interface SpaceSettlementComponentDto {
    debtId?: string
    currency: string
    amount: MoneyDto
    order: number
}

export interface SpaceSettlementLegDto {
    id: string
    paid: MoneyDto
    reporting: MoneyDto
    accountId?: string
    linkedTransactionId?: string
    conversionSnapshots: ConversionSnapshot[]
    applications: SpaceSettlementApplicationDto[]
}

export interface SpaceSettlementApplicationDto {
    legId: string
    debtId?: string
    debtCurrency: string
    paid: MoneyDto
    applied: MoneyDto
    conversionSnapshot?: ConversionSnapshot
}

export interface SpaceQuoteDto {
    fingerprint: string
    sourceCurrency: string
    targetCurrency: string
    rate: string
    direction: 'multiply'
    source: 'dolarapi_official' | 'frankfurter' | 'manual' | 'identity'
    status: 'current' | 'stale' | 'unavailable'
    observedAt: string
    capturedAt: string
    expiresAt?: string
    path: ConversionSnapshot['path']
}

export interface SpaceQuotesDto {
    reportingCurrency: string
    fetchedAt: string
    quotes: SpaceQuoteDto[]
}

export interface SpaceDebtDto {
    id: string
    direction: 'payable' | 'receivable'
    counterpartyParticipantId: string
    counterpartyName: string
    amount: number
    remainingAmount: number
    currency: string
    status: 'active' | 'partially_paid' | 'paid' | 'ignored' | 'cancelled'
    contractVersion: 2
    spaceRevision: number
    amountMoney?: MoneyDto
    remainingMoney?: MoneyDto
}
