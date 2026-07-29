'use client'

import { CalendarClock, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/shared/Spinner'
import type { FunctionalSuggestion, FunctionalSuggestionActionId } from '@/types/capture-intent'

interface CaptureOrientationCardProps {
    suggestion: FunctionalSuggestion
    busy?: boolean
    error?: string | null
    /**
     * Importe y cuenta con los que realmente se va a aplicar. Puede diferir del
     * monto vigente del compromiso si el usuario escribió otro, y la tarjeta debe
     * anunciar lo que va a pasar, no lo que estaba previsto.
     */
    effectiveAmount?: number
    accountName?: string
    onAction: (actionId: FunctionalSuggestionActionId) => void
}

const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount)

/**
 * Propuesta de orientación: explica qué entendió Finp, por qué recomienda una
 * función y qué datos va a llevar.
 *
 * Nunca ejecuta nada por sí sola. Las recomendaciones ofrecen una salida simple;
 * las clasificaciones financieras (por ejemplo, tarjeta) no pueden degradarse a
 * un tipo incorrecto ni silenciarse de forma persistente.
 */
export function CaptureOrientationCard({
    suggestion,
    busy = false,
    error = null,
    effectiveAmount,
    accountName,
    onAction,
}: CaptureOrientationCardProps) {
    const isApply = suggestion.intent === 'apply_commitment'
    const Icon = isApply ? CalendarClock : Wand2
    const amountToShow = effectiveAmount ?? suggestion.commitment?.resolvedAmount
    const differsFromTemplate =
        typeof effectiveAmount === 'number' &&
        suggestion.commitment &&
        effectiveAmount !== suggestion.commitment.resolvedAmount

    return (
        <div
            data-testid="capture-orientation"
            data-intent={suggestion.intent}
            className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-3"
        >
            <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.reason}</p>

                    {isApply && suggestion.commitment && typeof amountToShow === 'number' && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                            Vas a confirmarlo por{' '}
                            <strong className="font-medium text-foreground">
                                {formatAmount(amountToShow, suggestion.commitment.currency)}
                            </strong>
                            {accountName && <span> desde {accountName}</span>}
                            {differsFromTemplate && (
                                <span>
                                    {' '}
                                    · el compromiso preveía{' '}
                                    {formatAmount(
                                        suggestion.commitment.resolvedAmount,
                                        suggestion.commitment.currency
                                    )}
                                </span>
                            )}
                            {suggestion.commitment.amountPolicy === 'variable' && (
                                <span> · monto variable, revisá el importe</span>
                            )}
                        </p>
                    )}

                    {suggestion.evidence.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                            {suggestion.evidence.join(' · ')}
                        </p>
                    )}

                    {error && (
                        <p role="alert" className="mt-1.5 text-xs text-destructive">
                            {error}
                        </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {suggestion.actions.map((action) => (
                            <Button
                                key={action.id}
                                type="button"
                                size="sm"
                                variant={action.id === 'primary' ? 'default' : 'outline'}
                                disabled={busy}
                                onClick={() => onAction(action.id)}
                            >
                                {busy && action.id === 'primary' ? <Spinner /> : action.label}
                            </Button>
                        ))}
                        {suggestion.canPersistDismissal !== false ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                className="text-muted-foreground"
                                onClick={() => onAction('never')}
                            >
                                No volver a sugerir
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
