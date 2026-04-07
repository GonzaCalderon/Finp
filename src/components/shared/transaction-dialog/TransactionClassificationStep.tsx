import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DURATION, easeSmooth, easeSoft } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { ICategory } from '@/types'
import { StepSection } from './StepSection'
import { CategoryChip, subtlePanelStyle } from './shared-ui'

interface TransactionClassificationStepProps {
    type: TransactionFormInput['type']
    showCategory: boolean
    categoryId: string | undefined
    appliedRuleName: string | null
    categoryQuery: string
    showAllCategories: boolean
    normalizedCategoryQuery: string
    filteredCategories: ICategory[]
    recentCategories: ICategory[]
    suggestedCategories: ICategory[]
    extraCategories: ICategory[]
    selectedCategory: ICategory | undefined
    onCategorySelect: (id: string) => void
    onCategoryQueryChange: (query: string) => void
    onToggleShowAllCategories: () => void
}

export function TransactionClassificationStep({
    type,
    showCategory,
    categoryId,
    appliedRuleName,
    categoryQuery,
    showAllCategories,
    normalizedCategoryQuery,
    filteredCategories,
    recentCategories,
    suggestedCategories,
    extraCategories,
    selectedCategory,
    onCategorySelect,
    onCategoryQueryChange,
    onToggleShowAllCategories,
}: TransactionClassificationStepProps) {
    return (
        <StepSection
            eyebrow="Paso 4"
            title="Elegi la categoria"
            subtitle="Resolve esto rapido: una sugerida, una frecuente o una busqueda corta."
        >
            <div className="space-y-5">
                {showCategory && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <Label>Categorias</Label>
                                <p className="text-xs text-muted-foreground">
                                    {type === 'income' ? 'Mostramos ingresos compatibles.' : 'Mostramos gastos compatibles.'}
                                </p>
                            </div>
                            {selectedCategory && (
                                <span
                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                    style={{ background: selectedCategory.color || 'rgba(74,158,204,0.10)', color: '#fff' }}
                                >
                                    {selectedCategory.name}
                                </span>
                            )}
                        </div>

                        {appliedRuleName && selectedCategory && normalizedCategoryQuery.length === 0 && (
                            <div className="rounded-3xl border px-4 py-3 text-sm" style={subtlePanelStyle}>
                                <p className="font-medium">Sugerida por regla: {appliedRuleName}</p>
                                <p className="mt-1 text-xs text-muted-foreground">La dejamos preseleccionada, pero podes cambiarla sin friccion.</p>
                            </div>
                        )}

                        {filteredCategories.length > 0 && (
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={categoryQuery}
                                    onChange={(event) => onCategoryQueryChange(event.target.value)}
                                    placeholder="Buscar categoria"
                                    className="pl-9"
                                />
                            </div>
                        )}

                        {recentCategories.length > 0 && normalizedCategoryQuery.length === 0 && (
                            <div className="space-y-2">
                                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Frecuentes</p>
                                <div className="flex flex-wrap gap-2">
                                    {recentCategories.map((category) => (
                                        <CategoryChip
                                            key={`recent-${category._id.toString()}`}
                                            category={category}
                                            selected={categoryId === category._id.toString()}
                                            onClick={() => onCategorySelect(category._id.toString())}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                {normalizedCategoryQuery.length > 0 ? 'Resultados' : 'Sugeridas'}
                            </p>
                            {suggestedCategories.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {suggestedCategories.map((category) => (
                                        <CategoryChip
                                            key={category._id.toString()}
                                            category={category}
                                            selected={categoryId === category._id.toString()}
                                            onClick={() => onCategorySelect(category._id.toString())}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {normalizedCategoryQuery.length > 0
                                        ? `No encontramos categorias para "${categoryQuery}".`
                                        : 'No hay categorias para este tipo.'}
                                </p>
                            )}
                        </div>

                        {extraCategories.length > 0 && normalizedCategoryQuery.length === 0 && (
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={onToggleShowAllCategories}
                                    className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                                    data-testid="transaction-toggle-all-categories"
                                >
                                    <span>{showAllCategories ? 'Ver menos' : `Ver todas (${extraCategories.length})`}</span>
                                    {showAllCategories ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>

                                <AnimatePresence initial={false}>
                                    {showAllCategories && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto', transition: { duration: DURATION.normal, ease: easeSmooth } }}
                                            exit={{ opacity: 0, height: 0, transition: { duration: DURATION.fast, ease: easeSoft } }}
                                            className="flex flex-wrap gap-2 overflow-hidden rounded-3xl border p-4"
                                            style={subtlePanelStyle}
                                        >
                                            {extraCategories.map((category) => (
                                                <CategoryChip
                                                    key={`extra-${category._id.toString()}`}
                                                    category={category}
                                                    selected={categoryId === category._id.toString()}
                                                    onClick={() => onCategorySelect(category._id.toString())}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </StepSection>
    )
}
