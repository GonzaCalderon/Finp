import type { AccountType, Currency } from '@/lib/constants'

export type CurrencyBalances = Record<Currency, number>

export const EMPTY_CURRENCY_BALANCES: CurrencyBalances = {
    ARS: 0,
    USD: 0,
}

const VALID_CURRENCIES: Currency[] = ['ARS', 'USD']

type AccountCurrencyLike = {
    type?: AccountType | string
    currency?: Currency | string
    supportedCurrencies?: readonly (Currency | string)[]
    initialBalance?: number
    initialBalances?: Partial<Record<Currency, number>>
    balancesByCurrency?: Partial<Record<Currency, number>>
}

export function buildCurrencyBalances(
    balances?: Partial<Record<Currency, number>> | null
): CurrencyBalances {
    return {
        ARS: balances?.ARS ?? 0,
        USD: balances?.USD ?? 0,
    }
}

export function normalizeInitialBalances(
    initialBalances?: Partial<Record<Currency, number>> | null,
    legacyInitialBalance?: number | null,
    fallbackCurrency?: Currency | string | null,
    supportedCurrencies?: readonly (Currency | string)[] | null,
    accountType?: AccountType | string | null
): CurrencyBalances {
    const balances = buildCurrencyBalances(initialBalances)
    const normalizedSupportedCurrencies = normalizeSupportedCurrencies(
        supportedCurrencies,
        fallbackCurrency,
        accountType
    )
    const primaryCurrency = normalizedSupportedCurrencies[0] ?? 'ARS'

    if ((legacyInitialBalance ?? 0) !== 0) {
        const hasExplicitPrimaryBalance =
            typeof initialBalances?.[primaryCurrency] === 'number'

        if (!hasExplicitPrimaryBalance) {
            balances[primaryCurrency] = legacyInitialBalance ?? 0
        }
    }

    return balances
}

export function normalizeSupportedCurrencies(
    supportedCurrencies?: readonly (Currency | string)[] | null,
    fallbackCurrency?: Currency | string | null,
    accountType?: AccountType | string | null
): Currency[] {
    if (accountType === 'credit_card') return ['ARS', 'USD']

    const normalized = (supportedCurrencies ?? [])
        .filter((value): value is Currency => VALID_CURRENCIES.includes(value as Currency))
        .filter((value, index, array) => array.indexOf(value) === index)

    if (normalized.length > 0) return normalized
    if (fallbackCurrency === 'USD') return ['USD']
    return ['ARS']
}

export function getSupportedCurrencies(account?: AccountCurrencyLike | null): Currency[] {
    if (!account) return ['ARS']
    return normalizeSupportedCurrencies(account.supportedCurrencies, account.currency, account.type)
}

export function supportsCurrency(account: AccountCurrencyLike | null | undefined, currency: Currency): boolean {
    return getSupportedCurrencies(account).includes(currency)
}

export function getCommonSupportedCurrencies(
    accounts: Array<AccountCurrencyLike | null | undefined>
): Currency[] {
    const normalized = accounts.filter(Boolean).map((account) => getSupportedCurrencies(account))
    if (normalized.length === 0) return ['ARS', 'USD']

    return VALID_CURRENCIES.filter((currency) => normalized.every((accountCurrencies) => accountCurrencies.includes(currency)))
}

export function getPrimaryCurrency(account?: AccountCurrencyLike | null): Currency {
    const [primary] = getSupportedCurrencies(account)
    return primary ?? 'ARS'
}

export function isDualCurrencyAccount(account?: AccountCurrencyLike | null): boolean {
    return getSupportedCurrencies(account).length > 1
}

export function getAccountCurrencyLabel(account?: AccountCurrencyLike | null): string {
    const supportedCurrencies = getSupportedCurrencies(account)
    if (supportedCurrencies.length > 1) return 'ARS y USD'
    return supportedCurrencies[0] ?? 'ARS'
}

export function getAccountBalancesByCurrency(account?: AccountCurrencyLike | null): CurrencyBalances {
    return buildCurrencyBalances(account?.balancesByCurrency)
}

export function getAccountDisplayBalance(account?: AccountCurrencyLike | null): number {
    const balances = getAccountBalancesByCurrency(account)
    return balances[getPrimaryCurrency(account)]
}

export function getInitialBalancesByCurrency(account?: AccountCurrencyLike | null): CurrencyBalances {
    return normalizeInitialBalances(
        account?.initialBalances,
        account?.initialBalance,
        account?.currency,
        account?.supportedCurrencies,
        account?.type
    )
}
