import { motion } from 'framer-motion'
import { Search, Sparkles, Wand2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { TransactionRuleProposal } from '@/lib/utils/transaction-description-intelligence'
import type { ICategory } from '@/types'
import { StepSection } from './StepSection'
import { CategoryChip, SURFACE } from './shared-ui'

interface TransactionClassificationStepProps {
    showCategory: boolean
    categoryId: string | undefined
    appliedRuleName: string | null
    categoryQuery: string
    normalizedCategoryQuery: string
    availableCategories: ICategory[]
    visibleCategories: ICategory[]
    selectedCategory: ICategory | undefined
    categoryReason?: string
    ruleProposal?: TransactionRuleProposal
    isCreatingRule?: boolean
    onCategorySelect: (id: string) => void
    onCategoryQueryChange: (query: string) => void
    onCreateSuggestedRule?: () => void
}

export function TransactionClassificationStep({
    showCategory,
    categoryId,
    appliedRuleName,
    categoryQuery,
    normalizedCategoryQuery,
    availableCategories,
    visibleCategories,
    selectedCategory,
    categoryReason,
    ruleProposal,
    isCreatingRule,
    onCategorySelect,
    onCategoryQueryChange,
    onCreateSuggestedRule,
}: TransactionClassificationStepProps) {
    return (
        <StepSection>
            <motion.div
                className="space-y-5"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {showCategory && (
                    <motion.div variants={staggerItem} className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <Label>Categorias</Label>
                                <p className="text-xs text-muted-foreground">
                                    Ordenadas segun tu uso reciente y movimientos similares.
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
                            <motion.div variants={staggerItem} className="rounded-[1.6rem] border px-4 py-3 text-sm" style={SURFACE.panel}>
                                <p className="font-medium">Sugerida por regla: {appliedRuleName}</p>
                                <p className="mt-1 text-xs text-muted-foreground">La dejamos preseleccionada, pero podes cambiarla sin friccion.</p>
                            </motion.div>
                        )}

                        {!appliedRuleName && selectedCategory && categoryReason && normalizedCategoryQuery.length === 0 && (
                            <motion.p
                                variants={staggerItem}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                                <Sparkles className="h-3.5 w-3.5 text-[var(--sky)]" />
                                {categoryReason}
                            </motion.p>
                        )}

                        {!appliedRuleName &&
                            ruleProposal &&
                            selectedCategory &&
                            ruleProposal.categoryId === selectedCategory._id.toString() &&
                            onCreateSuggestedRule &&
                            normalizedCategoryQuery.length === 0 && (
                                <motion.div
                                    variants={staggerItem}
                                    className="flex items-center justify-between gap-3 rounded-[1.35rem] border px-3 py-2.5"
                                    style={SURFACE.panel}
                                >
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-1.5 text-xs font-medium">
                                            <Wand2 className="h-3.5 w-3.5 text-[var(--sky)]" />
                                            Automatizar próximos movimientos
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {ruleProposal.reason}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 shrink-0 rounded-lg px-2.5 text-xs"
                                        disabled={isCreatingRule}
                                        onClick={onCreateSuggestedRule}
                                    >
                                        {isCreatingRule ? 'Creando...' : 'Crear regla'}
                                    </Button>
                                </motion.div>
                            )}

                        {availableCategories.length > 0 && (
                            <motion.div variants={staggerItem} className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={categoryQuery}
                                    onChange={(event) => onCategoryQueryChange(event.target.value)}
                                    placeholder="Buscar categoria"
                                    className="pl-9"
                                />
                            </motion.div>
                        )}

                        <motion.div variants={staggerItem}>
                            {visibleCategories.length > 0 ? (
                                <div
                                    className="flex flex-wrap gap-2"
                                    aria-label={
                                        normalizedCategoryQuery
                                            ? 'Resultados de categorias'
                                            : 'Categorias ordenadas por relevancia'
                                    }
                                >
                                    {visibleCategories.map((category) => (
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
                        </motion.div>
                    </motion.div>
                )}
            </motion.div>
        </StepSection>
    )
}
