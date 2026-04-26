import { describe, expect, it } from 'vitest'
import { getTransactionAmountPrefix } from '@/components/dashboard/dashboard-utils'
import type { DashboardRecentTransaction } from '@/components/dashboard/types'

function transaction(overrides: Partial<DashboardRecentTransaction>): DashboardRecentTransaction {
    return {
        _id: 'tx-1',
        type: 'adjustment',
        description: 'Ajuste',
        amount: 100,
        currency: 'ARS',
        date: '2026-03-20',
        impact: 'neutral',
        ...overrides,
    }
}

describe('dashboard transaction display helpers', () => {
    it('uses the impact field to render positive adjustment prefixes', () => {
        expect(getTransactionAmountPrefix(transaction({
            type: 'adjustment',
            impact: 'positive',
        }))).toBe('+')
    })

    it('uses the impact field to render negative adjustment prefixes', () => {
        expect(getTransactionAmountPrefix(transaction({
            type: 'adjustment',
            impact: 'negative',
        }))).toBe('-')
    })
})
