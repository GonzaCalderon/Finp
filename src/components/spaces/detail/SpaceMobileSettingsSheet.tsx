'use client'

import { Settings2, UserPlus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
    SpaceInviteStatusBadge,
    SpaceMetaBadge,
    SpaceModeBadge,
    SpaceRoleBadge,
    SpaceStatusBadge,
    SpaceTypeBadge,
} from '@/components/spaces/SpaceUi'
import {
    SPACE_MODE_LABELS,
    SPACE_SPLIT_MODE_LABELS,
    SPACE_STATUS_LABELS,
    SPACE_TYPE_LABELS,
    extractId,
    formatSpaceDateRange,
} from '@/lib/utils/spaces'
import type { ISpace, ISpaceParticipant, SpaceSummarySnapshot } from '@/types'
import { Coins, Users } from 'lucide-react'

function SettingsRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium text-foreground">{value}</span>
        </div>
    )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {children}
        </p>
    )
}

function SettingsCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card/60">
            {children}
        </div>
    )
}

export function SpaceMobileSettingsSheet({
    open,
    onClose,
    space,
    summary,
    participants,
    canManage,
    onEdit,
    onAddParticipant,
    onToggleClosed,
}: {
    open: boolean
    onClose: () => void
    space: ISpace
    summary: SpaceSummarySnapshot
    participants: ISpaceParticipant[]
    canManage: boolean
    onEdit: () => void
    onAddParticipant: () => void
    onToggleClosed: () => void
}) {
    const isClosed = space.status === 'closed'

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.button
                        type="button"
                        className="fixed inset-0 z-40 bg-black/40 md:hidden"
                        onClick={onClose}
                        aria-label="Cerrar"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    />

                    <motion.div
                        className="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-3xl border-t shadow-2xl md:hidden"
                        style={{
                            background: 'var(--background)',
                            borderColor: 'var(--border)',
                            maxHeight: '92dvh',
                        }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {/* Handle */}
                        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />

                        {/* Header: space name as protagonist */}
                        <div className="flex items-start justify-between px-5 pb-3 pt-4">
                            <div className="min-w-0 flex-1 pr-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Configuración del espacio
                                </p>
                                <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-foreground">
                                    {space.name}
                                </h2>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    <SpaceTypeBadge type={space.type} />
                                    <SpaceModeBadge mode={space.mode} />
                                    <SpaceStatusBadge status={space.status} />
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 pt-1">
                                {canManage ? (
                                    <button
                                        type="button"
                                        onClick={() => { onClose(); onEdit() }}
                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-card/70 text-muted-foreground transition-colors active:bg-muted"
                                        aria-label="Editar configuración"
                                    >
                                        <Settings2 size={15} />
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-card/70 text-muted-foreground transition-colors active:bg-muted"
                                    aria-label="Cerrar"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        <div className="mx-5 h-px bg-border/60" />

                        {/* Scrollable content */}
                        <div
                            className="overflow-y-auto"
                            style={{ maxHeight: 'calc(92dvh - 140px)', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
                        >
                            {/* GENERAL */}
                            <section className="px-5 py-4">
                                <SectionLabel>General</SectionLabel>
                                <SettingsCard>
                                    <div className="px-4">
                                        <SettingsRow label="Tipo" value={SPACE_TYPE_LABELS[space.type]} />
                                    </div>
                                    <div className="px-4">
                                        <SettingsRow label="Estado" value={SPACE_STATUS_LABELS[space.status]} />
                                    </div>
                                    <div className="px-4">
                                        <SettingsRow label="Modo" value={SPACE_MODE_LABELS[space.mode]} />
                                    </div>
                                </SettingsCard>
                                {space.description ? (
                                    <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
                                        {space.description}
                                    </p>
                                ) : null}
                            </section>

                            {/* PARTICIPANTES */}
                            <section className="px-5 pb-4">
                                <div className="mb-2 flex items-center justify-between">
                                    <SectionLabel>Participantes</SectionLabel>
                                    {canManage ? (
                                        <button
                                            type="button"
                                            onClick={() => { onClose(); onAddParticipant() }}
                                            className="mb-2 flex items-center gap-1.5 rounded-full border border-foreground/10 bg-card/70 px-3 py-1 text-[11px] font-medium text-foreground transition-colors active:bg-muted"
                                        >
                                            <UserPlus size={11} />
                                            Invitar
                                        </button>
                                    ) : null}
                                </div>
                                <div className="space-y-1.5">
                                    {participants.map((p) => (
                                        <div
                                            key={extractId(p._id)}
                                            className="flex items-center gap-3 rounded-2xl border border-foreground/[0.06] bg-card/60 px-3 py-2.5"
                                        >
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                                {(p.displayName?.[0] ?? '?').toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-foreground">
                                                    {p.displayName}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {p.email ?? 'Participante externo'}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                <SpaceRoleBadge role={p.role} />
                                                <SpaceInviteStatusBadge status={p.inviteStatus} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* REPARTO Y MONEDAS */}
                            <section className="px-5 pb-4">
                                <SectionLabel>Reparto y monedas</SectionLabel>
                                <SettingsCard>
                                    <div className="px-4">
                                        <SettingsRow label="Split por defecto" value={SPACE_SPLIT_MODE_LABELS[space.defaultSplitMode]} />
                                    </div>
                                    <div className="px-4">
                                        <SettingsRow label="Moneda de reporte" value={space.reportingCurrency} />
                                    </div>
                                    <div className="px-4">
                                        <SettingsRow label="Monedas operativas" value={space.currencies.join(' · ')} />
                                    </div>
                                    <div className="px-4">
                                        <SettingsRow label="Período" value={formatSpaceDateRange(space.startDate, space.endDate)} />
                                    </div>
                                </SettingsCard>
                                <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                                    <SpaceMetaBadge icon={Coins}>
                                        {summary.totalEntryCount} mov.
                                    </SpaceMetaBadge>
                                    <SpaceMetaBadge icon={Users}>
                                        {summary.participantCount} part.
                                    </SpaceMetaBadge>
                                </div>
                            </section>

                            {/* CIERRE */}
                            <section className="px-5 pb-6">
                                <SectionLabel>Estado operativo</SectionLabel>
                                <div
                                    className="rounded-2xl border p-4"
                                    style={{
                                        background: isClosed
                                            ? 'color-mix(in srgb, var(--muted) 55%, var(--background))'
                                            : 'color-mix(in srgb, var(--card) 70%, var(--background))',
                                        borderColor: 'color-mix(in srgb, var(--border) 70%, transparent)',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {isClosed ? 'Espacio cerrado' : 'Espacio activo'}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {isClosed
                                                    ? 'No acepta nuevos movimientos hasta reabrirlo.'
                                                    : 'Habilitado para registrar movimientos y participantes.'}
                                            </p>
                                        </div>
                                        <SpaceStatusBadge status={space.status} />
                                    </div>

                                    {canManage ? (
                                        <Button
                                            className="mt-3 w-full rounded-full"
                                            variant={isClosed ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => { onClose(); onToggleClosed() }}
                                        >
                                            {isClosed ? 'Reabrir espacio' : 'Cerrar espacio'}
                                        </Button>
                                    ) : null}
                                </div>
                            </section>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
