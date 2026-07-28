import { describe, expect, it } from 'vitest'
import {
    COMMITMENT_INVALIDATION_TAGS,
    DEBT_INVALIDATION_TAGS,
    INSTALLMENT_INVALIDATION_TAGS,
    NOTIFICATION_INVALIDATION_TAGS,
    PERSONAL_PENDING_ACTIONS_INVALIDATION_TAGS,
    SPACE_INVALIDATION_TAGS,
    invalidateData,
    matchesInvalidation,
    subscribeToInvalidation,
} from '@/lib/client/data-sync'

describe('commitment invalidation tags', () => {
    it('refreshes every view affected by an applied commitment', () => {
        expect(COMMITMENT_INVALIDATION_TAGS).toEqual(
            expect.arrayContaining([
                'commitments',
                'dashboard',
                'projection',
                'transactions',
                'accounts',
                'account-detail',
            ])
        )
    })
})

describe('installment invalidation tags', () => {
    it('refreshes the transaction list after creating an installment plan', () => {
        expect(INSTALLMENT_INVALIDATION_TAGS).toContain('transactions')
    })
})

describe('data-sync invalidation bus', () => {
    it('invalidación múltiple llama listeners con los tags correctos', () => {
        const calls: string[][] = []
        const unsubscribe = subscribeToInvalidation((tags) => {
            calls.push([...tags])
        })

        invalidateData(['notifications', 'debts'])

        expect(calls).toEqual([['notifications', 'debts']])
        unsubscribe()
    })

    it('unsubscribe funciona', () => {
        const calls: string[][] = []
        const unsubscribe = subscribeToInvalidation((tags) => {
            calls.push([...tags])
        })

        unsubscribe()
        invalidateData(['spaces'])

        expect(calls).toEqual([])
    })

    it('no duplica listener si se registra dos veces y se remueve', () => {
        const calls: string[][] = []
        const listener = (tags: Set<string>) => calls.push([...tags])

        const unsubscribeA = subscribeToInvalidation(listener)
        const unsubscribeB = subscribeToInvalidation(listener)
        invalidateData(['notifications'])

        expect(calls).toEqual([['notifications']])

        unsubscribeA()
        invalidateData(['notifications'])
        expect(calls).toEqual([['notifications']])

        unsubscribeB()
    })

    it('matchesInvalidation detecta intersección de tags', () => {
        expect(matchesInvalidation(['debts', 'accounts'], new Set(['notifications', 'debts']))).toBe(true)
        expect(matchesInvalidation(['spaces'], new Set(['notifications', 'debts']))).toBe(false)
    })
})

describe('fase 6 invalidation tags', () => {
    it('NOTIFICATION_INVALIDATION_TAGS contiene notifications', () => {
        expect(NOTIFICATION_INVALIDATION_TAGS).toEqual(expect.arrayContaining(['notifications', 'nav-insights']))
    })

    it('PERSONAL_PENDING_ACTIONS_INVALIDATION_TAGS refresca pending y notifications', () => {
        expect(PERSONAL_PENDING_ACTIONS_INVALIDATION_TAGS).toEqual(
            expect.arrayContaining(['personal-pending-actions', 'notifications', 'nav-insights'])
        )
    })

    it('SPACE_INVALIDATION_TAGS incluye spaces, debts, pending y notifications', () => {
        expect(SPACE_INVALIDATION_TAGS).toEqual(
            expect.arrayContaining([
                'spaces',
                'debts',
                'transactions',
                'dashboard',
                'accounts',
                'account-detail',
                'personal-pending-actions',
                'notifications',
                'nav-insights',
            ])
        )
    })

    it('DEBT_INVALIDATION_TAGS incluye debts, transactions, accounts, dashboard y notifications', () => {
        expect(DEBT_INVALIDATION_TAGS).toEqual(
            expect.arrayContaining([
                'debts',
                'transactions',
                'accounts',
                'account-detail',
                'dashboard',
                'notifications',
                'nav-insights',
            ])
        )
    })
})
