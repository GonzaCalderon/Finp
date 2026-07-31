import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    getProjectionForUser: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/server/projection', () => ({ getProjectionForUser: mocks.getProjectionForUser }))

const { GET } = await import('@/app/api/projection/route')

describe('GET /api/projection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.getProjectionForUser.mockResolvedValue({
            currentPeriod: '2026-07',
            projection: [{
                month: '2026-07',
                isCurrentMonth: true,
                isPast: false,
                items: [],
                totals: {
                    commitments: { ars: 0, usd: 0 },
                    cardSingle: { ars: 0, usd: 0 },
                    cardInstallments: { ars: 0, usd: 0 },
                    estimated: { ars: 0, usd: 0 },
                    total: { ars: 0, usd: 0 },
                    pendingAmountCount: 0,
                },
            }],
        })
    })

    it('requiere autenticacion y evita cachear la respuesta', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await GET(new Request('http://localhost/api/projection'))

        expect(response.status).toBe(401)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(mocks.connectDB).not.toHaveBeenCalled()
    })

    it.each([
        '?mode=weekly',
        '?months=0',
        '?months=6.5',
        '?mode=annual&months=6',
        '?mode=monthly&year=2026',
        '?unexpected=true',
    ])('rechaza una query invalida: %s', async (query) => {
        const response = await GET(new Request(`http://localhost/api/projection${query}`))

        expect(response.status).toBe(400)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(mocks.getProjectionForUser).not.toHaveBeenCalled()
    })

    it('envia al servicio un horizonte mensual validado y devuelve contrato serializable', async () => {
        const response = await GET(new Request('http://localhost/api/projection?mode=monthly&months=6'))
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(mocks.getProjectionForUser).toHaveBeenCalledWith('user-1', {
            mode: 'monthly',
            monthCount: 6,
            year: undefined,
        })
        expect(JSON.parse(JSON.stringify(data))).toEqual(data)
        expect(data.projection[0].totals).toHaveProperty('cardSingle')
    })

    it('acepta el modo anual con selector de anio', async () => {
        const response = await GET(new Request('http://localhost/api/projection?mode=annual&year=2025'))

        expect(response.status).toBe(200)
        expect(mocks.getProjectionForUser).toHaveBeenCalledWith('user-1', {
            mode: 'annual',
            monthCount: undefined,
            year: 2025,
        })
    })
})
