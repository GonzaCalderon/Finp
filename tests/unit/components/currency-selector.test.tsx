import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CurrencyMultiSelector } from '@/components/shared/CurrencyMultiSelector'
import { CurrencySelector } from '@/components/shared/CurrencySelector'

describe('CurrencySelector', () => {
    it('usa pills para una o dos monedas', () => {
        render(
            <CurrencySelector
                value="ARS"
                options={['ARS', 'USD'] as const}
                onValueChange={() => undefined}
            />
        )

        expect(screen.getByRole('radio', { name: 'ARS' })).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: 'USD' })).toBeInTheDocument()
    })

    it('usa un buscador para catalogos amplios y soporta fallback sin bandera', () => {
        render(
            <CurrencySelector
                value="ARS"
                options={['ARS', 'USD', 'EUR', 'FINP'] as const}
                onValueChange={() => undefined}
            />
        )

        fireEvent.click(screen.getByRole('combobox', { name: 'Moneda' }))
        const search = screen.getByPlaceholderText('Buscar moneda')
        fireEvent.change(search, { target: { value: 'FINP' } })

        expect(screen.getByText('Moneda personalizada')).toBeInTheDocument()
        expect(screen.getByTitle('FINP')).toBeInTheDocument()
    })
})

describe('CurrencyMultiSelector', () => {
    it('permite selección múltiple sin dejar menos del mínimo indicado', () => {
        const onValueChange = vi.fn()
        render(
            <CurrencyMultiSelector
                value={['ARS']}
                options={['ARS', 'USD'] as const}
                onValueChange={onValueChange}
                minimumSelections={1}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'ARS' }))
        expect(onValueChange).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'USD' }))
        expect(onValueChange).toHaveBeenCalledWith(['ARS', 'USD'])
    })
})
