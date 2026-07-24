'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
    Brain,
    Check,
    Clock3,
    Loader2,
    RefreshCcw,
    RotateCcw,
    Search,
    ShieldCheck,
    Sparkles,
    WandSparkles,
} from 'lucide-react'

import { QuickCaptureAliasesSection } from '@/components/settings/QuickCaptureAliasesSection'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { QUICK_CAPTURE_TARGET_LABELS } from '@/lib/constants/quick-capture'
import { isSimpleTransactionAccountType } from '@/lib/utils/accounts'
import { resolveEntityId } from '@/lib/utils/entity-id'
import type {
    QuickCaptureLearnedPatternDto,
    QuickCaptureLearningMetrics,
    QuickCaptureLearningProfileDto,
} from '@/types'

function formatPercent(value: number) {
    return new Intl.NumberFormat('es-AR', {
        style: 'percent',
        maximumFractionDigits: 0,
    }).format(value)
}

function formatDuration(value?: number) {
    if (!value) return '—'
    const seconds = Math.round(value / 1000)
    return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`
}

export function QuickCaptureLearningSection() {
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const [patterns, setPatterns] = useState<QuickCaptureLearnedPatternDto[]>([])
    const [profile, setProfile] = useState<QuickCaptureLearningProfileDto>({
        enabled: true,
    })
    const [metrics, setMetrics] = useState<QuickCaptureLearningMetrics>()
    const [loading, setLoading] = useState(true)
    const [savingProfile, setSavingProfile] = useState(false)
    const [busyPatternKey, setBusyPatternKey] = useState<string>()
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState<'all' | 'active' | 'forgotten'>('active')
    const [resetOpen, setResetOpen] = useState(false)
    const [resetting, setResetting] = useState(false)
    const [correcting, setCorrecting] = useState<QuickCaptureLearnedPatternDto>()
    const [correctionValue, setCorrectionValue] = useState('')
    const [savingCorrection, setSavingCorrection] = useState(false)

    const loadLearning = useCallback(async () => {
        setLoading(true)
        try {
            const response = await fetch(
                '/api/quick-capture/learning/patterns',
                { cache: 'no-store' }
            )
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error ?? 'No se pudo cargar el aprendizaje')
            }
            setPatterns(result.patterns)
            setProfile(result.profile)
            setMetrics(result.metrics)
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'No se pudo cargar el aprendizaje'
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadLearning()
    }, [loadLearning])

    const filteredPatterns = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase('es-AR')
        return patterns.filter((pattern) => {
            if (status !== 'all' && pattern.status !== status) return false
            if (!normalized) return true
            return [
                pattern.triggerLabel,
                pattern.targetLabel,
            QUICK_CAPTURE_TARGET_LABELS[pattern.targetType],
            ].some((value) =>
                value.toLocaleLowerCase('es-AR').includes(normalized)
            )
        })
    }, [patterns, query, status])

    async function toggleLearning(enabled: boolean) {
        setSavingProfile(true)
        try {
            const response = await fetch('/api/quick-capture/learning/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            })
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error ?? 'No se pudo guardar la preferencia')
            }
            setProfile(result.profile)
            toast.success(
                enabled
                    ? 'Aprendizaje personalizado activado'
                    : 'Aprendizaje personalizado pausado'
            )
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'No se pudo guardar la preferencia'
            )
        } finally {
            setSavingProfile(false)
        }
    }

    async function updatePattern(
        pattern: QuickCaptureLearnedPatternDto,
        action: 'forget' | 'restore'
    ) {
        setBusyPatternKey(pattern.key)
        try {
            const response = await fetch(
                `/api/quick-capture/learning/patterns/${pattern.key}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action }),
                }
            )
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error ?? 'No se pudo actualizar el patrón')
            }
            setPatterns((current) =>
                current.map((item) =>
                    item.key === pattern.key
                        ? result.pattern
                        : item
                )
            )
            toast.success(
                action === 'forget'
                    ? 'Finp dejó de usar este patrón'
                    : 'Patrón restaurado'
            )
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'No se pudo actualizar el patrón'
            )
        } finally {
            setBusyPatternKey(undefined)
        }
    }

    function openCorrection(pattern: QuickCaptureLearnedPatternDto) {
        setCorrecting(pattern)
        setCorrectionValue(pattern.targetId ?? pattern.targetValue ?? '')
    }

    async function saveCorrection() {
        if (!correcting || !correctionValue.trim()) {
            toast.error('Elegí la interpretación correcta')
            return
        }
        setSavingCorrection(true)
        try {
            const isEntity =
                correcting.targetType === 'account' ||
                correcting.targetType === 'category'
            const response = await fetch(
                `/api/quick-capture/learning/patterns/${correcting.key}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'correct',
                        targetType: correcting.targetType,
                        targetId: isEntity ? correctionValue : undefined,
                        targetValue: isEntity ? undefined : correctionValue,
                    }),
                }
            )
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error ?? 'No se pudo guardar la corrección')
            }
            setPatterns((current) =>
                current.map((item) =>
                    item.key === correcting.key
                        ? { ...item, status: 'forgotten', autoApply: false }
                        : item
                )
            )
            setCorrecting(undefined)
            toast.success('Corrección guardada como atajo explícito')
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'No se pudo guardar la corrección'
            )
        } finally {
            setSavingCorrection(false)
        }
    }

    async function resetLearning() {
        setResetting(true)
        try {
            const response = await fetch('/api/quick-capture/learning', {
                method: 'DELETE',
            })
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error ?? 'No se pudo reiniciar')
            }
            setPatterns([])
            setProfile(result.profile)
            setMetrics(undefined)
            setResetOpen(false)
            toast.success('Aprendizaje reiniciado')
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'No se pudo reiniciar'
            )
        } finally {
            setResetting(false)
        }
    }

    const correctionOptions = correcting?.targetType === 'account'
        ? accounts
            .filter((account) =>
                account.isActive !== false &&
                isSimpleTransactionAccountType(account.type)
            )
            .map((account) => ({
                id: resolveEntityId(account._id),
                label: account.name,
            }))
        : correcting?.targetType === 'category'
            ? categories
                .filter((category) =>
                    !category.isArchived &&
                    category.type === correcting.transactionType
                )
                .map((category) => ({
                    id: resolveEntityId(category._id),
                    label: category.name,
                }))
            : []

    return (
        <section className="space-y-6">
            <div className="rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Brain className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-semibold">Aprendizaje de Finp</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Prioriza tus cuentas, categorías y comercios habituales
                                    usando movimientos confirmados.
                                </p>
                            </div>
                            <Switch
                                checked={profile.enabled}
                                disabled={savingProfile}
                                onCheckedChange={(enabled) =>
                                    void toggleLearning(enabled)
                                }
                                aria-label="Activar aprendizaje personalizado"
                            />
                        </div>
                        <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/50 p-3">
                            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Finp guarda decisiones estructuradas, no la frase completa ni
                                el monto. Podés pausar o reiniciar el aprendizaje cuando quieras.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    {
                        label: 'Patrones',
                        value: metrics?.activePatterns ?? 0,
                        icon: Sparkles,
                    },
                    {
                        label: 'Aceptación',
                        value: formatPercent(metrics?.acceptanceRate ?? 0),
                        icon: Check,
                    },
                    {
                        label: 'Correcciones',
                        value: metrics?.corrections ?? 0,
                        icon: RefreshCcw,
                    },
                    {
                        label: 'Tiempo típico',
                        value: formatDuration(metrics?.medianDurationMs),
                        icon: Clock3,
                    },
                ].map((metric) => (
                    <div key={metric.label} className="rounded-xl border bg-card p-3">
                        <metric.icon className="size-3.5 text-muted-foreground" />
                        <strong className="mt-2 block text-base">{metric.value}</strong>
                        <span className="text-[11px] text-muted-foreground">
                            {metric.label}
                        </span>
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar patrón aprendido"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={status}
                        onValueChange={(value: typeof status) => setStatus(value)}
                    >
                        <SelectTrigger className="w-full sm:w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Activos</SelectItem>
                            <SelectItem value="forgotten">Olvidados</SelectItem>
                            <SelectItem value="all">Todos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={index} className="h-32 rounded-xl" />
                        ))}
                    </div>
                ) : filteredPatterns.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                        <Brain className="mx-auto size-5 text-muted-foreground" />
                        <p className="mt-2 text-sm font-medium">
                            {patterns.length === 0
                                ? 'Finp todavía está observando patrones'
                                : 'No hay patrones que coincidan'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Se muestran después de tres movimientos similares y consistentes.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredPatterns.map((pattern) => (
                            <div
                                key={pattern.key}
                                className="rounded-xl border bg-card p-3"
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    <span
                                        className="mt-1 size-2.5 shrink-0 rounded-full bg-primary"
                                        style={
                                            pattern.targetColor
                                                ? { backgroundColor: pattern.targetColor }
                                                : undefined
                                        }
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <strong className="text-sm">
                                                {pattern.triggerLabel}
                                            </strong>
                                            <span className="text-muted-foreground">→</span>
                                            <span className="text-sm">
                                                {pattern.targetLabel}
                                            </span>
                                            {pattern.autoApply ? (
                                                <Badge variant="secondary">
                                                    Completa solo
                                                </Badge>
                                            ) : null}
                                            {pattern.status === 'forgotten' ? (
                                                <Badge variant="outline">Olvidado</Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                            {pattern.reason}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                                <span>
                                    {QUICK_CAPTURE_TARGET_LABELS[pattern.targetType]}
                                </span>
                                            <span>·</span>
                                            <span>{formatPercent(pattern.consistency)} consistente</span>
                                            <span>·</span>
                                            <span>{pattern.currency}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5 sm:justify-end">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={busyPatternKey === pattern.key}
                                        onClick={() =>
                                            void updatePattern(
                                                pattern,
                                                pattern.status === 'forgotten'
                                                    ? 'restore'
                                                    : 'forget'
                                            )
                                        }
                                    >
                                        {busyPatternKey === pattern.key ? (
                                            <Loader2 className="animate-spin" />
                                        ) : (
                                            <RotateCcw />
                                        )}
                                        {pattern.status === 'forgotten'
                                            ? 'Volver a aprender'
                                            : 'Olvidar'}
                                    </Button>
                                    {pattern.status === 'active' ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openCorrection(pattern)}
                                        >
                                            <WandSparkles />
                                            Corregir
                                        </Button>
                                    ) : null}
                                    {pattern.canConvertToRule &&
                                    pattern.status === 'active' ? (
                                        <Button size="sm" variant="outline" asChild>
                                            <Link href={`/rules?fromLearning=${pattern.key}`}>
                                                Crear regla
                                            </Link>
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <Button
                    variant="destructive"
                    onClick={() => setResetOpen(true)}
                >
                    <RotateCcw />
                    Reiniciar aprendizaje
                </Button>
            </div>

            <Separator />
            <QuickCaptureAliasesSection />

            <Dialog
                open={Boolean(correcting)}
                onOpenChange={(open) => {
                    if (!open) setCorrecting(undefined)
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Corregir interpretación</DialogTitle>
                        <DialogDescription>
                            Finp guardará esta corrección como un atajo explícito,
                            que siempre tendrá prioridad sobre lo aprendido.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>
                            “{correcting?.triggerLabel}” debería ser
                        </Label>
                        {correcting?.targetType === 'account' ||
                        correcting?.targetType === 'category' ? (
                            <Select
                                value={correctionValue}
                                onValueChange={setCorrectionValue}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Elegir" />
                                </SelectTrigger>
                                <SelectContent>
                                    {correctionOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.id}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={correctionValue}
                                onChange={(event) =>
                                    setCorrectionValue(event.target.value)
                                }
                                placeholder="Interpretación correcta"
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCorrecting(undefined)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            disabled={savingCorrection}
                            onClick={() => void saveCorrection()}
                        >
                            {savingCorrection ? (
                                <Loader2 className="animate-spin" />
                            ) : null}
                            Guardar corrección
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ¿Reiniciar el aprendizaje de Finp?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminarán eventos y patrones aprendidos. Tus
                            transacciones, reglas y atajos explícitos no cambian.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={resetting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void resetLearning()}
                        >
                            {resetting ? <Loader2 className="animate-spin" /> : null}
                            Reiniciar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
