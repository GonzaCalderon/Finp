'use client'

import { ArrowRight, Lightbulb, Store, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import type { TransactionRuleSuggestion } from '@/lib/utils/rule-suggestions'
import type { ICategory } from '@/types'

export function RuleSuggestionCard({
    suggestion,
    category,
    onReview,
    onDismiss,
}: {
    suggestion: TransactionRuleSuggestion
    category?: ICategory
    onReview: (suggestion: TransactionRuleSuggestion) => void
    onDismiss: (suggestion: TransactionRuleSuggestion) => void
}) {
    const confidence = Math.round(suggestion.confidence * 100)

    return (
        <Card className="min-w-0 gap-0 py-0">
            <CardHeader className="border-b border-foreground/[0.06] py-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--sky)_12%,transparent)] text-[var(--sky-dark)]">
                        <Lightbulb className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="truncate">
                            Automatizar “{suggestion.value}”
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Basada en {suggestion.occurrences} movimientos
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3 py-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {suggestion.reason}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">
                        {confidence}% de confianza
                    </Badge>
                    {category ? (
                        <Badge variant="outline" className="gap-1.5 rounded-full">
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: category.color || 'var(--sky)' }}
                            />
                            {category.name}
                        </Badge>
                    ) : null}
                    {suggestion.field === 'merchant' ? (
                        <Badge variant="outline" className="gap-1 rounded-full">
                            <Store className="h-3 w-3" />
                            Comercio
                        </Badge>
                    ) : null}
                </div>

                {suggestion.examples[0] ? (
                    <p className="truncate rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        Ejemplo: {suggestion.examples[0]}
                    </p>
                ) : null}
            </CardContent>

            <CardFooter className="justify-between gap-2 border-t border-foreground/[0.06] bg-muted/25 px-4 py-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => onDismiss(suggestion)}
                >
                    <X className="h-3.5 w-3.5" />
                    Descartar
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onReview(suggestion)}
                >
                    Revisar
                    <ArrowRight className="h-3.5 w-3.5" />
                </Button>
            </CardFooter>
        </Card>
    )
}
