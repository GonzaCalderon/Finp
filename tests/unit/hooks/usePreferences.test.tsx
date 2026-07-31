import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    apiJson: vi.fn(),
    invalidateData: vi.fn(),
}))

vi.mock('@/lib/client/auth-client', () => ({ apiJson: mocks.apiJson }))
vi.mock('@/lib/client/data-sync', () => ({
    invalidateData: mocks.invalidateData,
    PREFERENCE_INVALIDATION_TAGS: ['preferences'],
}))
vi.mock('@/hooks/useDataInvalidation', () => ({ useDataInvalidation: vi.fn() }))

const { usePreferences } = await import('@/hooks/usePreferences')

describe('usePreferences para proyeccion', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        mocks.apiJson.mockRejectedValue(new Error('sin conexion'))
    })

    it('usa defaults seguros cuando no hay preferencias guardadas', () => {
        const { result } = renderHook(() => usePreferences())

        expect(result.current.preferences).toMatchObject({
            projectionGrouping: 'type',
            projectionMode: 'monthly',
            projectionMonths: 6,
            projectionChartCurrency: 'ARS',
        })
    })

    it('mantiene el fallback local si la API no esta disponible', async () => {
        localStorage.setItem('finp-projection-grouping', 'category')
        localStorage.setItem('finp-projection-mode', 'annual')
        localStorage.setItem('finp-projection-months', '9')
        localStorage.setItem('finp-projection-chart-currency', 'USD')

        const { result } = renderHook(() => usePreferences())

        await waitFor(() => expect(result.current.preferences).toMatchObject({
            projectionGrouping: 'category',
            projectionMode: 'annual',
            projectionMonths: 9,
            projectionChartCurrency: 'USD',
        }))
    })

    it('actualiza en forma optimista, persiste localmente y sincroniza con la API', async () => {
        mocks.apiJson.mockImplementation((_input, init?: RequestInit) =>
            init?.method === 'PATCH' ? Promise.resolve({}) : Promise.reject(new Error('sin conexion'))
        )
        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setProjectionPreferences({
                projectionGrouping: 'card',
                projectionMonths: 12,
                projectionChartCurrency: 'USD',
            })
        })

        expect(result.current.preferences).toMatchObject({
            projectionGrouping: 'card',
            projectionMonths: 12,
            projectionChartCurrency: 'USD',
        })
        expect(localStorage.getItem('finp-projection-grouping')).toBe('card')
        expect(localStorage.getItem('finp-projection-months')).toBe('12')
        expect(localStorage.getItem('finp-projection-chart-currency')).toBe('USD')
        await waitFor(() => expect(mocks.apiJson).toHaveBeenCalledWith('/api/preferences', expect.objectContaining({
            method: 'PATCH',
        })))
    })
})
