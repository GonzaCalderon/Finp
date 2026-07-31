import { describe, expect, it } from 'vitest'

import { describePaymentGroupChoice } from '@/lib/utils/payment-group'

describe('describePaymentGroupChoice', () => {
    it('explica las dos alternativas y sus montos', () => {
        const choice = describePaymentGroupChoice('ars-payment', [
            { _id: 'ars-payment', amount: 120000, currency: 'ARS' },
            { _id: 'usd-payment', amount: 75, currency: 'USD' },
        ])

        expect(choice).toEqual({
            canDeleteGroup: true,
            singleLabel: 'Sólo esta parte',
            singleDescription: expect.stringContaining('ARS 120.000'),
            groupLabel: 'El pago completo (ARS + USD)',
            groupDescription: expect.stringMatching(/ARS 120\.000.*USD 75/),
        })
    })

    it('no ofrece borrar grupo para un huérfano', () => {
        const choice = describePaymentGroupChoice('only', [
            { _id: 'only', amount: 25, currency: 'USD' },
        ])

        expect(choice.canDeleteGroup).toBe(false)
        expect(choice.groupDescription).toContain('ya no tiene otra parte')
    })
})
