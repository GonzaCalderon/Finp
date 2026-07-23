'use client'

import { AlertTriangle, ArrowRight, Copy, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
    DescriptionTextSuggestion,
    DuplicateTransactionWarning,
    SimilarTransactionSuggestion,
} from '@/lib/utils/transaction-description-intelligence'

interface SmartDescriptionInputProps {
    id: string
    value: string
    placeholder: string
    error?: string
    className?: string
    textSuggestion?: DescriptionTextSuggestion
    similarTransaction?: SimilarTransactionSuggestion
    duplicate?: DuplicateTransactionWarning
    onChange: (value: string) => void
    onAcceptSuggestion: (suggestion: DescriptionTextSuggestion) => void
    onApplySimilarTransaction: (suggestion: SimilarTransactionSuggestion) => void
}

function suggestionLabel(suggestion: DescriptionTextSuggestion) {
    if (suggestion.kind === 'completion') return 'Completar'
    if (suggestion.kind === 'normalization') return 'Ordenar texto'
    return '¿Quisiste decir?'
}

export function SmartDescriptionInput({
    id,
    value,
    placeholder,
    error,
    className,
    textSuggestion,
    similarTransaction,
    duplicate,
    onChange,
    onAcceptSuggestion,
    onApplySimilarTransaction,
}: SmartDescriptionInputProps) {
    return (
        <div className="space-y-2">
            <Input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-invalid={Boolean(error)}
                className={className}
                autoComplete="off"
            />

            <div className="space-y-2" aria-live="polite">
                {textSuggestion && textSuggestion.value !== value && (
                    <button
                        type="button"
                        onClick={() => onAcceptSuggestion(textSuggestion)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60"
                        style={{ borderColor: 'color-mix(in srgb, var(--sky) 34%, var(--border))' }}
                    >
                        <span className="min-w-0">
                            <span className="mr-1.5 font-semibold text-foreground">
                                {suggestionLabel(textSuggestion)}
                            </span>
                            <span className="text-muted-foreground">“{textSuggestion.value}”</span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                )}

                {!duplicate && similarTransaction && (
                    <div
                        className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                        style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--card) 72%, transparent)' }}
                    >
                        <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-xs font-medium">
                                <Sparkles className="h-3.5 w-3.5 text-[var(--sky)]" />
                                Movimiento parecido
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {similarTransaction.description}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 rounded-lg px-2.5 text-xs"
                            onClick={() => onApplySimilarTransaction(similarTransaction)}
                        >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Usar datos
                        </Button>
                    </div>
                )}

                {duplicate && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <div>
                            <p className="font-medium text-foreground">Posible movimiento duplicado</p>
                            <p className="text-muted-foreground">
                                Ya registraste “{duplicate.description}” por el mismo monto cerca de esta fecha.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    )
}
