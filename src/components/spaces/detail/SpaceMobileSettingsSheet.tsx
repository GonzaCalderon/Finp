'use client'

import { Settings2, UserPlus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
    SpaceInviteStatusBadge,
    SpaceMetaBadge,
    SpaceRoleBadge,
    SpaceStatusBadge,
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
import { Coins, Plus, Users } from 'lucide-react'

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
                        className="fixed inset-x-0 bottom-0 z-50 md:hidden rounded-t-3xl border-t shadow-2xl"
                        style={{
                            background: 'var(--background)',
                            borderColor: 'var(--border)',
                            maxHeight: '88dvh',
                        }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />

                        <div className="flex items-center justify-between px-4 py-3">
                            <p className="text-sm font-semibold text-foreground">Gestionar espacio</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
                                aria-label="Cerrar"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="overflow-y-auto pb-safe-or-6" style={{ maxHeight: 'calc(88dvh - 80px)' }}>
                            {/* Participantes */}
                            <section className="px-4 pb-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                            Participantes
                                        </p>
                                        <p className="mt-0.5 text-base font-semibold text-foreground">
                                            Personas del espacio
                                        </p>
                                    </div>
                                    {canManage ? (
                                        <Button
                                            size="sm"
                                            className="rounded-full"
                                            onClick={() => { onClose(); onAddParticipant() }}
                                        >
                                            <UserPlus className="h-3.5 w-3.5" />
                                            Agregar
                                        </Button>
                                    ) : null}
                                </div>

                                <div className="mt-3 space-y-2">
                                    {participants.map((p) => (
                                        <div
                                            key={extractId(p._id)}
                                            className="flex items-center gap-3 rounded-2xl border border-foreground/[0.06] bg-card/70 px-3 py-2.5"
                                        >
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                                                {(p.displayName?.[0] ?? '?').toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    {p.displayName}
                                                </p>
                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                    <SpaceRoleBadge role={p.role} />
                                                    <SpaceInviteStatusBadge status={p.inviteStatus} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="mx-4 border-t border-border/60" />

                            {/* Configuración */}
                            <section className="px-4 py-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                            Configuración
                                        </p>
                                        <p className="mt-0.5 text-base font-semibold text-foreground">
                                            Ajustes del espacio
                                        </p>
                                    </div>
                                    {canManage ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="rounded-full"
                                            onClick={() => { onClose(); onEdit() }}
                                        >
                                            <Settings2 className="h-3.5 w-3.5" />
                                            Editar
                                        </Button>
                                    ) : null}
                                </div>

                                <div className="mt-3 divide-y divide-border/60 rounded-2xl border border-foreground/[0.06] bg-card/70 overflow-hidden">
                                    {[
                                        ['Tipo', SPACE_TYPE_LABELS[space.type]],
                                        ['Estado', SPACE_STATUS_LABELS[space.status]],
                                        ['Modo', SPACE_MODE_LABELS[space.mode]],
                                        ['Monedas', space.currencies.join(' / ')],
                                        ['Reporte', space.reportingCurrency],
                                        ['Split', SPACE_SPLIT_MODE_LABELS[space.defaultSplitMode]],
                                        ['Período', formatSpaceDateRange(space.startDate, space.endDate)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                            <span className="text-muted-foreground">{label}</span>
                                            <span className="font-medium text-foreground">{value}</span>
                                        </div>
                                    ))}
                                </div>

                                {space.description ? (
                                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                        {space.description}
                                    </p>
                                ) : null}
                            </section>

                            <div className="mx-4 border-t border-border/60" />

                            {/* Cierre */}
                            <section className="px-4 py-5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Cierre
                                </p>
                                <p className="mt-0.5 text-base font-semibold text-foreground">
                                    Estado operativo
                                </p>

                                <div className="mt-3 rounded-2xl border border-foreground/[0.06] bg-card/70 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {isClosed ? 'Espacio cerrado' : 'Espacio abierto'}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {isClosed
                                                    ? 'Congelado para nuevos movimientos.'
                                                    : 'Habilitado para registrar movimientos.'}
                                            </p>
                                        </div>
                                        <SpaceStatusBadge status={space.status} />
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        <SpaceMetaBadge icon={Coins}>
                                            {summary.totalEntryCount} mov.
                                        </SpaceMetaBadge>
                                        <SpaceMetaBadge icon={Users}>
                                            {summary.participantCount} part.
                                        </SpaceMetaBadge>
                                        {summary.pendingEntryCount > 0 ? (
                                            <SpaceMetaBadge icon={Plus}>
                                                {summary.pendingEntryCount} pend.
                                            </SpaceMetaBadge>
                                        ) : null}
                                    </div>
                                </div>

                                {canManage ? (
                                    <Button
                                        className="mt-3 w-full rounded-full"
                                        variant={isClosed ? 'default' : 'outline'}
                                        onClick={() => { onClose(); onToggleClosed() }}
                                    >
                                        {isClosed ? 'Reabrir espacio' : 'Cerrar espacio'}
                                    </Button>
                                ) : null}
                            </section>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
