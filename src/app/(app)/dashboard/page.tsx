'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

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
    }[]
    netWorth: {
        assets: number
        liabilities: number
        total: number
    }
    pendingCommitments: {
        _id: string
        description: string
        amount: number
        currency: string
        dayOfMonth?: number
    }[]
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

    useEffect(() => {
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
        fetchDashboard()
    }, [month])

    const fmt = (amount: number, currency = 'ARS') =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount)

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando dashboard...</div>
    if (error) return <div className="p-8 text-center text-destructive">{error}</div>
    if (!data) return null

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Dashboard</h1>
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

            {/* Resumen del mes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-600">
                            {fmt(data.summary.totalIncome)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Gastos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-600">
                            {fmt(data.summary.totalExpense)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${data.summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fmt(data.summary.balance)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Deuda total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-orange-500">
                            {fmt(data.summary.totalDebt)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Saldos por cuenta */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Saldos por cuenta</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {data.accounts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin cuentas</p>
                        ) : (
                            data.accounts.map((account) => (
                                <div key={account._id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{account.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                            {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                                        </Badge>
                                    </div>
                                    <span className={`text-sm font-semibold ${account.balance < 0 ? 'text-red-600' : ''}`}>
                    {fmt(account.balance, account.currency)}
                  </span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Gastos por categoría */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Gastos por categoría</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {data.expenseByCategory.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin gastos este mes</p>
                        ) : (
                            data.expenseByCategory.map((cat) => (
                                <div key={cat.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {cat.color && (
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                        )}
                                        <span className="text-sm">{cat.name}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-red-600">{fmt(cat.total)}</span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Compromisos pendientes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Compromisos pendientes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {data.pendingCommitments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin compromisos pendientes</p>
                        ) : (
                            data.pendingCommitments.map((c) => (
                                <div key={c._id} className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">{c.description}</p>
                                        {c.dayOfMonth && (
                                            <p className="text-xs text-muted-foreground">Día {c.dayOfMonth}</p>
                                        )}
                                    </div>
                                    <span className="text-sm font-semibold text-red-600">
                    {fmt(c.amount, c.currency)}
                  </span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Cuotas del mes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Cuotas del mes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {data.installmentsThisMonth.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin cuotas este mes</p>
                        ) : (
                            data.installmentsThisMonth.map((plan) => (
                                <div key={plan._id} className="flex items-center justify-between">
                                    <p className="text-sm font-medium">{plan.description}</p>
                                    <span className="text-sm font-semibold text-red-600">
                    {fmt(plan.installmentAmount, plan.currency)}
                  </span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Patrimonio */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Patrimonio</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Activos</p>
                            <p className="text-lg font-bold text-green-600">{fmt(data.netWorth.assets)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pasivos</p>
                            <p className="text-lg font-bold text-red-600">{fmt(data.netWorth.liabilities)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Neto</p>
                            <p className={`text-lg font-bold ${data.netWorth.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {fmt(data.netWorth.total)}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}