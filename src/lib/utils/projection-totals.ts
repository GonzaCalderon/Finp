import {
    addCurrencyAmount,
    emptyCurrencyTotals,
} from '@/lib/utils/currency-totals'
import type { ProjectionItem, ProjectionTotals } from '@/types/projection'

export function emptyProjectionTotals(): ProjectionTotals {
    return {
        commitments: emptyCurrencyTotals(),
        cardSingle: emptyCurrencyTotals(),
        cardInstallments: emptyCurrencyTotals(),
        hypothetical: emptyCurrencyTotals(),
        estimated: emptyCurrencyTotals(),
        total: emptyCurrencyTotals(),
        pendingAmountCount: 0,
    }
}

export function buildProjectionTotals(items: ProjectionItem[]): ProjectionTotals {
    const totals = emptyProjectionTotals()

    for (const item of items) {
        addCurrencyAmount(totals.total, item.currency, item.amount)
        if (item.kind === 'commitment') addCurrencyAmount(totals.commitments, item.currency, item.amount)
        if (item.kind === 'card_single') addCurrencyAmount(totals.cardSingle, item.currency, item.amount)
        if (item.kind === 'card_installment') addCurrencyAmount(totals.cardInstallments, item.currency, item.amount)
        if (item.kind === 'hypothetical') addCurrencyAmount(totals.hypothetical, item.currency, item.amount)
        if (item.certainty === 'estimated') addCurrencyAmount(totals.estimated, item.currency, item.amount)
        if (
            item.certainty === 'pending_amount' &&
            item.simulation?.state !== 'omitted' &&
            !(item.simulation?.state === 'moved' && item.amount === 0)
        ) {
            totals.pendingAmountCount += 1
        }
    }

    return totals
}
