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
    DEBT_PAYMENT: 'debt_payment',      // kept for backwards compat — display as "Pago de tarjeta"
    ADJUSTMENT: 'adjustment',
} as const

export const CATEGORY_TYPES = {
    INCOME: 'income',
    EXPENSE: 'expense',
} as const

export const CURRENCIES = {
    ARS: 'ARS',
    USD: 'USD',
} as const

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

// Tipos derivados
export type AccountType = typeof ACCOUNT_TYPES[keyof typeof ACCOUNT_TYPES]
export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES]
export type CategoryType = typeof CATEGORY_TYPES[keyof typeof CATEGORY_TYPES]
export type Currency = typeof CURRENCIES[keyof typeof CURRENCIES]
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
