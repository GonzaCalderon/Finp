'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CreditCard, Eye, Layers3, Pencil, Plus, Trash2 } from 'lucide-react'

import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import {
    useCreditCardExpenses,
    getInstallmentStatus,
    getRemainingDebt,
    type CCExpenseItem,
} from '@/hooks/useCreditCardExpenses'
import { useInstallments } from '@/hooks/useInstallments'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePreferences } from '@/hooks/usePreferences'
import { useToast } from '@/hooks/useToast'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { useHideAmounts } from '@/contexts/HideAmountsContext'

import { CreditCardExpenseSheet } from '@/components/shared/CreditCardExpenseSheet'
import { EmptyState } from '@/components/shared/EmptyState'
import { Spinner } from '@/components/shared/Spinner'
import { TransactionDialog } from '@/components/shared/TransactionDialog'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { InstallmentFormData, TransactionFormData } from '@/lib/validations'
import type { ITransaction } from '@/types'

type StatusFilter = 'active' | 'finished' | 'all'
type InstallmentFilter = 'all' | 'single' | 'multi'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Activas' },
    { value: 'finished', label: 'Finalizadas' },
    { value: 'all', label: 'Todas' },
]

const INSTALLMENT_OPTIONS: { value: InstallmentFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'single', label: '1 cuota' },
    { value: 'multi', label: 'En cuotas' },
]

function getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const MONTHS = Array.from({ length: 25 }, (_, index) => {
    const offset = index - 12
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() + offset)

    return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('es-AR', {
            month: 'long',
            year: 'numeric',
        }),
    }
})

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

function getRefId(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value !== 'object') return ''
    const candidate = value as { _id?: unknown; toString?: () => string }
    if (
        candidate._id &&
        typeof candidate._id === 'object' &&
        'toString' in candidate._id &&
        typeof candidate._id.toString === 'function'
    ) {
        return candidate._id.toString()
    }
    return typeof candidate.toString === 'function' ? candidate.toString() : ''
}

function matchesStatus(item: CCExpenseItem, selectedMonth: string, filter: StatusFilter) {
    if (filter === 'all') return true
    if (item.kind === 'single') return filter === 'active'

    const status = getInstallmentStatus(item.plan, selectedMonth)
    if (filter === 'active') return status.state !== 'finished'
    return status.state === 'finished'
}

function matchesInstallmentMode(item: CCExpenseItem, filter: InstallmentFilter) {
    if (filter === 'all') return true
    if (filter === 'single') return item.kind === 'single'
    return item.kind === 'plan'
}

async function postTransaction(body: TransactionFormData) {
    const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al crear gasto con TC')
    return data.transaction as ITransaction
}

async function patchTransaction(id: string, body: TransactionFormData) {
    const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al actualizar gasto con TC')
    return data.transaction as ITransaction
}

export default function CreditCardExpensesPage() {
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
    const [cardFilter, setCardFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
    const [installmentFilter, setInstallmentFilter] = useState<InstallmentFilter>('all')
    const [sheetItem, setSheetItem] = useState<CCExpenseItem | null>(null)
    const [deleteItem, setDeleteItem] = useState<CCExpenseItem | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<ITransaction | null>(null)

    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { rules } = useTransactionRules()
    const { preferences } = usePreferences()
    const { hidden } = useHideAmounts()
    const { success, error: toastError } = useToast()
    const { createPlan } = useInstallments()
    const {
        allItems,
        loading,
        error,
        fetchAll,
        deletePlan,
        deleteTransaction,
    } = useCreditCardExpenses(selectedMonth)

    usePageTitle('Gastos con TC')

    const creditCardAccounts = useMemo(
        () => accounts.filter((account) => account.type === 'credit_card'),
        [accounts]
    )

    const filteredItems = useMemo(() => {
        return allItems.filter((item) => {
            const accountRef = item.kind === 'plan' ? item.plan.accountId : item.transaction.sourceAccountId
            const matchesCard = cardFilter === 'all' || getRefId(accountRef) === cardFilter

            return (
                matchesCard &&
                matchesStatus(item, selectedMonth, statusFilter) &&
                matchesInstallmentMode(item, installmentFilter)
            )
        })
    }, [allItems, cardFilter, installmentFilter, selectedMonth, statusFilter])

    const hasFinishedPlans = useMemo(
        () =>
            allItems.some((item) => item.kind === 'plan' && getInstallmentStatus(item.plan, selectedMonth).state === 'finished'),
        [allItems, selectedMonth]
    )

    const fmt = (amount: number, currency = 'ARS') =>
        hidden
            ? '••••'
            : new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
            }).format(amount)

    const openCreateDialog = () => {
        setSelectedTransaction(null)
        setDialogOpen(true)
    }

    const handleEditItem = (item: CCExpenseItem | null) => {
        if (!item) return
        const transaction = item.kind === 'plan' ? item.plan.parentTransaction ?? null : item.transaction
        if (!transaction) return

        setSelectedTransaction(transaction)
        setDialogOpen(true)
    }

    const handleSubmitTransaction = async (data: TransactionFormData) => {
        try {
            if (selectedTransaction) {
                await patchTransaction(selectedTransaction._id.toString(), data)
                success('Gasto con TC actualizado correctamente')
            } else {
                await postTransaction(data)
                success('Gasto con TC creado correctamente')
            }

            setDialogOpen(false)
            setSelectedTransaction(null)
            await fetchAll()
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar gasto con TC')
        }
    }

    const handleSubmitInstallment = async (data: InstallmentFormData) => {
        try {
            await createPlan(data)
            success('Plan de cuotas creado correctamente')
            setDialogOpen(false)
            setSelectedTransaction(null)
            await fetchAll()
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al crear plan de cuotas')
        }
    }

    const handleDeleteConfirm = async () => {
        if (!deleteItem) return

        try {
            if (deleteItem.kind === 'plan') {
                await deletePlan(deleteItem.plan._id.toString())
                success('Plan eliminado correctamente')
            } else {
                await deleteTransaction(deleteItem.transaction._id.toString())
                success('Gasto con TC eliminado correctamente')
            }

            setDeleteItem(null)
            setSheetItem(null)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al eliminar gasto con TC')
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="h-24 rounded-2xl" />
                <div className="grid gap-3">
                    {[...Array(4)].map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-2xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return <div className="p-8 text-center text-sm text-destructive">{error}</div>
    }

    return (
        <>
            <motion.div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6" {...fadeIn}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <Link
                            href="/transactions"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                            <Layers3 className="h-3.5 w-3.5" />
                            Volver a Transacciones
                        </Link>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-semibold tracking-tight">Gastos con TC</h1>
                            {loading && <Spinner className="text-muted-foreground" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Gestioná compras en 1 cuota y planes en cuotas desde una vista dedicada.
                        </p>
                    </div>

                    <Button onClick={openCreateDialog}>
                        <Plus className="h-4 w-4" />
                        Nuevo gasto con TC
                    </Button>
                </div>

                <div className="rounded-2xl border p-4" style={{ background: 'var(--card)' }}>
                    <div className="grid gap-3 md:grid-cols-[180px_220px_1fr]">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Mes</p>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Tarjeta</p>
                            <Select value={cardFilter} onValueChange={setCardFilter}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {creditCardAccounts.map((account) => (
                                        <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                            {account.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Estado</p>
                                <div className="flex flex-wrap gap-2">
                                    {STATUS_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setStatusFilter(option.value)}
                                            className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                                            style={{
                                                background: statusFilter === option.value ? 'var(--sky)' : 'var(--secondary)',
                                                color: statusFilter === option.value ? '#fff' : 'var(--muted-foreground)',
                                                borderColor: statusFilter === option.value ? 'var(--sky)' : 'var(--border)',
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Cuotas</p>
                                <div className="flex flex-wrap gap-2">
                                    {INSTALLMENT_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setInstallmentFilter(option.value)}
                                            className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                                            style={{
                                                background: installmentFilter === option.value ? 'var(--sky)' : 'var(--secondary)',
                                                color: installmentFilter === option.value ? '#fff' : 'var(--muted-foreground)',
                                                borderColor: installmentFilter === option.value ? 'var(--sky)' : 'var(--border)',
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <AnimatePresence initial={false}>
                        {hasFinishedPlans && (
                            <motion.div
                                className="mt-4 flex flex-wrap items-center gap-2"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.18 }}
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStatusFilter((prev) => (prev === 'active' ? 'all' : 'active'))}
                                >
                                    <Eye className="h-4 w-4" />
                                    {statusFilter === 'active' ? 'Mostrar finalizados' : 'Ocultar finalizados'}
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Por defecto se muestran solo planes activos para el mes seleccionado.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {filteredItems.length === 0 ? (
                    <div className="rounded-2xl border" style={{ background: 'var(--card)' }}>
                        <EmptyState
                            icon={CreditCard}
                            title="No hay gastos con TC para esos filtros"
                            description="Probá cambiando el mes, la tarjeta o mostrando finalizados."
                            actionLabel="Nuevo gasto con TC"
                            onAction={openCreateDialog}
                        />
                    </div>
                ) : (
                    <motion.div
                        className="space-y-3"
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                    >
                        {filteredItems.map((item) => {
                            const isPlan = item.kind === 'plan'
                            const plan = isPlan ? item.plan : null
                            const singleTransaction = isPlan ? null : item.transaction
                            const transaction = isPlan ? plan?.parentTransaction ?? null : singleTransaction
                            const accountRef = isPlan ? plan?.accountId : singleTransaction?.sourceAccountId
                            const categoryRef = isPlan ? plan?.categoryId : singleTransaction?.categoryId
                            const accountName = getRefName(accountRef)
                            const accountColor = getRefColor(accountRef)
                            const categoryName = getRefName(categoryRef)
                            const categoryColor = getRefColor(categoryRef)
                            const status = isPlan && plan ? getInstallmentStatus(plan, selectedMonth) : { label: '1 cuota' }
                            const amount = isPlan && plan ? plan.totalAmount : (singleTransaction?.amount ?? 0)
                            const currency = isPlan && plan ? plan.currency : (singleTransaction?.currency ?? 'ARS')
                            const purchaseDate = isPlan && plan ? plan.purchaseDate : singleTransaction?.date
                            const purchaseDateLabel = purchaseDate
                                ? new Date(purchaseDate).toLocaleDateString('es-AR')
                                : '-'
                            const installmentMeta = isPlan && plan ? `${plan.installmentCount} cuotas` : '1 cuota'
                            const remainingDebt = isPlan && plan ? getRemainingDebt(plan, selectedMonth) : 0

                            return (
                                <motion.div
                                    key={`${item.kind}-${isPlan ? item.plan._id.toString() : item.transaction._id.toString()}`}
                                    variants={staggerItem}
                                    className="rounded-2xl border p-4"
                                    style={{ background: 'var(--card)' }}
                                >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1 space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline" className="border-indigo-200 text-indigo-600">
                                                    Gasto con TC
                                                </Badge>
                                                <Badge variant="secondary">{installmentMeta}</Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        status.label === 'Finalizado'
                                                            ? 'text-muted-foreground'
                                                            : status.label === 'Aún no inicia'
                                                                ? 'border-amber-200 text-amber-600'
                                                                : 'border-indigo-200 text-indigo-600'
                                                    }
                                                >
                                                    {status.label}
                                                </Badge>
                                            </div>

                                            <div>
                                                <h2 className="text-base font-semibold">{transaction?.description ?? plan?.description}</h2>
                                                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                                    <span>{purchaseDateLabel}</span>
                                                    {accountName && (
                                                        <span className="flex items-center gap-1">
                                                            ·
                                                            {accountColor && (
                                                                <span
                                                                    className="h-2 w-2 rounded-full"
                                                                    style={{ backgroundColor: accountColor }}
                                                                />
                                                            )}
                                                            {accountName}
                                                        </span>
                                                    )}
                                                    {categoryName && (
                                                        <span className="flex items-center gap-1">
                                                            ·
                                                            {categoryColor && (
                                                                <span
                                                                    className="h-2 w-2 rounded-full"
                                                                    style={{ backgroundColor: categoryColor }}
                                                                />
                                                            )}
                                                            {categoryName}
                                                        </span>
                                                    )}
                                                    {(transaction?.merchant || plan?.merchant) && (
                                                        <span>· {transaction?.merchant ?? plan?.merchant}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid gap-2 sm:grid-cols-3">
                                                <div className="rounded-xl bg-muted/35 p-3">
                                                    <p className="text-xs text-muted-foreground">Total</p>
                                                    <p className="mt-1 text-sm font-semibold">{fmt(amount, currency)}</p>
                                                </div>
                                                <div className="rounded-xl bg-muted/35 p-3">
                                                    <p className="text-xs text-muted-foreground">Por cuota</p>
                                                    <p className="mt-1 text-sm font-semibold">
                                                        {fmt(isPlan && plan ? plan.installmentAmount : (singleTransaction?.amount ?? 0), currency)}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl bg-muted/35 p-3">
                                                    <p className="text-xs text-muted-foreground">Pendiente</p>
                                                    <p className="mt-1 text-sm font-semibold">{fmt(remainingDebt, currency)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-stretch gap-2 lg:w-40">
                                            <Button variant="outline" onClick={() => setSheetItem(item)}>
                                                Ver detalle
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={() => handleEditItem(item)}
                                                disabled={!transaction}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Editar
                                            </Button>
                                            <Button variant="destructive" onClick={() => setDeleteItem(item)}>
                                                <Trash2 className="h-4 w-4" />
                                                Eliminar
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </motion.div>
                )}
            </motion.div>

            <CreditCardExpenseSheet
                open={Boolean(sheetItem)}
                onOpenChange={(open) => !open && setSheetItem(null)}
                item={sheetItem}
                selectedMonth={selectedMonth}
                hidden={hidden}
                onEdit={() => handleEditItem(sheetItem)}
                onDelete={() => sheetItem && setDeleteItem(sheetItem)}
            />

            <TransactionDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) setSelectedTransaction(null)
                }}
                transaction={selectedTransaction}
                accounts={accounts}
                categories={categories}
                onSubmit={handleSubmitTransaction}
                onInstallmentSubmit={handleSubmitInstallment}
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
            />

            <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            ¿Eliminar este gasto con TC?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteItem?.kind === 'plan'
                                ? 'Se eliminará el plan de cuotas y su transacción madre asociada.'
                                : 'Esta acción no se puede deshacer.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
