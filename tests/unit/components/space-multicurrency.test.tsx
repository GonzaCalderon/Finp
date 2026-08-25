import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }))

import { SpaceCurrencyComposition } from '@/components/spaces/detail/SpaceCurrencyComposition'
import { SpaceQuoteTicker } from '@/components/spaces/detail/SpaceQuoteTicker'
import { moneyFromDecimal, type ConversionSnapshot } from '@/lib/utils/money'

const snapshot: ConversionSnapshot = {
    rate: '1300',
    direction: 'multiply',
    source: 'dolarapi_official',
    observedAt: '2026-08-24T14:31:00.000Z',
    capturedAt: '2026-08-24T14:32:00.000Z',
    expiresAt: '2026-08-24T14:46:00.000Z',
    path: [{ fromCurrency: 'USD', toCurrency: 'ARS', rate: '1300', source: 'dolarapi_official' }],
}

describe('composición multimoneda', () => {
    it('explica Incluye… y permite transferir el filtro a movimientos', () => {
        const filter = vi.fn()
        render(<SpaceCurrencyComposition
            amount={150_000}
            reportingCurrency="ARS"
            hidden={false}
            composition={[
                {
                    currency: 'ARS',
                    original: moneyFromDecimal('ARS', 85_000),
                    historicalReporting: moneyFromDecimal('ARS', 85_000),
                    snapshots: [],
                },
                {
                    currency: 'USD',
                    original: moneyFromDecimal('USD', 50),
                    historicalReporting: moneyFromDecimal('ARS', 65_000),
                    snapshots: [snapshot],
                },
            ]}
            onFilterCurrency={filter}
        />)
        fireEvent.click(screen.getByRole('button', { name: /Incluye USD/i }))
        expect(screen.getByText('Composición del total')).toBeInTheDocument()
        expect(screen.getByText(/Referencia guardada/)).toHaveTextContent('1 USD = 1300 ARS')
        fireEvent.click(screen.getAllByRole('button', { name: /Ver movimientos/i })[1])
        expect(filter).toHaveBeenCalledWith('USD')
    })
})

describe('tira de cotizaciones', () => {
    beforeEach(() => {
        class ResizeObserverMock {
            observe() {}
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    })

    it('muestra par, fuente, hora y control de actualización accesible', () => {
        const refresh = vi.fn()
        render(<SpaceQuoteTicker
            data={{
                reportingCurrency: 'ARS',
                fetchedAt: '2026-08-24T14:32:00.000Z',
                quotes: [{
                    fingerprint: 'quote-fingerprint-123456',
                    sourceCurrency: 'USD',
                    targetCurrency: 'ARS',
                    rate: '1300',
                    direction: 'multiply',
                    source: 'dolarapi_official',
                    status: 'current',
                    observedAt: snapshot.observedAt,
                    capturedAt: snapshot.capturedAt,
                    expiresAt: snapshot.expiresAt,
                    path: snapshot.path,
                }],
            }}
            loading={false}
            error={null}
            onRefresh={refresh}
        />)
        expect(screen.getByText(/Cotizaciones de referencia/)).toBeInTheDocument()
        expect(screen.getByText('USD/ARS')).toBeInTheDocument()
        expect(screen.getByText('DolarAPI · oficial')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Actualizar cotizaciones' }))
        expect(refresh).toHaveBeenCalledOnce()
    })
})
