'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus,
    Wand2,
    Pencil,
    Trash2,
    Copy,
    ChevronUp,
    ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionRuleDialog } from '@/components/shared/TransactionRuleDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { ITransactionRule, ICategory } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type RuleFormValues = {
    name: string
    isActive: boolean
    priority: number
    appliesTo: 'expense' | 'income' | 'any'
    field: 'description' | 'merchant'
    condition: 'contains' | 'equals' | 'starts_with'
    value: string
    categoryId?: string
    setType?: '' | 'expense' | 'income'
    normalizeMerchant?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const APPLIES_TO_LABELS: Record<string, string> = {
    expense: 'gastos',
    income: 'ingresos',
    any: 'cualquier tipo',
}

const FIELD_LABELS: Record<string, string> = {
    description: 'descripción',
    merchant: 'comercio',
}

const CONDITION_LABELS: Record<string, string> = {
    contains: 'contiene',
    equals: 'es igual a',
    starts_with: 'empieza con',
}

function buildRuleDescription(
    rule: ITransactionRule,
    categories: ICategory[]
): string {
    const fieldLabel = FIELD_LABELS[rule.field] ?? rule.field
    const conditionLabel = CONDITION_LABELS[rule.condition] ?? rule.condition
    const appliesToLabel = APPLIES_TO_LABELS[rule.appliesTo] ?? rule.appliesTo

    const categoryObj = categories.find(
        (c) =>
            c._id.toString() ===
            ((rule.categoryId as { _id?: { toString(): string } })?._id?.toString() ??
                rule.categoryId?.toString())
    )

    let desc = `Si ${appliesToLabel === 'cualquier tipo' ? 'la' : `la`} ${fieldLabel} ${conditionLabel} "${rule.value}"`

    const actions: string[] = []
    if (categoryObj) actions.push(`→ ${categoryObj.name}`)
    if (rule.setType) actions.push(`tipo: ${rule.setType === 'expense' ? 'gasto' : 'ingreso'}`)
    if (rule.normalizeMerchant) actions.push(`comercio: ${rule.normalizeMerchant}`)

    if (actions.length > 0) {
        desc += `  ${actions.join(' · ')}`
    }

    return desc
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
    rule,
    categories,
    onEdit,
    onDelete,
    onToggle,
    onDuplicate,
}: {
    rule: ITransactionRule
    categories: ICategory[]
    onEdit: (rule: ITransactionRule) => void
    onDelete: (rule: ITransactionRule) => void
    onToggle: (id: string, isActive: boolean) => void
    onDuplicate: (rule: ITransactionRule) => void
}) {
    const categoryObj = categories.find(
        (c) =>
            c._id.toString() ===
            ((rule.categoryId as { _id?: { toString(): string } })?._id?.toString() ??
                rule.categoryId?.toString())
    )

    const appliesToLabel = APPLIES_TO_LABELS[rule.appliesTo] ?? rule.appliesTo
    const fieldLabel = FIELD_LABELS[rule.field] ?? rule.field
    const conditionLabel = CONDITION_LABELS[rule.condition] ?? rule.condition

    return (
        <motion.div
            variants={staggerItem}
            className="rounded-2xl border p-4 transition-opacity"
            style={{
                borderColor: rule.isActive ? 'var(--border)' : 'var(--border)',
                opacity: rule.isActive ? 1 : 0.55,
                background: 'var(--card)',
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{rule.name}</span>
                        {!rule.isActive && (
                            <span
                                className="text-xs rounded-full px-2 py-0.5"
                                style={{
                                    background: 'var(--muted)',
                                    color: 'var(--muted-foreground)',
                                }}
                            >
                                Inactiva
                            </span>
                        )}
                        {rule.priority > 0 && (
                            <span
                                className="text-xs rounded-full px-2 py-0.5"
                                style={{
                                    background: 'rgba(56,189,248,0.10)',
                                    color: 'var(--sky)',
                                }}
                            >
                                P{rule.priority}
                            </span>
                        )}
                    </div>

                    {/* Natural language */}
                    <p className="text-sm text-muted-foreground leading-snug">
                        <span
                            className="rounded px-1.5 py-0.5 text-xs mr-1"
                            style={{
                                background: rule.appliesTo === 'any'
                                    ? 'rgba(148,163,184,0.12)'
                                    : rule.appliesTo === 'expense'
                                    ? 'rgba(239,68,68,0.10)'
                                    : 'rgba(16,185,129,0.10)',
                                color: rule.appliesTo === 'any'
                                    ? 'var(--muted-foreground)'
                                    : rule.appliesTo === 'expense'
                                    ? '#DC2626'
                                    : '#059669',
                            }}
                        >
                            {appliesToLabel.charAt(0).toUpperCase() + appliesToLabel.slice(1)}
                        </span>
                        Si {fieldLabel}{' '}
                        <span className="text-foreground font-medium">{conditionLabel}</span>{' '}
                        &ldquo;{rule.value}&rdquo;
                    </p>

                    {/* Actions */}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {categoryObj && (
                            <span
                                className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-medium"
                                style={{
                                    background: categoryObj.color
                                        ? `${categoryObj.color}22`
                                        : 'rgba(56,189,248,0.12)',
                                    color: categoryObj.color || 'var(--sky)',
                                }}
                            >
                                <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: categoryObj.color || 'var(--sky)' }}
                                />
                                {categoryObj.name}
                            </span>
                        )}
                        {rule.setType && (
                            <span
                                className="inline-flex text-xs rounded-full px-2.5 py-1"
                                style={{
                                    background:
                                        rule.setType === 'expense'
                                            ? 'rgba(239,68,68,0.10)'
                                            : 'rgba(16,185,129,0.10)',
                                    color: rule.setType === 'expense' ? '#DC2626' : '#059669',
                                }}
                            >
                                Tipo: {rule.setType === 'expense' ? 'Gasto' : 'Ingreso'}
                            </span>
                        )}
                        {rule.normalizeMerchant && (
                            <span
                                className="inline-flex text-xs rounded-full px-2.5 py-1"
                                style={{
                                    background: 'var(--muted)',
                                    color: 'var(--muted-foreground)',
                                }}
                            >
                                Comercio: {rule.normalizeMerchant}
                            </span>
                        )}
                        {!categoryObj && !rule.setType && !rule.normalizeMerchant && (
                            <span
                                className="text-xs"
                                style={{ color: 'var(--muted-foreground)' }}
                            >
                                Sin acciones configuradas
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions menu */}
                <div className="flex items-center gap-1 shrink-0">
                    <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => onToggle(rule._id.toString(), checked)}
                        aria-label={rule.isActive ? 'Desactivar regla' : 'Activar regla'}
                        className="mr-1"
                    />
                    <button
                        type="button"
                        onClick={() => onDuplicate(rule)}
                        className="rounded-lg p-2 transition-colors hover:bg-muted"
                        title="Duplicar regla"
                        style={{ color: 'var(--muted-foreground)' }}
                    >
                        <Copy size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(rule)}
                        className="rounded-lg p-2 transition-colors hover:bg-muted"
                        title="Editar regla"
                        style={{ color: 'var(--muted-foreground)' }}
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(rule)}
                        className="rounded-lg p-2 transition-colors hover:bg-muted"
                        title="Eliminar regla"
                        style={{ color: 'var(--muted-foreground)' }}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RulesPage() {
    usePageTitle('Reglas automáticas')

    const { rules, loading, createRule, updateRule, toggleRule, deleteRule } =
        useTransactionRules()
    const { categories } = useCategories()
    const { error: toastError } = useToast()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<ITransactionRule | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ITransactionRule | null>(null)
    const [showInactive, setShowInactive] = useState(false)

    const activeRules = rules.filter((r) => r.isActive)
    const inactiveRules = rules.filter((r) => !r.isActive)

    const handleOpenCreate = () => {
        setEditingRule(null)
        setDialogOpen(true)
    }

    const handleEdit = (rule: ITransactionRule) => {
        setEditingRule(rule)
        setDialogOpen(true)
    }

    const handleDuplicate = async (rule: ITransactionRule) => {
        try {
            const categoryId =
                (rule.categoryId as { _id?: { toString(): string } })?._id?.toString() ??
                rule.categoryId?.toString()
            await createRule({
                name: `${rule.name} (copia)`,
                isActive: false,
                priority: rule.priority,
                appliesTo: rule.appliesTo,
                field: rule.field,
                condition: rule.condition,
                value: rule.value,
                categoryId: categoryId as unknown as import('mongoose').Types.ObjectId,
                setType: rule.setType,
                normalizeMerchant: rule.normalizeMerchant,
            })
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al duplicar regla')
        }
    }

    const handleSubmit = async (data: RuleFormValues) => {
        try {
            const payload = {
                ...data,
                setType: data.setType || undefined,
                normalizeMerchant: data.normalizeMerchant || undefined,
                categoryId: data.categoryId || undefined,
            }

            if (editingRule) {
                await updateRule(editingRule._id.toString(), payload as Partial<ITransactionRule>)
            } else {
                await createRule(payload as Partial<ITransactionRule>)
            }
            setDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar regla')
        }
    }

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return
        try {
            await deleteRule(deleteTarget._id.toString())
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al eliminar regla')
        } finally {
            setDeleteTarget(null)
        }
    }

    return (
        <div className="flex-1 p-4 md:p-6 pb-24 md:pb-6 max-w-2xl mx-auto w-full">
            <motion.div {...fadeIn} className="space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold flex items-center gap-2">
                            <Wand2 size={20} style={{ color: 'var(--sky)' }} />
                            Reglas automáticas
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Se aplican al crear transacciones para completar categoría y comercio.
                        </p>
                    </div>
                    <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
                        <Plus size={15} />
                        <span className="hidden sm:inline">Nueva regla</span>
                        <span className="sm:hidden">Nueva</span>
                    </Button>
                </div>

                {/* List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24 rounded-2xl" />
                        ))}
                    </div>
                ) : rules.length === 0 ? (
                    <EmptyState
                        icon={Wand2}
                        title="Sin reglas configuradas"
                        description="Creá reglas para que Finp complete categorías y comercios automáticamente al registrar transacciones."
                        actionLabel="Crear primera regla"
                        onAction={handleOpenCreate}
                    />
                ) : (
                    <div className="space-y-6">
                        {/* Active rules */}
                        {activeRules.length > 0 && (
                            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                                {activeRules.map((rule) => (
                                    <RuleCard
                                        key={rule._id.toString()}
                                        rule={rule}
                                        categories={categories}
                                        onEdit={handleEdit}
                                        onDelete={setDeleteTarget}
                                        onToggle={toggleRule}
                                        onDuplicate={handleDuplicate}
                                    />
                                ))}
                            </motion.div>
                        )}

                        {/* Inactive rules (collapsible) */}
                        {inactiveRules.length > 0 && (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setShowInactive((prev) => !prev)}
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showInactive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {inactiveRules.length} regla{inactiveRules.length !== 1 ? 's' : ''} inactiva{inactiveRules.length !== 1 ? 's' : ''}
                                </button>

                                <AnimatePresence>
                                    {showInactive && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="space-y-3 overflow-hidden"
                                        >
                                            {inactiveRules.map((rule) => (
                                                <RuleCard
                                                    key={rule._id.toString()}
                                                    rule={rule}
                                                    categories={categories}
                                                    onEdit={handleEdit}
                                                    onDelete={setDeleteTarget}
                                                    onToggle={toggleRule}
                                                    onDuplicate={handleDuplicate}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Info */}
                        <p className="text-xs text-muted-foreground text-center">
                            Las reglas se evalúan por prioridad · la primera que coincide gana
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Dialog */}
            <TransactionRuleDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                rule={editingRule}
                categories={categories}
                onSubmit={handleSubmit}
            />

            {/* Delete confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar regla?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará &ldquo;{deleteTarget?.name}&rdquo;. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
