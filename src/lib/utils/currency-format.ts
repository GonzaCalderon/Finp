export function formatCurrencyAmount(
    amount: number,
    currency: string,
    options?: Intl.NumberFormatOptions
) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'ARS' ? 0 : 2,
        ...options,
    }).format(amount)
}
