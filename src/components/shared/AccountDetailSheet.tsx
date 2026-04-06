'use client'

import { useState, useEffect } from 'react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { IAccount } from '@/types'
import {
    getAccountBalancesByCurrency,
    getAccountCurrencyLabel,
    getPrimaryCurrency,
    isDualCurrencyAccount,
} from '@/lib/utils/accounts'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import { apiJson } from '@/lib/client/auth-client'

type AccountWithColor = IAccount & { color?: string; balance?: number }

interface Category {
    name: string
    color?: string
}

interface RecentTransaction {
    _id: string
    type: string
    amount: number
    currency: string
    destinationAmount?: number
    destinationCurrency?: string
    exchangeRate?: number
    paymentGroupId?: string
    date: string
    description: string
    categoryId?: Category
    sourceAccountId?: { _id: string } | string
    destinationAccountId?: { _id: string } | string
}

interface ActiveInstallment {
    _id: string
    description: string
    merchant?: string
    totalAmount: number
    installmentAmount: number
    installmentCount: number
    paidInstallments: number
    remainingInstallments: number
    remainingAmount: number
    currency: string
    category?: Category
}

interface AccountDetail {
    account: AccountWithColor
    recentTransactions: RecentTransaction[]
    activeInstallments: ActiveInstallment[]
}

interface AccountDetailSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    accountId: string | null
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    bank: 'Banco',
    cash: 'Efectivo',
    wallet: 'Billetera virtual',
    credit_card: 'Tarjeta de crédito',
    debt: 'Deuda',
    savings: 'Ahorro',
}

export function AccountDetailSheet({ open, onOpenChange, accountId }: AccountDetailSheetProps) {
    const [detail, setDetail] = useState<AccountDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || !accountId) return
        const fetchDetail = async () => {
            try {
                setLoading(true)
                setError(null)
                const data = await apiJson<AccountDetail>(`/api/accounts/${accountId}/detail`)
                setDetail(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al cargar detalle')
            } finally {
                setLoading(false)
            }
        }
        fetchDetail()
    }, [open, accountId])

    useDataInvalidation(
        ['account-detail', 'accounts', 'transactions', 'credit-card-expenses'],
        () => {
            if (!open || !accountId) return

            void apiJson<AccountDetail>(`/api/accounts/${accountId}/detail`)
                .then((data) => {
                    setDetail(data)
                    setError(null)
                })
                .catch((err) => {
                    setError(err instanceof Error ? err.message : 'Error al cargar detalle')
                })
        }
    )

    const fmt = (amount: number, currency = 'ARS') =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount)

    const account = detail?.account
    const balancesByCurrency = getAccountBalancesByCurrency(account)
    const primaryCurrency = getPrimaryCurrency(account)
    const dualCurrency = isDualCurrencyAccount(account)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
                <SheetHeader className="mb-4">
                    <SheetTitle className="flex items-center gap-2">
                        {account?.color && (
                            <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: account.color }}
                            />
                        )}
                        {loading ? <Skeleton className="h-6 w-40" /> : account?.name ?? 'Detalle de cuenta'}
                    </SheetTitle>
                </SheetHeader>

                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-40 w-full rounded-xl" />
                        <Skeleton className="h-40 w-full rounded-xl" />
                    </div>
                ) : error ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : detail && account ? (
                    <div className="space-y-6">

                        {/* Info general */}
                        <div className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Tipo</span>
                                <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Monedas</span>
                                <span className="text-sm font-medium">{getAccountCurrencyLabel(account)}</span>
                            </div>
                            {account.institution && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Entidad</span>
                                    <span className="text-sm font-medium">{account.institution}</span>
                                </div>
                            )}
                            <Separator />
                            {dualCurrency ? (
                                <div className="space-y-2">
                                    <span className="text-sm font-medium">Saldos actuales</span>
                                    {(['ARS', 'USD'] as const).map((currency) => (
                                        <div key={currency} className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">{currency}</span>
                                            <span className={`text-base font-bold ${balancesByCurrency[currency] < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {fmt(balancesByCurrency[currency], currency)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Saldo actual</span>
                                    <span className={`text-lg font-bold ${(account.balance ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {fmt(account.balance ?? 0, primaryCurrency)}
                                    </span>
                                </div>
                            )}

                            {/* Info tarjeta */}
                            {account.type === 'credit_card' && account.creditCardConfig && (
                                <>
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Cierre</span>
                                        <span className="text-sm font-medium">Día {account.creditCardConfig.closingDay}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Vencimiento</span>
                                        <span className="text-sm font-medium">Día {account.creditCardConfig.dueDay}</span>
                                    </div>
                                    {account.creditCardConfig.creditLimit && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Límite</span>
                                                <span className="text-sm font-medium">{fmt(account.creditCardConfig.creditLimit, primaryCurrency)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Disponible</span>
                                                <span className="text-sm font-medium text-green-600">
                          {fmt(account.creditCardConfig.creditLimit + (account.balance ?? 0), primaryCurrency)}
                        </span>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Cuotas activas */}
                        {account.type === 'credit_card' && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold">Cuotas activas</h3>
                                {detail.activeInstallments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin cuotas activas</p>
                                ) : (
                                    <div className="space-y-3">
                                        {detail.activeInstallments.map((inst) => (
                                            <div key={inst._id} className="rounded-lg border p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium">{inst.description}</p>
                                                        {inst.merchant && (
                                                            <p className="text-xs text-muted-foreground">{inst.merchant}</p>
                                                        )}
                                                    </div>
                                                    {inst.category && (
                                                        <div className="flex items-center gap-1">
                                                            {inst.category.color && (
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: inst.category.color }} />
                                                            )}
                                                            <span className="text-xs text-muted-foreground">{inst.category.name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-xs">
                                                    <div>
                                                        <p className="text-muted-foreground">Cuotas</p>
                                                        <p className="font-medium">{inst.paidInstallments}/{inst.installmentCount}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Por mes</p>
                                                        <p className="font-medium">{fmt(inst.installmentAmount, inst.currency)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Restante</p>
                                                        <p className="font-medium text-orange-500">{fmt(inst.remainingAmount, inst.currency)}</p>
                                                    </div>
                                                </div>
                                                {/* Barra de progreso */}
                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all"
                                                        style={{ width: `${(inst.paidInstallments / inst.installmentCount) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Últimas transacciones */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold">Últimas transacciones</h3>
                            {detail.recentTransactions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin transacciones</p>
                            ) : (
                                <div className="space-y-2">
                                    {detail.recentTransactions.map((t) => {
                                        const isSource = (() => {
                                            const src = t.sourceAccountId
                                            if (!src) return false
                                            if (typeof src === 'string') return src === accountId
                                            return src._id?.toString() === accountId
                                        })()
                                        const isDestination = (() => {
                                            const dest = t.destinationAccountId
                                            if (!dest) return false
                                            if (typeof dest === 'string') return dest === accountId
                                            return dest._id?.toString() === accountId
                                        })()
                                        const displayAmount =
                                            t.type === 'exchange' && isDestination && t.destinationAmount
                                                ? t.destinationAmount
                                                : t.amount
                                        const displayCurrency =
                                            t.type === 'exchange' && isDestination && t.destinationCurrency
                                                ? t.destinationCurrency
                                                : t.currency
                                        const displayPrefix =
                                            t.type === 'exchange' && isSource && isDestination
                                                ? '↔'
                                                : isSource
                                                    ? '-'
                                                    : '+'
                                        return (
                                            <div key={t._id} className="flex items-center justify-between py-2 border-b last:border-0">
                                                <div className="flex items-center gap-2">
                                                    {t.categoryId?.color && (
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.categoryId.color }} />
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-medium">{t.description}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(t.date).toLocaleDateString('es-AR')}
                                                            {t.categoryId?.name && ` · ${t.categoryId.name}`}
                                                            {t.type === 'exchange' && t.exchangeRate
                                                                ? ` · TC ${new Intl.NumberFormat('es-AR', {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 4,
                                                                }).format(t.exchangeRate)}`
                                                                : ''}
                                                            {t.type === 'credit_card_payment' && t.paymentGroupId
                                                                ? ' · pago dual'
                                                                : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-semibold ${isSource && !isDestination ? 'text-red-600' : 'text-green-600'}`}>
                          {displayPrefix}{fmt(displayAmount, displayCurrency)}
                        </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </SheetContent>
        </Sheet>
    )
}
