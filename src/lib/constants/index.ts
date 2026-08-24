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

export const COMMITMENT_LIFECYCLE_STATUSES = {
    UPCOMING: 'upcoming',
    ACTIVE: 'active',
    ENDING_SOON: 'ending_soon',
    EXPIRED: 'expired',
    INACTIVE: 'inactive',
} as const

export const COMMITMENT_REMINDER_STATES = {
    UPCOMING: 'upcoming',
    DUE: 'due',
    OVERDUE: 'overdue',
} as const

/**
 * Política de monto de un compromiso.
 * - `fixed`: el mismo valor sigue vigente hasta que el usuario lo cambia.
 * - `variable`: Finp prepara el período pero pide confirmar el importe real.
 */
export const COMMITMENT_AMOUNT_POLICIES = {
    FIXED: 'fixed',
    VARIABLE: 'variable',
} as const

/** Cómo estimar un compromiso variable mientras no hay monto confirmado. */
export const COMMITMENT_ESTIMATION_MODES = {
    TEMPLATE: 'template',
    LAST: 'last',
    AVERAGE: 'average',
} as const

/** De dónde salió el monto usado en una aplicación concreta. */
export const COMMITMENT_AMOUNT_SOURCES = {
    TEMPLATE: 'template',
    SCHEDULE: 'schedule',
    MANUAL: 'manual',
    ESTIMATED: 'estimated',
} as const

/**
 * Estados persistidos de una aplicación: la fila sólo existe cuando algo ocurrió.
 * Los estados previos (`scheduled`, `awaiting_amount`, `ready`) se derivan al leer.
 */
export const COMMITMENT_APPLICATION_STATUSES = {
    REGISTERED: 'registered',
    SKIPPED: 'skipped',
    CANCELLED: 'cancelled',
    REVERTED: 'reverted',
} as const

/** Estados derivados, que nunca se persisten. */
export const COMMITMENT_APPLICATION_DERIVED_STATUSES = {
    SCHEDULED: 'scheduled',
    AWAITING_AMOUNT: 'awaiting_amount',
    READY: 'ready',
} as const

export const COMMITMENT_APPLICATION_ORIGINS = {
    MANUAL: 'manual',
    QUICK_CAPTURE: 'quick_capture',
    SYSTEM: 'system',
} as const

export const TRANSACTION_STATUS = {
    CONFIRMED: 'confirmed',
    PLANNED: 'planned',
} as const

export const CREATED_FROM = {
    WEB: 'web',
    QUICK_CAPTURE: 'quick_capture',
    TELEGRAM: 'telegram',
    SYSTEM: 'system',
    SPACE: 'space',
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

export const SPACE_INVITE_TYPES = {
    DIRECT: 'direct',
    LINK: 'link',
} as const

export const SPACE_INVITE_STATUSES = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    ACTIVE: 'active',
    REVOKED: 'revoked',
    EXPIRED: 'expired',
} as const

export const SPACE_PERSONAL_CATEGORY_STRATEGIES = {
    MANUAL: 'manual',
    SPACE_NAME_VIRTUAL: 'space_name_virtual',
    FIXED_PERSONAL_CATEGORY: 'fixed_personal_category',
    MAP_SPACE_CATEGORIES: 'map_space_categories',
} as const

export const SPACE_ENTRY_TYPES = {
    EXPENSE: 'expense',
    INCOME: 'income',
    ADJUSTMENT: 'adjustment',
    SETTLEMENT: 'settlement',
} as const

export const SPACE_ENTRY_STATUSES = {
    RECORDED: 'recorded',
    VOIDED: 'voided',
    PENDING_CONFIRMATION: 'pending_confirmation',
    CONFIRMED: 'confirmed',
    LINKED: 'linked',
    REJECTED: 'rejected',
} as const

/** Estados compartidos válidos para escrituras del contrato financiero v2. */
export const SPACE_ENTRY_V2_STATUSES = {
    RECORDED: 'recorded',
    VOIDED: 'voided',
} as const

export const SPACE_CONTRACT_VERSIONS = {
    V2: 2,
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
    PERSONAL_EXPENSE: 'personal_expense',
    ADVANCE: 'advance',
    PAYER_FULL_AMOUNT: 'payer_full_amount',
    PARTICIPANT_SHARE: 'participant_share',
    SETTLEMENT_PAID: 'settlement_paid',
    SETTLEMENT_RECEIVED: 'settlement_received',
} as const

export const SPACE_OPERATION_TYPES = {
    CREATE_ENTRY: 'create_entry',
    EDIT_ENTRY: 'edit_entry',
    VOID_ENTRY: 'void_entry',
    RESOLVE_PERSONAL_IMPACT: 'resolve_personal_impact',
    LINK_PERSONAL_IMPACT: 'link_personal_impact',
    IGNORE_PERSONAL_IMPACT: 'ignore_personal_impact',
    REVIEW_PERSONAL_IMPACT: 'review_personal_impact',
    REMOVE_PERSONAL_IMPACT: 'remove_personal_impact',
    SETTLE_DEBT: 'settle_debt',
    CHANGE_DEBT_MODE: 'change_debt_mode',
    CHANGE_LIFECYCLE: 'change_lifecycle',
    CHANGE_ROLE: 'change_role',
    TRANSFER_OWNERSHIP: 'transfer_ownership',
} as const

export const SPACE_OPERATION_STATUSES = {
    PENDING: 'pending',
    COMMITTED: 'committed',
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
    SPACE_ENTRY_VOIDED_REVIEW: 'space_entry_voided_review',
    SPACE_ENTRY_EDITED_REVIEW: 'space_entry_edited_review',
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
export type CommitmentLifecycleStatus =
    typeof COMMITMENT_LIFECYCLE_STATUSES[keyof typeof COMMITMENT_LIFECYCLE_STATUSES]
export type CommitmentReminderState =
    typeof COMMITMENT_REMINDER_STATES[keyof typeof COMMITMENT_REMINDER_STATES]
export type CommitmentAmountPolicy = typeof COMMITMENT_AMOUNT_POLICIES[keyof typeof COMMITMENT_AMOUNT_POLICIES]
export type CommitmentEstimationMode = typeof COMMITMENT_ESTIMATION_MODES[keyof typeof COMMITMENT_ESTIMATION_MODES]
export type CommitmentAmountSource = typeof COMMITMENT_AMOUNT_SOURCES[keyof typeof COMMITMENT_AMOUNT_SOURCES]
export type CommitmentApplicationStatus =
    typeof COMMITMENT_APPLICATION_STATUSES[keyof typeof COMMITMENT_APPLICATION_STATUSES]
export type CommitmentApplicationDerivedStatus =
    typeof COMMITMENT_APPLICATION_DERIVED_STATUSES[keyof typeof COMMITMENT_APPLICATION_DERIVED_STATUSES]
/** Unión completa: lo que la UI muestra, persistido o derivado. */
export type CommitmentApplicationState =
    | CommitmentApplicationStatus
    | CommitmentApplicationDerivedStatus
export type CommitmentApplicationOrigin =
    typeof COMMITMENT_APPLICATION_ORIGINS[keyof typeof COMMITMENT_APPLICATION_ORIGINS]
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
export type SpaceInviteType =
    typeof SPACE_INVITE_TYPES[keyof typeof SPACE_INVITE_TYPES]
export type SpaceInviteStatus =
    typeof SPACE_INVITE_STATUSES[keyof typeof SPACE_INVITE_STATUSES]
export type SpacePersonalCategoryStrategy =
    typeof SPACE_PERSONAL_CATEGORY_STRATEGIES[keyof typeof SPACE_PERSONAL_CATEGORY_STRATEGIES]
export type SpaceEntryType = typeof SPACE_ENTRY_TYPES[keyof typeof SPACE_ENTRY_TYPES]
export type SpaceEntryStatus =
    typeof SPACE_ENTRY_STATUSES[keyof typeof SPACE_ENTRY_STATUSES]
export type SpaceEntryV2Status =
    typeof SPACE_ENTRY_V2_STATUSES[keyof typeof SPACE_ENTRY_V2_STATUSES]
export type SpaceContractVersion =
    typeof SPACE_CONTRACT_VERSIONS[keyof typeof SPACE_CONTRACT_VERSIONS]
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
export type SpaceOperationType =
    typeof SPACE_OPERATION_TYPES[keyof typeof SPACE_OPERATION_TYPES]
export type SpaceOperationStatus =
    typeof SPACE_OPERATION_STATUSES[keyof typeof SPACE_OPERATION_STATUSES]
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
