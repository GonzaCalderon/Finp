'use client'

import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CommitmentSuggestion } from '@/lib/utils/commitment-suggestions'

interface CommitmentSuggestionCardProps {
    suggestion: CommitmentSuggestion
    onAccept: (suggestion: CommitmentSuggestion) => void
    onDismiss: (suggestion: CommitmentSuggestion) => void
}

export function CommitmentSuggestionCard({
    suggestion,
    onAccept,
    onDismiss,
}: CommitmentSuggestionCardProps) {
    const amount = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: suggestion.currency,
        maximumFractionDigits: 0,
    }).format(suggestion.amount)

    return (
        <article className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                    <Sparkles className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{suggestion.description}</h3>
                        <Badge variant="secondary">
                            {suggestion.amountPolicy === 'fixed'
                                ? 'Monto estable'
                                : 'Monto variable'}
                        </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Finp encontró movimientos similares en{' '}
                        {suggestion.occurrences} meses. Revisá si representan un pago
                        recurrente. Monto sugerido: {amount}.
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {suggestion.evidence.map((evidence) => (
                            <li key={evidence}>• {evidence}</li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => onDismiss(suggestion)}
                >
                    <X className="size-4" />
                    No es un compromiso
                </Button>
                <Button
                    type="button"
                    className="min-h-11"
                    onClick={() => onAccept(suggestion)}
                >
                    Revisar y crear
                </Button>
            </div>
        </article>
    )
}
