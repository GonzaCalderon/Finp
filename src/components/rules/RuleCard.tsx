'use client'

import { motion } from 'framer-motion'
import {
    ArrowRight,
    Copy,
    Pencil,
    Store,
    Tag,
    Target,
    Trash2,
    TrendingDown,
    TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardAction,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { staggerItem } from '@/lib/utils/animations'
import { cn } from '@/lib/utils'
import type { ICategory, ITransactionRule } from '@/types'

const APPLIES_TO_LABELS: Record<string, string> = {
    expense: 'Gastos',
    income: 'Ingresos',
    any: 'Gastos e ingresos',
}

const FIELD_LABELS: Record<string, string> = {
    description: 'Descripción',
    merchant: 'Comercio',
}

const CONDITION_LABELS: Record<string, string> = {
    contains: 'contiene',
    equals: 'es igual a',
    starts_with: 'empieza con',
}

function getReferenceId(value: unknown) {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'object' && '_id' in value) {
        return (value as { _id?: { toString(): string } })._id?.toString()
    }
    return String(value)
}

function formatLastMatch(value?: Date) {
    if (!value) return null
    return new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value))
}

export function RuleCard({
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
    const categoryId = getReferenceId(rule.categoryId)
    const category = categories.find(
        (item) => item._id.toString() === categoryId
    )
    const matchCount = rule.matchCount ?? 0
    const lastMatch = formatLastMatch(rule.lastMatchedAt)
    const TypeIcon =
        rule.appliesTo === 'income'
            ? TrendingUp
            : rule.appliesTo === 'expense'
                ? TrendingDown
                : Target

    return (
        <motion.div variants={staggerItem}>
            <Card
                className={cn(
                    'gap-0 py-0 transition-colors',
                    !rule.isActive && 'opacity-65'
                )}
            >
                <CardHeader className="border-b border-foreground/[0.06] py-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                            style={{
                                background:
                                    rule.appliesTo === 'income'
                                        ? 'rgba(16,185,129,0.10)'
                                        : rule.appliesTo === 'expense'
                                            ? 'rgba(239,68,68,0.09)'
                                            : 'color-mix(in srgb, var(--sky) 12%, transparent)',
                                color:
                                    rule.appliesTo === 'income'
                                        ? '#059669'
                                        : rule.appliesTo === 'expense'
                                            ? '#DC2626'
                                            : 'var(--sky-dark)',
                            }}
                        >
                            <TypeIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <CardTitle className="truncate">{rule.name}</CardTitle>
                                <Badge
                                    variant={rule.isActive ? 'secondary' : 'outline'}
                                    className="rounded-full"
                                >
                                    {rule.isActive ? 'Activa' : 'Pausada'}
                                </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {APPLIES_TO_LABELS[rule.appliesTo]} · Prioridad {rule.priority}
                            </p>
                        </div>
                    </div>
                    <CardAction className="flex items-center gap-2">
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                            {rule.isActive ? 'Aplicando' : 'Pausada'}
                        </span>
                        <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) =>
                                onToggle(rule._id.toString(), checked)
                            }
                            aria-label={rule.isActive ? 'Pausar regla' : 'Activar regla'}
                        />
                    </CardAction>
                </CardHeader>

                <CardContent className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                    <div className="rounded-xl bg-muted/55 p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Cuando
                        </p>
                        <div className="mt-2 flex items-start gap-2">
                            {rule.field === 'merchant' ? (
                                <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                                <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <p className="text-sm leading-snug">
                                {FIELD_LABELS[rule.field]}{' '}
                                <span className="text-muted-foreground">
                                    {CONDITION_LABELS[rule.condition]}
                                </span>{' '}
                                <span className="font-medium">“{rule.value}”</span>
                            </p>
                        </div>
                    </div>

                    <ArrowRight className="mx-auto hidden h-4 w-4 text-muted-foreground/55 md:block" />

                    <div className="rounded-xl bg-[color-mix(in_srgb,var(--sky)_7%,transparent)] p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Finp completa
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {category ? (
                                <Badge
                                    variant="outline"
                                    className="gap-1.5 rounded-full bg-background/70"
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ background: category.color || 'var(--sky)' }}
                                    />
                                    {category.name}
                                </Badge>
                            ) : null}
                            {rule.setType ? (
                                <Badge variant="outline" className="rounded-full bg-background/70">
                                    Tipo: {rule.setType === 'expense' ? 'Gasto' : 'Ingreso'}
                                </Badge>
                            ) : null}
                            {rule.normalizeMerchant ? (
                                <Badge
                                    variant="outline"
                                    className="gap-1 rounded-full bg-background/70"
                                >
                                    <Store className="h-3 w-3" />
                                    {rule.normalizeMerchant}
                                </Badge>
                            ) : null}
                            {!category && !rule.setType && !rule.normalizeMerchant ? (
                                <span className="text-xs text-muted-foreground">
                                    Sin acciones configuradas
                                </span>
                            ) : null}
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-wrap justify-between gap-3 border-t border-foreground/[0.06] bg-muted/25 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Tag className="h-3.5 w-3.5" />
                        {matchCount === 0
                            ? 'Sin coincidencias todavía'
                            : `${matchCount} coincidencia${matchCount === 1 ? '' : 's'}`}
                        {lastMatch ? <span>· Última {lastMatch}</span> : null}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDuplicate(rule)}
                            aria-label={`Duplicar ${rule.name}`}
                            title="Duplicar"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onEdit(rule)}
                            aria-label={`Editar ${rule.name}`}
                            title="Editar"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onDelete(rule)}
                            aria-label={`Eliminar ${rule.name}`}
                            title="Eliminar"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </motion.div>
    )
}
