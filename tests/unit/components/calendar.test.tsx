import { render, screen } from '@testing-library/react'
import { enUS } from 'react-day-picker/locale'
import { describe, expect, it } from 'vitest'

import { Calendar } from '@/components/ui/calendar'

describe('Calendar', () => {
    it('usa español por defecto para el mes y la navegación', () => {
        render(<Calendar month={new Date(2026, 0, 1)} />)

        expect(screen.getByText(/enero 2026/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ir al mes anterior' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ir al mes siguiente' })).toBeInTheDocument()
    })

    it('permite sobrescribir el idioma cuando un uso lo necesita', () => {
        render(<Calendar locale={enUS} month={new Date(2026, 0, 1)} />)

        expect(screen.getByText(/january 2026/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Go to the Next Month' })).toBeInTheDocument()
    })
})
