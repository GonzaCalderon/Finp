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
import { Spinner } from '@/components/shared/Spinner'
import { useAccounts } from '@/hooks/useAccounts'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { TrendingUp, TrendingDown, CheckCircle } from 'lucide-react'

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
    trends: {
        income: number | null
        expense: number | null
        balance: number | null
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

function TrendBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
    if (value === null) return null
    const isPositive = inverse ? value < 0 : value > 0
    const isNeutral = value === 0
    const Icon = isPositive ? TrendingUp : TrendingDown
    const abs = Math.abs(value)
    return (
        <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{
                  background: isNeutral ? 'var(--secondary)' : isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: isNeutral ? 'var(--muted-foreground)' : isPositive ? '#10B981' : '#EF4444',
              }}>
            {!isNeutral && <Icon size={10} />}
            {isNeutral ? '=' : `${abs}%`}
        </span>
    )
}

// Formatea números grandes de forma compacta en mobile
function FmtAmount({ amount, currency = 'ARS', color, hidden }: {
    amount: number
    currency?: string
    color?: string
    hidden: boolean
}) {
    if (hidden) return <span style={{ color }}>••••</span>

    const compact = new Intl.NumberFormat('es-AR', {
        style: 'currency', currency,
        maximumFractionDigits: 0,
        notation: 'compact',
    }).format(amount)

    const full = new Intl.NumberFormat('es-AR', {
        style: 'currency', currency,
        maximumFractionDigits: 0,
    }).format(amount)

    return (
        <>
            <span className="md:hidden" style={{ color }}>{compact}</span>
            <span className="hidden md:inline" style={{ color }}>{full}</span>
        </>
    )
}

export default function DashboardPage() {
    const [month, setMonth] = useState(getCurrentMonth())
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [applyDialogOpen, setApplyDialogOpen] = useState(false)
    const [selectedCommitment, setSelectedCommitment] = useState<CommitmentItem | null>(null)
    const [appliedId, setAppliedId] = useState<string | null>(null)

    const { accounts } = useAccounts()
    const { success, error: toastError } = useToast()
    const { hidden } = useHideAmounts()

    usePageTitle('Dashboard')

    const fetchDashboard = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true)
            else setLoading(true)
            const res = await fetch(`/api/dashboard?month=${month}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            setData(json)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar dashboard')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => { fetchDashboard(data !== null) }, [month])

    const handleApplyCommitment = (commitment: CommitmentItem) => {
        setSelectedCommitment(commitment)
        setApplyDialogOpen(true)
    }

    const handleApplySubmit = async (commitmentId: string, applyData: Record<string, unknown>) => {
        try {
            const res = await fetch(`/api/commitments/${commitmentId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(applyData),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            success('Compromiso aplicado correctamente')
            setApplyDialogOpen(false)
            setAppliedId(commitmentId)
            setTimeout(() => {
                setAppliedId(null)
                fetchDashboard(true)
            }, 1000)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al aplicar compromiso')
        }
    }

    const fmt = (amount: number, currency = 'ARS') =>
        hidden ? '••••' : new Intl.NumberFormat('es-AR', {
            style: 'currency', currency, maximumFractionDigits: 0,
        }).format(amount)

    if (loading) return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-9 w-48" />
            </div>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
        </div>
    )

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>
    if (!data) return null

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                    {refreshing && <Spinner className="text-muted-foreground" />}
                </div>
                <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-44 h-8 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={month} {...fadeIn} className="space-y-4">

                    {/* Grupo 1 — Ingresos / Gastos / Balance mensual */}
                    <motion.div
                        className="rounded-xl overflow-hidden"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                    >
                        <div className="px-4 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensual</p>
                        </div>
                        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--border)' }}>
                            <motion.div variants={staggerItem} className="p-3 md:p-4"
                                        style={{ borderTop: '2px solid #10B981' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Ingresos</p>
                                <p className="text-base md:text-2xl font-semibold tracking-tight text-green-500">
                                    <FmtAmount amount={data.summary.totalIncome} hidden={hidden} color="#10B981" />
                                </p>
                                <div className="mt-1"><TrendBadge value={data.trends.income} /></div>
                            </motion.div>

                            <motion.div variants={staggerItem} className="p-3 md:p-4"
                                        style={{ borderTop: '2px solid var(--destructive)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Gastos</p>
                                <p className="text-base md:text-2xl font-semibold tracking-tight text-destructive">
                                    <FmtAmount amount={data.summary.totalExpense} hidden={hidden} color="var(--destructive)" />
                                </p>
                                <div className="mt-1"><TrendBadge value={data.trends.expense} inverse /></div>
                            </motion.div>

                            <motion.div variants={staggerItem} className="p-3 md:p-4"
                                        style={{ borderTop: '2px solid var(--sky)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Balance</p>
                                <p className="text-base md:text-2xl font-semibold tracking-tight">
                                    <FmtAmount
                                        amount={data.summary.balance}
                                        hidden={hidden}
                                        color={data.summary.balance >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    />
                                </p>
                                <div className="mt-1"><TrendBadge value={data.trends.balance} /></div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Grupo 2 — Deuda total / Balance general */}
                    <motion.div
                        className="rounded-xl overflow-hidden"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                    >
                        <div className="px-4 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">General</p>
                        </div>
                        <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--border)' }}>
                            <motion.div variants={staggerItem} className="p-3 md:p-4"
                                        style={{ borderTop: '2px solid var(--amber)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Deuda total</p>
                                <p className="text-base md:text-2xl font-semibold tracking-tight">
                                    <FmtAmount amount={data.summary.totalDebt} hidden={hidden} color="var(--amber-dark)" />
                                </p>
                            </motion.div>

                            <motion.div variants={staggerItem} className="p-3 md:p-4"
                                        style={{ borderTop: '2px solid var(--sky)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Balance general</p>
                                <p className="text-base md:text-2xl font-semibold tracking-tight">
                                    <FmtAmount
                                        amount={data.netWorth.total}
                                        hidden={hidden}
                                        color={data.netWorth.total >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    />
                                </p>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Sankey */}
                    <SankeyChart />

                    {/* Grid principal */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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
                                        <div className="flex items-center gap-2 min-w-0">
                                            {account.color && (
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
                                            )}
                                            <span className="text-sm truncate">{account.name}</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                                                  style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
                                                {ACCOUNT_TYPE_LABELS[account.type]}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium tabular-nums shrink-0 ml-2"
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
                                ) : data.expenseByCategory.map((cat) => {
                                    const pctOfTotal = data.summary.totalExpense > 0
                                        ? (cat.total / data.summary.totalExpense) * 100
                                        : 0
                                    const pctOfIncome = data.summary.totalIncome > 0
                                        ? Math.round((cat.total / data.summary.totalIncome) * 100)
                                        : null
                                    return (
                                        <div key={cat.name} className="py-2 border-b last:border-0"
                                             style={{ borderColor: 'var(--border)' }}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-2 h-2 rounded-full shrink-0"
                                                         style={{ backgroundColor: cat.color ?? '#9CA3AF' }} />
                                                    <span className="text-sm truncate">{cat.name}</span>
                                                </div>
                                                <span className="text-sm font-medium tabular-nums text-destructive shrink-0 ml-2">
                                                    {fmt(cat.total)}
                                                </span>
                                            </div>
                                            {/* Barra de progreso */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1 rounded-full overflow-hidden"
                                                     style={{ background: 'var(--secondary)' }}>
                                                    <div className="h-full rounded-full transition-all"
                                                         style={{
                                                             width: `${pctOfTotal}%`,
                                                             backgroundColor: cat.color ?? '#9CA3AF',
                                                             opacity: 0.7,
                                                         }} />
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="text-xs tabular-nums"
                                                          style={{ color: 'var(--muted-foreground)' }}>
                                                        {Math.round(pctOfTotal)}% gasto
                                                    </span>
                                                    {pctOfIncome !== null && (
                                                        <>
                                                            <span className="text-xs" style={{ color: 'var(--border)' }}>·</span>
                                                            <span className="text-xs tabular-nums"
                                                                  style={{ color: 'var(--muted-foreground)' }}>
                                                                {pctOfIncome}% ing
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
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
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm truncate">{c.description}</span>
                                            {c.dayOfMonth && (
                                                <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                                                      style={{ background: 'var(--sky-light)', color: 'var(--sky-dark)' }}>
                                                    día {c.dayOfMonth}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <span className="text-sm font-medium tabular-nums">
                                                {fmt(c.amount, c.currency)}
                                            </span>
                                            <motion.div
                                                key={c._id}
                                                animate={appliedId === c._id ? { scale: [1, 1.1, 1] } : {}}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {appliedId === c._id ? (
                                                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium"
                                                          style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                                                        <CheckCircle size={12} /> Aplicado
                                                    </span>
                                                ) : (
                                                    <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                                                            style={{ borderColor: 'var(--sky)', color: 'var(--sky)' }}
                                                            onClick={() => handleApplyCommitment(c)}>
                                                        Aplicar
                                                    </Button>
                                                )}
                                            </motion.div>
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
                                ) : data.installmentsThisMonth.map((plan) => {
                                    const [fy, fm] = plan.firstClosingMonth.split('-').map(Number)
                                    const [my, mm] = data.month.split('-').map(Number)
                                    const currentInstallment = (my - fy) * 12 + (mm - fm) + 1
                                    return (
                                        <div key={plan._id} className="flex items-center justify-between py-2 border-b last:border-0"
                                             style={{ borderColor: 'var(--border)' }}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-sm truncate">{plan.description}</span>
                                                <span className="text-xs px-1.5 py-0.5 rounded shrink-0 tabular-nums"
                                                      style={{ background: 'var(--amber-light)', color: 'var(--amber-dark)' }}>
                                                    {currentInstallment}/{plan.installmentCount}
                                                </span>
                                            </div>
                                            <span className="text-sm font-medium tabular-nums shrink-0 ml-2">
                                                {fmt(plan.installmentAmount, plan.currency)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Grupo 3 — Activos / Pasivos / Neto */}
                    <div className="rounded-xl overflow-hidden"
                         style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                        <div className="px-4 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Patrimonio</p>
                        </div>
                        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--border)' }}>
                            <div className="p-3 md:p-4" style={{ borderTop: '2px solid #10B981' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Activos</p>
                                <p className="text-base md:text-xl font-semibold tracking-tight text-green-500">
                                    <FmtAmount amount={data.netWorth.assets} hidden={hidden} color="#10B981" />
                                </p>
                            </div>
                            <div className="p-3 md:p-4" style={{ borderTop: '2px solid var(--destructive)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Pasivos</p>
                                <p className="text-base md:text-xl font-semibold tracking-tight text-destructive">
                                    <FmtAmount amount={data.netWorth.liabilities} hidden={hidden} color="var(--destructive)" />
                                </p>
                            </div>
                            <div className="p-3 md:p-4" style={{ borderTop: '2px solid var(--sky)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">Neto</p>
                                <p className="text-base md:text-xl font-semibold tracking-tight">
                                    <FmtAmount
                                        amount={data.netWorth.total}
                                        hidden={hidden}
                                        color={data.netWorth.total >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    />
                                </p>
                            </div>
                        </div>
                    </div>

                </motion.div>
            </AnimatePresence>

            <ApplyCommitmentDialog
                open={applyDialogOpen}
                onOpenChange={setApplyDialogOpen}
                commitment={selectedCommitment}
                accounts={accounts}
                period={month}
                onSubmit={handleApplySubmit}
            />
        </div>
    )
}