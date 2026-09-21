import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiJson: vi.fn() }))

vi.mock('@/lib/client/auth-client', () => ({ apiJson: mocks.apiJson }))

const {
    PERSONAL_SPACE_TRANSACTION_INVALIDATION_TAGS,
    removePersonalSpaceTransaction,
    withoutSelectedTransaction,
} = await import('@/lib/client/space-personal-impact')

const TARGET = {
    transactionId: '64b000000000000000000004',
    spaceId: '64b000000000000000000001',
    spaceEntryId: '64b000000000000000000002',
}
const DELETE_URL =
    '/api/transactions/64b000000000000000000004?spaceId=64b000000000000000000001&spaceEntryId=64b000000000000000000002'

describe('removePersonalSpaceTransaction', () => {
    beforeEach(() => vi.clearAllMocks())

    it('elimina la transacción por su recurso exacto y deja el teardown resolver el impacto', async () => {
        mocks.apiJson.mockResolvedValueOnce({ reverted: { personalImpact: true } })

        const response = await removePersonalSpaceTransaction(TARGET)

        expect(mocks.apiJson).toHaveBeenCalledWith(DELETE_URL, { method: 'DELETE' })
        expect(response.orphanTransactionDeleted).toBe(false)
    })

    it('informa cuando eliminó una transacción huérfana sin impacto persistido', async () => {
        mocks.apiJson.mockResolvedValueOnce({ reverted: { personalImpact: false } })

        const response = await removePersonalSpaceTransaction(TARGET)

        expect(mocks.apiJson).toHaveBeenCalledWith(DELETE_URL, { method: 'DELETE' })
        expect(response.orphanTransactionDeleted).toBe(true)
    })

    it('propaga un fallo del teardown para permitir reintentar', async () => {
        mocks.apiJson.mockRejectedValue(new Error('Sin conexion'))

        await expect(removePersonalSpaceTransaction(TARGET)).rejects.toThrow(
            'Sin conexion'
        )
        expect(mocks.apiJson).toHaveBeenCalledTimes(1)
    })

    it('quita solo la tarjeta confirmada e invalida finanzas y Espacios', () => {
        const transactions = [
            { _id: '64b000000000000000000004' },
            { _id: '64b000000000000000000005' },
        ]

        expect(withoutSelectedTransaction(
            transactions,
            '64b000000000000000000004'
        )).toEqual([{ _id: '64b000000000000000000005' }])
        expect(PERSONAL_SPACE_TRANSACTION_INVALIDATION_TAGS).toEqual(
            expect.arrayContaining([
                'transactions',
                'dashboard',
                'accounts',
                'account-detail',
                'spaces',
                'personal-pending-actions',
                'notifications',
            ])
        )
    })
})
