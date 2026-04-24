'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
    ArrowDownLeft,
    ArrowUpRight,
    BriefcaseBusiness,
    CheckCircle2,
    CircleDollarSign,
    FileText,
    HandCoins,
    Home,
    PauseCircle,
    Plane,
    Settings2,
    Sparkles,
    Users,
} from 'lucide-react'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
    SPACE_ENTRY_TYPE_LABELS,
    SPACE_INVITE_STATUS_LABELS,
    SPACE_MODE_LABELS,
    SPACE_ROLE_LABELS,
    SPACE_STATUS_LABELS,
    SPACE_TYPE_LABELS,
    resolveSpaceStatusTone,
    resolveSpaceTypeAccent,
} from '@/lib/utils/spaces'
import type {
    SpaceEntryStatus,
    SpaceEntryType,
    SpaceInviteStatus,
    SpaceMode,
    SpaceParticipantRole,
    SpaceStatus,
    SpaceType,
} from '@/lib/constants'

export const SPACE_TYPE_META: Record<
    SpaceType,
    {
        icon: LucideIcon
        description: string
    }
> = {
    couple: {
        icon: Users,
        description: 'Gastos, balances y acuerdos compartidos de pareja.',
    },
    home: {
        icon: Home,
        description: 'Vida cotidiana, alquiler y costos del hogar.',
    },
    travel: {
        icon: Plane,
        description: 'Presupuesto, reservas, gastos y cierre del viaje.',
    },
    project: {
        icon: Sparkles,
        description: 'Objetivos, proyectos o contextos colaborativos.',
    },
    event: {
        icon: Sparkles,
        description: 'Producción, logística y cierre de un evento.',
    },
    personal: {
        icon: BriefcaseBusiness,
        description: 'Un contexto personal separado de tu contabilidad general.',
    },
    other: {
        icon: Sparkles,
        description: 'Cualquier contexto financiero con identidad propia.',
    },
}

export const SPACE_ENTRY_TYPE_META: Record<
    SpaceEntryType,
    {
        icon: LucideIcon
        accent: string
        softAccent: string
    }
> = {
    expense: {
        icon: HandCoins,
        accent: 'var(--chart-4)',
        softAccent: 'rgba(239,68,68,0.12)',
    },
    income: {
        icon: CircleDollarSign,
        accent: 'var(--chart-3)',
        softAccent: 'rgba(16,185,129,0.12)',
    },
    adjustment: {
        icon: Settings2,
        accent: 'var(--chart-2)',
        softAccent: 'rgba(212,160,23,0.14)',
    },
    settlement: {
        icon: ArrowDownLeft,
        accent: 'var(--sky)',
        softAccent: 'rgba(74,158,204,0.14)',
    },
}

export function getFallbackChartColor(index: number) {
    const palette = [
        'var(--chart-1)',
        'var(--chart-2)',
        'var(--chart-3)',
        'var(--chart-4)',
        'var(--chart-5)',
    ]

    return palette[index % palette.length]
}

export function SpaceTypeIcon({
    type,
    className,
    iconClassName,
}: {
    type: SpaceType
    className?: string
    iconClassName?: string
}) {
    const Icon = SPACE_TYPE_META[type].icon
    const accent = resolveSpaceTypeAccent(type)

    return (
        <div
            className={cn(
                'flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/50 shadow-sm',
                className
            )}
            style={{
                background: `linear-gradient(135deg, ${accent.background} 0%, color-mix(in srgb, ${accent.color} 12%, white) 100%)`,
                color: accent.color,
            }}
        >
            <Icon className={cn('h-5 w-5', iconClassName)} />
        </div>
    )
}

export function SpaceInitialsAvatar({
    name,
    className,
}: {
    name: string
    className?: string
}) {
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')

    return (
        <div
            className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border border-background text-xs font-semibold shadow-sm',
                className
            )}
            style={{
                background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--sky) 18%, white), color-mix(in srgb, var(--chart-3) 10%, white))',
                color: 'var(--foreground)',
            }}
        >
            {initials}
        </div>
    )
}

export function SpaceSurface({
    children,
    className,
    accent = 'var(--sky)',
    padding = 'p-5 md:p-6',
    style,
}: {
    children: ReactNode
    className?: string
    accent?: string
    padding?: string
    style?: CSSProperties
}) {
    return (
        <section
            className={cn(
                'relative overflow-hidden rounded-[32px] border border-foreground/[0.08] bg-card/95',
                padding,
                className
            )}
            style={{
                background: `radial-gradient(circle at top left, color-mix(in srgb, ${accent} 12%, transparent) 0%, transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--card) 98%, transparent) 0%, color-mix(in srgb, var(--card) 94%, transparent) 100%)`,
                boxShadow: 'var(--card-shadow)',
                ...style,
            }}
        >
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                    background: `linear-gradient(90deg, transparent 0%, color-mix(in srgb, ${accent} 35%, white) 50%, transparent 100%)`,
                }}
            />
            {children}
        </section>
    )
}

export function SpaceSectionHeading({
    eyebrow,
    title,
    description,
    action,
    className,
}: {
    eyebrow?: string
    title: string
    description?: string
    action?: ReactNode
    className?: string
}) {
    return (
        <div className={cn('flex flex-col gap-3 md:flex-row md:items-start md:justify-between', className)}>
            <div className="space-y-1.5">
                {eyebrow ? (
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {eyebrow}
                    </p>
                ) : null}
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-[1.35rem]">
                        {title}
                    </h2>
                    {description ? (
                        <p className="max-w-3xl text-sm text-muted-foreground md:text-[0.95rem]">
                            {description}
                        </p>
                    ) : null}
                </div>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    )
}

export function SpaceMetaBadge({
    icon: Icon,
    children,
    className,
}: {
    icon?: LucideIcon
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/80 px-3 py-2 text-xs font-medium text-secondary-foreground backdrop-blur-sm',
                className
            )}
        >
            {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
            <span>{children}</span>
        </div>
    )
}

export function SpaceStatusBadge({
    status,
    className,
}: {
    status: SpaceStatus
    className?: string
}) {
    const tone = resolveSpaceStatusTone(status)
    const Icon =
        status === 'active'
            ? CheckCircle2
            : status === 'paused'
                ? PauseCircle
                : status === 'closed'
                    ? ArrowDownLeft
                    : FileText

    return (
        <Badge
            className={cn('gap-1.5 rounded-full border-0 px-3 py-1 text-[11px] font-medium', className)}
            style={{
                background: tone.background,
                color: tone.color,
            }}
        >
            <Icon className="h-3.5 w-3.5" />
            {SPACE_STATUS_LABELS[status]}
        </Badge>
    )
}

export function SpaceTypeBadge({
    type,
    className,
}: {
    type: SpaceType
    className?: string
}) {
    const tone = resolveSpaceTypeAccent(type)

    return (
        <Badge
            className={cn('rounded-full border-0 px-3 py-1 text-[11px] font-medium', className)}
            style={{
                background: tone.background,
                color: tone.color,
            }}
        >
            {SPACE_TYPE_LABELS[type]}
        </Badge>
    )
}

export function SpaceModeBadge({
    mode,
    className,
}: {
    mode: SpaceMode
    className?: string
}) {
    return (
        <Badge className={cn('rounded-full border border-border/80 bg-background/80 px-3 py-1 text-[11px] font-medium text-secondary-foreground', className)}>
            {SPACE_MODE_LABELS[mode]}
        </Badge>
    )
}

export function SpaceRoleBadge({
    role,
    className,
}: {
    role: SpaceParticipantRole
    className?: string
}) {
    return (
        <Badge className={cn('rounded-full border border-border/80 bg-background/80 px-3 py-1 text-[11px] font-medium text-secondary-foreground', className)}>
            {SPACE_ROLE_LABELS[role]}
        </Badge>
    )
}

export function SpaceInviteStatusBadge({
    status,
    className,
}: {
    status: SpaceInviteStatus
    className?: string
}) {
    const tone =
        status === 'accepted'
            ? { background: 'rgba(16,185,129,0.12)', color: '#10B981' }
            : status === 'declined'
                ? { background: 'rgba(239,68,68,0.12)', color: '#EF4444' }
                : { background: 'rgba(212,160,23,0.14)', color: '#A67C00' }

    return (
        <Badge
            className={cn('rounded-full border-0 px-3 py-1 text-[11px] font-medium', className)}
            style={{
                background: tone.background,
                color: tone.color,
            }}
        >
            {SPACE_INVITE_STATUS_LABELS[status]}
        </Badge>
    )
}

export function SpaceEntryTypeBadge({
    type,
    className,
}: {
    type: SpaceEntryType
    className?: string
}) {
    const meta = SPACE_ENTRY_TYPE_META[type]
    const Icon = meta.icon

    return (
        <Badge
            className={cn('gap-1.5 rounded-full border-0 px-3 py-1 text-[11px] font-medium', className)}
            style={{
                background: meta.softAccent,
                color: meta.accent,
            }}
        >
            <Icon className="h-3.5 w-3.5" />
            {SPACE_ENTRY_TYPE_LABELS[type]}
        </Badge>
    )
}

export function SpaceEntryStatusBadge({
    status,
    className,
}: {
    status: SpaceEntryStatus
    className?: string
}) {
    const tone =
        status === 'linked'
            ? { background: 'rgba(16,185,129,0.12)', color: '#10B981', label: 'Vinculado' }
            : status === 'confirmed'
                ? { background: 'rgba(74,158,204,0.14)', color: 'var(--sky)', label: 'Confirmado' }
                : status === 'pending_confirmation'
                    ? { background: 'rgba(212,160,23,0.14)', color: '#A67C00', label: 'Pendiente' }
                    : { background: 'rgba(239,68,68,0.12)', color: '#EF4444', label: 'Rechazado' }

    return (
        <Badge
            className={cn('rounded-full border-0 px-3 py-1 text-[11px] font-medium', className)}
            style={{
                background: tone.background,
                color: tone.color,
            }}
        >
            {tone.label}
        </Badge>
    )
}

export function SpaceMetricCard({
    label,
    amount,
    currency,
    hidden,
    className,
    accent,
    footer,
}: {
    label: string
    amount: number
    currency: string
    hidden: boolean
    className?: string
    accent?: string
    footer?: ReactNode
}) {
    return (
        <div
            className={cn(
                'rounded-[28px] border border-foreground/[0.07] bg-background/78 p-4 backdrop-blur-sm',
                className
            )}
        >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {label}
            </p>
            <ResponsiveAmount
                amount={amount}
                currency={currency}
                hidden={hidden}
                color={accent}
                className="mt-3 text-[1.7rem] font-semibold tracking-tight"
            />
            {footer ? <div className="mt-3 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
    )
}

export function SpaceAmountInline({
    amount,
    currency,
    hidden,
    className,
    color,
}: {
    amount: number
    currency: string
    hidden: boolean
    className?: string
    color?: string
}) {
    return (
        <ResponsiveAmount
            amount={amount}
            currency={currency}
            hidden={hidden}
            className={className}
            color={color}
        />
    )
}

export function SpaceTonePill({
    positive,
    children,
    className,
}: {
    positive?: boolean
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
                className
            )}
            style={{
                background: positive ? 'rgba(16,185,129,0.12)' : 'rgba(212,160,23,0.14)',
                color: positive ? '#10B981' : '#A67C00',
            }}
        >
            {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
            <span>{children}</span>
        </div>
    )
}
