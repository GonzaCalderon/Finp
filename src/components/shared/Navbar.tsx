'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import {
    LayoutDashboard,
    ArrowLeftRight,
    CreditCard,
    Tag,
    Calendar,
    TrendingUp,
    Menu,
    LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/transactions', label: 'Transacciones', icon: ArrowLeftRight },
    { href: '/accounts', label: 'Cuentas', icon: CreditCard },
    { href: '/categories', label: 'Categorías', icon: Tag },
    { href: '/commitments', label: 'Compromisos', icon: Calendar },
    { href: '/projection', label: 'Proyección', icon: TrendingUp },
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname()

    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-5 py-6">
        <span className="text-lg font-semibold tracking-tight text-white">
          fin<span style={{ color: 'var(--sky)' }}>p</span>
        </span>
            </div>

            {/* Nav items */}
            <nav className="flex flex-col gap-0.5 px-3 flex-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href
                    return (
                        <Link
                            key={href}
                            href={href}
                            onClick={onClose}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
                            style={{
                                color: isActive ? '#FFFFFF' : 'var(--sidebar-foreground)',
                                background: isActive ? 'var(--sidebar-accent)' : 'transparent',
                                borderRight: isActive ? '2px solid var(--sky)' : '2px solid transparent',
                            }}
                        >
                            <Icon
                                size={15}
                                style={{ opacity: isActive ? 1 : 0.6 }}
                            />
                            {label}
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom — theme + logout */}
            <div
                className="px-3 py-4 mx-3 mb-3 rounded-md space-y-1"
                style={{ borderTop: '0.5px solid var(--sidebar-border)' }}
            >
                <ThemeToggle />
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors hover:bg-white/5"
                    style={{ color: 'var(--sidebar-foreground)' }}
                >
                    <LogOut size={14} style={{ opacity: 0.6 }} />
                    Cerrar sesión
                </button>
            </div>
        </div>
    )
}

export function Navbar() {
    const [open, setOpen] = useState(false)

    return (
        <>
            {/* Sidebar desktop */}
            <aside
                className="hidden md:flex flex-col w-52 h-screen sticky top-0"
                style={{ background: 'var(--sidebar)', borderRight: '0.5px solid var(--sidebar-border)' }}
            >
                <SidebarContent />
            </aside>

            {/* Header mobile */}
            <header
                className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-10"
                style={{
                    background: 'var(--sidebar)',
                    borderBottom: '0.5px solid var(--sidebar-border)',
                }}
            >
        <span className="text-base font-semibold tracking-tight text-white">
          fin<span style={{ color: 'var(--sky)' }}>p</span>
        </span>
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <button
                            className="p-1.5 rounded-md"
                            style={{ color: 'var(--sidebar-foreground)' }}
                        >
                            <Menu size={18} />
                        </button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="w-52 p-0"
                        style={{ background: 'var(--sidebar)', border: 'none' }}
                    >
                        <SidebarContent onClose={() => setOpen(false)} />
                    </SheetContent>
                </Sheet>
            </header>
        </>
    )
}