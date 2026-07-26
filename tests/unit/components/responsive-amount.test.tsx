import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'

describe('ResponsiveAmount', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it.each([
        ['inválida', 'MONEDA_INVALIDA'],
        ['vacía', ''],
        ['ausente', undefined],
    ])('usa ARS y avisa cuando la moneda es %s', (_, currency) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        render(<ResponsiveAmount amount={1250} currency={currency} />)

        expect(screen.getByText(/\$\s?1\.250/)).toBeInTheDocument()
        expect(screen.getByTitle(/\$\s?1\.250/)).toBeInTheDocument()
        expect(warn).toHaveBeenCalledOnce()
    })
})
