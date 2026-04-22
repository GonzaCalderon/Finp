'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplyCommitmentDialog } from '@/components/shared/ApplyCommitmentDialog'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { DashboardDesktop } from '@/components/dashboard/DashboardDesktop'
import { DashboardMobile } from '@/components/dashboard/DashboardMobile'
import type { CommitmentItem, DashboardData } from '@/components/dashboard/types'
import { useAccounts } from '@/hooks/useAccounts'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePreferences } from '@/hooks/usePreferences'
import { useToast } from '@/hooks/useToast'
import { apiJson } from '@/lib/client/auth-client'
import { COMMITMENT_INVALIDATION_TAGS, invalidateData } from '@/lib/client/data-sync'
import { buildMonthOptions, getCurrentFinancialPeriod } from '@/lib/utils/period'
import { getOperationalStartFinancialPeriod } from '@/lib/utils/operational-start'

const DESKTOP_QUERY = '(min-width: 768px)'

function getCurrentMonth(monthStartDay = 1) {
    return getCurrentFinancialPeriod(new Date(), monthStartDay)
}

function DashboardSkeleton() {
    return (
        <div className="space-y-4 md:space-y-6">
            <Skeleton className="h-56 rounded-[32px] md:h-80" />
            <div className="grid gap-4 md:grid-cols-[1.25fr_0.95fr]">
                <Skeleton className="h-64 rounded-[28px]" />
                <Skeleton className="h-64 rounded-[28px]" />
            </div>
            <div className="grid gap-4 md:grid-cols-[1.35fr_0.85fr]">
                <Skeleton className="h-80 rounded-[28px]" />
                <div className="grid gap-4">
                    <Skeleton className="h-40 rounded-[28px]" />
                    <Skeleton className="h-40 rounded-[28px]" />
                </div>
            </div>
        </div>
    )
}

export default function DashboardPage() {
    const [month, setMonth] = useState(() => getCurrentMonth())
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [applyDialogOpen, setApplyDialogOpen] = useState(false)
    const [selectedCommitment, setSelectedCommitment] = useState<CommitmentItem | null>(null)
    const [appliedId, setAppliedId] = useState<string | null>(null)
    const hasLoadedOnce = useRef(false)

    const { accounts, loading: accountsLoading } = useAccounts()
    const { hidden } = useHideAmounts()
    const { preferences } = usePreferences()
    const { success, error: toastError } = useToast()
    const isDesktop = useMediaQuery(DESKTOP_QUERY)

    usePageTitle('Dashboard')

    const firstOperationalMonth = useMemo(
        () =>
            getOperationalStartFinancialPeriod(
                preferences.operationalStartDate,
                preferences.monthStartDay
            ),
        [preferences.monthStartDay, preferences.operationalStartDate]
    )

    const monthOptions = useMemo(() => {
        const options = buildMonthOptions({ pastMonths: 8, futureMonths: 1, from: new Date() })
        if (!firstOperationalMonth) return options
        return options.filter((option) => option.value >= firstOperationalMonth)
    }, [firstOperationalMonth])

    useEffect(() => {
        const currentMonth = getCurrentMonth(preferences.monthStartDay)
        const minimumMonth =
            firstOperationalMonth && firstOperationalMonth > currentMonth
                ? firstOperationalMonth
                : currentMonth

        setMonth((previous) =>
            previous >= minimumMonth && (!firstOperationalMonth || previous >= firstOperationalMonth)
                ? previous
                : minimumMonth
        )
    }, [firstOperationalMonth, preferences.monthStartDay])

    const fetchDashboard = useCallback(
        async (isRefresh = false) => {
            try {
                setError(null)
                if (isRefresh) {
                    setRefreshing(true)
                } else {
                    setLoading(true)
                }

                const response = await apiJson<DashboardData>(`/api/dashboard?month=${month}`)
                setData(response)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al cargar dashboard')
            } finally {
                setLoading(false)
                setRefreshing(false)
            }
        },
        [month]
    )

    useEffect(() => {
        void fetchDashboard(hasLoadedOnce.current)
        hasLoadedOnce.current = true
    }, [fetchDashboard])

    useDataInvalidation(['dashboard'], () => {
        void fetchDashboard(true)
    })

    useAppStartupReady(!loading && !accountsLoading)

    const handleApplyCommitment = (commitment: CommitmentItem) => {
        setSelectedCommitment(commitment)
        setApplyDialogOpen(true)
    }

    const handleApplySubmit = async (commitmentId: string, payload: Record<string, unknown>) => {
        try {
            await apiJson(`/api/commitments/${commitmentId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            success('Compromiso aplicado correctamente')
            setApplyDialogOpen(false)
            setAppliedId(commitmentId)
            invalidateData(COMMITMENT_INVALIDATION_TAGS)
            window.setTimeout(() => setAppliedId(null), 1400)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al aplicar compromiso')
        }
    }

    return (
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4 md:px-6 md:py-6">
            {loading && <DashboardSkeleton />}
            {!loading && error && (
                <div className="rounded-[28px] border border-destructive/20 bg-destructive/5 px-5 py-8 text-center text-sm text-destructive">
                    {error}
                </div>
            )}
            {!loading && !error && data && (
                <>
                    {isDesktop ? (
                        <DashboardDesktop
                            data={data}
                            month={month}
                            monthOptions={monthOptions}
                            refreshing={refreshing}
                            hidden={hidden}
                            onMonthChange={setMonth}
                            onApplyCommitment={handleApplyCommitment}
                            appliedId={appliedId}
                            operationalStartConfigured={Boolean(preferences.operationalStartDate)}
                        />
                    ) : (
                        <DashboardMobile
                            data={data}
                            month={month}
                            monthOptions={monthOptions}
                            refreshing={refreshing}
                            hidden={hidden}
                            onMonthChange={setMonth}
                            onApplyCommitment={handleApplyCommitment}
                            appliedId={appliedId}
                            operationalStartConfigured={Boolean(preferences.operationalStartDate)}
                        />
                    )}
                </>
            )}

            <ApplyCommitmentDialog
                open={applyDialogOpen}
                onOpenChange={setApplyDialogOpen}
                commitment={selectedCommitment}
                accounts={accounts}
                period={month}
                onSubmit={handleApplySubmit}
            />
        </div>
    )
}
