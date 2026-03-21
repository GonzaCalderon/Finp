'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTransactions } from '@/hooks/useTransactions'
import { useInstallments } from '@/hooks/useInstallments'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
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
import { TransactionDialog } from '@/components/shared/TransactionDialog'
import { InstallmentDialog } from '@/components/shared/InstallmentDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Spinner } from '@/components/shared/Spinner'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { ArrowLeftRight } from 'lucide-react'
import type { TransactionFormData, InstallmentFormData } from '@/lib/validations'
import type { ITransaction, IAccount } from '@/types'
import {useHideAmounts} from "@/contexts/HideAmountsContext";

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    transfer: 'Transferencia',
    credit_card_payment: 'Pago tarjeta',
    debt_payment: 'Pago deuda',
    adjustment: 'Ajuste',
}

const TRANSACTION_TYPE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    income: 'default',
    expense: 'destructive',
    transfer: 'secondary',
    credit_card_payment: 'outline',
    debt_payment: 'outline',
    adjustment: 'secondary',
}

const getCurrentMonth = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const MONTHS = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return { value, label }
})

export default function TransactionsPage() {
    const [month, setMonth] = useState(getCurrentMonth())
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
    const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<ITransaction | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const { transactions, loading, refreshing, error, createTransaction, updateTransaction, deleteTransaction } = useTransactions({ month })
    const { createPlan } = useInstallments()
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { success, error: toastError } = useToast()
    const { hidden } = useHideAmounts()

    usePageTitle('Transacciones')

    const handleNewTransaction = useCallback(() => {
        setSelectedTransaction(null)
        setTransactionDialogOpen(true)
    }, [])

    useKeyboardShortcuts([
        { key: 'n', handler: handleNewTransaction },
    ])

    const handleEdit = (t: ITransaction) => { setSelectedTransaction(t); setTransactionDialogOpen(true) }
    const handleDelete = (id: string) => setDeleteId(id)


    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        try {
            await deleteTransaction(deleteId)
            success('Transacción eliminada correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al eliminar transacción')
        } finally {
            setDeleteId(null)
        }
    }

    const handleTransactionSubmit = async (data: TransactionFormData) => {
        try {
            if (selectedTransaction) {
                await updateTransaction(selectedTransaction._id.toString(), data as Record<string, unknown>)
                success('Transacción actualizada correctamente')
            } else {
                await createTransaction(data as Record<string, unknown>)
                success('Transacción registrada correctamente')
            }
            setTransactionDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar transacción')
        }
    }

    const handleInstallmentSubmit = async (data: InstallmentFormData) => {
        try {
            await createPlan(data as never)
            success('Compra en cuotas registrada correctamente')
            setInstallmentDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar compra en cuotas')
        }
    }

    const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)

    const totalExpense = transactions
        .filter((t) => t.type === 'expense' && !t.installmentPlanId)
        .reduce((sum, t) => sum + t.amount, 0)

    const fmt = (amount: number, currency: string) =>
        hidden ? '••••' : new Intl.NumberFormat('es-AR', {
            style: 'currency', currency, maximumFractionDigits: 0,
        }).format(amount)

    if (loading) return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-8 w-52" />
            <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
        </div>
    )

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>

    return (
        <motion.div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" {...fadeIn}>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">Transacciones</h1>
                    {refreshing && <Spinner className="text-muted-foreground" />}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setInstallmentDialogOpen(true)}>
                        + Cuotas
                    </Button>
                    <Button size="sm" onClick={handleNewTransaction}>+ Nueva</Button>
                </div>
            </div>

            <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-52 h-8 text-sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Métricas */}
            <motion.div
                className="grid grid-cols-3 gap-2"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                <motion.div variants={staggerItem} className="rounded-xl p-3 md:p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--sky)' }}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Ingresos</p>
                    <p className="text-base md:text-xl font-semibold tracking-tight text-green-500 truncate">{fmt(totalIncome, 'ARS')}</p>
                </motion.div>
                <motion.div variants={staggerItem} className="rounded-xl p-3 md:p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--destructive)' }}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Gastos</p>
                    <p className="text-base md:text-xl font-semibold tracking-tight text-destructive truncate">{fmt(totalExpense, 'ARS')}</p>
                </motion.div>
                <motion.div variants={staggerItem} className="rounded-xl p-3 md:p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--sky)' }}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Balance</p>
                    <p className="text-base md:text-xl font-semibold tracking-tight truncate"
                       style={{ color: totalIncome - totalExpense >= 0 ? 'var(--sky-dark)' : 'var(--destructive)' }}>
                        {fmt(totalIncome - totalExpense, 'ARS')}
                    </p>
                </motion.div>
            </motion.div>

            {/* Transacciones */}
            <AnimatePresence mode="wait">
                <motion.div key={month} className="space-y-2" {...fadeIn}>
                    {transactions.length === 0 ? (
                        <div className="rounded-xl"
                             style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                            <EmptyState
                                icon={ArrowLeftRight}
                                title="Sin transacciones este mes"
                                description="Registrá tu primera transacción del mes"
                                actionLabel="+ Nueva transacción"
                                onAction={handleNewTransaction}
                            />
                        </div>
                    ) : (
                        <motion.div
                            className="space-y-2"
                            variants={staggerContainer}
                            initial="initial"
                            animate="animate"
                        >
                            {transactions.map((transaction) => {
                                const sourceAccount = transaction.sourceAccountId as unknown as IAccount & { color?: string } | null
                                const destAccount = transaction.destinationAccountId as unknown as IAccount & { color?: string } | null
                                return (
                                    <motion.div
                                        key={transaction._id.toString()}
                                        variants={staggerItem}
                                        className="rounded-xl"
                                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                                    >
                                        <div className="py-3 px-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Badge variant={TRANSACTION_TYPE_COLORS[transaction.type]}>
                                                    {TRANSACTION_TYPE_LABELS[transaction.type]}
                                                </Badge>
                                                <div>
                                                    <p className="text-sm font-medium">{transaction.description}</p>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(transaction.date).toLocaleDateString('es-AR')}
                                                            {transaction.merchant && ` · ${transaction.merchant}`}
                                                        </p>
                                                        {sourceAccount?.name && (
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                ·
                                                                {sourceAccount.color && (
                                                                    <span className="w-2 h-2 rounded-full inline-block"
                                                                          style={{ backgroundColor: sourceAccount.color }} />
                                                                )}
                                                                {sourceAccount.name}
                              </span>
                                                        )}
                                                        {destAccount?.name && (
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                →
                                                                {destAccount.color && (
                                                                    <span className="w-2 h-2 rounded-full inline-block"
                                                                          style={{ backgroundColor: destAccount.color }} />
                                                                )}
                                                                {destAccount.name}
                              </span>
                                                        )}
                                                        {transaction.installmentPlanId && (
                                                            <span className="text-xs" style={{ color: 'var(--sky)' }}>· en cuotas</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="font-semibold tabular-nums text-sm"
                                                   style={{
                                                       color: transaction.type === 'income'
                                                           ? '#10B981'
                                                           : transaction.type === 'expense'
                                                               ? 'var(--destructive)'
                                                               : 'var(--foreground)',
                                                   }}>
                                                    {fmt(transaction.amount, transaction.currency)}
                                                </p>
                                                <div className="flex gap-1">
                                                    <Button variant="outline" size="sm" className="h-7 text-xs"
                                                            onClick={() => handleEdit(transaction)}>
                                                        Editar
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                                                            onClick={() => handleDelete(transaction._id.toString())}>
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    )}
                </motion.div>
            </AnimatePresence>

            <TransactionDialog
                open={transactionDialogOpen}
                onOpenChange={setTransactionDialogOpen}
                transaction={selectedTransaction}
                accounts={accounts}
                categories={categories}
                onSubmit={handleTransactionSubmit}
            />

            <InstallmentDialog
                open={installmentDialogOpen}
                onOpenChange={setInstallmentDialogOpen}
                accounts={accounts}
                categories={categories}
                onSubmit={handleInstallmentSubmit}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta transacción?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    )
}