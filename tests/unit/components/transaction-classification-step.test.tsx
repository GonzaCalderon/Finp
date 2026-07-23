import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Types } from 'mongoose'
import { describe, expect, it, vi } from 'vitest'

import type { ICategory } from '@/types'

interface MotionProps extends React.HTMLAttributes<HTMLElement> {
    variants?: unknown
    whileHover?: unknown
    whileTap?: unknown
    transition?: unknown
    initial?: unknown
    animate?: unknown
}

function nativeMotionProps(props: MotionProps) {
    const nativeProps = { ...props }
    delete nativeProps.variants
    delete nativeProps.whileHover
    delete nativeProps.whileTap
    delete nativeProps.transition
    delete nativeProps.initial
    delete nativeProps.animate
    return nativeProps
}

vi.mock('framer-motion', () => ({
    motion: {
        section: (props: MotionProps) => <section {...nativeMotionProps(props)} />,
        div: (props: MotionProps) => <div {...nativeMotionProps(props)} />,
        p: (props: MotionProps) => <p {...nativeMotionProps(props)} />,
        button: (props: MotionProps) => <button {...nativeMotionProps(props)} />,
    },
}))

const { TransactionClassificationStep } = await import(
    '@/components/shared/transaction-dialog/TransactionClassificationStep'
)

function category(name: string, color: string): ICategory {
    return {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        name,
        type: 'expense',
        color,
        isDefault: true,
        isArchived: false,
        sortOrder: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }
}

describe('TransactionClassificationStep', () => {
    it('muestra todas las categorias en una unica lista sin colapsable', () => {
        const categories = [
            category('Supermercado', '#22c55e'),
            category('Transporte', '#3b82f6'),
            category('Salud', '#ec4899'),
            category('Servicios', '#6b7280'),
        ]

        render(
            <TransactionClassificationStep
                showCategory
                categoryId={undefined}
                appliedRuleName={null}
                categoryQuery=""
                normalizedCategoryQuery=""
                availableCategories={categories}
                visibleCategories={categories}
                selectedCategory={undefined}
                onCategorySelect={() => undefined}
                onCategoryQueryChange={() => undefined}
            />
        )

        categories.forEach((item) => {
            expect(screen.getByRole('button', { name: item.name })).toBeInTheDocument()
        })
        expect(screen.queryByText(/sugeridas/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/frecuentes/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/ver todas|ver menos/i)).not.toBeInTheDocument()
    })

    it('mantiene la busqueda como filtro directo de la lista', () => {
        const onQueryChange = vi.fn()

        render(
            <TransactionClassificationStep
                showCategory
                categoryId={undefined}
                appliedRuleName={null}
                categoryQuery=""
                normalizedCategoryQuery=""
                availableCategories={[category('Supermercado', '#22c55e')]}
                visibleCategories={[category('Supermercado', '#22c55e')]}
                selectedCategory={undefined}
                onCategorySelect={() => undefined}
                onCategoryQueryChange={onQueryChange}
            />
        )

        fireEvent.change(screen.getByPlaceholderText('Buscar categoria'), {
            target: { value: 'super' },
        })

        expect(onQueryChange).toHaveBeenCalledWith('super')
    })

    it('explica la recomendacion y permite crear una regla sugerida', () => {
        const selected = category('Transporte', '#3b82f6')
        const onCreateSuggestedRule = vi.fn()

        render(
            <TransactionClassificationStep
                showCategory
                categoryId={selected._id.toString()}
                appliedRuleName={null}
                categoryQuery=""
                normalizedCategoryQuery=""
                availableCategories={[selected]}
                visibleCategories={[selected]}
                selectedCategory={selected}
                categoryReason="La usaste en movimientos similares."
                ruleProposal={{
                    value: 'Uber',
                    categoryId: selected._id.toString(),
                    occurrences: 3,
                    reason: 'Elegiste esta categoria en 3 movimientos parecidos.',
                }}
                onCategorySelect={() => undefined}
                onCategoryQueryChange={() => undefined}
                onCreateSuggestedRule={onCreateSuggestedRule}
            />
        )

        expect(screen.getByText(/la usaste en movimientos similares/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /crear regla/i }))
        expect(onCreateSuggestedRule).toHaveBeenCalledOnce()
    })
})
