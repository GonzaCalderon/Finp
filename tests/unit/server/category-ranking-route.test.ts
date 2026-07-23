import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
    const query = {
        select: vi.fn(),
        sort: vi.fn(),
        limit: vi.fn(),
        lean: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.sort.mockReturnValue(query)
    query.limit.mockReturnValue(query)

    return {
        auth: vi.fn(),
        connectDB: vi.fn().mockResolvedValue(undefined),
        Transaction: { find: vi.fn().mockReturnValue(query) },
        query,
    }
})

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({ Transaction: mocks.Transaction }))

const { GET } = await import('@/app/api/categories/ranking/route')

describe('GET /api/categories/ranking', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.query.select.mockReturnValue(mocks.query)
        mocks.query.sort.mockReturnValue(mocks.query)
        mocks.query.limit.mockReturnValue(mocks.query)
        mocks.Transaction.find.mockReturnValue(mocks.query)
    })

    it('requiere sesion', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await GET(new Request('https://finp.test/api/categories/ranking?type=expense'))

        expect(response.status).toBe(401)
        expect(mocks.Transaction.find).not.toHaveBeenCalled()
    })

    it('rechaza tipos que no representan categorias', async () => {
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })

        const response = await GET(new Request('https://finp.test/api/categories/ranking?type=exchange'))

        expect(response.status).toBe(400)
        expect(mocks.Transaction.find).not.toHaveBeenCalled()
    })

    it('ordena solo el historial del usuario y devuelve señales accionables', async () => {
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.query.lean.mockResolvedValue([
            {
                _id: { toString: () => 'tx-transport' },
                type: 'expense',
                categoryId: { toString: () => 'transport-category' },
                sourceAccountId: { toString: () => 'wallet-1' },
                description: 'Uber a oficina',
                merchant: '',
                amount: 4200,
                currency: 'ARS',
                date: new Date('2026-07-20T12:00:00.000Z'),
            },
            {
                _id: { toString: () => 'tx-grocery' },
                type: 'expense',
                categoryId: { toString: () => 'grocery-category' },
                description: 'Compra semanal',
                merchant: '',
                amount: 9000,
                currency: 'ARS',
                date: new Date('2026-07-22T12:00:00.000Z'),
            },
        ])

        const response = await GET(new Request(
            'https://finp.test/api/categories/ranking?type=expense&description=Uber'
        ))
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(mocks.Transaction.find).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-1',
            type: { $in: ['expense', 'credit_card_expense'] },
        }))
        expect(body.ranking[0].categoryId).toBe('transport-category')
        expect(body.signals.similarTransaction).toMatchObject({
            transactionId: 'tx-transport',
            categoryId: 'transport-category',
            sourceAccountId: 'wallet-1',
        })
        expect(body).toEqual(expect.objectContaining({
            ranking: expect.any(Array),
            signals: expect.any(Object),
        }))
    })
})
