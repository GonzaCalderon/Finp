'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Handshake, Plus } from 'lucide-react'
import Link from 'next/link'
import { useDebts } from '@/hooks/useDebts'
import { useAccounts } from '@/hooks/useAccounts'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useToast } from '@/hooks/useToast'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { DebtsSummaryCards } from '@/components/debts/index/DebtsSummaryCards'
import { DebtsFilterBar, type DebtsFilter } from '@/components/debts/index/DebtsFilterBar'
import { DebtPersonCard } from '@/components/debts/index/DebtPersonCard'
import { DebtPersonSheet } from '@/components/debts/sheets/DebtPersonSheet'
import { DebtDetailSheet } from '@/components/debts/sheets/DebtDetailSheet'
import { CreateDebtDialog } from '@/components/debts/dialogs/CreateDebtDialog'
import { PayDebtDialog } from '@/components/debts/dialogs/PayDebtDialog'
import { CollectDebtDialog } from '@/components/debts/dialogs/CollectDebtDialog'
import { getContrapartyKey } from '@/components/debts/DebtsUi'
import { buildDebtSummary, consolidateDebtsByPerson } from '@/lib/utils/debt'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { IDebt } from '@/types/debt'
import type { ConsolidatedDebtByPerson } from '@/lib/utils/debt'

export default function DebtsPage() {
    usePageTitle('Deudas')

    const {
        debts,
        allDebts,
        loading,
        createDebt,
        payDebt,
        collectDebt,
        ignoreDebt,
        restoreDebt,
        cancelDebt,
        getDebtWithMovements,
    } = useDebts()
    const { accounts } = useAccounts()
    const { hidden } = useHideAmounts()
    const { success, error: toastError } = useToast()

    useAppStartupReady(!loading)

    const [activeFilter, setActiveFilter] = useState<DebtsFilter>('all')
    const [selectedPersonKey, setSelectedPersonKey] = useState<string | null>(null)
    const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [createPrefillName, setCreatePrefillName] = useState('')
    const [payDebtTarget, setPayDebtTarget] = useState<IDebt | null>(null)
    const [collectDebtTarget, setCollectDebtTarget] = useState<IDebt | null>(null)

    const sourceDebts = activeFilter === 'ignored' ? allDebts : debts

    const filteredDebts = useMemo(() => {
        return sourceDebts.filter((d) => {
            if (activeFilter === 'all') return d.status !== 'paid' && d.status !== 'cancelled' && d.status !== 'ignored'
            if (activeFilter === 'ignored') return d.status === 'ignored'
            if (activeFilter === 'payable') return d.direction === 'payable' && d.status !== 'paid' && d.status !== 'cancelled' && d.status !== 'ignored'
            if (activeFilter === 'receivable') return d.direction === 'receivable' && d.status !== 'paid' && d.status !== 'cancelled' && d.status !== 'ignored'
            if (activeFilter === 'space') return d.sourceType === 'space' && d.status !== 'paid' && d.status !== 'cancelled' && d.status !== 'ignored'
            if (activeFilter === 'manual') return d.sourceType === 'manual' && d.status !== 'paid' && d.status !== 'cancelled' && d.status !== 'ignored'
            return true
        })
    }, [sourceDebts, activeFilter])

    const groupedByPerson = useMemo(() => {
        return consolidateDebtsByPerson(filteredDebts)
    }, [filteredDebts])

    const summary = useMemo(() => {
        const activeDebts = debts.filter((d) => d.status === 'active' || d.status === 'partially_paid')
        return buildDebtSummary(activeDebts)
    }, [debts])

    const selectedPerson = useMemo<ConsolidatedDebtByPerson | null>(() => {
        if (!selectedPersonKey) return null
        return groupedByPerson.find((p) => {
            const key = p.counterpartyUserId ?? p.counterpartyParticipantId ?? p.counterpartyNameSnapshot.toLowerCase().trim()
            return key === selectedPersonKey
        }) ?? null
    }, [selectedPersonKey, groupedByPerson])

    const selectedPersonDebts = useMemo(() => {
        if (!selectedPersonKey) return []
        return filteredDebts.filter((d) => getContrapartyKey(d) === selectedPersonKey)
    }, [selectedPersonKey, filteredDebts])

    function openPersonSheet(person: ConsolidatedDebtByPerson) {
        const key = person.counterpartyUserId ?? person.counterpartyParticipantId ?? person.counterpartyNameSnapshot.toLowerCase().trim()
        setSelectedPersonKey(key)
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
            await payDebt(debtId, payload)
            success('Pago registrado')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar el pago')
        }
    }

    async function handleCollect(debtId: string, payload: Parameters<typeof collectDebt>[1]) {
        try {
            await collectDebt(debtId, payload)
            success('Cobro registrado')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar el cobro')
        }
    }

    async function handleIgnore(debt: IDebt) {
        try {
            await ignoreDebt(debt._id.toString())
            success('Deuda ignorada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al ignorar la deuda')
        }
    }

    async function handleRestore(debt: IDebt) {
        try {
            await restoreDebt(debt._id.toString())
            success('Deuda restaurada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al restaurar la deuda')
        }
    }

    async function handleCancel(debt: IDebt) {
        try {
            await cancelDebt(debt._id.toString())
            success('Deuda cancelada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al cancelar la deuda')
        }
    }

    return (
        <motion.div className="p-6 pb-10 max-w-3xl mx-auto space-y-6" {...fadeIn}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold">Deudas</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Controlá lo que debés y lo que te deben sin mezclarlo con tus gastos e ingresos.
                    </p>
                </div>
                <Button onClick={() => { setCreatePrefillName(''); setCreateOpen(true) }} size="sm">
                    <Plus size={15} className="mr-1.5" />
                    Nueva deuda
                </Button>
            </div>

            {!loading && summary && (
                <DebtsSummaryCards summary={summary} hidden={hidden} />
            )}

            <DebtsFilterBar active={activeFilter} onChange={setActiveFilter} />

            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="rounded-xl border h-20 animate-pulse"
                            style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}
                        />
                    ))}
                </div>
            )}

            {!loading && groupedByPerson.length === 0 && (
                <EmptyState
                    icon={Handshake}
                    title={
                        activeFilter === 'ignored'
                            ? 'No hay deudas ignoradas'
                            : activeFilter === 'payable'
                                ? 'No debés nada'
                                : activeFilter === 'receivable'
                                    ? 'Nadie te debe'
                                    : 'No hay deudas activas'
                    }
                    description={
                        activeFilter === 'all'
                            ? 'Cuando registres una deuda o compartas gastos en un Espacio, aparecerá acá.'
                            : undefined
                    }
                    actionLabel={activeFilter === 'all' ? 'Nueva deuda' : undefined}
                    onAction={activeFilter === 'all' ? () => setCreateOpen(true) : undefined}
                />
            )}

            {!loading && groupedByPerson.length > 0 && (
                <motion.div className="space-y-3" variants={staggerContainer} initial="initial" animate="animate">
                    {groupedByPerson.map((person) => {
                        const key = person.counterpartyUserId ?? person.counterpartyParticipantId ?? person.counterpartyNameSnapshot.toLowerCase().trim()
                        const personDebts = filteredDebts.filter((d) => getContrapartyKey(d) === key)
                        return (
                            <motion.div key={key} variants={staggerItem}>
                                <DebtPersonCard
                                    person={person}
                                    debts={personDebts}
                                    hidden={hidden}
                                    onViewDetail={() => openPersonSheet(person)}
                                    onPay={(debt) => setPayDebtTarget(debt)}
                                    onCollect={(debt) => setCollectDebtTarget(debt)}
                                />
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}

            <div
                className="rounded-xl border p-4 flex items-center justify-between gap-3"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
                <div className="flex items-center gap-2.5">
                    <CreditCard size={16} className="text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                        Tus tarjetas de crédito se siguen gestionando desde Pagos con TC.
                    </p>
                </div>
                <Button variant="ghost" size="sm" asChild className="shrink-0">
                    <Link href="/transactions/credit-card">Ir a Pagos con TC</Link>
                </Button>
            </div>

            <DebtPersonSheet
                open={Boolean(selectedPersonKey)}
                onOpenChange={(v) => { if (!v) setSelectedPersonKey(null) }}
                person={selectedPerson}
                debts={selectedPersonDebts}
                hidden={hidden}
                onViewDebt={(debt) => setSelectedDebtId(debt._id.toString())}
                onPay={(debt) => setPayDebtTarget(debt)}
                onCollect={(debt) => setCollectDebtTarget(debt)}
                onNewDebt={(name) => { setCreatePrefillName(name); setCreateOpen(true) }}
            />

            <DebtDetailSheet
                open={Boolean(selectedDebtId)}
                onOpenChange={(v) => { if (!v) setSelectedDebtId(null) }}
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
                onSubmit={handleCreateDebt}
            />

            <PayDebtDialog
                open={Boolean(payDebtTarget)}
                onOpenChange={(v) => { if (!v) setPayDebtTarget(null) }}
                debt={payDebtTarget}
                accounts={accounts}
                onSubmit={handlePay}
            />

            <CollectDebtDialog
                open={Boolean(collectDebtTarget)}
                onOpenChange={(v) => { if (!v) setCollectDebtTarget(null) }}
                debt={collectDebtTarget}
                accounts={accounts}
                onSubmit={handleCollect}
            />
        </motion.div>
    )
}
