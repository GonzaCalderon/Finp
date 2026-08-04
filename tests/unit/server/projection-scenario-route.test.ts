import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    preview: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/server/projection-scenario', () => ({
    getProjectionScenarioPreviewForUser: mocks.preview,
    InvalidScenarioCategoryError: class InvalidScenarioCategoryError extends Error {},
    InvalidScenarioAccountError: class InvalidScenarioAccountError extends Error {},
}))

const { POST } = await import('@/app/api/projection/scenarios/preview/route')
const { InvalidScenarioAccountError, InvalidScenarioCategoryError } = await import('@/lib/server/projection-scenario')

function request(body: unknown) {
    return new Request('http://localhost/api/projection/scenarios/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

const emptyPreview = {
    base: { currentPeriod: '2026-07', projection: [] },
    scenario: { currentPeriod: '2026-07', projection: [] },
    comparison: {
        periods: [],
        horizon: {
            base: { ars: 0, usd: 0 },
            scenario: { ars: 0, usd: 0 },
            difference: { ars: 0, usd: 0 },
        },
        changeCount: 0,
    },
    warnings: [],
}

describe('POST /api/projection/scenarios/preview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.preview.mockResolvedValue(emptyPreview)
    })

    it('requiere autenticación y nunca permite cache', async () => {
        mocks.auth.mockResolvedValue(null)
        const response = await POST(request({ view: { mode: 'monthly', months: 6 }, changes: [] }))
        expect(response.status).toBe(401)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(mocks.connectDB).not.toHaveBeenCalled()
    })

    it.each([
        { view: { mode: 'monthly', months: 6 }, changes: [], unexpected: true },
        { view: { mode: 'annual', months: 6 }, changes: [] },
        { view: { mode: 'monthly', year: 2026 }, changes: [] },
        {
            view: { mode: 'monthly', months: 6 },
            changes: [{
                id: 'bad-date',
                type: 'hypothetical',
                description: 'Gasto',
                amount: 10,
                currency: 'ARS',
                expense: { type: 'commitment', recurrence: { type: 'once', date: '2026-02-31' } },
            }],
        },
        {
            view: { mode: 'monthly', months: 6 },
            changes: [{
                id: 'move-forward',
                type: 'adjust',
                target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-07' },
                scope: 'forward',
                amount: 100,
                destinationPeriod: '2026-08',
            }],
        },
    ])('rechaza contratos no estrictos', async (body) => {
        const response = await POST(request(body))
        expect(response.status).toBe(400)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(mocks.preview).not.toHaveBeenCalled()
    })

    it('limita el escenario a 50 cambios', async () => {
        const changes = Array.from({ length: 51 }, (_, index) => ({
            id: `hypothesis-${index}`,
            type: 'hypothetical',
            description: 'Gasto',
            amount: 10,
            currency: 'ARS',
            expense: { type: 'commitment', recurrence: { type: 'once', date: '2026-08-01' } },
        }))
        const response = await POST(request({ view: { mode: 'monthly', months: 6 }, changes }))
        expect(response.status).toBe(400)
        expect(mocks.preview).not.toHaveBeenCalled()
    })

    it('recalcula y serializa el preview validado para el usuario autenticado', async () => {
        const body = {
            view: { mode: 'monthly', months: 6 },
            changes: [{
                id: 'omit-rent',
                type: 'omit',
                target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-07' },
                scope: 'occurrence',
            }],
        }
        const response = await POST(request(body))
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(mocks.preview).toHaveBeenCalledWith('user-1', body)
        expect(JSON.parse(JSON.stringify(data))).toEqual(data)
    })

    it('rechaza JSON inválido sin consultar ni escribir datos financieros', async () => {
        const response = await POST(new Request('http://localhost/api/projection/scenarios/preview', {
            method: 'POST',
            body: '{',
        }))
        expect(response.status).toBe(400)
        expect(mocks.connectDB).not.toHaveBeenCalled()
        expect(mocks.preview).not.toHaveBeenCalled()
    })

    it('traduce una categoría ajena sin exponer si existe para otro usuario', async () => {
        mocks.preview.mockRejectedValue(new InvalidScenarioCategoryError())
        const response = await POST(request({
            view: { mode: 'monthly', months: 6 },
            changes: [{
                id: 'foreign-category',
                type: 'hypothetical',
                description: 'Gasto',
                amount: 10,
                currency: 'ARS',
                categoryId: '720000000000000000000002',
                expense: { type: 'commitment', recurrence: { type: 'once', date: '2026-08-01' } },
            }],
        }))

        expect(response.status).toBe(400)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    })

    it('rechaza una tarjeta ajena o inactiva sin exponer su existencia', async () => {
        mocks.preview.mockRejectedValue(new InvalidScenarioAccountError())
        const response = await POST(request({
            view: { mode: 'monthly', months: 6 },
            changes: [{
                id: 'foreign-card',
                type: 'hypothetical',
                description: 'Compra',
                amount: 120,
                currency: 'USD',
                expense: {
                    type: 'card_single',
                    accountId: '720000000000000000000003',
                    purchaseDate: '2026-07-31',
                    firstClosingMonth: '2026-08',
                },
            }],
        }))

        expect(response.status).toBe(400)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    })
})
