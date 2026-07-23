import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DateRangePickerField } from '@/components/shared/DateRangePickerField'
import { MonthPickerField } from '@/components/shared/MonthPickerField'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'

describe('DatePickerField', () => {
    it('muestra la fecha localizada y permite limpiarla', () => {
        const onChange = vi.fn()
        render(
            <DatePickerField
                label="Fecha de pago"
                value={new Date(2026, 0, 15)}
                onChange={onChange}
                clearable
            />
        )

        expect(screen.getByText('15/1/2026')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Limpiar fecha de pago' }))
        expect(onChange).toHaveBeenCalledWith(undefined)
    })

    it('respeta el estado deshabilitado', () => {
        render(
            <DatePickerField
                label="Fecha"
                value={undefined}
                onChange={() => undefined}
                disabled
            />
        )

        expect(screen.getByRole('button', { name: /seleccioná una fecha/i })).toBeDisabled()
    })

    it('aplica límites mínimo y máximo al calendario', () => {
        render(
            <DatePickerField
                label="Fecha"
                value={new Date(2026, 0, 15)}
                onChange={() => undefined}
                minDate={new Date(2026, 0, 10)}
                maxDate={new Date(2026, 0, 20)}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /15\/1\/2026/ }))
        expect(screen.getByRole('button', { name: 'lunes, 5 de enero de 2026' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'sábado, 10 de enero de 2026' })).not.toBeDisabled()
        expect(
            screen.getByRole('button', { name: 'jueves, 15 de enero de 2026, seleccionado' })
        ).not.toBeDisabled()
        expect(screen.getByRole('button', { name: 'miércoles, 21 de enero de 2026' })).toBeDisabled()
    })
})

describe('DateRangePickerField', () => {
    it('muestra un rango localizado y permite limpiarlo', () => {
        const onChange = vi.fn()
        render(
            <DateRangePickerField
                value={{ from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) }}
                onChange={onChange}
            />
        )

        expect(screen.getByText('1/1/2026 – 31/1/2026')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Limpiar período' }))
        expect(onChange).toHaveBeenCalledWith(undefined)
    })
})

describe('MonthPickerField', () => {
    it('muestra meses localizados en español', () => {
        render(
            <MonthPickerField
                value="2026-01"
                onValueChange={() => undefined}
                options={[{ value: '2026-01', label: 'enero de 2026' }]}
            />
        )

        expect(screen.getByRole('combobox')).toHaveTextContent('enero de 2026')
    })
})
