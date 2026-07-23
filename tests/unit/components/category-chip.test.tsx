import React from 'react'
import { render, screen } from '@testing-library/react'
import { Types } from 'mongoose'
import { describe, expect, it, vi } from 'vitest'

import type { ICategory } from '@/types'

interface MotionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variants?: unknown
    whileHover?: unknown
    whileTap?: unknown
    transition?: unknown
    initial?: unknown
}

vi.mock('framer-motion', () => ({
    motion: {
        button: (props: MotionButtonProps) => {
            const nativeProps = { ...props }
            delete nativeProps.variants
            delete nativeProps.whileHover
            delete nativeProps.whileTap
            delete nativeProps.transition
            delete nativeProps.initial
            return <button {...nativeProps} />
        },
    },
}))

const { CategoryChip } = await import('@/components/shared/transaction-dialog/shared-ui')

function category(overrides: Partial<ICategory> = {}): ICategory {
    return {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        name: 'Supermercado',
        type: 'expense',
        color: '#22c55e',
        isDefault: true,
        isArchived: false,
        sortOrder: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides,
    }
}

describe('CategoryChip', () => {
    it('muestra el color propio de una categoría aun cuando no está seleccionada', () => {
        const { rerender } = render(
            <CategoryChip category={category()} selected={false} onClick={() => undefined} />
        )

        const button = screen.getByRole('button', { name: 'Supermercado' })
        const colorMarker = button.querySelector('[aria-hidden="true"]')

        expect(button).toHaveAttribute('aria-pressed', 'false')
        expect(colorMarker).toHaveStyle({ background: '#22c55e' })

        rerender(<CategoryChip category={category()} selected onClick={() => undefined} />)

        expect(screen.getByRole('button', { name: 'Supermercado' })).toHaveAttribute('aria-pressed', 'true')
    })
})
