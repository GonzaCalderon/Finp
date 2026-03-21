'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { TransactionDialog } from '@/components/shared/TransactionDialog'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import type { TransactionFormData } from '@/lib/validations'
import {
    LayoutDashboard, ArrowLeftRight, CreditCard, Tag,
    Calendar, TrendingUp, LogOut, Plus, MoreHorizontal, Eye, EyeOff,
} from 'lucide-react'

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/transactions', label: 'Transacciones', icon: ArrowLeftRight },
    { href: '/accounts', label: 'Cuentas', icon: CreditCard },
    { href: '/categories', label: 'Categorías', icon: Tag },
    { href: '/commitments', label: 'Compromisos', icon: Calendar },
    { href: '/projection', label: 'Proyección', icon: TrendingUp },
]

const BOTTOM_NAV_LEFT = { href: '/transactions', label: 'Transacciones', icon: ArrowLeftRight }
const BOTTOM_NAV_RIGHT = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/projection', label: 'Proyección', icon: TrendingUp },
]

const MORE_ITEMS = [
    { href: '/accounts', label: 'Cuentas', icon: CreditCard },
    { href: '/commitments', label: 'Compromisos', icon: Calendar },
    { href: '/categories', label: 'Categorías', icon: Tag },
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname()
    const { hidden, toggle } = useHideAmounts()

    return (
        <div className="flex flex-col h-full">
            <div className="px-5 py-6">
                <span className="text-lg font-semibold tracking-tight text-white">
                    fin<span style={{ color: 'var(--sky)' }}>p</span>
                </span>
            </div>

            <nav className="flex flex-col gap-0.5 px-3 flex-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href
                    return (
                        <Link key={href} href={href} onClick={onClose}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
                              style={{
                                  color: isActive ? '#FFFFFF' : 'var(--sidebar-foreground)',
                                  background: isActive ? 'var(--sidebar-accent)' : 'transparent',
                                  borderRight: isActive ? '2px solid var(--sky)' : '2px solid transparent',
                              }}>
                            <Icon size={15} style={{ opacity: isActive ? 1 : 0.6 }} />
                            {label}
                        </Link>
                    )
                })}
            </nav>

            <div className="px-3 py-4 mx-3 mb-3 rounded-md space-y-1"
                 style={{ borderTop: '0.5px solid var(--sidebar-border)' }}>
                <button onClick={toggle}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors hover:bg-white/5"
                        style={{ color: 'var(--sidebar-foreground)' }}>
                    {hidden ? <Eye size={14} style={{ opacity: 0.6 }} /> : <EyeOff size={14} style={{ opacity: 0.6 }} />}
                    {hidden ? 'Mostrar montos' : 'Ocultar montos'}
                </button>
                <ThemeToggle />
                <button onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors hover:bg-white/5"
                        style={{ color: 'var(--sidebar-foreground)' }}>
                    <LogOut size={14} style={{ opacity: 0.6 }} />
                    Cerrar sesión
                </button>
            </div>
        </div>
    )
}

function MobileBottomBar() {
    const pathname = usePathname()
    const [moreOpen, setMoreOpen] = useState(false)
    const [txDialogOpen, setTxDialogOpen] = useState(false)
    const { hidden, toggle } = useHideAmounts()
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { success, error: toastError } = useToast()

    useEffect(() => {
        if (moreOpen) document.body.style.overflow = 'hidden'
        else document.body.style.overflow = ''
        return () => { document.body.style.overflow = '' }
    }, [moreOpen])

    const closeMore = () => setMoreOpen(false)

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

    const BOTTOM_BAR_HEIGHT = 65

    return (
        <>
            {/* Panel Más */}
            <AnimatePresence>
                {moreOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40"
                            style={{ bottom: BOTTOM_BAR_HEIGHT, background: 'rgba(0,0,0,0.5)' }}
                            onClick={closeMore}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                            className="fixed top-0 right-0 z-50 flex flex-col w-72"
                            style={{
                                bottom: BOTTOM_BAR_HEIGHT,
                                background: 'var(--sidebar)',
                                borderLeft: '0.5px solid var(--sidebar-border)',
                            }}
                        >
                            <div className="px-6 pt-12 pb-6">
                                <span className="text-lg font-semibold tracking-tight text-white">
                                    fin<span style={{ color: 'var(--sky)' }}>p</span>
                                </span>
                            </div>

                            <div className="flex-1 px-4 space-y-1 overflow-y-auto">
                                {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
                                    const isActive = pathname === href
                                    return (
                                        <Link key={href} href={href} onClick={closeMore}
                                              className="flex items-center gap-4 px-4 py-4 rounded-xl text-base transition-colors"
                                              style={{
                                                  color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                                                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                                              }}>
                                            <Icon size={20} style={{ opacity: isActive ? 1 : 0.7 }} />
                                            {label}
                                        </Link>
                                    )
                                })}
                            </div>

                            <div className="px-4 pb-6 pt-4 space-y-1"
                                 style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
                                <button onClick={toggle}
                                        className="flex items-center gap-4 px-4 py-3 rounded-xl text-base w-full transition-colors"
                                        style={{ color: 'rgba(255,255,255,0.7)' }}>
                                    {hidden
                                        ? <Eye size={20} style={{ opacity: 0.7 }} />
                                        : <EyeOff size={20} style={{ opacity: 0.7 }} />}
                                    {hidden ? 'Mostrar montos' : 'Ocultar montos'}
                                </button>
                                <div className="px-4 py-1">
                                    <ThemeToggle />
                                </div>
                                <button onClick={() => signOut({ callbackUrl: '/login' })}
                                        className="flex items-center gap-4 px-4 py-3 rounded-xl text-base w-full"
                                        style={{ color: 'rgba(255,255,255,0.5)' }}>
                                    <LogOut size={20} style={{ opacity: 0.6 }} />
                                    Cerrar sesión
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bottom bar */}
            <div
                className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2"
                style={{
                    background: 'var(--sidebar)',
                    borderTop: '0.5px solid var(--sidebar-border)',
                    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
                    paddingTop: '8px',
                    height: BOTTOM_BAR_HEIGHT,
                }}
            >
                {/* Transacciones — izquierda del + */}
                {(() => {
                    const { href, label, icon: Icon } = BOTTOM_NAV_LEFT
                    const isActive = pathname === href && !moreOpen
                    return (
                        <Link href={href} onClick={closeMore}
                              className="flex flex-col items-center gap-1 px-3 py-1">
                            <Icon size={22} style={{ color: isActive ? 'var(--sky)' : 'rgba(255,255,255,0.5)' }} />
                            <span className="text-[10px]" style={{ color: isActive ? 'var(--sky)' : 'rgba(255,255,255,0.5)' }}>
                                {label}
                            </span>
                        </Link>
                    )
                })()}

                {/* + Nueva transacción — centrado */}
                <button
                    onClick={() => { closeMore(); setTxDialogOpen(true) }}
                    className="flex items-center justify-center w-14 h-14 rounded-full -mt-6 shadow-lg"
                    style={{ background: 'var(--sky)' }}>
                    <Plus size={26} color="white" />
                </button>

                {/* Dashboard y Proyección — derecha del + */}
                {BOTTOM_NAV_RIGHT.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href && !moreOpen
                    return (
                        <Link key={href} href={href} onClick={closeMore}
                              className="flex flex-col items-center gap-1 px-3 py-1">
                            <Icon size={22} style={{ color: isActive ? 'var(--sky)' : 'rgba(255,255,255,0.5)' }} />
                            <span className="text-[10px]" style={{ color: isActive ? 'var(--sky)' : 'rgba(255,255,255,0.5)' }}>
                                {label}
                            </span>
                        </Link>
                    )
                })}

                {/* Más */}
                <button
                    onClick={() => setMoreOpen((p) => !p)}
                    className="flex flex-col items-center gap-1 px-3 py-1">
                    <MoreHorizontal size={22} style={{ color: moreOpen ? 'var(--sky)' : 'rgba(255,255,255,0.5)' }} />
                    <span className="text-[10px]" style={{ color: moreOpen ? 'var(--sky)' : 'rgba(255,255,255,0.5)' }}>
                        Más
                    </span>
                </button>
            </div>

            <TransactionDialog
                open={txDialogOpen}
                onOpenChange={setTxDialogOpen}
                transaction={null}
                accounts={accounts}
                categories={categories}
                onSubmit={handleCreateTransaction}
            />
        </>
    )
}

export function Navbar() {
    return (
        <>
            <aside
                className="hidden md:flex flex-col w-52 h-screen sticky top-0 shrink-0"
                style={{ background: 'var(--sidebar)', borderRight: '0.5px solid var(--sidebar-border)' }}>
                <SidebarContent />
            </aside>
            <div className="md:hidden">
                <MobileBottomBar />
            </div>
        </>
    )
}