import type { Currency } from '@/lib/constants'
import {
    findApplicableCommitments,
    type CommitmentCandidate,
} from '@/lib/server/commitment-matching'
import type {
    CommitmentDraftFields,
    DraftFieldSource,
    FunctionalSuggestion,
} from '@/types/capture-intent'
import type { QuickCaptureDraft } from '@/types/quick-capture'

/**
 * Detección determinista de intención funcional sobre el texto ya interpretado.
 *
 * Sin IA y sin red, igual que el parser. La jerarquía sigue el criterio de
 * producto: una intención explícita ("el 5 de cada mes") nunca se reemplaza por
 * evidencia histórica, y con confianza baja no se interrumpe.
 */

/** Frases que indican explícitamente una recurrencia mensual. */
const MONTHLY_PATTERNS: RegExp[] = [
    /\bcada\s+mes\b/,
    /\btodos\s+los\s+meses\b/,
    /\bpor\s+mes\b/,
    /\bmensual(?:mente)?\b/,
]

const WEEKLY_PATTERNS: RegExp[] = [
    /\bcada\s+semana\b/,
    /\btodas\s+las\s+semanas\b/,
    /\bpor\s+semana\b/,
    /\bsemanal(?:mente)?\b/,
]

/** "el 5 de cada mes", "los 5 de cada mes", "el día 5 de cada mes". */
const DAY_OF_MONTH_PATTERN =
    /\b(?:el|los)\s+(?:d[ií]a\s+)?(\d{1,2})\s+de\s+cada\s+mes\b/

/** Palabras que sugieren un monto que cambia mes a mes. */
const VARIABLE_AMOUNT_PATTERNS: RegExp[] = [
    /\bmonto\s+variable\b/,
    /\bvar[ií]a\b/,
    /\bvariable\b/,
    /\ba\s+confirmar\b/,
]

function normalizeForIntent(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

export interface DetectCaptureIntentsInput {
    text: string
    draft: QuickCaptureDraft
    commitments?: CommitmentCandidate[]
    currentPeriod: string
    /** `subjectKey` de propuestas que el usuario silenció. */
    dismissedSubjects?: string[]
}

interface RecurrenceHint {
    recurrence: 'monthly' | 'weekly'
    dayOfMonth?: number
    amountPolicy: 'fixed' | 'variable'
}

/** Reconoce recurrencia explícita en el texto. Devuelve null si no hay señal. */
export function detectRecurrenceHint(text: string): RecurrenceHint | null {
    const normalized = normalizeForIntent(text)

    const dayMatch = normalized.match(DAY_OF_MONTH_PATTERN)
    const dayOfMonth = dayMatch ? Number(dayMatch[1]) : undefined
    const validDay = dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31 ? dayOfMonth : undefined

    const isWeekly = WEEKLY_PATTERNS.some((pattern) => pattern.test(normalized))
    const isMonthly =
        Boolean(validDay) || MONTHLY_PATTERNS.some((pattern) => pattern.test(normalized))

    if (!isWeekly && !isMonthly) return null

    const amountPolicy = VARIABLE_AMOUNT_PATTERNS.some((pattern) => pattern.test(normalized))
        ? 'variable'
        : 'fixed'

    // Si el texto dice ambas cosas, el día del mes desambigua a mensual.
    if (isWeekly && !validDay && !MONTHLY_PATTERNS.some((p) => p.test(normalized))) {
        return { recurrence: 'weekly', amountPolicy }
    }

    return { recurrence: 'monthly', dayOfMonth: validDay, amountPolicy }
}

/**
 * Quita del texto las frases de recurrencia para que no queden pegadas a la
 * descripción del compromiso ("Alquiler el 5 de cada mes" → "Alquiler").
 */
export function stripRecurrencePhrases(description: string): string {
    let result = description

    for (const pattern of [DAY_OF_MONTH_PATTERN, ...MONTHLY_PATTERNS, ...WEEKLY_PATTERNS, ...VARIABLE_AMOUNT_PATTERNS]) {
        result = result.replace(new RegExp(pattern.source, 'gi'), ' ')
    }

    return result.replace(/\s+/g, ' ').trim()
}

function buildCommitmentDraftFields(
    draft: QuickCaptureDraft,
    hint: RecurrenceHint
): { fields: Partial<CommitmentDraftFields>; provenance: Partial<Record<keyof CommitmentDraftFields, DraftFieldSource>> } {
    const description = stripRecurrencePhrases(draft.description)

    const fields: Partial<CommitmentDraftFields> = {
        recurrence: hint.recurrence,
        amountPolicy: hint.amountPolicy,
        currency: draft.currency,
        startDate: draft.date.toISOString(),
    }
    const provenance: Partial<Record<keyof CommitmentDraftFields, DraftFieldSource>> = {
        recurrence: 'text',
        amountPolicy: hint.amountPolicy === 'variable' ? 'text' : 'default',
        currency: 'default',
        startDate: 'default',
    }

    if (description) {
        fields.description = description
        provenance.description = 'text'
    }
    if (typeof draft.amount === 'number' && draft.amount > 0) {
        fields.amount = draft.amount
        provenance.amount = 'text'
    }
    if (hint.dayOfMonth) {
        fields.dayOfMonth = hint.dayOfMonth
        provenance.dayOfMonth = 'text'
    }
    if (draft.categoryId) {
        fields.categoryId = draft.categoryId
        provenance.categoryId = 'learned'
    }
    if (draft.accountId) {
        fields.accountId = draft.accountId
        provenance.accountId = 'learned'
    }

    return { fields, provenance }
}

/**
 * Devuelve las sugerencias funcionales para el texto actual.
 *
 * Como máximo una: no tiene sentido ofrecer dos derivaciones distintas sobre la
 * misma frase, y la coordinación entre superficies exige no duplicar propuestas.
 */
export function detectCaptureIntents(input: DetectCaptureIntentsInput): FunctionalSuggestion[] {
    const dismissed = new Set(input.dismissedSubjects ?? [])

    // 1. Intención explícita de recurrencia: prepara un compromiso nuevo.
    const hint = detectRecurrenceHint(input.text)
    if (hint) {
        const subjectKey = `create_commitment:${normalizeForIntent(
            stripRecurrencePhrases(input.draft.description)
        )}`

        if (!dismissed.has(subjectKey)) {
            const { fields, provenance } = buildCommitmentDraftFields(input.draft, hint)

            return [
                {
                    id: subjectKey,
                    intent: 'create_commitment',
                    subjectKey,
                    title:
                        hint.recurrence === 'weekly'
                            ? 'Esto parece un compromiso semanal.'
                            : 'Esto parece un compromiso mensual.',
                    reason: buildCreateReason(fields, hint),
                    evidence: [],
                    confidence: 0.9,
                    destination: { kind: 'route', href: '/commitments' },
                    draftFields: fields,
                    draftProvenance: provenance,
                    actions: [
                        { id: 'primary', label: 'Configurar compromiso' },
                        { id: 'record_simple', label: 'Registrar sólo este gasto' },
                        { id: 'dismiss', label: 'Ahora no' },
                    ],
                    state: 'shown',
                },
            ]
        }
    }

    // 2. Sin intención explícita: ¿coincide con una aplicación pendiente?
    const matches = findApplicableCommitments(input.commitments ?? [], {
        type: input.draft.type,
        description: input.draft.description,
        merchant: input.draft.merchant,
        currency: input.draft.currency,
    })

    const best = matches[0]
    if (!best) return []

    const subjectKey = `apply_commitment:${best.candidate.commitmentId}:${best.candidate.period}`
    if (dismissed.has(subjectKey)) return []

    return [
        {
            id: subjectKey,
            intent: 'apply_commitment',
            subjectKey,
            title: `Encontramos “${best.candidate.description}” pendiente.`,
            reason: best.reason,
            evidence: [`Período ${best.candidate.period}`],
            confidence: best.score,
            destination: { kind: 'inline' },
            actions: [
                { id: 'primary', label: 'Aplicar compromiso' },
                { id: 'record_simple', label: 'Registrar aparte' },
                { id: 'dismiss', label: 'Ahora no' },
            ],
            state: 'shown',
            commitment: {
                commitmentId: best.candidate.commitmentId,
                description: best.candidate.description,
                period: best.candidate.period,
                currency: best.candidate.currency as Currency,
                resolvedAmount: best.candidate.resolvedAmount,
                amountPolicy: best.candidate.amountPolicy,
                accountId: best.candidate.accountId,
                categoryId: best.candidate.categoryId,
            },
        },
    ]
}

function buildCreateReason(
    fields: Partial<CommitmentDraftFields>,
    hint: RecurrenceHint
): string {
    const parts: string[] = []

    if (fields.description) parts.push(`“${fields.description}”`)
    if (typeof fields.amount === 'number') {
        parts.push(
            new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: fields.currency ?? 'ARS',
                maximumFractionDigits: 0,
            }).format(fields.amount)
        )
    }
    if (hint.dayOfMonth) parts.push(`con vencimiento el día ${hint.dayOfMonth}`)
    if (hint.amountPolicy === 'variable') parts.push('con monto a confirmar')

    if (parts.length === 0) return 'Preparamos un compromiso para que lo configures.'

    return `Preparamos ${parts.join(', ')}.`
}
