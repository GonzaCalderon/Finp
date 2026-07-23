import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CurrencyPillSelector } from '@/components/shared/CurrencyPillSelector'

describe('CurrencyPillSelector', () => {
    it('expone las monedas como radios y permite cambiar la seleccion', () => {
        const onValueChange = vi.fn()

        render(
            <CurrencyPillSelector
                value="ARS"
                options={['ARS', 'USD'] as const}
                onValueChange={onValueChange}
            />
        )

        expect(screen.getByRole('radio', { name: 'ARS' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('radio', { name: 'USD' })).toHaveAttribute('aria-checked', 'false')

        fireEvent.click(screen.getByRole('radio', { name: 'USD' }))
        expect(onValueChange).toHaveBeenCalledWith('USD')
    })

    it('mantiene visible una moneda fija sin permitir cambios', () => {
        const onValueChange = vi.fn()

        render(
            <CurrencyPillSelector
                value="ARS"
                options={['ARS'] as const}
                readOnly
                onValueChange={onValueChange}
            />
        )

        const arsPill = screen.getByRole('radio', { name: 'ARS' })
        expect(arsPill).toBeDisabled()

        fireEvent.click(arsPill)
        expect(onValueChange).not.toHaveBeenCalled()
    })
})
