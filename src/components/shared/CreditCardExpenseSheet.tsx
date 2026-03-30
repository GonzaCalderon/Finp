'use client'

import { motion } from 'framer-motion'
import { CalendarDays, Layers3, Pencil, Trash2 } from 'lucide-react'

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { slideInRight } from '@/lib/utils/animations'
import {
    getInstallmentStatus,
    getRemainingDebt,
    type CCExpenseItem,
} from '@/hooks/useCreditCardExpenses'
import { getSingleCreditCardExpenseStatusForMonth } from '@/lib/utils/credit-card'

interface CreditCardExpenseSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: CCExpenseItem | null
    selectedMonth: string
    monthStartDay?: number
    hidden?: boolean
    onEdit?: () => void
    onDelete?: () => void
}

function getRefName(value: unknown): string | null {
    if (!value || typeof value === 'string' || typeof value !== 'object') return null
    const candidate = value as { name?: unknown }
    return typeof candidate.name === 'string' ? candidate.name : null
}

function getRefColor(value: unknown): string | null {
    if (!value || typeof value === 'string' || typeof value !== 'object') return null
    const candidate = value as { color?: unknown }
    return typeof candidate.color === 'string' ? candidate.color : null
}

function formatMonth(value: string) {
    const [year, month] = value.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
    })
}

function formatMonthCompact(value: string) {
    const [year, month] = value.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
        month: 'short',
        year: '2-digit',
    }).replace('.', '')
}

export function CreditCardExpenseSheet({
    open,
    onOpenChange,
    item,
    selectedMonth,
    monthStartDay = 1,
    hidden = false,
    onEdit,
    onDelete,
}: CreditCardExpenseSheetProps) {
    if (!item) {
        return <Sheet open={open} onOpenChange={onOpenChange} />
    }

    const isPlan = item.kind === 'plan'
    const plan = isPlan ? item.plan : null
    const transaction = isPlan ? item.plan.parentTransaction ?? null : item.transaction

    const accountRef = isPlan ? plan?.accountId : transaction?.sourceAccountId
    const categoryRef = isPlan ? plan?.categoryId : transaction?.categoryId
    const accountName = getRefName(accountRef)
    const accountColor = getRefColor(accountRef)
    const categoryName = getRefName(categoryRef)
    const categoryColor = getRefColor(categoryRef)

    const status = isPlan && plan
        ? getInstallmentStatus(plan, selectedMonth)
        : transaction
            ? getSingleCreditCardExpenseStatusForMonth(transaction, selectedMonth, monthStartDay)
            : { state: 'active' as const, label: 'Cuota 1/1', current: 1, total: 1 }
    const statusLabel =
        status.state === 'not_started'
            ? isPlan && plan
                ? `Primera cuota en ${formatMonthCompact(plan.firstClosingMonth)}`
                : `Impacta en ${new Date(transaction?.date ?? new Date()).toLocaleDateString('es-AR', {
                    month: 'short',
                    year: '2-digit',
                }).replace('.', '')}`
            : status.label

    const installmentCount = isPlan ? (plan?.installmentCount ?? 1) : 1
    const totalAmount = isPlan ? (plan?.totalAmount ?? 0) : (transaction?.amount ?? 0)
    const installmentAmount = isPlan ? (plan?.installmentAmount ?? totalAmount) : totalAmount
    const remainingDebt = isPlan && plan
        ? getRemainingDebt(plan, selectedMonth)
        : status.state === 'finished'
            ? 0
            : totalAmount
    const currency = isPlan ? (plan?.currency ?? 'ARS') : (transaction?.currency ?? 'ARS')
    const purchaseDate = isPlan ? plan?.purchaseDate : transaction?.date

    const fmt = (amount: number) =>
        hidden
            ? '••••'
            : new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
            }).format(amount)

    const statusTone =
        status.state === 'finished'
            ? { bg: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.18)', color: '#6B7280' }
            : status.state === 'not_started'
                ? { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.18)', color: '#D97706' }
                : { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.18)', color: '#4F46E5' }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
                <motion.div className="flex min-h-full flex-col" {...slideInRight}>
                    <SheetHeader className="border-b px-6 py-5">
                        <div className="space-y-2">
                            <Badge variant="outline" className="border-indigo-200 text-indigo-600">
                                Gasto con TC
                            </Badge>
                            <SheetTitle className="text-lg">
                                {transaction?.description ?? plan?.description ?? 'Detalle del gasto'}
                            </SheetTitle>
                            <SheetDescription>
                                Estado en {formatMonth(selectedMonth)}: {statusLabel}
                            </SheetDescription>
                        </div>
                    </SheetHeader>

                    <div className="flex-1 space-y-5 px-6 py-5">
                        <div className="rounded-2xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Monto total</p>
                                    <p className="mt-1 text-2xl font-semibold">{fmt(totalAmount)}</p>
                                </div>
                                <div
                                    className="rounded-full border px-3 py-1 text-xs font-medium"
                                    style={{
                                        background: statusTone.bg,
                                        borderColor: statusTone.border,
                                        color: statusTone.color,
                                    }}
                                >
                                    {statusLabel}
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">Cuotas</p>
                                    <p className="mt-1 font-medium">{installmentCount}</p>
                                </div>
                                <div className="rounded-xl bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">Monto por cuota</p>
                                    <p className="mt-1 font-medium">{fmt(installmentAmount)}</p>
                                </div>
                                <div className="rounded-xl bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">Deuda pendiente</p>
                                    <p className="mt-1 font-medium">{fmt(remainingDebt)}</p>
                                </div>
                                <div className="rounded-xl bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">Mes seleccionado</p>
                                    <p className="mt-1 font-medium capitalize">{formatMonth(selectedMonth)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border p-4 space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Layers3 className="h-4 w-4 text-muted-foreground" />
                                Detalle
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <span className="text-muted-foreground">Tarjeta</span>
                                    <span className="flex items-center gap-2 text-right font-medium">
                                        {accountColor && (
                                            <span
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: accountColor }}
                                            />
                                        )}
                                        {accountName ?? 'Sin tarjeta'}
                                    </span>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                    <span className="text-muted-foreground">Categoría</span>
                                    <span className="flex items-center gap-2 text-right font-medium">
                                        {categoryColor && (
                                            <span
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: categoryColor }}
                                            />
                                        )}
                                        {categoryName ?? 'Sin categoría'}
                                    </span>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                    <span className="text-muted-foreground">Fecha de compra</span>
                                    <span className="font-medium">
                                        {purchaseDate ? new Date(purchaseDate).toLocaleDateString('es-AR') : '-'}
                                    </span>
                                </div>

                                {(transaction?.merchant || plan?.merchant) && (
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="text-muted-foreground">Comercio</span>
                                        <span className="font-medium">{transaction?.merchant ?? plan?.merchant}</span>
                                    </div>
                                )}

                                <div className="flex items-start justify-between gap-4">
                                    <span className="text-muted-foreground">Tipo</span>
                                    <span className="font-medium">
                                        {isPlan ? 'Plan en cuotas' : 'Compra en 1 cuota'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                Seguimiento
                            </div>

                            {isPlan ? (
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Primera cuota</span>
                                        <span className="font-medium capitalize">
                                            {plan ? formatMonth(plan.firstClosingMonth) : '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Cuota actual</span>
                                        <span className="font-medium">{statusLabel}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Resumen</span>
                                    <span className="font-medium">Compra simple imputada en una cuota</span>
                                </div>
                            )}
                        </div>

                        {transaction?.notes && (
                            <>
                                <Separator />
                                <div>
                                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Notas</p>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{transaction.notes}</p>
                                </div>
                            </>
                        )}
                    </div>

                    <SheetFooter className="border-t px-6 py-4">
                        <div className="flex w-full gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={onEdit}
                                disabled={!transaction}
                            >
                                <Pencil className="h-4 w-4" />
                                Editar
                            </Button>
                            <Button
                                variant="ghost"
                                className="flex-1 text-destructive hover:text-destructive"
                                onClick={onDelete}
                            >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                            </Button>
                        </div>
                    </SheetFooter>
                </motion.div>
            </SheetContent>
        </Sheet>
    )
}
