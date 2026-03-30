import { ACCOUNT_TYPES, CURRENCIES, IMPORT_ROW_STATUS } from '@/lib/constants'
import type { IAccount, ICategory, ImportParsedData } from '@/types'
import { normalizeLegacyTransactionType } from '@/lib/utils/credit-card'

type ImportTypeOption = {
    value: string
    label: string
}

type ImportEvaluationParams = {
    data: ImportParsedData
    accounts: IAccount[]
    categories: ICategory[]
}

type ImportRequirement = {
    descriptionRequired: boolean
    categoryRequired: boolean
    sourceRequired: boolean
    destinationRequired: boolean
}

export type ImportEvaluationResult = {
    data: ImportParsedData
    normalizedType?: string
    errors: string[]
    warnings: string[]
    status: string
}

const IMPORT_TYPE_OPTIONS: ImportTypeOption[] = [
    { value: 'income', label: 'Ingreso' },
    { value: 'expense', label: 'Gasto' },
    { value: 'credit_card_expense', label: 'Gasto con TC' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'adjustment', label: 'Ajuste' },
    { value: 'credit_card_payment', label: 'Pago de tarjeta' },
]

export const IMPORT_TRANSACTION_TYPE_OPTIONS = IMPORT_TYPE_OPTIONS
export const IMPORT_TRANSACTION_TYPE_ORDER = IMPORT_TYPE_OPTIONS.map((option) => option.value)

export const IMPORT_TRANSACTION_TYPE_LABELS = Object.fromEntries(
    IMPORT_TYPE_OPTIONS.map((option) => [option.value, option.label])
) as Record<string, string>

export const IMPORT_TYPE_ALIASES: Record<string, string> = {
    ingreso: 'income',
    ingresos: 'income',
    income: 'income',
    gasto: 'expense',
    gastos: 'expense',
    egreso: 'expense',
    egresos: 'expense',
    expense: 'expense',
    'gasto con tc': 'credit_card_expense',
    'gasto tc': 'credit_card_expense',
    'gasto tarjeta': 'credit_card_expense',
    'gasto con tarjeta': 'credit_card_expense',
    'consumo tarjeta': 'credit_card_expense',
    'consumo con tc': 'credit_card_expense',
    credit_card_expense: 'credit_card_expense',
    transferencia: 'transfer',
    transferencias: 'transfer',
    transfer: 'transfer',
    ajuste: 'adjustment',
    ajustes: 'adjustment',
    adjustment: 'adjustment',
    'pago de tarjeta': 'credit_card_payment',
    'pago tarjeta': 'credit_card_payment',
    pago_tarjeta: 'credit_card_payment',
    credit_card_payment: 'credit_card_payment',
    'pago deuda': 'credit_card_payment',
    debt_payment: 'credit_card_payment',
}

function normalizeFreeText(value?: string | null): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
}

function getRequirement(type?: string | null): ImportRequirement {
    const normalized = normalizeImportTransactionType(type)

    if (normalized === 'transfer') {
        return {
            descriptionRequired: false,
            categoryRequired: false,
            sourceRequired: true,
            destinationRequired: true,
        }
    }

    if (normalized === 'credit_card_payment') {
        return {
            descriptionRequired: false,
            categoryRequired: false,
            sourceRequired: true,
            destinationRequired: true,
        }
    }

    if (normalized === 'adjustment') {
        return {
            descriptionRequired: true,
            categoryRequired: false,
            sourceRequired: true,
            destinationRequired: false,
        }
    }

    if (normalized === 'income') {
        return {
            descriptionRequired: true,
            categoryRequired: true,
            sourceRequired: true,
            destinationRequired: false,
        }
    }

    if (normalized === 'credit_card_expense') {
        return {
            descriptionRequired: true,
            categoryRequired: true,
            sourceRequired: true,
            destinationRequired: false,
        }
    }

    return {
        descriptionRequired: true,
        categoryRequired: true,
        sourceRequired: true,
        destinationRequired: false,
    }
}

export function normalizeImportTransactionType(type?: string | null): string | undefined {
    const normalized = normalizeFreeText(type)
    if (!normalized) return undefined
    return normalizeLegacyTransactionType(IMPORT_TYPE_ALIASES[normalized] ?? normalized)
}

export function getImportCategoryKind(type?: string | null): 'income' | 'expense' | null {
    const normalized = normalizeImportTransactionType(type)
    if (normalized === 'income') return 'income'
    if (normalized === 'expense' || normalized === 'credit_card_expense') return 'expense'
    return null
}

export function typeSupportsCategory(type?: string | null): boolean {
    return Boolean(getImportCategoryKind(type))
}

export function typeRequiresCategory(type?: string | null): boolean {
    return getRequirement(type).categoryRequired
}

export function typeRequiresSourceAccount(type?: string | null): boolean {
    return getRequirement(type).sourceRequired
}

export function typeRequiresDestinationAccount(type?: string | null): boolean {
    return getRequirement(type).destinationRequired
}

export function getCompatibleSourceAccounts(accounts: IAccount[], type?: string | null): IAccount[] {
    const normalized = normalizeImportTransactionType(type)

    if (normalized === 'credit_card_expense') {
        return accounts.filter((account) => account.type === ACCOUNT_TYPES.CREDIT_CARD)
    }

    if (normalized === 'credit_card_payment') {
        return accounts.filter(
            (account) => !([ACCOUNT_TYPES.CREDIT_CARD, ACCOUNT_TYPES.DEBT] as string[]).includes(account.type)
        )
    }

    if (normalized === 'expense') {
        return accounts.filter((account) => account.type !== ACCOUNT_TYPES.DEBT)
    }

    return accounts
}

export function getCompatibleDestinationAccounts(accounts: IAccount[], type?: string | null): IAccount[] {
    const normalized = normalizeImportTransactionType(type)

    if (normalized === 'credit_card_payment') {
        return accounts.filter((account) =>
            ([ACCOUNT_TYPES.CREDIT_CARD, ACCOUNT_TYPES.DEBT] as string[]).includes(account.type)
        )
    }

    return accounts
}

export function getImportAccountFieldLabel(type?: string | null): string {
    const normalized = normalizeImportTransactionType(type)
    if (normalized === 'credit_card_expense') return 'Tarjeta'
    if (normalized === 'credit_card_payment') return 'Cuenta que paga'
    return 'Cuenta'
}

export function getImportDestinationFieldLabel(type?: string | null): string {
    return normalizeImportTransactionType(type) === 'credit_card_payment'
        ? 'Tarjeta'
        : 'Cuenta destino'
}

export function shouldShowFirstClosingMonth(data: ImportParsedData): boolean {
    return normalizeImportTransactionType(data.type) === 'credit_card_expense'
}

export function normalizeImportMonth(value?: string | null): string | undefined {
    const raw = (value ?? '').trim()
    if (!raw) return undefined

    const direct = raw.match(/^(\d{4})-(\d{1,2})$/)
    if (direct) {
        const [, year, month] = direct
        return `${year}-${month.padStart(2, '0')}`
    }

    const slash = raw.match(/^(\d{1,2})\/(\d{2,4})$/)
    if (slash) {
        const [, month, yearRaw] = slash
        const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw
        return `${year}-${month.padStart(2, '0')}`
    }

    return undefined
}

export function getDefaultFirstClosingMonth(date?: Date | string | null): string | undefined {
    if (!date) return undefined
    const parsed = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(parsed.getTime())) return undefined
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
}

export function resolveImportReferences(
    data: ImportParsedData,
    accounts: IAccount[],
    categories: ICategory[]
): ImportParsedData {
    const next: ImportParsedData = { ...data }
    const normalizedType = normalizeImportTransactionType(next.type)

    const accountByName = new Map(accounts.map((account) => [normalizeFreeText(account.name), account]))
    const categoryByName = new Map(categories.map((category) => [normalizeFreeText(category.name), category]))

    if (!next.categoryId && next.categoryName) {
        const category = categoryByName.get(normalizeFreeText(next.categoryName))
        if (category) next.categoryId = String(category._id)
    }

    if (!next.sourceAccountId && next.accountName) {
        const account = accountByName.get(normalizeFreeText(next.accountName))
        if (account) next.sourceAccountId = String(account._id)
    }

    if (!next.destinationAccountId && next.destinationAccountName) {
        const destination = accountByName.get(normalizeFreeText(next.destinationAccountName))
        if (destination) next.destinationAccountId = String(destination._id)
    }

    if (next.cardName) {
        const card = accountByName.get(normalizeFreeText(next.cardName))
        if (card?.type === ACCOUNT_TYPES.CREDIT_CARD) {
            if (normalizedType === 'credit_card_expense' && !next.sourceAccountId) {
                next.sourceAccountId = String(card._id)
            }
            if (normalizedType === 'credit_card_payment' && !next.destinationAccountId) {
                next.destinationAccountId = String(card._id)
            }
        }
    }

    next.type = normalizedType
    next.firstClosingMonth = normalizeImportMonth(next.firstClosingMonth)

    return next
}

export function normalizeResolvedImportTransactionType(data: ImportParsedData): string | undefined {
    return normalizeImportTransactionType(data.type)
}

function resolveFinalType(data: ImportParsedData, accounts: IAccount[]): string | undefined {
    const normalizedType = normalizeImportTransactionType(data.type)
    if (!normalizedType) return undefined

    const sourceAccount = data.sourceAccountId
        ? accounts.find((account) => String(account._id) === data.sourceAccountId)
        : undefined

    if (normalizedType === 'expense' && sourceAccount?.type === ACCOUNT_TYPES.CREDIT_CARD) {
        return 'credit_card_expense'
    }

    return normalizedType
}

export function applyImportTypeTransition(
    data: ImportParsedData,
    nextType: string,
    accounts: IAccount[]
): ImportParsedData {
    const normalizedType = normalizeImportTransactionType(nextType) ?? nextType
    const next: ImportParsedData = {
        ...data,
        type: normalizedType,
    }

    if (normalizedType === 'credit_card_expense') {
        next.installmentCount = next.installmentCount && next.installmentCount > 0 ? next.installmentCount : 1
        next.installmentNumber = 1
        next.firstClosingMonth = next.firstClosingMonth ?? getDefaultFirstClosingMonth(next.date)

        const currentAccount = next.sourceAccountId
            ? accounts.find((account) => String(account._id) === next.sourceAccountId)
            : undefined
        if (currentAccount && currentAccount.type !== ACCOUNT_TYPES.CREDIT_CARD) {
            next.sourceAccountId = undefined
            next.accountName = undefined
        }
    } else {
        next.installmentCount = undefined
        next.installmentNumber = undefined
        next.firstClosingMonth = undefined
    }

    if (!typeSupportsCategory(normalizedType)) {
        next.categoryId = undefined
        next.categoryName = undefined
    }

    if (!typeRequiresDestinationAccount(normalizedType)) {
        next.destinationAccountId = undefined
        next.destinationAccountName = undefined
    }

    return next
}

export function evaluateImportRow({
    data,
    accounts,
    categories,
}: ImportEvaluationParams): ImportEvaluationResult {
    const normalizedData = resolveImportReferences(data, accounts, categories)
    const normalizedType = resolveFinalType(normalizedData, accounts)
    const requirement = getRequirement(normalizedType)
    const categoryType = getImportCategoryKind(normalizedType)

    const sourceAccount = normalizedData.sourceAccountId
        ? accounts.find((account) => String(account._id) === normalizedData.sourceAccountId)
        : undefined
    const destinationAccount = normalizedData.destinationAccountId
        ? accounts.find((account) => String(account._id) === normalizedData.destinationAccountId)
        : undefined
    const category = normalizedData.categoryId
        ? categories.find((item) => String(item._id) === normalizedData.categoryId)
        : undefined

    const errors: string[] = []
    const warnings: string[] = []

    if (!normalizedData.date) {
        errors.push('La fecha es inválida o está vacía. Usá el formato DD/MM/AAAA.')
    }

    if (!normalizedType) {
        errors.push(
            'El tipo es requerido. Valores válidos: ingreso, gasto, gasto con TC, transferencia, ajuste o pago de tarjeta.'
        )
    }

    if (requirement.descriptionRequired && !normalizedData.description?.trim()) {
        errors.push('La descripción es obligatoria para este tipo.')
    }

    if (normalizedData.amount === undefined || normalizedData.amount === null || Number.isNaN(normalizedData.amount)) {
        errors.push('El monto es obligatorio y debe ser un número válido.')
    } else if (normalizedType !== 'adjustment' && normalizedData.amount <= 0) {
        errors.push('El monto debe ser mayor a 0.')
    } else if (normalizedType === 'adjustment' && normalizedData.amount === 0) {
        errors.push('El ajuste debe tener un monto distinto de cero.')
    }

    if (!normalizedData.currency) {
        errors.push('La moneda es obligatoria.')
    } else if (!Object.values(CURRENCIES).includes(normalizedData.currency as (typeof CURRENCIES)[keyof typeof CURRENCIES])) {
        errors.push(`Moneda desconocida: "${normalizedData.currency}". Usá ARS o USD.`)
    }

    if (requirement.categoryRequired && !normalizedData.categoryId) {
        errors.push('La categoría es obligatoria para este tipo.')
    }

    if (
        requirement.categoryRequired &&
        normalizedData.categoryName &&
        !normalizedData.categoryId
    ) {
        errors.push(`Categoría "${normalizedData.categoryName}" no encontrada en Finp.`)
    }

    if (normalizedData.categoryId && category && categoryType && category.type !== categoryType) {
        errors.push('La categoría elegida no es compatible con el tipo de transacción.')
    }

    if (requirement.sourceRequired && !normalizedData.sourceAccountId) {
        errors.push('La cuenta es obligatoria para este tipo.')
    }

    if (
        requirement.sourceRequired &&
        normalizedData.accountName &&
        !normalizedData.sourceAccountId
    ) {
        errors.push(`Cuenta "${normalizedData.accountName}" no encontrada en Finp.`)
    }

    if (requirement.destinationRequired && !normalizedData.destinationAccountId) {
        errors.push('La cuenta destino es obligatoria para este tipo.')
    }

    if (
        requirement.destinationRequired &&
        normalizedData.destinationAccountName &&
        !normalizedData.destinationAccountId
    ) {
        errors.push(`Cuenta destino "${normalizedData.destinationAccountName}" no encontrada en Finp.`)
    }

    if (normalizedType === 'credit_card_expense') {
        if (!normalizedData.installmentCount || normalizedData.installmentCount < 1) {
            errors.push('Las cuotas son obligatorias para Gasto con TC.')
        }

        if (!normalizedData.firstClosingMonth) {
            errors.push('El mes de primer pago es obligatorio para Gasto con TC.')
        }

        if (sourceAccount && sourceAccount.type !== ACCOUNT_TYPES.CREDIT_CARD) {
            errors.push('Gasto con TC solo puede usar una tarjeta como cuenta.')
        }
    }

    if (normalizedType === 'expense' && sourceAccount?.type === ACCOUNT_TYPES.CREDIT_CARD) {
        errors.push('Si la cuenta es una tarjeta, el tipo debe ser "Gasto con TC".')
    }

    if (
        normalizedType === 'credit_card_payment' &&
        sourceAccount &&
        ([ACCOUNT_TYPES.CREDIT_CARD, ACCOUNT_TYPES.DEBT] as string[]).includes(sourceAccount.type)
    ) {
        errors.push('Pago de tarjeta debe salir de una cuenta que no sea tarjeta ni deuda.')
    }

    if (
        normalizedType === 'credit_card_payment' &&
        destinationAccount &&
        destinationAccount.type !== ACCOUNT_TYPES.CREDIT_CARD
    ) {
        errors.push('La cuenta destino de un pago de tarjeta debe ser una tarjeta.')
    }

    if (
        normalizedType === 'transfer' &&
        normalizedData.sourceAccountId &&
        normalizedData.destinationAccountId &&
        normalizedData.sourceAccountId === normalizedData.destinationAccountId
    ) {
        errors.push('La cuenta y la cuenta destino no pueden ser la misma.')
    }

    if (!typeSupportsCategory(normalizedType)) {
        normalizedData.categoryId = undefined
        normalizedData.categoryName = undefined
    }

    if (normalizedType !== 'credit_card_expense') {
        normalizedData.installmentCount = undefined
        normalizedData.installmentNumber = undefined
        normalizedData.firstClosingMonth = undefined
    } else {
        normalizedData.installmentNumber = 1
    }

    const status = errors.length > 0
        ? errors.some((error) => error.includes('no encontrada') || error.includes('no es'))
            ? IMPORT_ROW_STATUS.INVALID
            : IMPORT_ROW_STATUS.INCOMPLETE
        : IMPORT_ROW_STATUS.OK

    return {
        data: {
            ...normalizedData,
            type: normalizedType,
        },
        normalizedType,
        errors,
        warnings,
        status,
    }
}
