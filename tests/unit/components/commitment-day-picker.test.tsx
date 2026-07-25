import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommitmentDayPicker } from '@/components/commitments/CommitmentDayPicker'

describe('CommitmentDayPicker', () => {
    it('abre un calendario mensual compacto y permite elegir un día', () => {
        const onChange = vi.fn()

        render(<CommitmentDayPicker value={3} onChange={onChange} />)

        fireEvent.click(screen.getByRole('button', { name: 'Día 3' }))

        expect(
            screen.getAllByRole('button', { name: /del mes/i })
        ).toHaveLength(31)
        expect(
            screen.getByRole('gridcell', { name: '3' })
        ).toHaveAttribute('aria-selected', 'true')

        fireEvent.click(screen.getByRole('button', { name: 'Día 31 del mes' }))
        expect(onChange).toHaveBeenCalledWith(31)
    })
})
