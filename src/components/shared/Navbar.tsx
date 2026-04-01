'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
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
    ChevronDown,
    Upload,
    X,
    Settings,
    Wand2,
} from 'lucide-react'

import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { TransactionDialog } from '@/components/shared/TransactionDialog'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { usePreferences } from '@/hooks/usePreferences'
import type { TransactionFormData, InstallmentFormData } from '@/lib/validations'
import { useInstallments } from '@/hooks/useInstallments'

type SubNavItem = { href: string; label: string; icon: React.ElementType }
type NavItemDef = { href: string; label: string; icon: React.ElementType; subItems?: SubNavItem[] }

const NAV_ITEMS: NavItemDef[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
        href: '/transactions',
        label: 'Transacciones',
        icon: ArrowLeftRight,
        subItems: [
            { href: '/transactions/credit-card', label: 'Gastos con TC', icon: CreditCard },
            { href: '/transactions/import', label: 'Importar', icon: Upload },
        ],
    },
    { href: '/accounts', label: 'Cuentas', icon: CreditCard },
    { href: '/commitments', label: 'Compromisos', icon: Calendar },
    { href: '/projection', label: 'Proyección', icon: TrendingUp },
    { href: '/rules', label: 'Reglas', icon: Wand2 },
    { href: '/settings', label: 'Configuración', icon: Settings },
]

const BOTTOM_NAV_LEFT = [
    { href: '/transactions', label: 'Transacciones', icon: ArrowLeftRight },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

const BOTTOM_NAV_RIGHT = [
    { href: '/projection', label: 'Proyección', icon: TrendingUp },
]

type MoreItem =
    | { href: string; label: string; icon: React.ElementType; subItems?: never }
    | { href: string; label: string; icon: React.ElementType; subItems: { href: string; label: string; icon: React.ElementType }[] }

const MORE_ITEMS: MoreItem[] = [
    {
        href: '/transactions',
        label: 'Transacciones',
        icon: ArrowLeftRight,
        subItems: [
            { href: '/transactions/credit-card', label: 'Gastos con TC', icon: CreditCard },
            { href: '/transactions/import', label: 'Importar', icon: Upload },
        ],
    },
    { href: '/accounts', label: 'Cuentas', icon: CreditCard },
    { href: '/commitments', label: 'Compromisos', icon: Calendar },
    { href: '/rules', label: 'Reglas', icon: Wand2 },
    { href: '/settings', label: 'Configuración', icon: Settings },
]

function MobileNavItem({
    href,
    label,
    icon: Icon,
    active,
    onClick,
}: {
    href: string
    label: string
    icon: React.ElementType
    active: boolean
    onClick: () => void
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="flex flex-col items-center justify-center gap-1 w-full h-full"
            style={{
                color: active ? 'var(--sky)' : 'var(--muted-foreground)',
            }}
        >
            <Icon size={18} />
            <span className="text-[11px]">{label}</span>
        </Link>
    )
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname()
    const { hidden, toggleHidden } = useHideAmounts()

    // Expand section if currently on that path; user can toggle manually
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {}
        NAV_ITEMS.forEach(item => {
            if (item.subItems && (pathname === item.href || pathname.startsWith(item.href + '/'))) {
                initial[item.href] = true
            }
        })
        return initial
    })

    const toggleSection = (href: string) => {
        setExpandedSections(prev => ({ ...prev, [href]: !prev[href] }))
    }

    return (
        <div className="flex h-full flex-col">
            <div
                className="px-3 py-4 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
                <div
                    className="text-xl font-semibold tracking-tight"
                    style={{ color: 'var(--sidebar-foreground)' }}
                >
                    Fin<span style={{ color: 'var(--sky)' }}>p</span>
                </div>
            </div>

            <nav className="flex-1 px-2 py-3 space-y-0.5">
                {NAV_ITEMS.map(({ href, label, icon: Icon, subItems }) => {
                    const isActive = pathname === href
                    const isSectionActive = pathname === href || pathname.startsWith(href + '/')
                    const isExpanded = expandedSections[href] ?? false

                    return (
                        <div key={href}>
                            {/* Item principal */}
                            <div className="flex items-center gap-0.5">
                                <Link
                                    href={href}
                                    onClick={onClose}
                                    className="flex flex-1 items-center gap-2.5 py-2 pr-3 rounded-md text-sm transition-all duration-150"
                                    style={{
                                        color: isSectionActive ? '#fff' : 'var(--sidebar-foreground)',
                                        background: isActive
                                            ? 'linear-gradient(to right, rgba(96,184,224,0.28) 0%, rgba(96,184,224,0) 85%)'
                                            : 'transparent',
                                        borderLeft: isActive ? "3px solid var(--sky)" : "3px solid transparent",
                                        paddingLeft: '9px',
                                    }}
                                >
                                    <Icon size={16} />
                                    {label}
                                </Link>

                                {subItems && (
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(href)}
                                        className="flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/8"
                                        style={{ color: 'rgba(255,255,255,0.4)' }}
                                        aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                                    >
                                        <ChevronDown
                                            size={13}
                                            style={{
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.18s ease',
                                            }}
                                        />
                                    </button>
                                )}
                            </div>

                            {/* Sub-items desplegables */}
                            {subItems && isExpanded && (
                                <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l pl-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                                    {subItems.map((sub) => {
                                        const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                                        return (
                                            <Link
                                                key={sub.href}
                                                href={sub.href}
                                                onClick={onClose}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors"
                                                style={{
                                                    color: subActive ? '#fff' : 'rgba(255,255,255,0.45)',
                                                    background: subActive ? 'rgba(56,189,248,0.14)' : 'transparent',
                                                }}
                                            >
                                                <sub.icon size={13} />
                                                {sub.label}
                                            </Link>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </nav>

            <div className="mt-auto px-2 pb-3 space-y-1">
                <button
                    type="button"
                    onClick={toggleHidden}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors hover:bg-white/5"
                    style={{ color: 'var(--sidebar-foreground)' }}
                >
                    {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                    {hidden ? 'Mostrar montos' : 'Ocultar montos'}
                </button>

                <ThemeToggle />

                <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors hover:bg-white/5"
                    style={{ color: 'var(--sidebar-foreground)' }}
                >
                    <LogOut size={16} />
                    Cerrar sesión
                </button>
            </div>
        </div>
    )
}

function useTransactionLauncher() {
    const [txDialogOpen, setTxDialogOpen] = useState(false)
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { rules } = useTransactionRules()
    const { preferences } = usePreferences()
    const { success, error: toastError } = useToast()
    const { createPlan } = useInstallments()

    const handleCreateTransaction = async (data: TransactionFormData) => {
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error)

            success('Transacción creada correctamente')
            setTxDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al crear transacción')
        }
    }

    const handleCreateTransactionBatch = async (items: TransactionFormData[]) => {
        try {
            for (const item of items) {
                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item),
                })

                const json = await res.json()
                if (!res.ok) throw new Error(json.error)
            }

            success(items.length === 2 ? 'Pago dual registrado correctamente' : 'Transacciones creadas correctamente')
            setTxDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al crear transacciones')
        }
    }

    const handleCreateInstallment = async (data: InstallmentFormData) => {
        try {
            await createPlan(data)
            success('Compra en cuotas registrada correctamente')
            setTxDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar compra en cuotas')
        }
    }

    return {
        txDialogOpen,
        setTxDialogOpen,
        accounts,
        categories,
        rules,
        preferences,
        handleCreateTransaction,
        handleCreateTransactionBatch,
        handleCreateInstallment,
    }
}

function DesktopFloatingTransactionButton() {
    const {
        txDialogOpen,
        setTxDialogOpen,
        accounts,
        categories,
        rules,
        preferences,
        handleCreateTransaction,
        handleCreateTransactionBatch,
        handleCreateInstallment,
    } = useTransactionLauncher()

    return (
        <>
            <div className="hidden md:block fixed right-6 bottom-6 z-40">
                <div className="relative group">
                    <div
                        className="pointer-events-none absolute right-0 bottom-[calc(100%+0.75rem)] translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                    >
                        <div
                            className="rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-sm"
                            style={{
                                background: 'var(--card)',
                                color: 'var(--foreground)',
                                border: '0.5px solid var(--border)',
                            }}
                        >
                            Nueva transacción
                        </div>
                    </div>

                    <Button
                        type="button"
                        onClick={() => setTxDialogOpen(true)}
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.04] active:scale-[0.98]"
                        aria-label="Nueva transacción"
                    >
                        <Plus className="w-5 h-5" />
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
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
                monthStartDay={preferences.monthStartDay}
            />
        </>
    )
}

function MobileBottomBar() {
    const pathname = usePathname()
    const [moreOpen, setMoreOpen] = useState(false)
    const [actionSheetOpen, setActionSheetOpen] = useState(false)
    const [moreExpandedSections, setMoreExpandedSections] = useState<Record<string, boolean>>({
        '/transactions': pathname.startsWith('/transactions/'),
    })

    const toggleMoreSection = (href: string) => {
        setMoreExpandedSections(prev => ({ ...prev, [href]: !prev[href] }))
    }

    const { hidden, toggleHidden } = useHideAmounts()
    const {
        txDialogOpen,
        setTxDialogOpen,
        accounts,
        categories,
        rules,
        preferences,
        handleCreateTransaction,
        handleCreateTransactionBatch,
        handleCreateInstallment,
    } = useTransactionLauncher()

    useEffect(() => {
        if (moreOpen || actionSheetOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }

        return () => {
            document.body.style.overflow = ''
        }
    }, [moreOpen, actionSheetOpen])

    const closeMore = () => setMoreOpen(false)
    const closeActionSheet = () => setActionSheetOpen(false)

    const BOTTOM_BAR_HEIGHT = 65

    return (
        <>
            <AnimatePresence>
                {moreOpen && (
                    <>
                        <motion.button
                            type="button"
                            className="fixed inset-0 z-40 bg-black/40 md:hidden"
                            onClick={closeMore}
                            aria-label="Cerrar panel más"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                        />

                        <motion.div
                            className="fixed inset-x-3 bottom-[84px] z-50 md:hidden rounded-2xl border p-3 shadow-2xl"
                            style={{
                                background: 'var(--sidebar)',
                                borderColor: 'rgba(255,255,255,0.08)',
                            }}
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.98 }}
                            transition={{ duration: 0.18 }}
                        >
                            <div
                                className="mb-3 text-lg font-semibold"
                                style={{ color: 'var(--sidebar-foreground)' }}
                            >
                                Fin<span style={{ color: 'var(--sky)' }}>p</span>
                            </div>

                            <div className="space-y-1">
                                {MORE_ITEMS.map((item) => {
                                    const { href, label, icon: Icon, subItems } = item
                                    const isActive = pathname === href
                                    const isSectionActive = pathname === href || pathname.startsWith(href + '/')
                                    const isExpanded = moreExpandedSections[href] ?? false

                                    if (subItems) {
                                        return (
                                            <div key={href}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleMoreSection(href)}
                                                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-base transition-colors"
                                                    style={{
                                                        color: isSectionActive ? '#fff' : 'rgba(255,255,255,0.8)',
                                                        background: isSectionActive && !isExpanded
                                                            ? 'rgba(56,189,248,0.18)'
                                                            : 'transparent',
                                                    }}
                                                >
                                                    <span className="flex items-center gap-4">
                                                        <Icon size={18} />
                                                        {label}
                                                    </span>
                                                    <ChevronDown
                                                        size={15}
                                                        style={{
                                                            color: 'rgba(255,255,255,0.4)',
                                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            transition: 'transform 0.18s ease',
                                                        }}
                                                    />
                                                </button>
                                                <AnimatePresence initial={false}>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="ml-4 pl-4 border-l space-y-0.5 py-1" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                                                                {subItems.map(sub => {
                                                                    const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                                                                    return (
                                                                        <Link
                                                                            key={sub.href}
                                                                            href={sub.href}
                                                                            onClick={closeMore}
                                                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-colors"
                                                                            style={{
                                                                                color: subActive ? '#fff' : 'rgba(255,255,255,0.6)',
                                                                                background: subActive ? 'rgba(56,189,248,0.14)' : 'transparent',
                                                                            }}
                                                                        >
                                                                            <sub.icon size={15} />
                                                                            {sub.label}
                                                                        </Link>
                                                                    )
                                                                })}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )
                                    }

                                    return (
                                        <Link
                                            key={href}
                                            href={href}
                                            onClick={closeMore}
                                            className="flex items-center gap-4 px-4 py-3 rounded-xl text-base w-full"
                                            style={{
                                                color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
                                                background: isActive
                                                    ? 'rgba(56, 189, 248, 0.18)'
                                                    : 'transparent',
                                            }}
                                        >
                                            <Icon size={18} />
                                            {label}
                                        </Link>
                                    )
                                })}

                                <button
                                    type="button"
                                    onClick={toggleHidden}
                                    className="flex items-center gap-4 px-4 py-3 rounded-xl text-base w-full"
                                    style={{ color: 'rgba(255,255,255,0.8)' }}
                                >
                                    {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
                                    {hidden ? 'Mostrar montos' : 'Ocultar montos'}
                                </button>

                                <ThemeToggle
                                    className="flex items-center gap-4 px-4 py-3 rounded-xl text-base w-full transition-colors hover:bg-white/5"
                                    iconSize={18}
                                    style={{ color: 'rgba(255,255,255,0.8)' }}
                                />

                                <button
                                    type="button"
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="flex items-center gap-4 px-4 py-3 rounded-xl text-base w-full"
                                    style={{ color: 'rgba(255,255,255,0.5)' }}
                                >
                                    <LogOut size={18} />
                                    Cerrar sesión
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {actionSheetOpen && (
                    <>
                        <motion.button
                            type="button"
                            className="fixed inset-0 z-40 bg-black/40 md:hidden"
                            onClick={closeActionSheet}
                            aria-label="Cerrar acciones rápidas"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                        />

                        <motion.div
                            className="fixed inset-x-0 bottom-0 z-50 md:hidden rounded-t-3xl border-t shadow-2xl"
                            style={{
                                background: 'var(--background)',
                                borderColor: 'var(--border)',
                            }}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-muted" />

                            <div className="px-4 pb-5">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold">Agregar</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Elegí qué querés registrar.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={closeActionSheet}
                                        className="rounded-full p-2 transition-colors hover:bg-muted"
                                        aria-label="Cerrar"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeActionSheet()
                                            setTxDialogOpen(true)
                                        }}
                                        className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-xl"
                                            style={{
                                                background: 'rgba(56, 189, 248, 0.14)',
                                                color: 'var(--sky)',
                                            }}
                                        >
                                            <Plus size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Nueva transacción</p>
                                            <p className="text-xs text-muted-foreground">
                                                Gasto o ingreso rápido
                                            </p>
                                        </div>
                                    </button>

                                    <Link
                                        href="/transactions/import"
                                        onClick={closeActionSheet}
                                        className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-xl"
                                            style={{
                                                background: 'rgba(14, 165, 233, 0.14)',
                                                color: 'var(--sky)',
                                            }}
                                        >
                                            <Upload size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Importar desde Excel</p>
                                            <p className="text-xs text-muted-foreground">
                                                Subir planilla de movimientos
                                            </p>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div
                className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t backdrop-blur supports-[backdrop-filter]:bg-background/90"
                style={{
                    height: BOTTOM_BAR_HEIGHT,
                    borderColor: 'var(--border)',
                    background: 'var(--background)',
                }}
            >
                <div className="grid h-full grid-cols-5">
                    <div className="flex items-center justify-center">
                        <MobileNavItem {...BOTTOM_NAV_LEFT[0]} active={pathname === BOTTOM_NAV_LEFT[0].href && !moreOpen} onClick={closeMore} />
                    </div>

                    <div className="flex items-center justify-center">
                        <MobileNavItem {...BOTTOM_NAV_LEFT[1]} active={pathname === BOTTOM_NAV_LEFT[1].href && !moreOpen} onClick={closeMore} />
                    </div>

                    <div className="flex items-start justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                closeMore()
                                setActionSheetOpen(true)
                            }}
                            className="flex items-center justify-center w-14 h-14 rounded-full shadow-lg"
                            style={{ background: 'var(--sky)', marginTop: '-24px' }}
                            aria-label="Nueva operación"
                        >
                            <Plus size={22} color="#fff" />
                        </button>
                    </div>

                    <div className="flex items-center justify-center">
                        <MobileNavItem {...BOTTOM_NAV_RIGHT[0]} active={pathname === BOTTOM_NAV_RIGHT[0].href && !moreOpen} onClick={closeMore} />
                    </div>

                    <div className="flex items-center justify-center">
                        <button
                            type="button"
                            onClick={() => setMoreOpen((prev) => !prev)}
                            className="flex flex-col items-center justify-center gap-1 w-full h-full"
                            style={{
                                color: moreOpen ? 'var(--sky)' : 'var(--muted-foreground)',
                            }}
                        >
                            <MoreHorizontal size={18} />
                            <span className="text-[11px]">Más</span>
                        </button>
                    </div>
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
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
                monthStartDay={preferences.monthStartDay}
            />
        </>
    )
}

export function Navbar() {
    return (
        <>
            <aside
                className="hidden md:flex md:w-64 md:flex-col md:sticky md:top-0 md:h-screen md:self-start"
                style={{ background: 'var(--sidebar)' }}
            >
                <SidebarContent />
            </aside>

            <DesktopFloatingTransactionButton />
            <MobileBottomBar />
        </>
    )
}
