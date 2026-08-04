import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiJson: vi.fn() }))

vi.mock('@/lib/client/auth-client', () => ({ apiJson: mocks.apiJson }))

const {
    PERSONAL_SPACE_TRANSACTION_INVALIDATION_TAGS,
    PersonalSpaceTransactionNotDeletedError,
    removePersonalSpaceTransaction,
    withoutSelectedTransaction,
} = await import('@/lib/client/space-personal-impact')

describe('removePersonalSpaceTransaction', () => {
    beforeEach(() => vi.clearAllMocks())

    it('envia el transactionId de la tarjeta seleccionada y acepta una eliminacion confirmada', async () => {
        mocks.apiJson.mockResolvedValue({
            ok: true,
            deletedTransaction: true,
            orphanTransactionDeleted: true,
        })

        const response = await removePersonalSpaceTransaction({
            transactionId: '64b000000000000000000004',
            spaceId: '64b000000000000000000001',
            spaceEntryId: '64b000000000000000000002',
        })

        expect(mocks.apiJson).toHaveBeenCalledWith(
            '/api/spaces/64b000000000000000000001/entries/64b000000000000000000002/personal-impact?transactionId=64b000000000000000000004',
            { method: 'DELETE' }
        )
        expect(response.orphanTransactionDeleted).toBe(true)
    })

    it('no interpreta deletedTransaction false como exito', async () => {
        mocks.apiJson.mockResolvedValue({
            ok: true,
            deletedTransaction: false,
            orphanTransactionDeleted: false,
        })

        await expect(removePersonalSpaceTransaction({
            transactionId: '64b000000000000000000004',
            spaceId: '64b000000000000000000001',
            spaceEntryId: '64b000000000000000000002',
        })).rejects.toBeInstanceOf(PersonalSpaceTransactionNotDeletedError)
    })

    it('propaga un fallo de red para permitir reintentar', async () => {
        mocks.apiJson.mockRejectedValue(new Error('Sin conexion'))

        await expect(removePersonalSpaceTransaction({
            transactionId: '64b000000000000000000004',
            spaceId: '64b000000000000000000001',
            spaceEntryId: '64b000000000000000000002',
        })).rejects.toThrow('Sin conexion')
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
