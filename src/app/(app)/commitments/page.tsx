'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Archive,
    Bell,
    Calendar,
    CheckCircle,
    ChevronDown,
    Clock3,
    Plus,
    Wallet,
} from 'lucide-react'
import { useCommitments } from '@/hooks/useCommitments'
import { useCommitmentSuggestions } from '@/hooks/useCommitmentSuggestions'
import { useCategories } from '@/hooks/useCategories'
import { useAccounts } from '@/hooks/useAccounts'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError, apiJson } from '@/lib/client/auth-client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CommitmentDialog } from '@/components/shared/CommitmentDialog'
import { ApplyCommitmentDialog } from '@/components/shared/ApplyCommitmentDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { MobileCardCarousel } from '@/components/shared/MobileCardCarousel'
import { CommitmentAmountDialog } from '@/components/commitments/CommitmentAmountDialog'
import { CommitmentSection } from '@/components/commitments/CommitmentSection'
import { CommitmentSuggestionCard } from '@/components/commitments/CommitmentSuggestionCard'
import { fadeIn, staggerContainer } from '@/lib/utils/animations'
import { getCurrentFinancialPeriod } from '@/lib/utils/period'
import { takeCaptureDraft } from '@/lib/client/capture-draft'
import { reportCaptureIntentCompleted } from '@/lib/client/capture-intent-events'
import {
    CAPTURE_DRAFT_TTL_MS,
    CAPTURE_DRAFT_VERSION,
    type CaptureIntent,
    type CommitmentDraftEnvelope,
    type CommitmentDraftFields,
} from '@/types/capture-intent'
import type { CommitmentFormData } from '@/lib/validations'
import type { IScheduledCommitment } from '@/types'
import type { CommitmentSuggestion } from '@/lib/utils/commitment-suggestions'
import {
    COMMITMENT_INVALIDATION_TAGS,
    invalidateData,
} from '@/lib/client/data-sync'

const getFallbackPeriod = () => getCurrentFinancialPeriod(new Date())

function getReferenceId(value: unknown): string | undefined {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value !== 'object') return undefined
    const candidate = value as { _id?: unknown; toString?: () => string }
    if (candidate._id) return String(candidate._id)
    return candidate.toString?.()
}

function SummaryCard({
    title,
    value,
    hint,
}: {
    title: string
    value: string
    hint: string
}) {
    return (
        <div className="min-w-[210px] shrink-0 snap-start rounded-2xl border bg-card p-4 shadow-sm md:min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
        </div>
    )
}

function CommitmentsLoadingState() {
    return (
        <div className="mx-auto max-w-5xl space-y-5 px-4 py-4 md:px-6 md:py-6">
            <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-10 w-40" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
                {[...Array(3)].map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-2xl" />
                ))}
            </div>
            {[...Array(2)].map((_, index) => (
                <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
        </div>
    )
}

function buildSuggestionDraft(
    suggestion: CommitmentSuggestion
): CommitmentDraftEnvelope {
    const now = Date.now()
    return {
        version: CAPTURE_DRAFT_VERSION,
        draftId: `commitment-suggestion-${now}`,
        intent: 'create_commitment',
        origin: {
            surface: 'commitments',
            sessionId: `commitments-${now}`,
            createdAt: new Date(now).toISOString(),
        },
        expiresAt: new Date(now + CAPTURE_DRAFT_TTL_MS).toISOString(),
        fields: {
            description: suggestion.description,
            amount: suggestion.amount,
            currency: suggestion.currency,
            recurrence: 'monthly',
            dayOfMonth: suggestion.dayOfMonth,
            categoryId: suggestion.categoryId,
            accountId: suggestion.accountId,
            amountPolicy: suggestion.amountPolicy,
            startDate: new Date().toISOString(),
        },
        provenance: {
            description: 'learned',
            amount: 'learned',
            currency: 'learned',
            recurrence: 'learned',
            dayOfMonth: 'learned',
            categoryId: suggestion.categoryId ? 'learned' : 'default',
            accountId: suggestion.accountId ? 'learned' : 'default',
            amountPolicy: 'learned',
            startDate: 'default',
        },
        confidence: suggestion.confidence,
    }
}

function CommitmentsPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const {
        commitments,
        currentPeriod,
        loading,
        error,
        fetchCommitments,
        createCommitment,
        updateCommitment,
        deleteCommitment,
    } = useCommitments()
    const {
        suggestions,
        loading: suggestionsLoading,
        refresh: refreshSuggestions,
        dismiss: dismissSuggestion,
    } = useCommitmentSuggestions()
    const { categories } = useCategories()
    const { accounts } = useAccounts()
    const { success, error: toastError } = useToast()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [selected, setSelected] = useState<IScheduledCommitment | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [applyDialogOpen, setApplyDialogOpen] = useState(false)
    const [applyCommitment, setApplyCommitment] =
        useState<IScheduledCommitment | null>(null)
    const [amountDialogOpen, setAmountDialogOpen] = useState(false)
    const [amountCommitment, setAmountCommitment] =
        useState<IScheduledCommitment | null>(null)
    const [initialDraft, setInitialDraft] =
        useState<CommitmentDraftEnvelope | null>(null)
    const [showArchived, setShowArchived] = useState(false)
    const consumedDraftRef = useRef<string | null>(null)
    /**
     * Derivación de Captura rápida en curso. Se completa cuando esta visita crea
     * la plantilla; cualquier otro uso del diálogo la abandona, así aceptar el
     * CTA y completar la función siguen siendo estados distintos.
     */
    const pendingIntentRef = useRef<{
        draftId: string
        intent: CaptureIntent
        sessionId: string
        startedAt: string
    } | null>(null)

    const selectedLive = selected
        ? commitments.find(
              (commitment) =>
                  commitment._id.toString() === selected._id.toString()
          ) ?? selected
        : null
    const amountCommitmentLive = amountCommitment
        ? commitments.find(
              (commitment) =>
                  commitment._id.toString() === amountCommitment._id.toString()
          ) ?? amountCommitment
        : null

    usePageTitle('Compromisos')

    useEffect(() => {
        const draftId = searchParams.get('draft')
        const wantsCreate = searchParams.get('create') === '1'
        if (!draftId && !wantsCreate) return

        if (draftId && consumedDraftRef.current !== draftId) {
            consumedDraftRef.current = draftId
            const envelope = takeCaptureDraft<CommitmentDraftFields>(draftId)
            if (envelope) {
                setInitialDraft(envelope)
                // Sólo las derivaciones de Captura rápida cierran el embudo de
                // orientación: un candidato aceptado acá es otra superficie.
                pendingIntentRef.current =
                    envelope.origin.surface === 'quick_capture'
                        ? {
                            draftId: envelope.draftId,
                            intent: envelope.intent,
                            sessionId: envelope.origin.sessionId,
                            startedAt: envelope.origin.createdAt,
                        }
                        : null
            }
        }

        setSelected(null)
        setDialogOpen(true)
        router.replace('/commitments', { scroll: false })
    }, [router, searchParams])

    const activeCommitments = useMemo(
        () =>
            commitments.filter((commitment) =>
                ['active', 'ending_soon'].includes(
                    commitment.lifecycleStatus ?? 'active'
                ) && commitment.occursThisPeriod !== false
            ),
        [commitments]
    )
    const pendingCommitments = useMemo(
        () =>
            activeCommitments.filter(
                (commitment) => !commitment.appliedThisMonth
            ),
        [activeCommitments]
    )
    const appliedCommitments = useMemo(
        () =>
            activeCommitments.filter((commitment) => commitment.appliedThisMonth),
        [activeCommitments]
    )
    const upcomingCommitments = useMemo(
        () =>
            commitments.filter(
                (commitment) =>
                    commitment.lifecycleStatus === 'upcoming' ||
                    (['active', 'ending_soon'].includes(
                        commitment.lifecycleStatus ?? 'active'
                    ) &&
                        commitment.occursThisPeriod === false)
            ),
        [commitments]
    )
    const archivedCommitments = useMemo(
        () =>
            commitments.filter((commitment) =>
                ['expired', 'inactive'].includes(
                    commitment.lifecycleStatus ?? ''
                )
            ),
        [commitments]
    )
    const reminderCount = useMemo(
        () =>
            commitments.filter(
                (commitment) =>
                    !commitment.appliedThisMonth &&
                    !['expired', 'inactive'].includes(
                        commitment.lifecycleStatus ?? ''
                    ) &&
                    ['due', 'overdue'].includes(commitment.reminderState ?? '')
            ).length,
        [commitments]
    )

    function handleCreate() {
        setInitialDraft(null)
        pendingIntentRef.current = null
        setSelected(null)
        setDialogOpen(true)
    }

    function handleEdit(commitment: IScheduledCommitment) {
        setInitialDraft(null)
        pendingIntentRef.current = null
        setSelected(commitment)
        setDialogOpen(true)
    }

    function handleApply(commitment: IScheduledCommitment) {
        setApplyCommitment(commitment)
        setApplyDialogOpen(true)
    }

    function handleUpdateAmount(commitment: IScheduledCommitment) {
        setAmountCommitment(commitment)
        setAmountDialogOpen(true)
    }

    async function handleDeleteConfirm() {
        if (!deleteId) return
        try {
            await deleteCommitment(deleteId)
            await fetchCommitments({ silent: true })
            success('Compromiso desactivado correctamente')
        } catch (caught) {
            toastError(
                caught instanceof Error
                    ? caught.message
                    : 'Error al desactivar compromiso'
            )
        } finally {
            setDeleteId(null)
        }
    }

    async function handleReactivate(commitment: IScheduledCommitment) {
        try {
            await updateCommitment(commitment._id.toString(), { isActive: true })
            await fetchCommitments({ silent: true })
            success('Compromiso reactivado')
        } catch (caught) {
            toastError(
                caught instanceof Error
                    ? caught.message
                    : 'No se pudo reactivar el compromiso'
            )
        }
    }

    async function handleSubmit(data: CommitmentFormData) {
        try {
            if (selected) {
                await updateCommitment(
                    selected._id.toString(),
                    data as Record<string, unknown>
                )
                success('Compromiso actualizado correctamente')
            } else {
                await createCommitment(data as Record<string, unknown>)
                success('Compromiso creado correctamente')
                // La plantilla existe: acá se cierra la derivación que empezó en
                // Captura rápida. El ref se limpia primero para que un segundo
                // alta en la misma visita no vuelva a contarla.
                const pendingIntent = pendingIntentRef.current
                pendingIntentRef.current = null
                if (pendingIntent) void reportCaptureIntentCompleted(pendingIntent)
                await refreshSuggestions()
            }
            await fetchCommitments({ silent: true })
            setDialogOpen(false)
            setInitialDraft(null)
        } catch (caught) {
            if (caught instanceof ApiError && caught.details?.length) {
                throw caught
            }
            toastError(
                caught instanceof Error
                    ? caught.message
                    : 'Error al guardar compromiso'
            )
            throw caught
        }
    }

    async function handleApplySubmit(
        commitmentId: string,
        data: Record<string, unknown>
    ) {
        try {
            await apiJson(`/api/commitments/${commitmentId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            invalidateData(COMMITMENT_INVALIDATION_TAGS)
            await fetchCommitments({ silent: true })
            success('Compromiso aplicado correctamente')
            setApplyDialogOpen(false)
        } catch (caught) {
            toastError(
                caught instanceof Error
                    ? caught.message
                    : 'Error al aplicar compromiso'
            )
        }
    }

    function handleAcceptSuggestion(suggestion: CommitmentSuggestion) {
        setSelected(null)
        pendingIntentRef.current = null
        setInitialDraft(buildSuggestionDraft(suggestion))
        setDialogOpen(true)
    }

    async function handleDismissSuggestion(suggestion: CommitmentSuggestion) {
        try {
            await dismissSuggestion(suggestion)
            success('Finp no volverá a sugerir este patrón')
        } catch (caught) {
            toastError(
                caught instanceof Error
                    ? caught.message
                    : 'No se pudo descartar la sugerencia'
            )
        }
    }

    if (loading) return <CommitmentsLoadingState />

    if (error) {
        return (
            <div className="px-4 py-10 md:px-6">
                <p className="text-center text-sm text-destructive">{error}</p>
            </div>
        )
    }

    return (
        <motion.main
            className="mx-auto max-w-5xl space-y-5 px-4 py-4 pb-24 md:space-y-7 md:px-6 md:py-6 md:pb-6"
            {...fadeIn}
        >
            <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                        Compromisos
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Anticipá pagos, recordá vencimientos y registralos con su
                        monto vigente.
                    </p>
                </div>
                <Button
                    onClick={handleCreate}
                    className="min-h-11 w-full gap-2 md:w-auto"
                >
                    <Plus className="size-4" />
                    Nuevo compromiso
                </Button>
            </header>

            <MobileCardCarousel
                hint="Deslizá para recorrer el resumen"
                ariaLabel="Resumen de compromisos"
            >
                <SummaryCard
                    title="Vigentes"
                    value={String(activeCommitments.length)}
                    hint="Compromisos activos del período actual"
                />
                <SummaryCard
                    title="Pendientes"
                    value={String(pendingCommitments.length)}
                    hint="Todavía requieren tu confirmación"
                />
                <SummaryCard
                    title="Recordatorios"
                    value={String(reminderCount)}
                    hint="Vencen pronto o ya pasaron su fecha"
                />
            </MobileCardCarousel>
            <div className="hidden gap-3 md:grid md:grid-cols-3">
                <SummaryCard
                    title="Vigentes"
                    value={String(activeCommitments.length)}
                    hint="Compromisos activos del período actual"
                />
                <SummaryCard
                    title="Pendientes"
                    value={String(pendingCommitments.length)}
                    hint="Todavía requieren tu confirmación"
                />
                <SummaryCard
                    title="Recordatorios"
                    value={String(reminderCount)}
                    hint="Vencen pronto o ya pasaron su fecha"
                />
            </div>

            {(suggestionsLoading || suggestions.length > 0) && (
                <section className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                            <Bell className="size-4.5" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Sugerencias de Finp</h2>
                            <p className="text-xs text-muted-foreground">
                                Patrones mensuales del historial. Siempre requieren
                                revisión.
                            </p>
                        </div>
                    </div>
                    {suggestionsLoading ? (
                        <Skeleton className="h-44 rounded-2xl" />
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {suggestions.map((suggestion) => (
                                <CommitmentSuggestionCard
                                    key={suggestion.subjectKey}
                                    suggestion={suggestion}
                                    onAccept={handleAcceptSuggestion}
                                    onDismiss={(item) =>
                                        void handleDismissSuggestion(item)
                                    }
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}

            {commitments.length === 0 ? (
                <div className="rounded-2xl border bg-card">
                    <EmptyState
                        icon={Calendar}
                        title="Sin compromisos programados"
                        description="Agregá alquiler, servicios u otros pagos para anticiparlos y recordarlos."
                        actionLabel="Nuevo compromiso"
                        onAction={handleCreate}
                    />
                </div>
            ) : (
                <motion.div
                    className="space-y-7"
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                >
                    <CommitmentSection
                        title="Pendientes del período"
                        description="Listos para revisar y registrar manualmente."
                        icon={Wallet}
                        accent="#0284C7"
                        commitments={pendingCommitments}
                        onApply={handleApply}
                        onEdit={handleEdit}
                        onUpdateAmount={handleUpdateAmount}
                        onDeactivate={setDeleteId}
                        onReactivate={(item) => void handleReactivate(item)}
                    />
                    <CommitmentSection
                        title="Aplicados este período"
                        description="Conservan la fecha y el monto realmente registrados."
                        icon={CheckCircle}
                        accent="#10B981"
                        commitments={appliedCommitments}
                        onApply={handleApply}
                        onEdit={handleEdit}
                        onUpdateAmount={handleUpdateAmount}
                        onDeactivate={setDeleteId}
                        onReactivate={(item) => void handleReactivate(item)}
                    />
                    <CommitmentSection
                        title="Próximos"
                        description="Empiezan en una fecha futura y todavía no afectan el período."
                        icon={Clock3}
                        accent="#7C3AED"
                        commitments={upcomingCommitments}
                        onApply={handleApply}
                        onEdit={handleEdit}
                        onUpdateAmount={handleUpdateAmount}
                        onDeactivate={setDeleteId}
                        onReactivate={(item) => void handleReactivate(item)}
                    />

                    {archivedCommitments.length > 0 && (
                        <section className="space-y-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 w-full justify-between"
                                onClick={() =>
                                    setShowArchived((current) => !current)
                                }
                                aria-expanded={showArchived}
                            >
                                <span className="flex items-center gap-2">
                                    <Archive className="size-4" />
                                    Finalizados y desactivados (
                                    {archivedCommitments.length})
                                </span>
                                <ChevronDown
                                    className={`size-4 transition-transform ${
                                        showArchived ? 'rotate-180' : ''
                                    }`}
                                />
                            </Button>
                            {showArchived && (
                                <CommitmentSection
                                    title="Historial de compromisos"
                                    description="No afectan proyecciones ni pendientes actuales."
                                    icon={Archive}
                                    accent="#64748B"
                                    commitments={archivedCommitments}
                                    onApply={handleApply}
                                    onEdit={handleEdit}
                                    onUpdateAmount={handleUpdateAmount}
                                    onDeactivate={setDeleteId}
                                    onReactivate={(item) =>
                                        void handleReactivate(item)
                                    }
                                />
                            )}
                        </section>
                    )}
                </motion.div>
            )}

            <CommitmentDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) {
                        setInitialDraft(null)
                        setSelected(null)
                        // Cerrar sin crear abandona la derivación: no se completa
                        // más tarde con un alta manual no relacionada.
                        pendingIntentRef.current = null
                    }
                }}
                commitment={selectedLive}
                initialDraft={initialDraft}
                categories={categories}
                accounts={accounts}
                onSubmit={handleSubmit}
            />

            <CommitmentAmountDialog
                open={amountDialogOpen}
                onOpenChange={setAmountDialogOpen}
                commitment={amountCommitmentLive}
                onChange={() => void fetchCommitments({ silent: true })}
            />

            <ApplyCommitmentDialog
                open={applyDialogOpen}
                onOpenChange={setApplyDialogOpen}
                commitment={
                    applyCommitment
                        ? {
                              _id: applyCommitment._id.toString(),
                              description: applyCommitment.description,
                              amount: applyCommitment.amount,
                              currency: applyCommitment.currency,
                              dayOfMonth: applyCommitment.dayOfMonth,
                              resolvedAmount: applyCommitment.resolvedAmount,
                              amountPolicy: applyCommitment.amountPolicy,
                              amountCertainty: applyCommitment.amountCertainty,
                              defaultAccountId: getReferenceId(
                                  applyCommitment.accountId
                              ),
                          }
                        : null
                }
                accounts={accounts}
                period={currentPeriod ?? getFallbackPeriod()}
                onSubmit={handleApplySubmit}
            />

            <AlertDialog
                open={Boolean(deleteId)}
                onOpenChange={(open) => {
                    if (!open) setDeleteId(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ¿Desactivar este compromiso?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Dejará de aparecer en la proyección y en los pendientes.
                            Su historial y sus aplicaciones se conservan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => void handleDeleteConfirm()}
                        >
                            Desactivar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.main>
    )
}

export default function CommitmentsPage() {
    return (
        <Suspense fallback={null}>
            <CommitmentsPageInner />
        </Suspense>
    )
}
