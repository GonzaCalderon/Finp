'use client'

import { usePathname } from 'next/navigation'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

const ROUTE_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    transactions: 'Transacciones',
    accounts: 'Cuentas',
    categories: 'Categorías',
    commitments: 'Compromisos',
    projection: 'Proyección',
    settings: 'Configuración',
}

export function AppBreadcrumb() {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)

    if (segments.length === 0) return null

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink
                        href="/dashboard"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        finp
                    </BreadcrumbLink>
                </BreadcrumbItem>

                {segments.map((segment, index) => {
                    const href = '/' + segments.slice(0, index + 1).join('/')
                    const label = ROUTE_LABELS[segment] ?? segment
                    const isLast = index === segments.length - 1

                    return (
                        <span key={href} className="flex items-center gap-1.5">
              <BreadcrumbSeparator className="text-muted-foreground/50" />
              <BreadcrumbItem>
                {isLast ? (
                    <BreadcrumbPage className="text-xs font-medium">
                        {label}
                    </BreadcrumbPage>
                ) : (
                    <BreadcrumbLink
                        href={href}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {label}
                    </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}