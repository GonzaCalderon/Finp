'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react'
import { signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard,
    ArrowLeftRight,
    CreditCard,
    Calendar,
    TrendingUp,
    LogOut,
    Plus,
    MoreHorizontal,
    Eye,
    EyeOff,
    Upload,
    Settings,
    Wand2,
    BriefcaseBusiness,
    HandCoins,
    ChevronRight,
    Wallet,
} from 'lucide-react'

import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { QuickCaptureDialog } from '@/components/shared/QuickCaptureDialog'
import { TransactionDialog } from '@/components/shared/TransactionDialog'
import { NavInsight } from '@/components/shared/NavInsight'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useNavInsights } from '@/hooks/useNavInsights'
import { useToast } from '@/hooks/useToast'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useSpaceAction } from '@/contexts/SpaceActionContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { usePreferences } from '@/hooks/usePreferences'
import type {
    TransactionFormData,
    InstallmentFormData,
} from '@/lib/validations'
import { useInstallments } from '@/hooks/useInstallments'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    TRANSACTION_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import type { NavInsight as NavInsightType } from '@/types/nav-insight'
import type { CaptureTransactionLaunchDraft } from '@/types/capture-intent'

type NavKey =
    | 'dashboard'
    | 'transactions'
    | 'creditCard'
    | 'import'
    | 'accounts'
    | 'commitments'
    | 'projection'
    | 'rules'
    | 'spaces'
    | 'debts'
    | 'settings'

type NavItemDef = {
    key: NavKey
    href: string
    label: string
    caption: string
    icon: ElementType
}

type NavGroup = {
    label: string
    items: NavKey[]
}

type MoreSection = {
    label: string
    items: NavKey[]
}

export type FabActionTone = 'primary' | 'sky' | 'green' | 'amber' | 'purple' | 'muted'

export type FabAction = {
    id: string
    label: string
    description?: string
    icon: ElementType
    tone?: FabActionTone
    onPress?: () => void
    href?: string
    disabled?: boolean
}

export type FabConfig = {
    mode: 'hidden' | 'direct' | 'radial'
    label: string
    icon?: ReactNode
    actions: FabAction[]
}

const NAV_ITEMS: NavItemDef[] = [
    { key: 'dashboard', href: '/dashboard', label: 'Dashboard', caption: 'Pulso del periodo', icon: LayoutDashboard },
    { key: 'transactions', href: '/transactions', label: 'Transacciones', caption: 'Movimientos del mes', icon: ArrowLeftRight },
    { key: 'creditCard', href: '/transactions/credit-card', label: 'Gastos con TC', caption: 'Tarjetas y cuotas', icon: CreditCard },
    { key: 'import', href: '/transactions/import', label: 'Importar', caption: 'Subir Excel', icon: Upload },
    { key: 'accounts', href: '/accounts', label: 'Cuentas', caption: 'Bancos y billeteras', icon: Wallet },
    { key: 'commitments', href: '/commitments', label: 'Compromisos', caption: 'Pagos previstos', icon: Calendar },
    { key: 'projection', href: '/projection', label: 'Proyeccion', caption: 'Meses por venir', icon: TrendingUp },
    { key: 'rules', href: '/rules', label: 'Reglas', caption: 'Categorizacion automatica', icon: Wand2 },
    { key: 'spaces', href: '/spaces', label: 'Espacios', caption: 'Gastos compartidos', icon: BriefcaseBusiness },
    { key: 'debts', href: '/debts', label: 'Deudas', caption: 'Prestamos y pendientes', icon: HandCoins },
    { key: 'settings', href: '/settings', label: 'Configuracion', caption: 'Cuenta y preferencias', icon: Settings },
]

const NAV_BY_KEY = NAV_ITEMS.reduce<Record<NavKey, NavItemDef>>((acc, item) => {
    acc[item.key] = item
    return acc
}, {} as Record<NavKey, NavItemDef>)

const DESKTOP_GROUPS: NavGroup[] = [
    { label: 'Mi dia', items: ['dashboard', 'transactions'] },
    { label: 'Dinero', items: ['accounts', 'creditCard', 'debts'] },
    { label: 'Futuro', items: ['commitments', 'projection'] },
    { label: 'Compartido y automatizacion', items: ['spaces', 'rules', 'import'] },
    { label: 'Sistema', items: ['settings'] },
]

const MOBILE_MORE_SECTIONS: MoreSection[] = [
    { label: 'Movimientos', items: ['creditCard', 'import'] },
    { label: 'Dinero', items: ['accounts', 'debts'] },
    { label: 'Planificacion', items: ['commitments', 'projection'] },
    { label: 'Compartido', items: ['spaces'] },
    { label: 'Automatizacion', items: ['rules'] },
    { label: 'Sistema', items: ['settings'] },
]

const BOTTOM_NAV = [
    { key: 'dashboard' as const, mobileLabel: 'Dashboard' },
    { key: 'transactions' as const, mobileLabel: 'Transacciones' },
    { key: 'spaces' as const, mobileLabel: 'Espacios' },
]

const FAB_TONE_STYLES: Record<FabActionTone, { background: string; color: string; shadow: string }> = {
    primary: { background: 'var(--sky)', color: '#fff', shadow: 'rgba(74,158,204,0.28)' },
    sky: { background: 'var(--sky-light)', color: 'var(--sky-dark)', shadow: 'rgba(74,158,204,0.16)' },
    green: { background: 'color-mix(in srgb, #10B981 14%, var(--card))', color: '#059669', shadow: 'rgba(16,185,129,0.16)' },
    amber: { background: 'var(--warning-soft)', color: 'var(--warning-foreground)', shadow: 'rgba(212,160,23,0.16)' },
    purple: { background: 'color-mix(in srgb, #8B5CF6 14%, var(--card))', color: '#7C3AED', shadow: 'rgba(139,92,246,0.16)' },
    muted: { background: 'var(--secondary)', color: 'var(--muted-foreground)', shadow: 'rgba(17,24,39,0.10)' },
}

const NAV_LOAD_ITEM = {
    initial: { opacity: 0, y: 8, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
} as const

function isRouteActive(pathname: string, href: string) {
    if (href === '/transactions') return pathname === href
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
}

function isBottomRouteActive(pathname: string, href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
}

function getPeriodInfo(date = new Date()) {
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const progress = Math.min(1, Math.max(0, date.getDate() / daysInMonth))
    const monthLabel = date.toLocaleDateString('es-AR', { month: 'long' })
        .replace(/^\w/, (letter) => letter.toUpperCase())
    const percent = Math.round(progress * 100)
    return {
        progress,
        monthLabel,
        percentLabel: `${percent}%`,
        compactLabel: `${monthLabel} · ${percent}%`,
        progressAriaLabel: `${monthLabel}, ${percent}% del mes transcurrido`,
    }
}

function getInitials(name?: string | null, email?: string | null) {
    const source = name?.trim() || email?.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Finp'
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'F'
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function buildConfig(label: string, actions: FabAction[], icon?: ReactNode): FabConfig {
    const available = actions.filter((action) => !action.disabled).slice(0, 4)

    if (available.length === 0) {
        return { mode: 'hidden', label, icon, actions: [] }
    }

    return {
        mode: 'radial',
        label,
        icon,
        actions: available,
    }
}

function hrefAction(params: Omit<FabAction, 'onPress'> & { currentPathname: string }): FabAction | null {
    const { href, currentPathname, ...action } = params
    if (!href || isRouteActive(currentPathname, href)) return null
    return { ...action, href }
}

export function getMobileFabConfig(params: {
    pathname: string
    openTransactionDialog: () => void
    openQuickCapture?: () => void
    openCreditCardExpense?: () => void
    openAccountDialog?: () => void
    openSpaceDialog?: () => void
    openDebtDialog?: () => void
    openCommitmentDialog?: () => void
    openRuleDialog?: () => void
    spaceAction?: {
        label: string
        icon?: ReactNode
        onPress: () => void
    } | null
    navigate: (href: string) => void
}): FabConfig {
    const {
        pathname,
        openTransactionDialog,
        openQuickCapture,
        openAccountDialog,
        openSpaceDialog,
        openDebtDialog,
        openCommitmentDialog,
        openRuleDialog,
        spaceAction,
    } = params

    const quickCapture: FabAction = {
        id: 'quick-capture',
        label: 'Captura rápida',
        description: 'Escribí el movimiento',
        icon: Wand2,
        tone: 'primary',
        onPress: openQuickCapture ?? openTransactionDialog,
    }
    const newTransaction: FabAction = {
        id: 'new-transaction',
        label: 'Nueva transacción',
        description: 'Formulario completo',
        icon: ArrowLeftRight,
        tone: 'primary',
        onPress: openTransactionDialog,
    }
    const importExcel: FabAction = {
        id: 'import-excel',
        label: 'Importar Excel',
        description: 'Subir movimientos',
        icon: Upload,
        tone: 'sky',
        href: '/transactions/import',
    }

    const accountAction = openAccountDialog
        ? ({
            id: 'new-account',
            label: 'Nueva cuenta',
            description: 'Banco o billetera',
            icon: Wallet,
            tone: 'green',
            onPress: openAccountDialog,
        } satisfies FabAction)
        : hrefAction({
            id: 'new-account',
            label: 'Nueva cuenta',
            description: 'Banco o billetera',
            icon: Wallet,
            tone: 'green',
            href: '/accounts?create=1',
            currentPathname: pathname,
        })

    const spaceCreateAction = openSpaceDialog
        ? ({
            id: 'new-space',
            label: 'Nuevo espacio',
            description: 'Gasto compartido',
            icon: BriefcaseBusiness,
            tone: 'amber',
            onPress: openSpaceDialog,
        } satisfies FabAction)
        : spaceAction
            ? ({
                id: 'space-action',
                label: spaceAction.label,
                description: 'Accion del espacio',
                icon: BriefcaseBusiness,
                tone: 'amber',
                onPress: spaceAction.onPress,
            } satisfies FabAction)
            : hrefAction({
                id: 'new-space',
                label: 'Nuevo espacio',
                description: 'Gasto compartido',
                icon: BriefcaseBusiness,
                tone: 'amber',
                href: '/spaces?create=1',
                currentPathname: pathname,
            })

    if (pathname.startsWith('/spaces/')) {
        if (!spaceAction) return { mode: 'hidden', label: 'Acciones del espacio', actions: [] }
        return buildConfig(
            spaceAction.label,
            [{
                id: 'space-action',
                label: spaceAction.label,
                description: 'Accion contextual',
                icon: BriefcaseBusiness,
                tone: 'amber',
                onPress: spaceAction.onPress,
            }],
            spaceAction.icon ?? <BriefcaseBusiness className="h-5 w-5" />
        )
    }

    const newSpaceAction: FabAction = {
        id: 'new-space',
        label: 'Nuevo espacio',
        description: 'Crear espacio compartido',
        icon: BriefcaseBusiness,
        tone: 'amber',
        href: '/spaces?create=1',
    }

    if (pathname === '/spaces') {
        return buildConfig('Acciones de espacios', [
            quickCapture,
            spaceAction
                ? {
                    id: 'space-action',
                    label: spaceAction.label,
                    description: 'Registrar gasto compartido',
                    icon: BriefcaseBusiness,
                    tone: 'amber',
                    onPress: spaceAction.onPress,
                }
                : null,
            newSpaceAction,
            newTransaction,
        ].filter(Boolean) as FabAction[])
    }

    if (pathname === '/transactions/credit-card') {
        return buildConfig('Acciones de tarjeta', [
            quickCapture,
            newTransaction,
            importExcel,
        ].filter(Boolean) as FabAction[])
    }

    if (pathname === '/transactions/import' || pathname.startsWith('/transactions/import/')) {
        return buildConfig('Nueva transacción', [quickCapture, newTransaction])
    }

    if (pathname === '/transactions') {
        return buildConfig('Acciones de movimientos', [quickCapture, newTransaction, importExcel])
    }

    if (pathname === '/accounts') {
        return buildConfig('Acciones de cuentas', [quickCapture, accountAction, newTransaction].filter(Boolean) as FabAction[])
    }

    if (pathname === '/debts') {
        const debtAction = openDebtDialog
            ? ({
                id: 'new-debt',
                label: 'Nueva deuda',
                description: 'Prestamo o pendiente',
                icon: HandCoins,
                tone: 'amber',
                onPress: openDebtDialog,
            } satisfies FabAction)
            : hrefAction({
                id: 'new-debt',
                label: 'Nueva deuda',
                description: 'Prestamo o pendiente',
                icon: HandCoins,
                tone: 'amber',
                href: '/debts?create=1',
                currentPathname: pathname,
            })
        return buildConfig('Acciones de deudas', [quickCapture, debtAction, newTransaction].filter(Boolean) as FabAction[])
    }

    if (pathname === '/commitments') {
        const commitmentAction = openCommitmentDialog
            ? ({
                id: 'new-commitment',
                label: 'Nuevo compromiso',
                description: 'Pago previsto',
                icon: Calendar,
                tone: 'green',
                onPress: openCommitmentDialog,
            } satisfies FabAction)
            : hrefAction({
                id: 'new-commitment',
                label: 'Nuevo compromiso',
                description: 'Pago previsto',
                icon: Calendar,
                tone: 'green',
                href: '/commitments?create=1',
                currentPathname: pathname,
            })
        return buildConfig('Acciones de compromisos', [quickCapture, commitmentAction, newTransaction].filter(Boolean) as FabAction[])
    }

    if (pathname === '/rules') {
        const ruleAction = openRuleDialog
            ? ({
                id: 'new-rule',
                label: 'Nueva regla',
                description: 'Automatizar categoria',
                icon: Wand2,
                tone: 'purple',
                onPress: openRuleDialog,
            } satisfies FabAction)
            : hrefAction({
                id: 'new-rule',
                label: 'Nueva regla',
                description: 'Automatizar categoria',
                icon: Wand2,
                tone: 'purple',
                href: '/rules?create=1',
                currentPathname: pathname,
            })
        return buildConfig('Acciones de reglas', [quickCapture, ruleAction].filter(Boolean) as FabAction[])
    }

    if (pathname === '/dashboard') {
        return buildConfig('Acciones rapidas', [
            quickCapture,
            newTransaction,
            importExcel,
            accountAction,
            spaceCreateAction,
        ].filter(Boolean) as FabAction[])
    }

    return buildConfig('Acciones rapidas', [
        quickCapture,
        newTransaction,
        importExcel,
        accountAction,
        spaceCreateAction,
    ].filter(Boolean) as FabAction[])
}

function PulseDot({ count, className = '' }: { count?: number; className?: string }) {
    return (
        <span
            className={`finp-pulse-dot relative inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${className}`}
            style={{ background: 'var(--warning)' }}
            aria-label={count ? `${count} pendientes` : 'Pendiente'}
        />
    )
}

function AvatarProgressRing({
    initials,
    progress,
    size = 38,
    ariaLabel,
}: {
    initials: string
    progress: number
    size?: number
    ariaLabel?: string
}) {
    const stroke = Math.max(2, Math.round(size * 0.07))
    const radius = (size - stroke) / 2
    const circumference = 2 * Math.PI * radius
    const dashOffset = circumference * (1 - progress)
    const innerSize = size - stroke * 2 - 4

    return (
        <div
            className="relative shrink-0"
            style={{ width: size, height: size }}
            role="img"
            aria-label={ariaLabel}
        >
            <svg className="absolute inset-0" width={size} height={size} aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--sky)"
                    strokeWidth={stroke}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    className="transition-[stroke-dashoffset] duration-500 ease-out"
                />
            </svg>
            <div
                className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] font-semibold text-white"
                style={{
                    width: innerSize,
                    height: innerSize,
                    background: 'linear-gradient(135deg, var(--sky), var(--sky-dark))',
                }}
            >
                {initials}
            </div>
        </div>
    )
}

function SidebarContent({ insight, insightLoading }: { insight: NavInsightType; insightLoading: boolean }) {
    const pathname = usePathname()
    const { hidden, toggleHidden } = useHideAmounts()
    const { pendingCount, transactionReviewCount } = useNotifications()
    const period = useMemo(() => getPeriodInfo(), [])
    const initials = getInitials()

    return (
        <div className="flex h-full flex-col">
            <div className="border-b px-4 py-4" style={{ borderColor: 'var(--finp-nav-line)' }}>
                <div className="flex items-center justify-between gap-3">
                    <div
                        className="text-xl font-semibold tracking-tight text-white"
                    >
                        Fin<span style={{ color: 'var(--sky)' }}>p</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right leading-tight">
                            <div className="text-[11px] font-semibold text-white">{period.monthLabel}</div>
                            <div className="text-[10px] font-medium text-white/42">{period.percentLabel}</div>
                        </div>
                        <AvatarProgressRing
                            initials={initials}
                            progress={period.progress}
                            ariaLabel={period.progressAriaLabel}
                        />
                    </div>
                </div>
            </div>

            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--finp-nav-line)' }}>
                <NavInsight insight={insight} loading={insightLoading} />
            </div>

            <nav className="finp-nav-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
                {DESKTOP_GROUPS.map((group, groupIndex) => (
                    <motion.div
                        key={group.label}
                        className="mb-3"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.04 + groupIndex * 0.035, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <motion.div
                            className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/32"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.18, delay: 0.06 + groupIndex * 0.035 }}
                        >
                            {group.label}
                        </motion.div>
                        <div className="space-y-1">
                            {group.items.map((key, itemIndex) => {
                                const item = NAV_BY_KEY[key]
                                const Icon = item.icon
                                const active = isRouteActive(pathname, item.href)
                                const showPending =
                                    (key === 'spaces' && pendingCount > 0) ||
                                    (key === 'transactions' && transactionReviewCount > 0)
                                const dotCount = key === 'spaces' ? pendingCount : transactionReviewCount

                                return (
                                    <motion.div
                                        key={item.href}
                                        {...NAV_LOAD_ITEM}
                                        transition={{
                                            duration: 0.22,
                                            delay: 0.08 + groupIndex * 0.04 + itemIndex * 0.025,
                                            ease: [0.22, 1, 0.36, 1],
                                        }}
                                    >
                                        <Link
                                            href={item.href}
                                            className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--finp-nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                                            style={{ color: active ? '#fff' : 'var(--sidebar-foreground)' }}
                                        >
                                            {active && (
                                                <motion.span
                                                    layoutId="desktop-nav-active"
                                                    className="absolute inset-0 rounded-lg"
                                                    style={{ background: 'var(--sidebar-accent)' }}
                                                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                                                />
                                            )}
                                            {active && (
                                                <motion.span
                                                    layoutId="desktop-nav-bar"
                                                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                                                    style={{ background: 'var(--sky)' }}
                                                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                                                />
                                            )}
                                            <Icon
                                                size={16}
                                                className="relative shrink-0 transition-colors"
                                                style={{ color: active ? 'var(--sky)' : 'currentColor' }}
                                            />
                                            <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                                            {showPending && <PulseDot count={dotCount} />}
                                        </Link>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </motion.div>
                ))}
            </nav>

            <div className="mt-auto border-t px-3 py-3" style={{ borderColor: 'var(--finp-nav-line)' }}>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <motion.div
                        {...NAV_LOAD_ITEM}
                        transition={{ duration: 0.22, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <button
                            type="button"
                            onClick={toggleHidden}
                            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-2 text-xs font-medium text-sidebar-foreground hover:bg-[var(--finp-nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                            style={{ borderColor: 'var(--finp-nav-line)' }}
                            aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
                        >
                            {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>{hidden ? 'Mostrar' : 'Ocultar'}</span>
                        </button>
                    </motion.div>

                    <motion.div
                        {...NAV_LOAD_ITEM}
                        transition={{ duration: 0.22, delay: 0.27, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <ThemeToggle
                            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-2 text-xs font-medium text-sidebar-foreground hover:bg-[var(--finp-nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                            iconSize={14}
                            style={{ color: 'var(--sidebar-foreground)', borderColor: 'var(--finp-nav-line)' }}
                        />
                    </motion.div>

                    <motion.div
                        {...NAV_LOAD_ITEM}
                        transition={{ duration: 0.22, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <button
                            type="button"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sidebar-foreground hover:bg-[var(--finp-nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                            style={{ borderColor: 'var(--finp-nav-line)' }}
                            aria-label="Cerrar sesion"
                        >
                            <LogOut size={14} />
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

function useTransactionLauncher() {
    const [txDialogOpen, setTxDialogOpen] = useState(false)
    const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
    const [initialTransactionData, setInitialTransactionData] = useState<
        CaptureTransactionLaunchDraft | undefined
    >()
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { rules, createRule } = useTransactionRules()
    const { preferences } = usePreferences()
    const { success, error: toastError } = useToast()
    const { createPlan } = useInstallments()

    const recordCompletedIntent = (transactionId?: string) => {
        const draft = initialTransactionData
        if (
            draft?.origin !== 'quick_capture' ||
            !draft.captureSessionId ||
            !draft.captureIntent
        ) {
            return
        }
        const eventId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        void fetch('/api/quick-capture/learning/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                events: [{
                    eventId,
                    sessionId: draft.captureSessionId,
                    type: 'intent_completed',
                    method: 'submit',
                    suggestionId: draft.captureIntent,
                    transactionId,
                }],
            }),
        }).catch(() => {})
    }

    const handleCreateTransaction = async (data: TransactionFormData) => {
        try {
            const isQuickCapture = initialTransactionData?.origin === 'quick_capture'
            const result = await apiJson<{ transaction?: { _id?: unknown } }>('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    ...(isQuickCapture
                        ? {
                            quickCapture: true,
                            quickCaptureLearning: {
                                sessionId: initialTransactionData.captureSessionId,
                            },
                            allowPotentialDuplicate:
                                initialTransactionData.allowPotentialDuplicate === true,
                        }
                        : {}),
                }),
            })
            const transactionId = result.transaction?._id
                ? String(result.transaction._id)
                : undefined
            recordCompletedIntent(transactionId)
            invalidateData(TRANSACTION_INVALIDATION_TAGS)
            success('Transaccion creada correctamente')
            setTxDialogOpen(false)
            setInitialTransactionData(undefined)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al crear transaccion')
        }
    }

    const handleCreateTransactionBatch = async (items: TransactionFormData[]) => {
        try {
            for (const item of items) {
                await apiJson('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item),
                })
            }

            invalidateData(TRANSACTION_INVALIDATION_TAGS)
            success(items.length === 2 ? 'Pago dual registrado correctamente' : 'Transacciones creadas correctamente')
            setTxDialogOpen(false)
            setInitialTransactionData(undefined)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al crear transacciones')
        }
    }

    const handleCreateInstallment = async (data: InstallmentFormData) => {
        try {
            const isQuickCapture = initialTransactionData?.origin === 'quick_capture'
            const result = await createPlan(
                data,
                isQuickCapture
                    ? {
                        quickCapture: true,
                        quickCaptureLearning: {
                            sessionId: initialTransactionData.captureSessionId ?? '',
                        },
                        allowPotentialDuplicate:
                            initialTransactionData.allowPotentialDuplicate === true,
                    }
                    : undefined
            )
            const transactionId = result.transaction?._id
                ? String(result.transaction._id)
                : undefined
            recordCompletedIntent(transactionId)
            success('Compra en cuotas registrada correctamente')
            setTxDialogOpen(false)
            setInitialTransactionData(undefined)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar compra en cuotas')
        }
    }

    return {
        txDialogOpen,
        setTxDialogOpen,
        quickCaptureOpen,
        setQuickCaptureOpen,
        initialTransactionData,
        openFullTransaction: () => {
            setInitialTransactionData(undefined)
            setTxDialogOpen(true)
        },
        completeQuickCaptureDetails: (draft: CaptureTransactionLaunchDraft) => {
            setInitialTransactionData(draft)
            setQuickCaptureOpen(false)
            setTxDialogOpen(true)
        },
        handleAppliedCommitment: (description: string, period: string) => {
            const label = new Date(
                Number(period.split('-')[0]),
                Number(period.split('-')[1]) - 1,
                1
            ).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
            success(`Aplicaste “${description}” de ${label}.`)
        },
        accounts,
        categories,
        rules,
        createRule,
        preferences,
        handleCreateTransaction,
        handleCreateTransactionBatch,
        handleCreateInstallment,
    }
}

function DesktopFloatingTransactionButton() {
    const pathname = usePathname()
    const router = useRouter()
    const { action: spaceAction } = useSpaceAction()
    const [open, setOpen] = useState(false)
    const {
        txDialogOpen,
        setTxDialogOpen,
        quickCaptureOpen,
        setQuickCaptureOpen,
        initialTransactionData,
        openFullTransaction,
        completeQuickCaptureDetails,
        handleAppliedCommitment,
        accounts,
        categories,
        rules,
        createRule,
        preferences,
        handleCreateTransaction,
        handleCreateTransactionBatch,
        handleCreateInstallment,
    } = useTransactionLauncher()

    const fabConfig = getMobileFabConfig({
        pathname,
        openTransactionDialog: openFullTransaction,
        openQuickCapture: () => setQuickCaptureOpen(true),
        spaceAction,
        navigate: (href) => router.push(href),
    })

    const setOpenState = (nextOpen: boolean) => {
        setOpen(nextOpen)
    }

    useEffect(() => {
        // The menu must close when navigation removes the contextual FAB.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (fabConfig.mode === 'hidden' && open) setOpenState(false)
    }, [fabConfig.mode, open])

    useEffect(() => {
        function handleQuickCaptureShortcut(event: globalThis.KeyboardEvent) {
            if (
                event.key.toLowerCase() !== 'q' ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                !window.matchMedia('(min-width: 768px)').matches
            ) {
                return
            }
            const target = event.target as HTMLElement | null
            if (
                target?.isContentEditable ||
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA' ||
                target?.tagName === 'SELECT'
            ) {
                return
            }
            event.preventDefault()
            setQuickCaptureOpen(true)
        }
        window.addEventListener('keydown', handleQuickCaptureShortcut)
        return () => window.removeEventListener('keydown', handleQuickCaptureShortcut)
    }, [setQuickCaptureOpen])

    if (fabConfig.mode === 'hidden') return null

    return (
        <>
            <div className="fixed bottom-6 right-6 z-40 hidden md:block">
                <AnimatePresence>
                    {open && (
                        <>
                            <motion.button
                                type="button"
                                className="fixed inset-0 z-30 cursor-default bg-background/20 backdrop-blur-[2px]"
                                onClick={() => setOpenState(false)}
                                aria-label="Cerrar acciones rapidas"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                            />

                            <motion.div
                                className="absolute bottom-[calc(100%+0.85rem)] right-0 z-40 flex w-72 flex-col gap-2"
                                initial="closed"
                                animate="open"
                                exit="closed"
                                variants={{
                                    open: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
                                    closed: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
                                }}
                            >
                                {fabConfig.actions.map((action) => {
                                    const Icon = action.icon
                                    const tone = FAB_TONE_STYLES[action.tone ?? 'sky']

                                    return (
                                        <motion.button
                                            key={action.id}
                                            type="button"
                                            className="finp-fab-action flex min-h-[3.45rem] w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:opacity-50"
                                            style={{
                                                background: 'var(--card)',
                                                borderColor: 'var(--border)',
                                                boxShadow: `0 12px 28px ${tone.shadow}`,
                                            }}
                                            aria-label={action.label}
                                            data-fab-action={action.id}
                                            disabled={action.disabled}
                                            onClick={() => {
                                                setOpenState(false)
                                                runFabAction(action, (href) => router.push(href))
                                            }}
                                            variants={{
                                                open: { opacity: 1, y: 0, scale: 1 },
                                                closed: { opacity: 0, y: 10, scale: 0.96 },
                                            }}
                                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                        >
                                            <span
                                                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                                                style={{ background: tone.background, color: tone.color }}
                                            >
                                                <Icon size={18} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold">{action.label}</span>
                                                {action.description && (
                                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                        {action.description}
                                                    </span>
                                                )}
                                            </span>
                                        </motion.button>
                                    )
                                })}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <div className="relative z-50 flex flex-col items-end gap-1.5">
                    <Button
                        type="button"
                        onClick={() => setOpenState(!open)}
                        size="icon"
                        className="h-14 w-14 rounded-full border-[3px] text-white shadow-lg shadow-sky-500/30 transition-all duration-200 hover:shadow-sky-500/40 hover:-translate-y-0.5 hover:scale-[1.04] active:scale-[0.98]"
                        style={{
                            background: 'linear-gradient(160deg, var(--sky), var(--sky-dark))',
                            borderColor: 'var(--finp-fab-ring)',
                        }}
                        aria-label={open ? 'Cerrar acciones rapidas' : 'Abrir acciones rapidas'}
                        aria-expanded={open}
                    >
                        <span className={open ? 'rotate-45 transition-transform duration-200' : 'transition-transform duration-200'}>
                            <Plus className="h-5 w-5" />
                        </span>
                    </Button>
                </div>
            </div>

            <TransactionDialog
                open={txDialogOpen}
                onOpenChange={setTxDialogOpen}
                transaction={null}
                accounts={accounts}
                categories={categories}
                onSubmit={handleCreateTransaction}
                onBatchSubmit={handleCreateTransactionBatch}
                onInstallmentSubmit={handleCreateInstallment}
                onCreateRule={createRule}
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
                monthStartDay={preferences.monthStartDay}
                initialData={initialTransactionData}
            />
            <QuickCaptureDialog
                open={quickCaptureOpen}
                onOpenChange={setQuickCaptureOpen}
                accounts={accounts}
                categories={categories}
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
                onCompleteDetails={completeQuickCaptureDetails}
                onAppliedCommitment={handleAppliedCommitment}
            />
        </>
    )
}

function MobileNavItem({
    href,
    label,
    icon: Icon,
    active,
    onClick,
    loadDelay = 0,
    dot = false,
}: {
    href: string
    label: string
    icon: ElementType
    active: boolean
    onClick: () => void
    loadDelay?: number
    dot?: boolean
}) {
    return (
        <motion.div
            className="h-full w-full"
            {...NAV_LOAD_ITEM}
            transition={{ duration: 0.24, delay: loadDelay, ease: [0.22, 1, 0.36, 1] }}
        >
            <Link
                href={href}
                onClick={onClick}
                className="relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-[1.15rem] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                style={{ color: active ? 'var(--sky-dark)' : 'var(--muted-foreground)' }}
            >
                {active && (
                    <motion.span
                        layoutId="mobile-bottom-active"
                        className="absolute left-2 right-2 top-1.5 h-8 rounded-full"
                        style={{ background: 'var(--sky-light)' }}
                        transition={{ type: 'spring', stiffness: 450, damping: 38 }}
                    />
                )}
                <span className="relative">
                    <Icon size={18} />
                    {dot && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2">
                            <PulseDot />
                        </span>
                    )}
                </span>
                <span className="relative max-w-full truncate text-[10px] font-medium leading-none">{label}</span>
            </Link>
        </motion.div>
    )
}

function runFabAction(action: FabAction, navigate: (href: string) => void) {
    if (action.disabled) return
    if (action.onPress) {
        action.onPress()
        return
    }
    if (action.href) navigate(action.href)
}

function MobileContextualFab({
    config,
    onOpenChange,
}: {
    config: FabConfig
    onOpenChange?: (open: boolean) => void
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)

    const navigate = (href: string) => {
        router.push(href)
    }

    const setOpenState = (nextOpen: boolean) => {
        setOpen(nextOpen)
        onOpenChange?.(nextOpen)
    }

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpenState(false)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    useEffect(() => {
        if (config.mode === 'hidden' && open) setOpenState(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.mode, open])

    if (config.mode === 'hidden') return <div className="h-14 w-14" aria-hidden="true" />

    const handleCorePress = () => {
        if (config.mode === 'direct') {
            const action = config.actions[0]
            if (action) runFabAction(action, navigate)
            return
        }

        setOpenState(!open)
    }

    return (
        <>
            <AnimatePresence>
                {open && (
                    <>
                        <motion.button
                            type="button"
                            className="fixed inset-0 z-20 bg-background/35 backdrop-blur-[3px] dark:bg-black/35 md:hidden"
                            onClick={() => setOpenState(false)}
                            aria-label="Cerrar acciones rapidas"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.16 }}
                        />

                        <motion.div
                            className="fixed left-1/2 z-[45] flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 flex-col-reverse gap-2 md:hidden"
                            style={{ bottom: 'calc(var(--safe-area-bottom) + 5.9rem)' }}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            variants={{
                                open: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
                                closed: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
                            }}
                        >
                            {config.actions.map((action) => {
                                const Icon = action.icon
                                const tone = FAB_TONE_STYLES[action.tone ?? 'sky']

                                return (
                                    <motion.button
                                        key={action.id}
                                        type="button"
                                        className="finp-fab-action flex min-h-[3.6rem] w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:opacity-50"
                                        style={{
                                            background: 'var(--card)',
                                            borderColor: 'var(--border)',
                                            boxShadow: `0 12px 28px ${tone.shadow}`,
                                        }}
                                        aria-label={action.label}
                                        data-fab-action={action.id}
                                        disabled={action.disabled}
                                        onClick={() => {
                                            setOpenState(false)
                                            runFabAction(action, navigate)
                                        }}
                                        variants={{
                                            open: { opacity: 1, y: 0, scale: 1 },
                                            closed: { opacity: 0, y: 10, scale: 0.96 },
                                        }}
                                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        <span
                                            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                                            style={{ background: tone.background, color: tone.color }}
                                        >
                                            <Icon size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{action.label}</span>
                                            {action.description && (
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                    {action.description}
                                                </span>
                                            )}
                                        </span>
                                    </motion.button>
                                )
                            })}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <motion.div
                className="relative z-[46] -mt-6 flex flex-col items-center gap-1"
                {...NAV_LOAD_ITEM}
                transition={{ duration: 0.26, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
                <button
                    type="button"
                    onClick={handleCorePress}
                    className="grid h-14 w-14 place-items-center rounded-full border-[3px] text-white shadow-lg shadow-sky-500/30 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                    style={{
                        background: 'linear-gradient(160deg, var(--sky), var(--sky-dark))',
                        borderColor: 'var(--finp-fab-ring)',
                    }}
                    aria-label={open ? 'Cerrar acciones rapidas' : 'Abrir acciones rapidas'}
                    aria-expanded={config.mode === 'radial' ? open : undefined}
                >
                    <span className={open ? 'rotate-45 transition-transform duration-200' : 'transition-transform duration-200'}>
                        {config.mode === 'direct' && config.icon ? config.icon : <Plus size={23} strokeWidth={2.6} />}
                    </span>
                </button>
                <span className="max-w-[4.8rem] truncate text-center text-[10px] font-medium leading-none text-muted-foreground">
                    Agregar
                </span>
            </motion.div>
        </>
    )
}

function MobileMoreSheet({
    open,
    onClose,
    onNavigate,
    insight,
    insightLoading,
}: {
    open: boolean
    onClose: () => void
    onNavigate: () => void
    insight: NavInsightType
    insightLoading: boolean
}) {
    const pathname = usePathname()
    const { hidden, toggleHidden } = useHideAmounts()
    const { pendingCount, transactionReviewCount } = useNotifications()
    const period = useMemo(() => getPeriodInfo(), [])
    const initials = getInitials()
    const displayName = 'Finp'
    const displayEmail = 'Tu cuenta'

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose, open])

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.button
                        type="button"
                        className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] md:hidden"
                        onClick={onClose}
                        aria-label="Cerrar panel mas"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    />

                    <motion.div
                        className="fixed inset-x-0 bottom-0 z-[55] max-h-[88svh] overflow-y-auto rounded-t-[1.35rem] border-t bg-card shadow-2xl md:hidden"
                        style={{ borderColor: 'var(--border)' }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Mas navegacion"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="safe-area-pb">
                            <div className="mx-auto my-2 h-1.5 w-11 rounded-full bg-muted" />

                            <div className="mx-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--sky) 10%, var(--card)), var(--card))' }}>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full bg-[var(--sidebar)] p-1">
                                        <AvatarProgressRing
                                            initials={initials}
                                            progress={period.progress}
                                            size={50}
                                            ariaLabel={period.progressAriaLabel}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold">{displayName}</div>
                                        <div className="truncate text-xs text-muted-foreground">{displayEmail}</div>
                                        <div className="mt-0.5 truncate text-[11px] font-medium" style={{ color: 'var(--sky-dark)' }}>
                                            {period.compactLabel}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2.5">
                                    <NavInsight insight={insight} variant="mobile" loading={insightLoading} />
                                </div>
                            </div>

                            <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={toggleHidden}
                                    className="flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    {hidden ? <Eye size={16} className="text-muted-foreground" /> : <EyeOff size={16} className="text-muted-foreground" />}
                                    <span className="min-w-0 truncate">{hidden ? 'Mostrar montos' : 'Ocultar montos'}</span>
                                </button>

                                <ThemeToggle
                                    className="flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                                    iconSize={16}
                                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                                />
                            </div>

                            <div className="px-4 pb-3 pt-4">
                                {MOBILE_MORE_SECTIONS.map((section) => (
                                    <div key={section.label} className="mb-4 last:mb-0">
                                        <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                            {section.label}
                                        </div>
                                        <div className="overflow-hidden rounded-2xl border bg-card" style={{ borderColor: 'var(--border)' }}>
                                            {section.items.map((key) => {
                                                const item = NAV_BY_KEY[key]
                                                const Icon = item.icon
                                                const active = isRouteActive(pathname, item.href)
                                                const showPending =
                                                    (key === 'spaces' && pendingCount > 0) ||
                                                    (key === 'transactions' && transactionReviewCount > 0)
                                                const dotCount = key === 'spaces' ? pendingCount : transactionReviewCount

                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        onClick={onNavigate}
                                                        className="flex min-h-[3.75rem] items-center gap-3 border-b px-3 py-2.5 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/70"
                                                        style={{
                                                            borderColor: 'var(--border)',
                                                            background: active ? 'var(--sky-light)' : 'transparent',
                                                        }}
                                                    >
                                                        <span
                                                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                                                            style={{
                                                                background: active ? 'var(--card)' : 'var(--secondary)',
                                                                color: active ? 'var(--sky-dark)' : 'var(--muted-foreground)',
                                                            }}
                                                        >
                                                            <Icon size={17} />
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-semibold">{item.label}</span>
                                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.caption}</span>
                                                        </span>
                                                        {showPending && <PulseDot count={dotCount} />}
                                                        <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                                >
                                    <LogOut size={16} />
                                    Cerrar sesion
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

function MobileBottomBar({ insight, insightLoading }: { insight: NavInsightType; insightLoading: boolean }) {
    const pathname = usePathname()
    const router = useRouter()
    const [moreOpen, setMoreOpen] = useState(false)
    const [fabOpen, setFabOpen] = useState(false)
    const [fabKey, setFabKey] = useState(0)
    const { action: spaceAction } = useSpaceAction()
    const { pendingCount, transactionReviewCount } = useNotifications()
    const {
        txDialogOpen,
        setTxDialogOpen,
        quickCaptureOpen,
        setQuickCaptureOpen,
        initialTransactionData,
        openFullTransaction,
        completeQuickCaptureDetails,
        handleAppliedCommitment,
        accounts,
        categories,
        rules,
        createRule,
        preferences,
        handleCreateTransaction,
        handleCreateTransactionBatch,
        handleCreateInstallment,
    } = useTransactionLauncher()

    const fabConfig = getMobileFabConfig({
        pathname,
        openTransactionDialog: openFullTransaction,
        openQuickCapture: () => setQuickCaptureOpen(true),
        spaceAction,
        navigate: (href) => router.push(href),
    })

    useEffect(() => {
        if (!moreOpen && !fabOpen) return

        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = ''
        }
    }, [moreOpen, fabOpen])

    const closeMore = () => setMoreOpen(false)
    const closeFab = () => {
        setFabOpen(false)
        setFabKey((value) => value + 1)
    }

    const openMore = () => {
        closeFab()
        setMoreOpen((value) => !value)
    }

    const handleFabOpenChange = (open: boolean) => {
        setFabOpen(open)
        if (open) setMoreOpen(false)
    }

    return (
        <>
            <MobileMoreSheet
                open={moreOpen}
                onClose={closeMore}
                onNavigate={closeMore}
                insight={insight}
                insightLoading={insightLoading}
            />

            <div
                className="fixed inset-x-0 z-30 px-3 md:hidden"
                style={{ bottom: 'calc(var(--safe-area-bottom) + 0.55rem)' }}
            >
                <motion.div
                    className="finp-mobile-pill mx-auto grid h-[4.35rem] max-w-[26rem] grid-cols-5 items-center rounded-[1.65rem] border px-1.5 py-1.5 shadow-2xl backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-200"
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                        borderColor: fabOpen
                            ? 'color-mix(in srgb, var(--foreground) 16%, transparent)'
                            : 'color-mix(in srgb, var(--foreground) 9%, transparent)',
                        background: fabOpen
                            ? 'color-mix(in srgb, var(--background) 78%, var(--foreground) 14%)'
                            : 'color-mix(in srgb, var(--background) 92%, transparent)',
                        boxShadow: fabOpen
                            ? '0 18px 46px rgba(17,24,39,0.24), 0 2px 10px rgba(17,24,39,0.12)'
                            : undefined,
                    }}
                >
                    <MobileNavItem
                        href={NAV_BY_KEY.dashboard.href}
                        label={BOTTOM_NAV[0].mobileLabel}
                        icon={NAV_BY_KEY.dashboard.icon}
                        active={isBottomRouteActive(pathname, NAV_BY_KEY.dashboard.href) && !moreOpen}
                        loadDelay={0.05}
                        onClick={() => {
                            closeMore()
                            closeFab()
                        }}
                    />

                    <MobileNavItem
                        href={NAV_BY_KEY.transactions.href}
                        label={BOTTOM_NAV[1].mobileLabel}
                        icon={NAV_BY_KEY.transactions.icon}
                        active={isBottomRouteActive(pathname, NAV_BY_KEY.transactions.href) && !moreOpen}
                        loadDelay={0.08}
                        dot={transactionReviewCount > 0}
                        onClick={() => {
                            closeMore()
                            closeFab()
                        }}
                    />

                    <div className="flex h-full items-start justify-center">
                        <MobileContextualFab
                            key={fabKey}
                            config={fabConfig}
                            onOpenChange={handleFabOpenChange}
                        />
                    </div>

                    <MobileNavItem
                        href={NAV_BY_KEY.spaces.href}
                        label={BOTTOM_NAV[2].mobileLabel}
                        icon={NAV_BY_KEY.spaces.icon}
                        active={isBottomRouteActive(pathname, NAV_BY_KEY.spaces.href) && !moreOpen}
                        loadDelay={0.14}
                        onClick={() => {
                            closeMore()
                            closeFab()
                        }}
                    />

                    <motion.button
                        type="button"
                        onClick={openMore}
                        className="relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-[1.15rem] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                        {...NAV_LOAD_ITEM}
                        transition={{ duration: 0.24, delay: 0.17, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            color: moreOpen || (!isBottomRouteActive(pathname, '/dashboard') && !isBottomRouteActive(pathname, '/transactions') && !isBottomRouteActive(pathname, '/spaces'))
                                ? 'var(--sky-dark)'
                                : 'var(--muted-foreground)',
                        }}
                        aria-label={moreOpen ? 'Cerrar mas' : 'Abrir mas'}
                        aria-expanded={moreOpen}
                    >
                        {moreOpen && (
                            <motion.span
                                layoutId="mobile-bottom-active"
                                className="absolute left-2 right-2 top-1.5 h-8 rounded-full"
                                style={{ background: 'var(--sky-light)' }}
                                transition={{ type: 'spring', stiffness: 450, damping: 38 }}
                            />
                        )}
                        <span className="relative">
                            <MoreHorizontal size={18} />
                            {pendingCount > 0 && !moreOpen && (
                                <span className="absolute -top-5 left-1/2 -translate-x-1/2">
                                    <PulseDot count={pendingCount} />
                                </span>
                            )}
                        </span>
                        <span className="relative text-[10px] font-medium leading-none">Mas</span>
                    </motion.button>
                </motion.div>
            </div>

            <TransactionDialog
                open={txDialogOpen}
                onOpenChange={setTxDialogOpen}
                transaction={null}
                accounts={accounts}
                categories={categories}
                onSubmit={handleCreateTransaction}
                onBatchSubmit={handleCreateTransactionBatch}
                onInstallmentSubmit={handleCreateInstallment}
                onCreateRule={createRule}
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
                monthStartDay={preferences.monthStartDay}
                initialData={initialTransactionData}
            />
            <QuickCaptureDialog
                open={quickCaptureOpen}
                onOpenChange={setQuickCaptureOpen}
                accounts={accounts}
                categories={categories}
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
                onCompleteDetails={completeQuickCaptureDetails}
                onAppliedCommitment={handleAppliedCommitment}
            />
        </>
    )
}

export function Navbar() {
    const { activeInsight, loading: insightLoading } = useNavInsights()

    return (
        <>
            <aside
                className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:self-start"
                style={{ background: 'var(--sidebar)' }}
            >
                <SidebarContent insight={activeInsight} insightLoading={insightLoading} />
            </aside>

            <DesktopFloatingTransactionButton />
            <MobileBottomBar insight={activeInsight} insightLoading={insightLoading} />
        </>
    )
}
