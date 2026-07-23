import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'

function ControlledAmount({
    initialValue = 0,
    currency = 'ARS',
    allowNegative = false,
}: {
    initialValue?: number
    currency?: string
    allowNegative?: boolean
}) {
    const [value, setValue] = useState(initialValue)
    return (
        <FormattedAmountInput
            id="amount"
            label="Monto"
            value={value}
            currency={currency}
            allowNegative={allowNegative}
            onValueChangeAction={setValue}
        />
    )
}

describe('FormattedAmountInput', () => {
    it('acepta separadores argentinos y formatea miles al escribir', () => {
        render(<ControlledAmount />)
        const input = screen.getByLabelText('Monto')

        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: '1234,56' } })

        expect(input).toHaveValue('1.234,56')
    })

    it('interpreta punto o coma como decimal y conserva negativos permitidos', () => {
        const onNegative = vi.fn()
        render(
            <FormattedAmountInput
                id="amount"
                label="Monto"
                value={0}
                currency="USD"
                allowNegative
                onNegativeInputDetectedAction={onNegative}
                onValueChangeAction={() => undefined}
            />
        )
        const input = screen.getByLabelText('Monto')

        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: '-12.50' } })

        expect(input).toHaveValue('-12,50')
        expect(onNegative).toHaveBeenCalled()
    })

    it('muestra moneda ISO, bandera y respeta disabled/read-only', () => {
        const { rerender } = render(
            <FormattedAmountInput
                id="amount"
                label="Monto"
                value={100}
                currency="EUR"
                disabled
                onValueChangeAction={() => undefined}
            />
        )

        expect(screen.getByLabelText('Monto')).toBeDisabled()
        expect(screen.getByTitle(/EUR/)).toHaveClass('rounded-full', 'h-5', 'w-5')

        rerender(
            <FormattedAmountInput
                id="amount"
                label="Monto"
                value={100}
                currency="EUR"
                readOnly
                onValueChangeAction={() => undefined}
            />
        )
        expect(screen.getByLabelText('Monto')).toHaveAttribute('readonly')
    })
})
