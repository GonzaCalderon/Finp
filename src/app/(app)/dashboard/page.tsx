'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplyCommitmentDialog } from '@/components/shared/ApplyCommitmentDialog'
import { SankeyChart } from '@/components/shared/SankeyChart'
import { useAccounts } from '@/hooks/useAccounts'
import { useToast } from '@/hooks/useToast'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'

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

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    bank: 'Banco',
    cash: 'Efectivo',
    wallet: 'Billetera',
    credit_card: 'Tarjeta',
    debt: 'Deuda',
    savings: 'Ahorro',
}

interface CommitmentItem {
    _id: string
    description: string
    amount: number
    currency: string
    dayOfMonth?: number
}

interface DashboardData {
    month: string
    summary: {
        totalIncome: number
        totalExpense: number
        balance: number
        totalDebt: number
    }
    expenseByCategory: { name: string; color?: string; total: number }[]
    accounts: {
        _id: string
        name: string
        type: string
        currency: string
        includeInNetWorth: boolean
        balance: number
        color?: string
    }[]
    netWorth: {
        assets: number
        liabilities: number
        total: number
    }
    pendingCommitments: CommitmentItem[]
    installmentsThisMonth: {
        _id: string
        description: string
        installmentAmount: number
        currency: string
        firstClosingMonth: string
        installmentCount: number
    }[]
}

export default function DashboardPage() {
    const [month, setMonth] = useState(getCurrentMonth())
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [applyDialogOpen, setApplyDialogOpen] = useState(false)
    const [selectedCommitment, setSelectedCommitment] = useState<CommitmentItem | null>(null)

    const { accounts } = useAccounts()
    const { success, error: toastError } = useToast()

    const fetchDashboard = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/dashboard?month=${month}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            setData(json)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar dashboard')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchDashboard() }, [month])

    const handleApplyCommitment = (commitment: CommitmentItem) => {
        setSelectedCommitment(commitment)
        setApplyDialogOpen(true)
    }

    const handleApplySubmit = async (commitmentId: string, data: Record<string, unknown>) => {
        try {
            const res = await fetch(`/api/commitments/${commitmentId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            success('Compromiso aplicado correctamente')
            setApplyDialogOpen(false)
            fetchDashboard()
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al aplicar compromiso')
        }
    }

    const fmt = (amount: number, currency = 'ARS') =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount)

    if (loading) return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-9 w-48" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-80 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
        </div>
    )

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>
    if (!data) return null

    return (
        <motion.div className="p-6 max-w-5xl mx-auto space-y-6" {...fadeIn}>

            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-48 h-8 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Métricas */}
            <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                <motion.div variants={staggerItem} className="rounded-xl p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--sky)' }}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Ingresos</p>
                    <p className="text-2xl font-semibold tracking-tight text-green-500">{fmt(data.summary.totalIncome)}</p>
                </motion.div>
                <motion.div variants={staggerItem} className="rounded-xl p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--destructive)' }}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Gastos</p>
                    <p className="text-2xl font-semibold tracking-tight text-destructive">{fmt(data.summary.totalExpense)}</p>
                </motion.div>
                <motion.div variants={staggerItem} className="rounded-xl p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--sky)' }}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Balance</p>
                    <p className="text-2xl font-semibold tracking-tight"
                       style={{ color: data.summary.balance >= 0 ? 'var(--sky-dark)' : 'var(--destructive)' }}>
                        {fmt(data.summary.balance)}
                    </p>
                </motion.div>
                <motion.div variants={staggerItem} className="rounded-xl p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--amber)' }}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Deuda total</p>
                    <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--amber-dark)' }}>
                        {fmt(data.summary.totalDebt)}
                    </p>
                </motion.div>
            </motion.div>

            {/* Sankey */}
            <motion.div variants={staggerItem} initial="initial" animate="animate">
                <SankeyChart />
            </motion.div>

            {/* Grid principal */}
            <AnimatePresence mode="wait">
                <motion.div key={month} className="grid grid-cols-1 md:grid-cols-2 gap-4" {...fadeIn}>

                    {/* Saldos por cuenta */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Saldos por cuenta
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 pt-0">
                            {data.accounts.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin cuentas</p>
                            ) : data.accounts.map((account) => (
                                <div key={account._id} className="flex items-center justify-between py-2 border-b last:border-0"
                                     style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center gap-2">
                                        {account.color && (
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
                                        )}
                                        <span className="text-sm">{account.name}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded"
                                              style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
                      {ACCOUNT_TYPE_LABELS[account.type]}
                    </span>
                                    </div>
                                    <span className="text-sm font-medium tabular-nums"
                                          style={{ color: account.balance < 0 ? 'var(--destructive)' : 'var(--foreground)' }}>
                    {fmt(account.balance, account.currency)}
                  </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Gastos por categoría */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Gastos por categoría
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 pt-0">
                            {data.expenseByCategory.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin gastos este mes</p>
                            ) : data.expenseByCategory.map((cat) => (
                                <div key={cat.name} className="flex items-center justify-between py-2 border-b last:border-0"
                                     style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full shrink-0"
                                             style={{ backgroundColor: cat.color ?? '#9CA3AF' }} />
                                        <span className="text-sm">{cat.name}</span>
                                    </div>
                                    <span className="text-sm font-medium tabular-nums text-destructive">
                    {fmt(cat.total)}
                  </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Compromisos pendientes */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Compromisos pendientes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 pt-0">
                            {data.pendingCommitments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin compromisos pendientes</p>
                            ) : data.pendingCommitments.map((c) => (
                                <div key={c._id} className="flex items-center justify-between py-2 border-b last:border-0"
                                     style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{c.description}</span>
                                        {c.dayOfMonth && (
                                            <span className="text-xs px-1.5 py-0.5 rounded"
                                                  style={{ background: 'var(--sky-light)', color: 'var(--sky-dark)' }}>
                        día {c.dayOfMonth}
                      </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium tabular-nums">{fmt(c.amount, c.currency)}</span>
                                        <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                                                style={{ borderColor: 'var(--sky)', color: 'var(--sky)' }}
                                                onClick={() => handleApplyCommitment(c)}>
                                            Aplicar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Cuotas del mes */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Cuotas del mes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 pt-0">
                            {data.installmentsThisMonth.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin cuotas este mes</p>
                            ) : data.installmentsThisMonth.map((plan) => (
                                <div key={plan._id} className="flex items-center justify-between py-2 border-b last:border-0"
                                     style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{plan.description}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded"
                                              style={{ background: 'var(--amber-light)', color: 'var(--amber-dark)' }}>
                      cuota
                    </span>
                                    </div>
                                    <span className="text-sm font-medium tabular-nums">
                    {fmt(plan.installmentAmount, plan.currency)}
                  </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </motion.div>
            </AnimatePresence>

            {/* Patrimonio */}
            <motion.div variants={staggerItem} initial="initial" animate="animate"
                        className="rounded-xl p-4"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Patrimonio</p>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Activos</p>
                        <p className="text-xl font-semibold tracking-tight text-green-500">{fmt(data.netWorth.assets)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Pasivos</p>
                        <p className="text-xl font-semibold tracking-tight text-destructive">{fmt(data.netWorth.liabilities)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Neto</p>
                        <p className="text-xl font-semibold tracking-tight"
                           style={{ color: data.netWorth.total >= 0 ? 'var(--sky-dark)' : 'var(--destructive)' }}>
                            {fmt(data.netWorth.total)}
                        </p>
                    </div>
                </div>
            </motion.div>

            <ApplyCommitmentDialog
                open={applyDialogOpen}
                onOpenChange={setApplyDialogOpen}
                commitment={selectedCommitment}
                accounts={accounts}
                period={month}
                onSubmit={handleApplySubmit}
            />
        </motion.div>
    )
}