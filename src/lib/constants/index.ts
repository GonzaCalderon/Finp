export const ACCOUNT_TYPES = {
    BANK: 'bank',
    CASH: 'cash',
    WALLET: 'wallet',
    CREDIT_CARD: 'credit_card',
    DEBT: 'debt',
    SAVINGS: 'savings',
} as const

export const TRANSACTION_TYPES = {
    INCOME: 'income',
    EXPENSE: 'expense',
    CREDIT_CARD_EXPENSE: 'credit_card_expense',
    TRANSFER: 'transfer',
    EXCHANGE: 'exchange',
    CREDIT_CARD_PAYMENT: 'credit_card_payment',
    DEBT_PAYMENT: 'debt_payment',           // kept for backwards compat — display as "Pago de tarjeta"
    ADJUSTMENT: 'adjustment',
    PERSONAL_DEBT_PAYMENT: 'personal_debt_payment', // pago de deuda personal: dinero sale de cuenta propia
    PERSONAL_DEBT_COLLECT: 'personal_debt_collect', // cobro de deuda personal: dinero entra a cuenta propia
} as const

export const CATEGORY_TYPES = {
    INCOME: 'income',
    EXPENSE: 'expense',
} as const

export const CURRENCIES = {
    ARS: 'ARS',
    USD: 'USD',
} as const

export const COMMON_CURRENCIES = ['ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU', 'GBP', 'JPY', 'CAD', 'CHF'] as const

export const RECURRENCE_TYPES = {
    MONTHLY: 'monthly',
    WEEKLY: 'weekly',
    ONCE: 'once',
} as const

export const APPLY_MODES = {
    MANUAL: 'manual',
    AUTO_MONTH_START: 'auto_month_start',
} as const

export const TRANSACTION_STATUS = {
    CONFIRMED: 'confirmed',
    PLANNED: 'planned',
} as const

export const CREATED_FROM = {
    WEB: 'web',
    TELEGRAM: 'telegram',
    SYSTEM: 'system',
} as const

export const RULE_APPLIES_TO = {
    EXPENSE: 'expense',
    INCOME: 'income',
    ANY: 'any',
} as const

export const RULE_FIELDS = {
    DESCRIPTION: 'description',
    MERCHANT: 'merchant',
} as const

export const RULE_CONDITIONS = {
    CONTAINS: 'contains',
    EQUALS: 'equals',
    STARTS_WITH: 'starts_with',
} as const

export const IMPORT_SOURCE_TYPES = {
    XLSX_TEMPLATE: 'xlsx_template',
} as const

export const IMPORT_BATCH_STATUS = {
    DRAFT: 'draft',
    CONFIRMED: 'confirmed',
    REVERTED: 'reverted',
} as const

export const IMPORT_ROW_STATUS = {
    OK: 'ok',
    INCOMPLETE: 'incomplete',
    INVALID: 'invalid',
    POSSIBLE_DUPLICATE: 'possible_duplicate',
    IGNORED: 'ignored',
    IMPORTED: 'imported',
} as const

export const SPACE_TYPES = {
    COUPLE: 'couple',
    HOME: 'home',
    TRAVEL: 'travel',
    PROJECT: 'project',
    EVENT: 'event',
    PERSONAL: 'personal',
    OTHER: 'other',
} as const

export const SPACE_MODES = {
    SOLO: 'solo',
    MANAGED: 'managed',
    SYNCHRONIZED: 'synchronized',
} as const

export const SPACE_STATUSES = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    CLOSED: 'closed',
    ARCHIVED: 'archived',
} as const

export const SPACE_PARTICIPANT_KINDS = {
    FINP_USER: 'finp_user',
    EXTERNAL: 'external',
} as const

export const SPACE_PARTICIPANT_ROLES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    PARTICIPANT: 'participant',
} as const

export const SPACE_INVITE_STATUSES = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
} as const

export const SPACE_ENTRY_TYPES = {
    EXPENSE: 'expense',
    INCOME: 'income',
    ADJUSTMENT: 'adjustment',
    SETTLEMENT: 'settlement',
} as const

export const SPACE_ENTRY_STATUSES = {
    RECORDED: 'recorded',
    PENDING_CONFIRMATION: 'pending_confirmation',
    CONFIRMED: 'confirmed',
    LINKED: 'linked',
    REJECTED: 'rejected',
} as const

export const SPACE_SPLIT_MODES = {
    NONE: 'none',
    EQUAL: 'equal',
    PERCENTAGE: 'percentage',
    FIXED: 'fixed',
} as const

export const SPACE_ACTIVITY_EVENT_TYPES = {
    ENTRY_CREATED: 'entry_created',
    ENTRY_EDITED: 'entry_edited',
    ENTRY_VOIDED: 'entry_voided',
    SETTLEMENT_CREATED: 'settlement_created',
    ATTACHMENT_UPLOADED: 'attachment_uploaded',
    ATTACHMENT_DELETED: 'attachment_deleted',
    CATEGORY_CREATED: 'category_created',
    CATEGORY_ARCHIVED: 'category_archived',
    CATEGORY_RESTORED: 'category_restored',
    PARTICIPANT_INVITED: 'participant_invited',
    PARTICIPANT_JOINED: 'participant_joined',
    PARTICIPANT_REMOVED: 'participant_removed',
    ROLE_CHANGED: 'role_changed',
    SPACE_UPDATED: 'space_updated',
} as const

export const SPACE_ACTIVITY_ENTITY_TYPES = {
    SPACE: 'space',
    ENTRY: 'entry',
    SETTLEMENT: 'settlement',
    ATTACHMENT: 'attachment',
    CATEGORY: 'category',
    PARTICIPANT: 'participant',
} as const

export const SPACE_PERSONAL_IMPACT_KINDS = {
    PAYER_FULL_AMOUNT: 'payer_full_amount',
    PARTICIPANT_SHARE: 'participant_share',
    SETTLEMENT_PAID: 'settlement_paid',
    SETTLEMENT_RECEIVED: 'settlement_received',
} as const

export const SPACE_PERSONAL_IMPACT_STATUSES = {
    LINKED: 'linked',
    UNLINKED: 'unlinked',
    NEEDS_REVIEW: 'needs_review',
    PENDING: 'pending',      // sin transacción, esperando decisión del usuario
    IGNORED: 'ignored',      // usuario decidió no registrar en su Finp
    REMOVED: 'removed',      // tenía linked, el usuario lo quitó
    CANCELLED: 'cancelled',  // sistema canceló (entry fue anulada)
} as const

export const SPACE_PERSONAL_PENDING_ACTION_TYPES = {
    IMPACT_SPACE_EXPENSE: 'impact_space_expense',
    IMPACT_SPACE_PAYMENT: 'impact_space_payment',
    IMPACT_SPACE_COLLECT: 'impact_space_collect',
} as const

export const SPACE_PERSONAL_IMPACT_SOURCE_TYPES = {
    SPACE_ENTRY: 'space_entry',
    DEBT_PAYMENT: 'debt_payment',
    DEBT_COLLECT: 'debt_collect',
} as const

export const DEBT_DIRECTIONS = {
    PAYABLE: 'payable',
    RECEIVABLE: 'receivable',
} as const

export const DEBT_SOURCE_TYPES = {
    MANUAL: 'manual',
    SPACE: 'space',
} as const

export const DEBT_STATUSES = {
    ACTIVE: 'active',
    IGNORED: 'ignored',
    PARTIALLY_PAID: 'partially_paid',
    PAID: 'paid',
    CANCELLED: 'cancelled',
} as const

export const DEBT_ORIGIN_MODES = {
    DIRECT: 'direct',
    SIMPLIFIED: 'simplified',
} as const

export const DEBT_MOVEMENT_TYPES = {
    CREATION: 'creation',
    PAYMENT: 'payment',
    COLLECT: 'collect',
    ADJUSTMENT: 'adjustment',
    CANCELLATION: 'cancellation',
    IGNORE: 'ignore',
    RESTORE: 'restore',
    SYNC_UPDATE: 'sync_update',
} as const

export const SPACE_DEBT_MODES = {
    DIRECT: 'direct',
    SIMPLIFIED: 'simplified',
} as const

export const NOTIFICATION_STATUSES = {
    UNREAD: 'unread',
    READ: 'read',
    ARCHIVED: 'archived',
    DISMISSED: 'dismissed',
} as const

export const NOTIFICATION_CATEGORIES = {
    SPACE: 'space',
    DEBT: 'debt',
    PERSONAL_IMPACT: 'personal_impact',
    SYSTEM: 'system',
    INSIGHT: 'insight',
} as const

export const NOTIFICATION_PRIORITIES = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
} as const

export const NOTIFICATION_ACTION_STATUSES = {
    NONE: 'none',
    PENDING: 'pending',
    COMPLETED: 'completed',
    IGNORED: 'ignored',
    CANCELLED: 'cancelled',
} as const

export const NOTIFICATION_TYPES = {
    PERSONAL_IMPACT_PENDING: 'personal_impact_pending',
    SPACE_ENTRY_CREATED: 'space_entry_created',
    SPACE_ENTRY_VOIDED: 'space_entry_voided',
    DEBT_PAYMENT_REGISTERED: 'debt_payment_registered',
    DEBT_COLLECT_REGISTERED: 'debt_collect_registered',
    SYSTEM_INFO: 'system_info',
} as const

// Tipos derivados
export type AccountType = typeof ACCOUNT_TYPES[keyof typeof ACCOUNT_TYPES]
export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES]
export type CategoryType = typeof CATEGORY_TYPES[keyof typeof CATEGORY_TYPES]
export type Currency = typeof CURRENCIES[keyof typeof CURRENCIES]
export type SpaceCurrency = string
export type RecurrenceType = typeof RECURRENCE_TYPES[keyof typeof RECURRENCE_TYPES]
export type ApplyMode = typeof APPLY_MODES[keyof typeof APPLY_MODES]
export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS]
export type CreatedFrom = typeof CREATED_FROM[keyof typeof CREATED_FROM]
export type RuleAppliesTo = typeof RULE_APPLIES_TO[keyof typeof RULE_APPLIES_TO]
export type RuleField = typeof RULE_FIELDS[keyof typeof RULE_FIELDS]
export type RuleCondition = typeof RULE_CONDITIONS[keyof typeof RULE_CONDITIONS]
export type ImportSourceType = typeof IMPORT_SOURCE_TYPES[keyof typeof IMPORT_SOURCE_TYPES]
export type ImportBatchStatus = typeof IMPORT_BATCH_STATUS[keyof typeof IMPORT_BATCH_STATUS]
export type ImportRowStatus = typeof IMPORT_ROW_STATUS[keyof typeof IMPORT_ROW_STATUS]
export type SpaceType = typeof SPACE_TYPES[keyof typeof SPACE_TYPES]
export type SpaceMode = typeof SPACE_MODES[keyof typeof SPACE_MODES]
export type SpaceStatus = typeof SPACE_STATUSES[keyof typeof SPACE_STATUSES]
export type SpaceParticipantKind =
    typeof SPACE_PARTICIPANT_KINDS[keyof typeof SPACE_PARTICIPANT_KINDS]
export type SpaceParticipantRole =
    typeof SPACE_PARTICIPANT_ROLES[keyof typeof SPACE_PARTICIPANT_ROLES]
export type SpaceInviteStatus =
    typeof SPACE_INVITE_STATUSES[keyof typeof SPACE_INVITE_STATUSES]
export type SpaceEntryType = typeof SPACE_ENTRY_TYPES[keyof typeof SPACE_ENTRY_TYPES]
export type SpaceEntryStatus =
    typeof SPACE_ENTRY_STATUSES[keyof typeof SPACE_ENTRY_STATUSES]
export type SpaceSplitMode = typeof SPACE_SPLIT_MODES[keyof typeof SPACE_SPLIT_MODES]
export type SpaceActivityEventType =
    typeof SPACE_ACTIVITY_EVENT_TYPES[keyof typeof SPACE_ACTIVITY_EVENT_TYPES]
export type SpaceActivityEntityType =
    typeof SPACE_ACTIVITY_ENTITY_TYPES[keyof typeof SPACE_ACTIVITY_ENTITY_TYPES]
export type SpacePersonalImpactKind =
    typeof SPACE_PERSONAL_IMPACT_KINDS[keyof typeof SPACE_PERSONAL_IMPACT_KINDS]
export type SpacePersonalImpactStatus =
    typeof SPACE_PERSONAL_IMPACT_STATUSES[keyof typeof SPACE_PERSONAL_IMPACT_STATUSES]
export type SpacePersonalPendingActionType =
    typeof SPACE_PERSONAL_PENDING_ACTION_TYPES[keyof typeof SPACE_PERSONAL_PENDING_ACTION_TYPES]
export type SpacePersonalImpactSourceType =
    typeof SPACE_PERSONAL_IMPACT_SOURCE_TYPES[keyof typeof SPACE_PERSONAL_IMPACT_SOURCE_TYPES]
export type DebtDirection = typeof DEBT_DIRECTIONS[keyof typeof DEBT_DIRECTIONS]
export type DebtSourceType = typeof DEBT_SOURCE_TYPES[keyof typeof DEBT_SOURCE_TYPES]
export type DebtStatus = typeof DEBT_STATUSES[keyof typeof DEBT_STATUSES]
export type DebtOriginMode = typeof DEBT_ORIGIN_MODES[keyof typeof DEBT_ORIGIN_MODES]
export type DebtMovementType = typeof DEBT_MOVEMENT_TYPES[keyof typeof DEBT_MOVEMENT_TYPES]
export type SpaceDebtMode = typeof SPACE_DEBT_MODES[keyof typeof SPACE_DEBT_MODES]
export type NotificationStatus = typeof NOTIFICATION_STATUSES[keyof typeof NOTIFICATION_STATUSES]
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[keyof typeof NOTIFICATION_CATEGORIES]
export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[keyof typeof NOTIFICATION_PRIORITIES]
export type NotificationActionStatus = typeof NOTIFICATION_ACTION_STATUSES[keyof typeof NOTIFICATION_ACTION_STATUSES]
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES]
