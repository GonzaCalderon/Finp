import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectionResponse } from '@/types/projection'

const mocks = vi.hoisted(() => ({
    apiJson: vi.fn(),
    invalidationCallback: null as null | (() => void),
}))

vi.mock('@/lib/client/auth-client', () => ({ apiJson: mocks.apiJson }))
vi.mock('@/hooks/useDataInvalidation', () => ({
    useDataInvalidation: (_tags: readonly string[], callback: () => void) => {
        mocks.invalidationCallback = callback
    },
}))
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }))
vi.mock('@/components/shared/AppStartupGate', () => ({ useAppStartupReady: vi.fn() }))
vi.mock('@/contexts/HideAmountsContext', () => ({ useHideAmounts: () => ({ hidden: false }) }))
vi.mock('@/hooks/usePreferences', () => ({
    usePreferences: () => ({
        preferences: {
            projectionMode: 'monthly',
            projectionMonths: 6,
            projectionGrouping: 'type',
            projectionChartCurrency: 'ARS',
        },
        setProjectionPreferences: vi.fn(),
    }),
}))
vi.mock('@/components/projection/ProjectionControls', () => ({
    ProjectionControls: () => <div>Controles</div>,
}))
vi.mock('@/components/projection/ProjectionChart', () => ({
    ProjectionChart: () => <div>Grafico</div>,
}))
vi.mock('@/components/projection/ProjectionPeriodCard', () => ({
    ProjectionPeriodCard: ({ period }: { period: { month: string } }) => <div>{period.month}</div>,
}))
vi.mock('@/components/shared/CurrencyBreakdownAmount', () => ({
    CurrencyBreakdownAmount: () => <span>importe</span>,
}))

const ProjectionPage = (await import('@/app/(app)/projection/page')).default

function response(month: string): ProjectionResponse {
    return {
        currentPeriod: '2026-07',
        projection: [{
            month,
            isCurrentMonth: month === '2026-07',
            isPast: false,
            items: [{
                id: `item:${month}`,
                sourceId: 'item',
                source: { type: 'scheduled_commitment', id: 'item' },
                kind: 'commitment',
                description: 'Alquiler',
                amount: 100,
                currency: 'ARS',
                certainty: 'confirmed',
                isRegistered: true,
                link: { href: '/commitments', label: 'Ver' },
            }],
            totals: {
                commitments: { ars: 100, usd: 0 },
                cardSingle: { ars: 0, usd: 0 },
                cardInstallments: { ars: 0, usd: 0 },
                estimated: { ars: 0, usd: 0 },
                total: { ars: 100, usd: 0 },
                pendingAmountCount: 0,
            },
        }],
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

describe('ProjectionPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.invalidationCallback = null
    })

    it('muestra error, limpia ese error al reintentar y recupera la vista', async () => {
        const user = userEvent.setup()
        mocks.apiJson.mockRejectedValueOnce(new Error('Fallo temporal'))
        mocks.apiJson.mockResolvedValueOnce(response('2026-08'))
        render(<ProjectionPage />)

        expect(await screen.findByRole('alert')).toHaveTextContent('Fallo temporal')
        await user.click(screen.getByRole('button', { name: /Reintentar/i }))

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(await screen.findByText('2026-08')).toBeInTheDocument()
    })

    it('descarta una respuesta obsoleta cuando llega despues de una recarga', async () => {
        const first = deferred<ProjectionResponse>()
        const second = deferred<ProjectionResponse>()
        mocks.apiJson.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        render(<ProjectionPage />)

        await waitFor(() => expect(mocks.apiJson).toHaveBeenCalledTimes(1))
        act(() => mocks.invalidationCallback?.())
        await waitFor(() => expect(mocks.apiJson).toHaveBeenCalledTimes(2))

        await act(async () => second.resolve(response('2026-09')))
        expect(await screen.findByText('2026-09')).toBeInTheDocument()

        await act(async () => first.resolve(response('2026-08')))
        expect(screen.queryByText('2026-08')).not.toBeInTheDocument()
        expect(screen.getByText('2026-09')).toBeInTheDocument()
    })
})
