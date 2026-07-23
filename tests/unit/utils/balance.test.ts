import { beforeEach, describe, expect, it, vi } from 'vitest'

const { aggregate } = vi.hoisted(() => ({
    aggregate: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    Transaction: { aggregate },
}))

import {
    calculateAccountBalancesByCurrency,
    sumAvailableAccountBalances,
} from '@/lib/utils/balance'

describe('account balance', () => {
    beforeEach(() => {
        aggregate.mockReset()
    })

    it('aplica una compra en cuotas una sola vez al saldo de la tarjeta', async () => {
        aggregate.mockResolvedValue([{
            regularIncoming: [],
            exchangeIncoming: [],
            outgoing: [{ _id: 'ARS', total: 1200 }],
        }])

        const balances = await calculateAccountBalancesByCurrency(
            'card-id' as never,
            'user-id' as never,
            { initialBalances: { ARS: 0 } }
        )

        expect(balances.ARS).toBe(-1200)
    })

    it('limita el saldo histórico al cierre solicitado', async () => {
        aggregate.mockResolvedValue([{
            regularIncoming: [],
            exchangeIncoming: [],
            outgoing: [],
        }])
        const sinceDate = new Date('2026-01-01T00:00:00.000Z')
        const untilDate = new Date('2026-03-01T00:00:00.000Z')

        await calculateAccountBalancesByCurrency(
            'account-id' as never,
            'user-id' as never,
            { sinceDate, untilDate }
        )

        expect(aggregate).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    $match: expect.objectContaining({
                        date: { $gte: sinceDate, $lt: untilDate },
                    }),
                }),
            ])
        )
    })

    it('suma únicamente cuentas disponibles y conserva saldos negativos', () => {
        expect(sumAvailableAccountBalances([
            { type: 'cash', balancesByCurrency: { ARS: -30, USD: 2 } },
            { type: 'bank', balancesByCurrency: { ARS: 10, USD: 3 } },
            { type: 'credit_card', balancesByCurrency: { ARS: -500, USD: -10 } },
            { type: 'debt', balancesByCurrency: { ARS: 1000, USD: 0 } },
        ])).toEqual({ ars: -20, usd: 5 })
    })
})
