'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
    AlertCircle,
    ArrowRight,
    Banknote,
    CreditCard,
    EyeOff,
    Landmark,
    Pencil,
    PiggyBank,
    Plus,
    Wallet,
} from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePreferences } from '@/hooks/usePreferences'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { AccountDialog } from '@/components/shared/AccountDialog'
import { AccountDetailSheet } from '@/components/shared/AccountDetailSheet'
import { EmptyState } from '@/components/shared/EmptyState'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { AccountFormData } from '@/lib/validations'
import type { IAccount } from '@/types'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { cn } from '@/lib/utils'
import {
    getAccountBalancesByCurrency,
    getAccountCurrencyLabel,
    getDefaultPaymentMethodLabel,
    getDefaultPaymentMethods,
    getPrimaryCurrency,
    isDualCurrencyAccount,
} from '@/lib/utils/accounts'

type AccountWithBalance = IAccount & { color?: string; balance?: number }

type TypeMeta = {
    label: string
    itemLabel: string
    icon: React.ElementType
    accent: string
    soft: string
}

type CurrencySummary = {
    currency: string
    total: number
    count: number
}

const ACCOUNT_TYPE_META: Record<string, TypeMeta> = {
    bank: {
        label: 'Bancos',
        itemLabel: 'Banco',
        icon: Landmark,
        accent: '#0284C7',
        soft: 'rgba(2,132,199,0.10)',
    },
    cash: {
        label: 'Efectivo',
        itemLabel: 'Efectivo',
        icon: Banknote,
        accent: '#16A34A',
        soft: 'rgba(22,163,74,0.10)',
    },
    wallet: {
        label: 'Billeteras virtuales',
        itemLabel: 'Billetera virtual',
        icon: Wallet,
        accent: '#7C3AED',
        soft: 'rgba(124,58,237,0.10)',
    },
    credit_card: {
        label: 'Tarjetas de crédito',
        itemLabel: 'Tarjeta de crédito',
        icon: CreditCard,
        accent: '#EA580C',
        soft: 'rgba(234,88,12,0.10)',
    },
    debt: {
        label: 'Deudas',
        itemLabel: 'Deuda',
        icon: AlertCircle,
        accent: '#DC2626',
        soft: 'rgba(220,38,38,0.10)',
    },
    savings: {
        label: 'Ahorros',
        itemLabel: 'Ahorro',
        icon: PiggyBank,
        accent: '#0F766E',
        soft: 'rgba(15,118,110,0.10)',
    },
}

const ACCOUNT_TYPE_ORDER = ['bank', 'wallet', 'cash', 'savings', 'credit_card', 'debt']

function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount)
}

function getTypeMeta(type: string): TypeMeta {
    return ACCOUNT_TYPE_META[type] ?? {
        label: type,
        itemLabel: type,
        icon: Wallet,
        accent: 'var(--sky)',
        soft: 'var(--secondary)',
    }
}

function summarizeByCurrency(accounts: AccountWithBalance[]): CurrencySummary[] {
    const map = new Map<string, CurrencySummary>()

    for (const account of accounts) {
        const balancesByCurrency = getAccountBalancesByCurrency(account)
        const supportedCurrencies = account.supportedCurrencies ?? [account.currency]
        ;(['ARS', 'USD'] as const).forEach((currency) => {
            if (!supportedCurrencies.includes(currency) && balancesByCurrency[currency] === 0) return

            const current = map.get(currency) ?? { currency, total: 0, count: 0 }
            current.total += balancesByCurrency[currency]
            current.count += 1
            map.set(currency, current)
        })
    }

    return Array.from(map.values()).sort((a, b) => a.currency.localeCompare(b.currency))
}

function getAccountSecondaryMeta(account: AccountWithBalance): string[] {
    const items: string[] = []

    if (account.institution) items.push(account.institution)

    if (account.type === 'credit_card' && account.creditCardConfig) {
        items.push(`Cierre ${account.creditCardConfig.closingDay}`)
        items.push(`Vto ${account.creditCardConfig.dueDay}`)
    }

    if (account.type === 'credit_card' && account.creditCardConfig?.creditLimit) {
        items.push(`Límite ${formatAmount(account.creditCardConfig.creditLimit, getPrimaryCurrency(account))}`)
    }

    return items
}

function SummaryCard({
    title,
    value,
    hint,
}: {
    title: string
    value: string
    hint: string
}) {
    return (
        <div
            className="min-w-[190px] shrink-0 snap-start rounded-xl p-3 md:min-w-0 md:rounded-2xl md:p-4"
            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
        >
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-1.5 text-lg font-semibold tracking-tight md:mt-2 md:text-2xl">{value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground md:mt-1 md:text-xs">{hint}</p>
        </div>
    )
}

function AccountsLoadingState() {
    return (
        <div className="px-4 py-5 md:px-6 md:py-6 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-9 w-32" />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                {[...Array(3)].map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-2xl" />
                ))}
            </div>

            {[...Array(3)].map((_, sectionIndex) => (
                <div key={sectionIndex} className="space-y-3">
                    <Skeleton className="h-8 w-52" />
                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                        {[...Array(2)].map((__, rowIndex) => (
                            <Skeleton
                                key={rowIndex}
                                className={cn('h-24 w-full rounded-none', rowIndex > 0 && 'border-t')}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function AccountRow({
    account,
    hidden,
    onOpen,
    onEdit,
    onDeactivate,
}: {
    account: AccountWithBalance
    hidden: boolean
    onOpen: (account: AccountWithBalance) => void
    onEdit: (account: AccountWithBalance, event: React.MouseEvent) => void
    onDeactivate: (account: AccountWithBalance, event: React.MouseEvent) => void
}) {
    const meta = getTypeMeta(account.type)
    const Icon = meta.icon
    const balancesByCurrency = getAccountBalancesByCurrency(account)
    const primaryCurrency = getPrimaryCurrency(account)
    const primaryBalance = balancesByCurrency[primaryCurrency]
    const balanceNegative = primaryBalance < 0
    const secondaryMeta = getAccountSecondaryMeta(account)
    const dualCurrency = isDualCurrencyAccount(account)
    const defaultPaymentMethods = getDefaultPaymentMethods(account)

    return (
        <motion.div
            variants={staggerItem}
            className="group cursor-pointer"
            onClick={() => onOpen(account)}
        >
            <div className="px-2.5 py-2.5 md:px-5 md:py-4">
                <div className="flex items-start gap-2 md:gap-3">
                    <div
                        className="mt-0.5 flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10 md:rounded-xl"
                        style={{ background: meta.soft, color: meta.accent }}
                    >
                        <Icon className="h-4 w-4 md:h-4.5 md:w-4.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    {account.color && (
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full md:h-2.5 md:w-2.5"
                                            style={{ backgroundColor: account.color }}
                                        />
                                    )}
                                    <p className="truncate text-[12.5px] font-medium md:text-[15px]">{account.name}</p>
                                    <Badge variant="outline" className="h-4 rounded-md px-1.5 text-[9px] md:h-5 md:text-[10px]">
                                        {getAccountCurrencyLabel(account)}
                                    </Badge>
                                </div>

                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground md:mt-1 md:gap-x-2 md:text-xs">
                                    <span>{meta.itemLabel}</span>
                                    {secondaryMeta.map((item) => (
                                        <span key={item} className="flex items-center gap-2">
                                            <span className="hidden sm:inline text-muted-foreground/60">•</span>
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2.5 md:justify-end md:gap-3">
                                <div className="text-left md:text-right">
                                    <p className="hidden text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:block">
                                        Saldo actual
                                    </p>
                                    {dualCurrency ? (
                                        <div className="space-y-0.5 md:mt-0.5">
                                            {(['ARS', 'USD'] as const).map((currency) => (
                                                <p
                                            key={currency}
                                            className="text-[11px] font-semibold tabular-nums md:text-sm"
                                            style={{
                                                color: balancesByCurrency[currency] < 0 ? 'var(--destructive)' : 'var(--foreground)',
                                            }}
                                                >
                                                    <span className="mr-1 text-[10px] text-muted-foreground md:text-xs">{currency}</span>
                                                    <ResponsiveAmount
                                                        amount={balancesByCurrency[currency]}
                                                        currency={currency}
                                                        hidden={hidden}
                                                    color={balancesByCurrency[currency] < 0 ? 'var(--destructive)' : 'var(--foreground)'}
                                                />
                                            </p>
                                        ))}
                                        </div>
                                    ) : (
                                        <p
                                            className="text-[13px] font-semibold tabular-nums md:mt-0.5 md:text-lg"
                                            style={{ color: balanceNegative ? 'var(--destructive)' : 'var(--foreground)' }}
                                        >
                                            <ResponsiveAmount
                                                amount={primaryBalance}
                                                currency={primaryCurrency}
                                                hidden={hidden}
                                                color={balanceNegative ? 'var(--destructive)' : 'var(--foreground)'}
                                            />
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-0 md:gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-7 w-7 md:h-8 md:w-8"
                                        aria-label="Editar cuenta"
                                        onClick={(event) => onEdit(account, event)}
                                    >
                                        <Pencil />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-7 w-7 md:h-8 md:w-8"
                                        aria-label="Desactivar cuenta"
                                        onClick={(event) => onDeactivate(account, event)}
                                    >
                                        <EyeOff />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between md:mt-3">
                            <div className="flex flex-wrap items-center gap-1 md:gap-2">
                                {defaultPaymentMethods.map((paymentMethod) => (
                                    <Badge
                                        key={paymentMethod}
                                        variant="secondary"
                                        className="rounded-md px-1.5 py-0 text-[8.5px] md:px-2 md:py-0.5 md:text-[10px]"
                                    >
                                        {getDefaultPaymentMethodLabel(paymentMethod)}
                                    </Badge>
                                ))}
                                {account.type === 'credit_card' && account.creditCardConfig?.creditLimit && (
                                    <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[8.5px] md:px-2 md:py-0.5 md:text-[10px]">
                                        Disponible{' '}
                                        <ResponsiveAmount
                                            amount={account.creditCardConfig.creditLimit + primaryBalance}
                                            currency={primaryCurrency}
                                            hidden={hidden}
                                            compactMaximumFractionDigits={0}
                                            className="font-medium"
                                        />
                                    </Badge>
                                )}
                                {account.type === 'debt' && (
                                    <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[8.5px] md:px-2 md:py-0.5 md:text-[10px]">
                                        Seguimiento de deuda
                                    </Badge>
                                )}
                            </div>

                            <div className="hidden md:flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                                Ver detalle
                                <ArrowRight className="h-3.5 w-3.5" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function AccountTypeSection({
    type,
    accounts,
    hidden,
    onOpen,
    onEdit,
    onDeactivate,
}: {
    type: string
    accounts: AccountWithBalance[]
    hidden: boolean
    onOpen: (account: AccountWithBalance) => void
    onEdit: (account: AccountWithBalance, event: React.MouseEvent) => void
    onDeactivate: (account: AccountWithBalance, event: React.MouseEvent) => void
}) {
    const meta = getTypeMeta(type)
    const Icon = meta.icon
    const currencySummary = summarizeByCurrency(accounts)

    return (
        <motion.section
            id={`account-section-${type}`}
            variants={staggerItem}
            className="space-y-2 md:space-y-3"
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-7.5 w-7.5 items-center justify-center rounded-xl md:h-10 md:w-10 md:rounded-2xl"
                        style={{ background: meta.soft, color: meta.accent }}
                    >
                        <Icon className="h-4 w-4 md:h-4.5 md:w-4.5" />
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[13px] font-semibold md:text-base">{meta.label}</h2>
                            <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[8.5px] md:text-[10px]">
                                {accounts.length}
                            </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground md:text-xs">
                            {accounts.length === 1 ? '1 cuenta en esta sección' : `${accounts.length} cuentas en esta sección`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {currencySummary.map((item) => (
                        <Badge
                            key={item.currency}
                            variant="outline"
                            className="h-5.5 rounded-lg px-2 text-[9px] font-medium md:h-7 md:px-2.5 md:text-[11px]"
                        >
                            {item.currency}{' '}
                            <ResponsiveAmount
                                amount={item.total}
                                currency={item.currency}
                                hidden={hidden}
                                compactMaximumFractionDigits={0}
                            />
                        </Badge>
                    ))}
                </div>
            </div>

            <motion.div
                className="overflow-hidden rounded-2xl"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {accounts.map((account, index) => (
                    <div
                        key={account._id.toString()}
                        style={index > 0 ? { borderTop: '0.5px solid var(--border)' } : undefined}
                    >
                        <AccountRow
                            account={account}
                            hidden={hidden}
                            onOpen={onOpen}
                            onEdit={onEdit}
                            onDeactivate={onDeactivate}
                        />
                    </div>
                ))}
            </motion.div>
        </motion.section>
    )
}

export default function AccountsPage() {
    const { accounts, loading, error, fetchAccounts, createAccount, updateAccount, deleteAccount } = useAccounts()
    const { success, error: toastError } = useToast()
    const { hidden } = useHideAmounts()
    const { preferences } = usePreferences()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<IAccount | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [detailAccountId, setDetailAccountId] = useState<string | null>(null)

    usePageTitle('Cuentas')

    useEffect(() => {
        void fetchAccounts()
    }, [fetchAccounts, preferences.operationalStartDate])

    const groupedAccounts = useMemo(() => {
        const source = accounts as AccountWithBalance[]
        return ACCOUNT_TYPE_ORDER
            .map((type) => ({
                type,
                accounts: source.filter((account) => account.type === type),
            }))
            .filter((group) => group.accounts.length > 0)
    }, [accounts])

    const summary = useMemo(() => {
        const source = accounts as AccountWithBalance[]
        const negativeCount = source.filter((account) => (account.balance ?? 0) < 0).length
        const creditCards = source.filter((account) => account.type === 'credit_card').length
        const activeTypes = groupedAccounts.length

        return {
            totalAccounts: source.length,
            negativeCount,
            creditCards,
            activeTypes,
        }
    }, [accounts, groupedAccounts])

    const handleCreate = () => {
        setSelectedAccount(null)
        setDialogOpen(true)
    }

    const handleEdit = (account: IAccount, event: React.MouseEvent) => {
        event.stopPropagation()
        setSelectedAccount(account)
        setDialogOpen(true)
    }

    const handleOpenDetail = (account: AccountWithBalance) => {
        setDetailAccountId(account._id.toString())
        setDetailOpen(true)
    }

    const handleDeactivate = (account: IAccount, event: React.MouseEvent) => {
        event.stopPropagation()
        setDeleteId(account._id.toString())
    }

    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        try {
            await deleteAccount(deleteId)
            success('Cuenta desactivada correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al desactivar cuenta')
        } finally {
            setDeleteId(null)
        }
    }

    const handleSubmit = async (data: AccountFormData) => {
        try {
            if (selectedAccount) {
                await updateAccount(selectedAccount._id.toString(), data)
                success('Cuenta actualizada correctamente')
            } else {
                await createAccount(data)
                success('Cuenta creada correctamente')
            }
            setDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar cuenta')
        }
    }

    if (loading) return <AccountsLoadingState />

    if (error) {
        return (
            <div className="px-4 py-10 md:px-6">
                <p className="text-center text-sm text-destructive">{error}</p>
            </div>
        )
    }

    return (
        <motion.div
            className="px-4 py-3.5 pb-24 md:px-6 md:py-6 md:pb-6 max-w-6xl mx-auto space-y-3.5 md:space-y-6"
            {...fadeIn}
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Cuentas</h1>
                    <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                        Organizá tus cuentas por tipo y entrá rápido al detalle de cada una.
                    </p>
                </div>

                <Button onClick={handleCreate} className="gap-2 w-full h-9 md:h-9 md:w-auto">
                    <Plus className="h-4 w-4" />
                    Nueva cuenta
                </Button>
            </div>

            {accounts.length === 0 ? (
                <div
                    className="rounded-2xl"
                    style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                >
                    <EmptyState
                        icon={CreditCard}
                        title="Todavía no tenés cuentas"
                        description="Creá tu primera cuenta para empezar a registrar movimientos y ordenar tu panorama financiero."
                        actionLabel="Nueva cuenta"
                        onAction={handleCreate}
                    />
                </div>
            ) : (
                <>
                    <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:gap-3 md:overflow-visible">
                        <SummaryCard
                            title="Cuentas activas"
                            value={String(summary.totalAccounts)}
                            hint={`${summary.activeTypes} tipos visibles en esta página`}
                        />
                        <SummaryCard
                            title="Tarjetas de crédito"
                            value={String(summary.creditCards)}
                            hint="Acceso rápido al detalle y a cuotas activas"
                        />
                        <SummaryCard
                            title="Con saldo en rojo"
                            value={String(summary.negativeCount)}
                            hint="Incluye cuentas con balance negativo o deuda visible"
                        />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {groupedAccounts.map((group) => {
                            const meta = getTypeMeta(group.type)
                            const Icon = meta.icon
                            return (
                                <button
                                    key={group.type}
                                    type="button"
                                    onClick={() => {
                                        document
                                            .getElementById(`account-section-${group.type}`)
                                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                    }}
                                    className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.25 text-[10px] font-medium transition-colors md:gap-2 md:px-3 md:py-2 md:text-xs"
                                    style={{
                                        background: 'var(--secondary)',
                                        color: 'var(--foreground)',
                                        border: '0.5px solid var(--border)',
                                    }}
                                >
                                    <Icon className="h-3.5 w-3.5" style={{ color: meta.accent }} />
                                    {meta.label}
                                    <span className="text-muted-foreground">({group.accounts.length})</span>
                                </button>
                            )
                        })}
                    </div>

                    <motion.div
                        className="space-y-6 md:space-y-8"
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                    >
                        {groupedAccounts.map((group) => (
                            <AccountTypeSection
                                key={group.type}
                                type={group.type}
                                accounts={group.accounts}
                                hidden={hidden}
                                onOpen={handleOpenDetail}
                                onEdit={handleEdit}
                                onDeactivate={handleDeactivate}
                            />
                        ))}
                    </motion.div>
                </>
            )}

            <AccountDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                account={selectedAccount}
                onSubmit={handleSubmit}
            />

            <AccountDetailSheet
                open={detailOpen}
                onOpenChange={setDetailOpen}
                accountId={detailAccountId}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desactivar esta cuenta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            La cuenta dejará de aparecer en la lista activa, pero el historial se conserva.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Desactivar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    )
}
