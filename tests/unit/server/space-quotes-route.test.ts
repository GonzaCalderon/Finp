import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn().mockResolvedValue(undefined),
    spaceFindById: vi.fn(),
    participantFindOne: vi.fn(),
    getSpaceReferenceQuotes: vi.fn(),
    resolveSpaceReferenceQuote: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    Space: { findById: mocks.spaceFindById },
    SpaceParticipant: { findOne: mocks.participantFindOne },
}))
vi.mock('@/lib/server/space-quote-service', () => ({
    getSpaceReferenceQuotes: mocks.getSpaceReferenceQuotes,
    resolveSpaceReferenceQuote: mocks.resolveSpaceReferenceQuote,
}))

const { GET } = await import('@/app/api/spaces/[id]/quotes/route')

const spaceId = '64b000000000000000000001'
const space = {
    _id: spaceId,
    currencies: ['ARS', 'USD', 'EUR'],
    reportingCurrency: 'ARS',
}

function leanResult<T>(value: T) {
    return { lean: vi.fn().mockResolvedValue(value) }
}

function request(query = '') {
    return new Request(`https://finp.test/api/spaces/${spaceId}/quotes${query}`)
}

function params() {
    return { params: Promise.resolve({ id: spaceId }) }
}

describe('GET cotizaciones de Espacios', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.spaceFindById.mockReturnValue(leanResult(space))
        mocks.participantFindOne.mockReturnValue(leanResult({ userId: 'user-1' }))
        mocks.getSpaceReferenceQuotes.mockResolvedValue({
            reportingCurrency: 'ARS',
            fetchedAt: '2026-08-24T15:00:00.000Z',
            quotes: [],
        })
        mocks.resolveSpaceReferenceQuote.mockResolvedValue({
            sourceCurrency: 'USD',
            targetCurrency: 'EUR',
            rate: '0.9',
            direction: 'multiply',
            source: 'frankfurter',
            status: 'current',
            observedAt: '2026-08-24T00:00:00.000Z',
            capturedAt: '2026-08-24T15:00:00.000Z',
            path: [],
        })
    })

    it('requiere autenticación antes de consultar datos o proveedores', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await GET(request(), params())

        expect(response.status).toBe(401)
        expect(mocks.connectDB).not.toHaveBeenCalled()
        expect(mocks.getSpaceReferenceQuotes).not.toHaveBeenCalled()
    })

    it('aísla el Espacio y no enumera cotizaciones a una persona ajena', async () => {
        mocks.participantFindOne.mockReturnValue(leanResult(null))

        const response = await GET(request(), params())

        expect(response.status).toBe(404)
        expect(mocks.getSpaceReferenceQuotes).not.toHaveBeenCalled()
    })

    it('rechaza pares fuera de las monedas habilitadas antes de llamar al proveedor', async () => {
        const response = await GET(request('?pairs=USD:GBP'), params())

        expect(response.status).toBe(400)
        expect(mocks.resolveSpaceReferenceQuote).not.toHaveBeenCalled()
    })

    it('devuelve el lote canónico con cache privada', async () => {
        const response = await GET(request(), params())

        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('private, max-age=60, stale-while-revalidate=840')
        expect(mocks.getSpaceReferenceQuotes).toHaveBeenCalledWith({
            currencies: ['ARS', 'USD', 'EUR'],
            reportingCurrency: 'ARS',
        })
    })

    it('resuelve sólo los pares habilitados solicitados por una liquidación', async () => {
        const response = await GET(request('?pairs=USD:EUR'), params())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(mocks.resolveSpaceReferenceQuote).toHaveBeenCalledWith({
            sourceCurrency: 'USD',
            targetCurrency: 'EUR',
        })
        expect(body.data.quotes).toHaveLength(1)
    })
})
