export type CurrencyTotals = {
    ars: number
    usd: number
}

export function emptyCurrencyTotals(): CurrencyTotals {
    return { ars: 0, usd: 0 }
}

export function addCurrencyAmount(totals: CurrencyTotals, currency: string, amount: number): void {
    if (currency === 'USD') totals.usd += amount
    else totals.ars += amount
}

export function addCurrencyTotals(left: CurrencyTotals, right: CurrencyTotals): CurrencyTotals {
    return {
        ars: left.ars + right.ars,
        usd: left.usd + right.usd,
    }
}

export function subtractCurrencyTotals(left: CurrencyTotals, right: CurrencyTotals): CurrencyTotals {
    return {
        ars: left.ars - right.ars,
        usd: left.usd - right.usd,
    }
}
