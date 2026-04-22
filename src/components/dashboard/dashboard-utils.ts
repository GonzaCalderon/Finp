import type {
    DashboardCreditCard,
    DashboardCurrencyTotals,
    DashboardExpenseCategory,
    DashboardInstallmentItem,
    DashboardRecentTransaction,
} from '@/components/dashboard/types'

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    bank: 'Banco',
    cash: 'Efectivo',
    wallet: 'Billetera',
    credit_card: 'Tarjeta',
    debt: 'Deuda',
    savings: 'Ahorro',
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    credit_card_expense: 'Gasto con TC',
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
    adjustment: 'Ajuste',
}

export type DashboardCardBrand = 'visa' | 'mastercard' | 'amex' | 'cabal' | 'diners' | 'generic'

export function inferCardBrand(name?: string, institution?: string): DashboardCardBrand {
    const haystack = `${name ?? ''} ${institution ?? ''}`.toLowerCase()
    if (haystack.includes('visa')) return 'visa'
    if (haystack.includes('master')) return 'mastercard'
    if (haystack.includes('amex') || haystack.includes('american express')) return 'amex'
    if (haystack.includes('cabal')) return 'cabal'
    if (haystack.includes('diners')) return 'diners'
    return 'generic'
}

export function getCardBrandTheme(card: Pick<DashboardCreditCard, 'name' | 'institution' | 'processor' | 'color'>) {
    const brand = (card.processor as DashboardCardBrand | undefined) ?? inferCardBrand(card.name, card.institution)
    const accent = card.color ?? 'var(--sky)'
    const labelMap: Record<DashboardCardBrand, string> = {
        visa: 'Visa',
        mastercard: 'Mastercard',
        amex: 'Amex',
        cabal: 'Cabal',
        diners: 'Diners',
        generic: 'Tarjeta',
    }

    return {
        brand,
        label: labelMap[brand],
        accent,
        background:
            'linear-gradient(135deg, ' +
            `color-mix(in srgb, ${accent} 12%, var(--card) 88%) 0%, ` +
            'color-mix(in srgb, var(--card) 96%, transparent) 48%, ' +
            `color-mix(in srgb, ${accent} 18%, var(--muted) 82%) 100%)`,
        border: `color-mix(in srgb, ${accent} 24%, var(--border) 76%)`,
        shadow: `color-mix(in srgb, ${accent} 18%, transparent)`,
        chip: `color-mix(in srgb, ${accent} 12%, var(--background) 88%)`,
        badge: `color-mix(in srgb, ${accent} 16%, var(--background) 84%)`,
    }
}

export function hasCurrencyTotals(totals: DashboardCurrencyTotals) {
    return totals.ars > 0 || totals.usd > 0
}

export function getCurrencyTotalsMagnitude(totals: DashboardCurrencyTotals) {
    return totals.ars + totals.usd
}

export function getTopExpenseCategories(categories: DashboardExpenseCategory[], limit = 5) {
    return [...categories]
        .sort((left, right) => getCurrencyTotalsMagnitude(right) - getCurrencyTotalsMagnitude(left))
        .slice(0, limit)
}

export function getDashboardLeadCard(cards: DashboardCreditCard[]) {
    return [...cards].sort((left, right) => {
        const pendingDiff = getCurrencyTotalsMagnitude(right.monthlyPending) - getCurrencyTotalsMagnitude(left.monthlyPending)
        if (pendingDiff !== 0) return pendingDiff

        const dueDiff = getCurrencyTotalsMagnitude(right.monthlyDue) - getCurrencyTotalsMagnitude(left.monthlyDue)
        if (dueDiff !== 0) return dueDiff

        return right.activeInstallments - left.activeInstallments
    })[0] ?? null
}

export function getCompactDateLabel(value?: string) {
    if (!value) return null

    return new Date(value).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
    })
}

export function getPeriodMonthLabel(value: string) {
    const [year, month] = value.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
    })
}

export function getInstallmentProgress(item: DashboardInstallmentItem) {
    if (!item.installmentNumber) return `${item.installmentCount} cuotas`
    return `${item.installmentNumber}/${item.installmentCount}`
}

export function getRecentTransactionHref(transaction: DashboardRecentTransaction, month: string) {
    if (
        (transaction.type === 'credit_card_expense' || transaction.type === 'credit_card_payment') &&
        transaction.primaryAccount?._id
    ) {
        return `/transactions/credit-card?month=${month}&cardId=${transaction.primaryAccount._id}`
    }

    return `/transactions?month=${month}`
}

export function getCategoryHref(categoryId: string, month: string) {
    return `/transactions?month=${month}&categoryId=${categoryId}`
}

export function getTransactionPrimaryMeta(transaction: DashboardRecentTransaction) {
    if (transaction.type === 'credit_card_payment' && transaction.destinationAccount?.name) {
        return `Pago a ${transaction.destinationAccount.name}`
    }

    if (transaction.type === 'income' && transaction.primaryAccount?.name) {
        return transaction.primaryAccount.name
    }

    if (transaction.type === 'transfer' && transaction.sourceAccount?.name && transaction.destinationAccount?.name) {
        return `${transaction.sourceAccount.name} -> ${transaction.destinationAccount.name}`
    }

    if (transaction.type === 'exchange' && transaction.primaryAccount?.name) {
        return transaction.primaryAccount.name
    }

    return transaction.primaryAccount?.name ?? null
}

export function getTransactionAccentColor(transaction: DashboardRecentTransaction) {
    if (transaction.impact === 'positive') return '#10B981'
    if (transaction.type === 'credit_card_payment') return 'var(--amber)'
    if (transaction.impact === 'neutral') return 'var(--sky)'
    return 'var(--destructive)'
}

export function getTransactionAmountPrefix(transaction: DashboardRecentTransaction) {
    if (transaction.impact === 'positive') return '+'
    if (transaction.type === 'transfer' || transaction.type === 'exchange') return ''
    return '-'
}

export function formatDayOfMonth(day?: number) {
    if (!day) return null
    return `dia ${day}`
}
