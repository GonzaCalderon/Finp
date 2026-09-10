'use client'

import { AlertTriangle, CalendarRange, Coins, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/shared/ErrorState'
import {
    SpaceAmountInline,
    SpaceEntryTypeBadge,
    SpaceMetaBadge,
} from '@/components/spaces/SpaceUi'
import {
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import type { SpaceEntryPreviewDto } from '@/types'

/**
 * Paso «Revisión»: resumen del movimiento y revisión financiera del servidor.
 *
 * La revisión distingue los cuatro estados de `espacios.md` §11 —
 * `calculando`, `disponible`, `incompleta` y `error`— y sólo el último
 * comunica un fallo. El monto nunca se abrevia acá (`design.md` §9).
 */
export function SpaceEntryReviewStep({
    entryType,
    amount,
    currency,
    reportingCurrency,
    formattedDate,
    payerName,
    personalIntentSummary,
    preview,
    previewLoading,
    previewError,
    showFinancialReview,
    onPreviewRetry,
    onSaveDraftAndClose,
    saveDraftDisabled,
    saveDraftBusy,
}: {
    entryType: React.ComponentProps<typeof SpaceEntryTypeBadge>['type']
    amount: number
    currency: string
    reportingCurrency: string
    formattedDate: string
    payerName?: string
    /** Cuál de las tres opciones de Mi Finp se confirma, con las mismas palabras del paso Extras. */
    personalIntentSummary?: string
    preview: SpaceEntryPreviewDto | null
    previewLoading: boolean
    previewError: string | null
    /** La edición legacy no tiene revisión financiera del servidor que mostrar. */
    showFinancialReview: boolean
    onPreviewRetry: () => void
    onSaveDraftAndClose?: () => void
    saveDraftDisabled?: boolean
    saveDraftBusy?: boolean
}) {
    return (
        <div className="space-y-5">
            <SpaceDialogPanel>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <SpaceDialogSectionEyebrow>Resumen</SpaceDialogSectionEyebrow>
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                            Vista rápida antes de guardar
                        </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <SpaceEntryTypeBadge type={entryType} />
                        <SpaceMetaBadge icon={Coins}>
                            {currency} · reporte en {reportingCurrency}
                        </SpaceMetaBadge>
                        <SpaceMetaBadge icon={CalendarRange}>{formattedDate}</SpaceMetaBadge>
                    </div>

                    <div className="rounded-[24px] border border-foreground/[0.07] bg-background/72 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Monto
                        </p>
                        <SpaceAmountInline
                            amount={Number.isFinite(amount) ? amount : 0}
                            currency={currency}
                            hidden={false}
                            className="mt-2 text-2xl font-semibold"
                            exact
                        />
                        <p className="mt-2 text-sm text-muted-foreground">
                            {payerName ? `Lo registra ${payerName}.` : 'Todavía falta elegir quién paga.'}
                        </p>
                        {personalIntentSummary ? (
                            <p className="mt-1 text-sm text-muted-foreground">{personalIntentSummary}</p>
                        ) : null}
                    </div>
                </div>
            </SpaceDialogPanel>

            {showFinancialReview ? (
            <SpaceDialogPanel>
                <div className="space-y-4" aria-live="polite">
                    <div>
                        <SpaceDialogSectionEyebrow>Revisión financiera</SpaceDialogSectionEyebrow>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                            Qué cambia al confirmar
                        </h3>
                    </div>
                    {previewLoading ? (
                        <p className="text-sm text-muted-foreground">Calculando con las reglas del Espacio…</p>
                    ) : preview ? (
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                            {([
                                ['Total', preview.totalAmount],
                                ['Tu parte', preview.ownShareAmount],
                                ['Impacto real de cuenta', preview.accountImpactAmount],
                                ['Gasto operacional', preview.operationalAmount],
                                ['Adelanto recuperable', preview.recoverableAdvanceAmount],
                                ['Cambio en deuda', preview.debtDeltaReporting],
                            ] as const).map(([label, value]) => (
                                <div
                                    key={label}
                                    className="rounded-xl border border-foreground/[0.07] bg-background/70 p-3"
                                >
                                    <dt className="text-xs text-muted-foreground">{label}</dt>
                                    <dd className="mt-1 font-semibold">
                                        <SpaceAmountInline
                                            amount={value}
                                            currency={
                                                label === 'Cambio en deuda'
                                                    ? preview.reportingCurrency
                                                    : preview.currency
                                            }
                                            hidden={false}
                                            exact
                                        />
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    ) : previewError ? (
                        <div className="rounded-xl border border-destructive/15 bg-destructive/5">
                            <ErrorState
                                icon={AlertTriangle}
                                title="No pudimos calcular la revisión"
                                description={previewError}
                                onRetry={onPreviewRetry}
                            />
                        </div>
                    ) : (
                        <p className="rounded-xl border border-foreground/[0.07] bg-muted/35 p-3 text-sm text-muted-foreground">
                            Completá monto, pagador y reparto para calcular la revisión.
                        </p>
                    )}
                </div>
            </SpaceDialogPanel>
            ) : null}

            {onSaveDraftAndClose ? (
                <SpaceDialogPanel>
                    <div className="space-y-3">
                        <SpaceDialogSectionEyebrow>Borrador</SpaceDialogSectionEyebrow>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start rounded-full text-muted-foreground"
                            onClick={onSaveDraftAndClose}
                            disabled={saveDraftDisabled}
                        >
                            {saveDraftBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Guardar borrador y cerrar
                        </Button>
                    </div>
                </SpaceDialogPanel>
            ) : null}
        </div>
    )
}
