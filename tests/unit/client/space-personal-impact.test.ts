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
const IMPACT_URL =
    '/api/spaces/64b000000000000000000001/entries/64b000000000000000000002/personal-impact'

describe('removePersonalSpaceTransaction', () => {
    beforeEach(() => vi.clearAllMocks())

    it('resuelve el impacto persistido sobre la revisión que leyó, con clave de idempotencia', async () => {
        mocks.apiJson
            .mockResolvedValueOnce({
                impact: { _id: '64b000000000000000000003', revision: 4 },
            })
            .mockResolvedValueOnce({ ok: true })

        const response = await removePersonalSpaceTransaction(TARGET)

        expect(mocks.apiJson).toHaveBeenNthCalledWith(1, IMPACT_URL)

        const [url, init] = mocks.apiJson.mock.calls[1]
        expect(url).toBe(IMPACT_URL)
        expect(init.method).toBe('POST')
        expect(init.headers['Idempotency-Key']).toEqual(expect.any(String))
        expect(JSON.parse(init.body)).toEqual({
            impactId: '64b000000000000000000003',
            expectedRevision: 4,
            decision: { type: 'remove_transaction' },
        })

        // El movimiento compartido sigue vivo: sólo se retiró el impacto propio.
        expect(response.orphanTransactionDeleted).toBe(false)
    })

    it('trata una revisión ausente como cero para no saltear el control optimista', async () => {
        mocks.apiJson
            .mockResolvedValueOnce({ impact: { _id: '64b000000000000000000003' } })
            .mockResolvedValueOnce({ ok: true })

        await removePersonalSpaceTransaction(TARGET)

        expect(JSON.parse(mocks.apiJson.mock.calls[1][1].body).expectedRevision).toBe(0)
    })

    it('elimina por su recurso personal una transacción sin impacto persistido', async () => {
        mocks.apiJson
            .mockResolvedValueOnce({ impact: null })
            .mockResolvedValueOnce({ ok: true })

        const response = await removePersonalSpaceTransaction(TARGET)

        expect(mocks.apiJson).toHaveBeenNthCalledWith(
            2,
            '/api/transactions/64b000000000000000000004',
            { method: 'DELETE' }
        )
        expect(response.orphanTransactionDeleted).toBe(true)
    })

    it('no elimina nada si no pudo leer el impacto', async () => {
        mocks.apiJson.mockRejectedValue(new Error('Sin conexion'))

        await expect(removePersonalSpaceTransaction(TARGET)).rejects.toThrow(
            'Sin conexion'
        )
        expect(mocks.apiJson).toHaveBeenCalledTimes(1)
    })

    it('propaga un fallo de la resolución para permitir reintentar', async () => {
        mocks.apiJson
            .mockResolvedValueOnce({ impact: { _id: '64b000000000000000000003', revision: 1 } })
            .mockRejectedValueOnce(new Error('Sin conexion'))

        await expect(removePersonalSpaceTransaction(TARGET)).rejects.toThrow(
            'Sin conexion'
        )
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
