'use client'

import { useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CategoryChip } from '@/components/shared/transaction-dialog/shared-ui'
import type { ICategory } from '@/types'

interface CategoryPickerFieldProps {
    categories: ICategory[]
    selectedCategoryId?: string
    query: string
    label?: string
    description?: string
    emptyMessage?: string
    context?: ReactNode
    collapsedLimit?: number
    onQueryChange: (query: string) => void
    onSelect: (categoryId: string) => void
}

export function CategoryPickerField({
    categories,
    selectedCategoryId,
    query,
    label = 'Categorías',
    description,
    emptyMessage = 'No hay categorías disponibles.',
    context,
    collapsedLimit,
    onQueryChange,
    onSelect,
}: CategoryPickerFieldProps) {
    const [expanded, setExpanded] = useState(false)
    const normalizedQuery = query.trim().toLocaleLowerCase('es')
    const visibleCategories = normalizedQuery
        ? categories.filter((category) =>
              category.name.toLocaleLowerCase('es').includes(normalizedQuery)
          )
        : categories
    const canCollapse = Boolean(
        collapsedLimit &&
            !normalizedQuery &&
            visibleCategories.length > collapsedLimit
    )
    const displayedCategories =
        canCollapse && !expanded
            ? visibleCategories.slice(0, collapsedLimit)
            : visibleCategories

    return (
        <div className="space-y-3">
            <div>
                <p className="text-sm font-medium leading-none">{label}</p>
                {description ? (
                    <p className="text-xs text-muted-foreground">{description}</p>
                ) : null}
            </div>

            {context}

            {categories.length > 0 ? (
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Buscar categoría"
                        className="h-11 pl-9"
                        aria-label="Buscar categoría"
                    />
                </div>
            ) : null}

            {displayedCategories.length > 0 ? (
                <div className="space-y-2">
                    <div
                        className="flex flex-wrap gap-2"
                        aria-label={
                            normalizedQuery
                                ? 'Resultados de categorías'
                                : 'Categorías ordenadas por relevancia'
                        }
                    >
                        {displayedCategories.map((category) => (
                            <CategoryChip
                                key={category._id.toString()}
                                category={category}
                                selected={selectedCategoryId === category._id.toString()}
                                onClick={() => onSelect(category._id.toString())}
                                animateOnMount={false}
                            />
                        ))}
                    </div>
                    {canCollapse ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-9 px-2"
                            onClick={() => setExpanded((current) => !current)}
                        >
                            {expanded
                                ? 'Ver menos'
                                : `Ver todas (${visibleCategories.length})`}
                        </Button>
                    ) : null}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {normalizedQuery
                        ? `No encontramos categorías para “${query}”.`
                        : emptyMessage}
                </p>
            )}
        </div>
    )
}
