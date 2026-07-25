import { motion } from 'framer-motion'
import { Sparkles, Wand2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CategoryPickerField } from '@/components/shared/CategoryPickerField'
import { staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { TransactionRuleProposal } from '@/lib/utils/transaction-description-intelligence'
import type { ICategory } from '@/types'
import { StepSection } from './StepSection'
import { SURFACE } from './shared-ui'

interface TransactionClassificationStepProps {
    showCategory: boolean
    categoryId: string | undefined
    appliedRuleName: string | null
    categoryQuery: string
    availableCategories: ICategory[]
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
    availableCategories,
    selectedCategory,
    categoryReason,
    ruleProposal,
    isCreatingRule,
    onCategorySelect,
    onCategoryQueryChange,
    onCreateSuggestedRule,
}: TransactionClassificationStepProps) {
    const normalizedCategoryQuery = categoryQuery.trim().toLocaleLowerCase('es')

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
                        <CategoryPickerField
                            categories={availableCategories}
                            selectedCategoryId={categoryId}
                            query={categoryQuery}
                            description="Ordenadas según tu uso reciente y movimientos similares."
                            emptyMessage="No hay categorías para este tipo."
                            onQueryChange={onCategoryQueryChange}
                            onSelect={onCategorySelect}
                            context={
                                <>
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
                                </>
                            }
                        />
                    </motion.div>
                )}
            </motion.div>
        </StepSection>
    )
}
