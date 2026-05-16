'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CreditCard, Handshake } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDebts } from '@/hooks/useDebts'
import { useAccounts } from '@/hooks/useAccounts'
import { useSpaces } from '@/hooks/useSpaces'
import { usePersonalPendingActions } from '@/hooks/usePersonalPendingActions'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useToast } from '@/hooks/useToast'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { DebtsPageHeader } from '@/components/debts/index/DebtsPageHeader'
import { DebtsSummaryCards } from '@/components/debts/index/DebtsSummaryCards'
import { DebtsFilterBar, type DebtsFilter, type DebtsSort } from '@/components/debts/index/DebtsFilterBar'
import { DebtsRelationItem } from '@/components/debts/index/DebtsRelationItem'
import { DebtRelationPanel } from '@/components/debts/panels/DebtRelationPanel'
import { DebtRelationSheet } from '@/components/debts/sheets/DebtRelationSheet'
import { DebtDetailSheet } from '@/components/debts/sheets/DebtDetailSheet'
import { CreateDebtDialog } from '@/components/debts/dialogs/CreateDebtDialog'
import { PayDebtDialog } from '@/components/debts/dialogs/PayDebtDialog'
import { CollectDebtDialog } from '@/components/debts/dialogs/CollectDebtDialog'
import { buildDebtSummary } from '@/lib/utils/debt'
import {
    buildDebtRelationships,
    filterRelationships,
    sortRelationships,
    type DebtRelationship,
} from '@/lib/utils/debts-ui'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { IDebt } from '@/types/debt'

function idToString(id: unknown) {
    if (!id) return ''
    return typeof id === 'string' ? id : id.toString()
}

function relationKeyFromDebt(debt: IDebt) {
    return (
        idToString(debt.counterpartyUserId) ||
        idToString(debt.counterpartyParticipantId) ||
        debt.counterpartyNameSnapshot.toLowerCase().trim()
    )
}

function usesHistoricalDebts(filter: DebtsFilter) {
    return filter === 'paid' || filter === 'ignored' || filter === 'cancelled'
}

function emptyTitle(filter: DebtsFilter) {
    if (filter === 'payable') return 'No debés nada'
    if (filter === 'receivable') return 'Nadie te debe'
    if (filter === 'space') return 'No hay deudas de espacios'
    if (filter === 'manual') return 'No hay deudas manuales'
    if (filter === 'pending') return 'No hay pendientes'
    if (filter === 'needs_review') return 'No hay revisiones'
    if (filter === 'paid') return 'No hay deudas saldadas'
    if (filter === 'ignored') return 'No hay deudas ignoradas'
    if (filter === 'cancelled') return 'No hay deudas canceladas'
    return 'No hay deudas activas'
}

function DebtsPageInner() {
    usePageTitle('Deudas')

    const router = useRouter()
    const searchParams = useSearchParams()
    const {
        debts,
        allDebts,
        loading: debtsLoading,
        createDebt,
        payDebt,
        collectDebt,
        ignoreDebt,
        restoreDebt,
        cancelDebt,
        getDebtWithMovements,
    } = useDebts()
    const { accounts } = useAccounts()
    const { spaces, loading: spacesLoading } = useSpaces()
    const {
        pendingActions,
        needsReviewActions,
        loading: pendingLoading,
    } = usePersonalPendingActions()
    const { hidden } = useHideAmounts()
    const { success, error: toastError, info } = useToast()
    const isMobile = useMediaQuery('(max-width: 767px)')

    const loading = debtsLoading || spacesLoading || pendingLoading
    useAppStartupReady(!loading)

    const [activeFilter, setActiveFilter] = useState<DebtsFilter>('all')
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<DebtsSort>('net')
    const [selectedRelationKey, setSelectedRelationKey] = useState<string | null>(null)
    const [highlightedDebtId, setHighlightedDebtId] = useState<string | null>(null)
    const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [createPrefillName, setCreatePrefillName] = useState('')
    const [createFromRelation, setCreateFromRelation] = useState(false)
    const [payDebtTarget, setPayDebtTarget] = useState<IDebt | null>(null)
    const [collectDebtTarget, setCollectDebtTarget] = useState<IDebt | null>(null)
    const handledDebtParamRef = useRef<string | null>(null)

    const pendingAndReviewActions = useMemo(
        () => [...pendingActions, ...needsReviewActions],
        [pendingActions, needsReviewActions]
    )

    const spaceNameMap = useMemo(() => {
        return spaces.reduce<Record<string, string>>((acc, item) => {
            acc[idToString(item.space._id)] = item.space.name
            return acc
        }, {})
    }, [spaces])

    const sourceDebts = usesHistoricalDebts(activeFilter) ? allDebts : debts

    const allRelationships = useMemo(() => {
        return buildDebtRelationships(allDebts, pendingAndReviewActions, spaceNameMap)
    }, [allDebts, pendingAndReviewActions, spaceNameMap])

    const relationships = useMemo(() => {
        return buildDebtRelationships(sourceDebts, pendingAndReviewActions, spaceNameMap)
    }, [sourceDebts, pendingAndReviewActions, spaceNameMap])

    const filteredRelationships = useMemo(() => {
        return sortRelationships(filterRelationships(relationships, activeFilter, search), sort)
    }, [relationships, activeFilter, search, sort])

    const summary = useMemo(() => {
        const activeDebts = debts.filter((debt) => debt.status === 'active' || debt.status === 'partially_paid')
        return buildDebtSummary(activeDebts)
    }, [debts])

    const selectedRel = useMemo<DebtRelationship | null>(() => {
        if (!selectedRelationKey) return null
        return allRelationships.find((rel) => rel.key === selectedRelationKey) ?? null
    }, [allRelationships, selectedRelationKey])

    function openCreate(prefillName = '', fromRelation = false) {
        setCreatePrefillName(prefillName)
        setCreateFromRelation(fromRelation)
        setCreateOpen(true)
    }

    useEffect(() => {
        if (searchParams.get('create') === '1') {
            queueMicrotask(() => {
                openCreate()
                router.replace('/debts', { scroll: false })
            })
        }

        const debtId = searchParams.get('debtId')
        if (!debtId || debtsLoading || handledDebtParamRef.current === debtId) return

        const debt = allDebts.find((item) => idToString(item._id) === debtId)
        handledDebtParamRef.current = debtId

        if (!debt) {
            info('No encontramos esa deuda. Puede haber sido eliminada o ya no estar disponible.')
            return
        }

        queueMicrotask(() => {
            if (debt.status === 'paid') {
                setActiveFilter('paid')
                info('Esta deuda ya fue saldada.')
            } else if (debt.status === 'ignored') {
                setActiveFilter('ignored')
                info('Esta deuda está ignorada en tu Finp.')
            } else if (debt.status === 'cancelled') {
                setActiveFilter('cancelled')
                info('Esta deuda fue cancelada.')
            }

            setSelectedRelationKey(relationKeyFromDebt(debt))
            setHighlightedDebtId(debtId)
        })
    }, [allDebts, debtsLoading, info, router, searchParams])

    function selectRelationship(rel: DebtRelationship) {
        setSelectedRelationKey(rel.key)
        setHighlightedDebtId(null)
    }

    function handlePanelNewDebt(name: string) {
        openCreate(name, true)
    }

    async function handleCreateDebt(payload: Parameters<typeof createDebt>[0]) {
        try {
            await createDebt(payload)
            success('Deuda registrada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar la deuda')
        }
    }

    async function handlePay(debtId: string, payload: Parameters<typeof payDebt>[1]) {
        try {
            const updated = await payDebt(debtId, payload)
            success('Pago registrado')
            if (updated.status === 'paid') setSelectedRelationKey(null)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar el pago')
        }
    }

    async function handleCollect(debtId: string, payload: Parameters<typeof collectDebt>[1]) {
        try {
            const updated = await collectDebt(debtId, payload)
            success('Cobro registrado')
            if (updated.status === 'paid') setSelectedRelationKey(null)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar el cobro')
        }
    }

    async function handleIgnore(debt: IDebt) {
        try {
            await ignoreDebt(idToString(debt._id))
            success('Deuda ignorada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al ignorar la deuda')
        }
    }

    async function handleRestore(debt: IDebt) {
        try {
            await restoreDebt(idToString(debt._id))
            success('Deuda restaurada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al restaurar la deuda')
        }
    }

    async function handleCancel(debt: IDebt) {
        try {
            await cancelDebt(idToString(debt._id))
            success('Deuda cancelada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al cancelar la deuda')
        }
    }

    const panelHandlers = {
        onViewDebt: (debt: IDebt) => setSelectedDebtId(idToString(debt._id)),
        onPay: (debt: IDebt) => setPayDebtTarget(debt),
        onCollect: (debt: IDebt) => setCollectDebtTarget(debt),
        onNewDebt: handlePanelNewDebt,
    }

    return (
        <motion.div className="flex h-full min-h-[calc(100vh-4rem)] bg-background" {...fadeIn}>
            <div className="min-w-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-5xl space-y-4 p-4 pb-10 md:p-6">
                    <DebtsPageHeader onNew={() => openCreate()} />

                    {!loading ? (
                        <DebtsSummaryCards
                            summary={summary}
                            hidden={hidden}
                            pendingCount={pendingActions.length}
                            needsReviewCount={needsReviewActions.length}
                        />
                    ) : null}

                    <DebtsFilterBar
                        active={activeFilter}
                        onChange={setActiveFilter}
                        search={search}
                        onSearchChange={setSearch}
                        sort={sort}
                        onSortChange={setSort}
                    />

                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((index) => (
                                <div key={index} className="h-20 animate-pulse rounded-xl border bg-muted" />
                            ))}
                        </div>
                    ) : null}

                    {!loading && filteredRelationships.length === 0 ? (
                        <EmptyState
                            icon={Handshake}
                            title={emptyTitle(activeFilter)}
                            description={
                                activeFilter === 'all'
                                    ? 'Cuando registres una deuda o compartas gastos en un Espacio, aparecerá acá.'
                                    : undefined
                            }
                            actionLabel={activeFilter === 'all' ? 'Nueva deuda' : undefined}
                            onAction={activeFilter === 'all' ? () => openCreate() : undefined}
                        />
                    ) : null}

                    {!loading && filteredRelationships.length > 0 ? (
                        <>
                            <motion.div
                                className="hidden overflow-hidden rounded-xl border bg-card shadow-sm md:block"
                                variants={staggerContainer}
                                initial="initial"
                                animate="animate"
                            >
                                {filteredRelationships.map((rel) => (
                                    <motion.div key={rel.key} variants={staggerItem}>
                                        <DebtsRelationItem
                                            rel={rel}
                                            hidden={hidden}
                                            variant="desktop"
                                            selected={selectedRelationKey === rel.key}
                                            onViewDetail={() => selectRelationship(rel)}
                                            onPay={(debt) => setPayDebtTarget(debt)}
                                            onCollect={(debt) => setCollectDebtTarget(debt)}
                                        />
                                    </motion.div>
                                ))}
                            </motion.div>

                            <motion.div
                                className="space-y-2 md:hidden"
                                variants={staggerContainer}
                                initial="initial"
                                animate="animate"
                            >
                                {filteredRelationships.map((rel) => (
                                    <motion.div key={rel.key} variants={staggerItem}>
                                        <DebtsRelationItem
                                            rel={rel}
                                            hidden={hidden}
                                            variant="mobile"
                                            selected={selectedRelationKey === rel.key}
                                            onViewDetail={() => selectRelationship(rel)}
                                            onPay={(debt) => setPayDebtTarget(debt)}
                                            onCollect={(debt) => setCollectDebtTarget(debt)}
                                        />
                                    </motion.div>
                                ))}
                            </motion.div>
                        </>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2.5">
                            <CreditCard size={16} className="shrink-0 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Tus tarjetas de crédito se siguen gestionando desde Pagos con TC.
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="shrink-0">
                            <Link href="/transactions/credit-card">Ir a Pagos con TC</Link>
                        </Button>
                    </div>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {selectedRel ? (
                    <motion.aside
                        key={selectedRel.key}
                        className="hidden w-96 shrink-0 overflow-hidden border-l bg-card md:flex md:flex-col"
                        initial={{ opacity: 0, x: 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 18 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <DebtRelationPanel
                            rel={selectedRel}
                            hidden={hidden}
                            highlightedDebtId={highlightedDebtId}
                            {...panelHandlers}
                        />
                    </motion.aside>
                ) : null}
            </AnimatePresence>

            <DebtRelationSheet
                open={Boolean(selectedRel && isMobile)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRelationKey(null)
                        setHighlightedDebtId(null)
                    }
                }}
                rel={selectedRel}
                hidden={hidden}
                highlightedDebtId={highlightedDebtId}
                {...panelHandlers}
            />

            <DebtDetailSheet
                open={Boolean(selectedDebtId)}
                onOpenChange={(open) => {
                    if (!open) setSelectedDebtId(null)
                }}
                debtId={selectedDebtId}
                hidden={hidden}
                onPay={(debt) => setPayDebtTarget(debt)}
                onCollect={(debt) => setCollectDebtTarget(debt)}
                onIgnore={handleIgnore}
                onRestore={handleRestore}
                onCancel={handleCancel}
                getDebtWithMovements={getDebtWithMovements}
            />

            <CreateDebtDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                prefillName={createPrefillName}
                lockCounterparty={createFromRelation}
                onSubmit={handleCreateDebt}
            />

            <PayDebtDialog
                open={Boolean(payDebtTarget)}
                onOpenChange={(open) => {
                    if (!open) setPayDebtTarget(null)
                }}
                debt={payDebtTarget}
                accounts={accounts}
                onSubmit={handlePay}
            />

            <CollectDebtDialog
                open={Boolean(collectDebtTarget)}
                onOpenChange={(open) => {
                    if (!open) setCollectDebtTarget(null)
                }}
                debt={collectDebtTarget}
                accounts={accounts}
                onSubmit={handleCollect}
            />
        </motion.div>
    )
}

export default function DebtsPage() {
    return (
        <Suspense fallback={null}>
            <DebtsPageInner />
        </Suspense>
    )
}
