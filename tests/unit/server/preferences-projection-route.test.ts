import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    User: {
        findOne: mocks.findOne,
        findOneAndUpdate: mocks.findOneAndUpdate,
    },
}))

const { GET, PATCH } = await import('@/app/api/preferences/route')

describe('preferencias de proyeccion', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { email: 'USER@finp.test' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.findOne.mockResolvedValue({ preferences: {} })
        mocks.findOneAndUpdate.mockResolvedValue({ preferences: {} })
    })

    it('devuelve defaults seguros y toma la moneda consolidada para el grafico', async () => {
        mocks.findOne.mockResolvedValue({ preferences: { consolidatedCurrency: 'USD' } })

        const response = await GET()

        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        await expect(response.json()).resolves.toMatchObject({
            preferences: {
                projectionGrouping: 'type',
                projectionMode: 'monthly',
                projectionMonths: 6,
                projectionChartCurrency: 'USD',
            },
        })
    })

    it.each([
        [{ projectionGrouping: 'merchant' }, 'Agrup'],
        [{ projectionMode: 'quarterly' }, 'Modo'],
        [{ projectionMonths: 2 }, 'Horizonte'],
        [{ projectionChartCurrency: 'EUR' }, 'Moneda'],
    ])('rechaza una preferencia invalida %#', async (body, message) => {
        const response = await PATCH(new Request('http://localhost/api/preferences', {
            method: 'PATCH',
            body: JSON.stringify(body),
        }))

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining(message) })
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled()
    })

    it('persiste las cuatro preferencias por usuario y las devuelve', async () => {
        const preferences = {
            projectionGrouping: 'card',
            projectionMode: 'annual',
            projectionMonths: 9,
            projectionChartCurrency: 'USD',
        }
        mocks.findOneAndUpdate.mockResolvedValue({ preferences })

        const response = await PATCH(new Request('http://localhost/api/preferences', {
            method: 'PATCH',
            body: JSON.stringify(preferences),
        }))

        expect(response.status).toBe(200)
        expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
            { email: 'user@finp.test' },
            { $set: {
                'preferences.projectionGrouping': 'card',
                'preferences.projectionMode': 'annual',
                'preferences.projectionMonths': 9,
                'preferences.projectionChartCurrency': 'USD',
            } },
            { new: true, select: 'preferences' }
        )
        await expect(response.json()).resolves.toMatchObject({ preferences })
    })
})
