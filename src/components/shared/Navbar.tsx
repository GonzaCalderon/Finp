'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
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

function NavLinks({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname()

    return (
        <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href
                return (
                    <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
              ${isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </Link>
                )
            })}
        </nav>
    )
}

export function Navbar() {
    const [open, setOpen] = useState(false)

    return (
        <>
            {/* Sidebar desktop */}
            <aside className="hidden md:flex flex-col w-56 border-r min-h-screen p-4 gap-6">
                <div className="px-3 py-2">
                    <h1 className="text-xl font-bold">Finm</h1>
                </div>
                <NavLinks />
                <div className="mt-auto">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                    >
                        <LogOut className="h-4 w-4 mr-3" />
                        Cerrar sesión
                    </Button>
                </div>
            </aside>

            {/* Header mobile */}
            <header className="md:hidden flex items-center justify-between border-b px-4 py-3">
                <h1 className="text-lg font-bold">Finm</h1>
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-56 p-4 flex flex-col gap-6">
                        <div className="px-3 py-2">
                            <h1 className="text-xl font-bold">Finm</h1>
                        </div>
                        <NavLinks onClose={() => setOpen(false)} />
                        <div className="mt-auto">
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-muted-foreground"
                                onClick={() => signOut({ callbackUrl: '/login' })}
                            >
                                <LogOut className="h-4 w-4 mr-3" />
                                Cerrar sesión
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            </header>
        </>
    )
}