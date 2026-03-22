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
    Tag,
    Calendar,
    TrendingUp,
    LogOut,
    Plus,
    MoreHorizontal,
    Eye,
    EyeOff,
    ShoppingBag,
    X,
} from 'lucide-react'

import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { TransactionDialog } from '@/components/shared/TransactionDialog'
import { InstallmentDialog } from '@/components/shared/InstallmentDialog'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import type { TransactionFormData, InstallmentFormData } from '@/lib/validations'

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/transactions', label: 'Transacciones', icon: ArrowLeftRight },
    { href: '/accounts', label: 'Cuentas', icon: CreditCard },
    { href: '/categories', label: 'Categorías', icon: Tag },
    { href: '/commitments', label: 'Compromisos', icon: Calendar },
    { href: '/projection', label: 'Proyección', icon: TrendingUp },
]

const BOTTOM_NAV_LEFT = [
    { href: '/transactions', label: 'Transacciones', icon: ArrowLeftRight },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

const BOTTOM_NAV_RIGHT = [
    { href: '/projection', label: 'Proyección', icon: TrendingUp },
]

const MORE_ITEMS = [
    { href: '/accounts', label: 'Cuentas', icon: CreditCard },
    { href: '/commitments', label: 'Compromisos', icon: Calendar },
    { href: '/categories', label: 'Categorías', icon: Tag },
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname()
    const { hidden, toggleHidden } = useHideAmounts()

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
                    fin <span style={{ color: 'var(--sky)' }}>p</span>
                </div>
            </div>

            <nav className="flex-1 px-2 py-3 space-y-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href

                    return (
                        <Link
                            key={href}
                            href={href}
                            onClick={onClose}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
                            style={{
                                color: isActive ? '#fff' : 'var(--sidebar-foreground)',
                                background: isActive ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                            }}
                        >
                            <Icon size={16} />
                            {label}
                        </Link>
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
function MobileBottomBar() {
    const pathname = usePathname()
    const [moreOpen, setMoreOpen] = useState(false)
    const [actionSheetOpen, setActionSheetOpen] = useState(false)
    const [txDialogOpen, setTxDialogOpen] = useState(false)
    const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false)

    const { hidden, toggleHidden } = useHideAmounts()
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { success, error: toastError } = useToast()

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

    const handleCreateInstallment = async (data: InstallmentFormData) => {
        try {
            const res = await fetch('/api/installments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error)

            success('Compra en cuotas registrada correctamente')
            setInstallmentDialogOpen(false)
        } catch (err) {
            toastError(
                err instanceof Error
                    ? err.message
                    : 'Error al registrar compra en cuotas'
            )
        }
    }

    const BOTTOM_BAR_HEIGHT = 65

    const NavItem = ({
                         href,
                         label,
                         icon: Icon,
                     }: {
        href: string
        label: string
        icon: React.ElementType
    }) => {
        const isActive = pathname === href && !moreOpen

        return (
            <Link
                href={href}
                onClick={closeMore}
                className="flex flex-col items-center justify-center gap-1 w-full h-full"
                style={{
                    color: isActive ? 'var(--sky)' : 'var(--muted-foreground)',
                }}
            >
                <Icon size={18} />
                <span className="text-[11px]">{label}</span>
            </Link>
        )
    }

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
                        >
                            <div
                                className="mb-3 text-lg font-semibold"
                                style={{ color: 'var(--sidebar-foreground)' }}
                            >
                                fin <span style={{ color: 'var(--sky)' }}>p</span>
                            </div>

                            <div className="space-y-1">
                                {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
                                    const isActive = pathname === href

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
                            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
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

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeActionSheet()
                                            setInstallmentDialogOpen(true)
                                        }}
                                        className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-xl"
                                            style={{
                                                background: 'rgba(245, 158, 11, 0.14)',
                                                color: 'var(--amber-dark)',
                                            }}
                                        >
                                            <ShoppingBag size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Compra en cuotas</p>
                                            <p className="text-xs text-muted-foreground">
                                                Registrar tarjeta y plan
                                            </p>
                                        </div>
                                    </button>
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
                        <NavItem {...BOTTOM_NAV_LEFT[0]} />
                    </div>

                    <div className="flex items-center justify-center">
                        <NavItem {...BOTTOM_NAV_LEFT[1]} />
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
                        <NavItem {...BOTTOM_NAV_RIGHT[0]} />
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
            />

            <InstallmentDialog
                open={installmentDialogOpen}
                onOpenChange={setInstallmentDialogOpen}
                accounts={accounts}
                categories={categories}
                onSubmit={handleCreateInstallment}
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

            <MobileBottomBar />
        </>
    )
}