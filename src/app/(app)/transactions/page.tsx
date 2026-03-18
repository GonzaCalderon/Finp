'use client'

import { useState } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useInstallments } from '@/hooks/useInstallments'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { TransactionDialog } from '@/components/shared/TransactionDialog'
import { InstallmentDialog } from '@/components/shared/InstallmentDialog'
import type { ITransaction } from '@/types'

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

    const { transactions, loading, error, createTransaction, updateTransaction, deleteTransaction } = useTransactions({ month })
    const { createPlan } = useInstallments()
    const { accounts } = useAccounts()
    const { categories } = useCategories()

    const handleNewTransaction = () => {
        setSelectedTransaction(null)
        setTransactionDialogOpen(true)
    }

    const handleEdit = (transaction: ITransaction) => {
        setSelectedTransaction(transaction)
        setTransactionDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta transacción?')) return
        try {
            await deleteTransaction(id)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al eliminar transacción')
        }
    }

    const handleTransactionSubmit = async (data: Partial<ITransaction>) => {
        try {
            if (selectedTransaction) {
                await updateTransaction(selectedTransaction._id.toString(), data)
            } else {
                await createTransaction(data)
            }
            setTransactionDialogOpen(false)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al guardar transacción')
        }
    }

    const handleInstallmentSubmit = async (data: Record<string, unknown>) => {
        try {
            await createPlan(data as never)
            setInstallmentDialogOpen(false)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al registrar compra en cuotas')
        }
    }

    const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)

    const totalExpense = transactions
        .filter((t) => t.type === 'expense' && !t.installmentPlanId)
        .reduce((sum, t) => sum + t.amount, 0)

    const totalInstallmentDebt = transactions
        .filter((t) => t.type === 'expense' && t.installmentPlanId)
        .reduce((sum, t) => sum + t.amount, 0)

    const formatAmount = (amount: number, currency: string) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount)

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando transacciones...</div>
    if (error) return <div className="p-8 text-center text-destructive">{error}</div>

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Transacciones</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setInstallmentDialogOpen(true)}>
                        + Cuotas
                    </Button>
                    <Button onClick={handleNewTransaction}>
                        + Nueva
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-52">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Ingresos</p>
                        <p className="text-xl font-bold text-green-600">
                            {formatAmount(totalIncome, 'ARS')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Gastos reales</p>
                        <p className="text-xl font-bold text-red-600">
                            {formatAmount(totalExpense, 'ARS')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Balance</p>
                        <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatAmount(totalIncome - totalExpense, 'ARS')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Deuda en cuotas</p>
                        <p className="text-xl font-bold text-orange-500">
                            {formatAmount(totalInstallmentDebt, 'ARS')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {transactions.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No hay transacciones este mes.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {transactions.map((transaction) => (
                        <Card key={transaction._id.toString()}>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Badge variant={TRANSACTION_TYPE_COLORS[transaction.type]}>
                                            {TRANSACTION_TYPE_LABELS[transaction.type]}
                                        </Badge>
                                        <div>
                                            <p className="text-sm font-medium">{transaction.description}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(transaction.date).toLocaleDateString('es-AR')}
                                                {transaction.merchant && ` · ${transaction.merchant}`}
                                                {transaction.installmentPlanId && (
                                                    <span className="ml-1 text-primary">· en cuotas</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : transaction.type === 'expense' ? 'text-red-600' : ''}`}>
                                            {formatAmount(transaction.amount, transaction.currency)}
                                        </p>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="sm" onClick={() => handleEdit(transaction)}>
                                                Editar
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(transaction._id.toString())}>
                                                Eliminar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

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
        </div>
    )
}