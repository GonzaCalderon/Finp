import type { Currency } from '@/lib/constants'
import {
    findApplicableCommitments,
    type CommitmentCandidate,
} from '@/lib/server/commitment-matching'
import type {
    CardPurchaseDraftFields,
    CommitmentDraftFields,
    DraftFieldSource,
    FunctionalSuggestion,
} from '@/types/capture-intent'
import type { QuickCaptureDraft } from '@/types/quick-capture'
import type { CommitmentSuggestion } from '@/lib/utils/commitment-suggestions'
import { normalizeRuleText } from '@/lib/utils/rules'
import { getDefaultFirstClosingMonth } from '@/lib/utils/installments'

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

export interface CaptureCreditCardAccount {
    id: string
    name: string
    currencies: Currency[]
    isActive?: boolean
}

export interface DetectCaptureIntentsInput {
    text: string
    draft: QuickCaptureDraft
    commitments?: CommitmentCandidate[]
    currentPeriod?: string
    learnedCommitmentCandidates?: CommitmentSuggestion[]
    creditCards?: CaptureCreditCardAccount[]
    selectedCardAccountId?: string
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

const CARD_GENERIC_PATTERN =
    /\b(?:tarjeta|credito|crediticia|visa|mastercard|master|amex|american express)\b/
const CARD_PAYMENT_PATTERN =
    /\b(?:pague|pago|abone|cancele)\b.{0,50}\b(?:resumen|tarjeta)\b|\b(?:pago|abono|cancelacion)\s+(?:del?\s+)?resumen\b/
const CARD_SUMMARY_PATTERN = /\bresumen\b/
const EXISTING_INSTALLMENT_PATTERN = /\bcuota\s+(\d+)\s*(?:de|\/)\s*(\d+)\b/
const NEW_INSTALLMENT_PATTERN = /\b(?:en\s+)?(\d+)\s+cuotas?\b/
const ONE_PAYMENT_PATTERN = /\b(?:en\s+)?(?:un|1)\s+(?:pago|cuota)\b/

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function accountMatchScore(text: string, accountName: string): number {
    const normalizedName = normalizeForIntent(accountName)
    if (!normalizedName) return 0
    if (text.includes(normalizedName)) return 100 + normalizedName.length

    const ignored = new Set(['tarjeta', 'credito', 'crediticia', 'banco', 'the'])
    return normalizedName
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3 && !ignored.has(token))
        .reduce(
            (score, token) =>
                score + (new RegExp(`\\b${token}\\b`).test(text) ? 1 : 0),
            0
        )
}

function resolveCardAccounts(
    text: string,
    currency: Currency,
    accounts: CaptureCreditCardAccount[],
    selectedCardAccountId?: string
) {
    const compatible = accounts.filter(
        (account) =>
            account.isActive !== false &&
            account.currencies.includes(currency)
    )
    const selected = compatible.find((account) => account.id === selectedCardAccountId)
    if (selected) {
        return {
            accountId: selected.id,
            candidateAccountIds: compatible.map((account) => account.id),
            hasNamedCard: true,
        }
    }

    const scored = compatible
        .map((account) => ({ account, score: accountMatchScore(text, account.name) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
    const bestScore = scored[0]?.score ?? 0
    const best = scored.filter((entry) => entry.score === bestScore)

    return {
        accountId: best.length === 1 ? best[0].account.id : undefined,
        candidateAccountIds:
            scored.length > 0
                ? scored.map((entry) => entry.account.id)
                : compatible.map((account) => account.id),
        hasNamedCard: scored.length > 0,
    }
}

function stripCardPhrases(description: string, cardNames: string[]): string {
    let result = normalizeWhitespace(description)
        .replace(EXISTING_INSTALLMENT_PATTERN, ' ')
        .replace(NEW_INSTALLMENT_PATTERN, ' ')
        .replace(ONE_PAYMENT_PATTERN, ' ')
        .replace(/\b(?:con|en|por)\s+(?:la\s+)?tarjeta\b/gi, ' ')
        .replace(/\b(?:tarjeta|credito|crediticia|visa|mastercard|master|amex)\b/gi, ' ')

    for (const cardName of [...cardNames].sort((left, right) => right.length - left.length)) {
        if (!cardName.trim()) continue
        const escaped = cardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ')
    }

    return normalizeWhitespace(result)
}

function buildCardSuggestion(input: DetectCaptureIntentsInput): FunctionalSuggestion | null {
    const normalized = normalizeForIntent(input.text)
    const existingInstallment = normalized.match(EXISTING_INSTALLMENT_PATTERN)
    const newInstallment = normalized.match(NEW_INSTALLMENT_PATTERN)
    const hasOnePayment = ONE_PAYMENT_PATTERN.test(normalized)
    const cards = input.creditCards ?? []
    const resolved = resolveCardAccounts(
        normalized,
        input.draft.currency,
        cards,
        input.selectedCardAccountId
    )
    const hasCardSignal =
        CARD_GENERIC_PATTERN.test(normalized) ||
        resolved.hasNamedCard ||
        Boolean(newInstallment) ||
        Boolean(existingInstallment)
    const isPayment =
        CARD_PAYMENT_PATTERN.test(normalized) ||
        (CARD_SUMMARY_PATTERN.test(normalized) && resolved.hasNamedCard)

    if (existingInstallment) {
        const current = Number(existingInstallment[1])
        const total = Number(existingInstallment[2])
        if (current < 1 || total < 1 || current > total) return null
        return {
            id: `review_installment:${current}:${total}`,
            intent: 'use_installments',
            subjectKey: `review_installment:${current}:${total}`,
            title: `Esto parece la cuota ${current} de ${total}.`,
            reason: 'Revisala en Tarjetas para no crear un segundo plan por la misma compra.',
            evidence: [],
            confidence: 0.98,
            destination: { kind: 'route', href: '/transactions/credit-card' },
            draft: {
                kind: 'card_review',
                fields: { href: '/transactions/credit-card' },
                provenance: {},
            },
            actions: [{ id: 'primary', label: 'Revisar en Tarjetas' }],
            state: 'shown',
            canPersistDismissal: false,
            card: {
                operation: 'existing_installment',
                candidateAccountIds: resolved.candidateAccountIds,
                accountId: resolved.accountId,
            },
        }
    }

    if (isPayment) {
        return {
            id: `card_payment:${resolved.accountId ?? 'select'}`,
            intent: 'record_transaction',
            subjectKey: `card_payment:${resolved.accountId ?? 'select'}`,
            title: 'Esto parece un pago de tarjeta.',
            reason: resolved.accountId
                ? 'Abriremos el pago completo para que elijas la cuenta de origen.'
                : 'Elegí qué tarjeta pagaste; después confirmaremos la cuenta de origen.',
            evidence: [],
            confidence: resolved.accountId ? 0.98 : 0.9,
            destination: { kind: 'route', href: '/transactions' },
            draft: {
                kind: 'card_payment',
                fields: {
                    type: 'credit_card_payment',
                    amount: input.draft.amount,
                    currency: input.draft.currency,
                    date: input.draft.date.toISOString(),
                    description: 'Pago de tarjeta',
                    destinationAccountId: resolved.accountId,
                },
                provenance: {
                    type: 'text',
                    amount: 'text',
                    currency: 'text',
                    date: 'text',
                    description: 'default',
                    destinationAccountId: resolved.accountId ? 'alias' : 'default',
                },
            },
            actions: [{ id: 'primary', label: 'Completar pago' }],
            state: 'shown',
            canPersistDismissal: false,
            card: {
                operation: 'payment',
                candidateAccountIds: resolved.candidateAccountIds,
                accountId: resolved.accountId,
            },
        }
    }

    if (!hasCardSignal || input.draft.type !== 'expense') return null

    const installmentCount = newInstallment ? Number(newInstallment[1]) : 1
    if (!Number.isInteger(installmentCount) || installmentCount < 1) return null

    const cardNames = cards
        .filter((card) => resolved.candidateAccountIds.includes(card.id))
        .map((card) => card.name)
    const description =
        stripCardPhrases(input.draft.description, cardNames) ||
        input.draft.merchant ||
        'Compra con tarjeta'
    const firstClosingMonth = getDefaultFirstClosingMonth(input.draft.date)
    const fields: Partial<CardPurchaseDraftFields> = {
        type: 'credit_card_expense',
        amount: input.draft.amount,
        currency: input.draft.currency,
        date: input.draft.date.toISOString(),
        description,
        categoryId: input.draft.categoryId,
        merchant: input.draft.merchant,
        cardAccountId: resolved.accountId,
        installmentCount,
        firstClosingMonth,
    }
    const isMultiple = installmentCount > 1

    return {
        id: `card_purchase:${installmentCount}:${resolved.accountId ?? 'select'}`,
        intent: 'use_installments',
        subjectKey: `card_purchase:${installmentCount}:${resolved.accountId ?? 'select'}`,
        title: isMultiple
            ? `Esto parece una compra en ${installmentCount} cuotas.`
            : 'Esto parece una compra con tarjeta.',
        reason: resolved.accountId
            ? isMultiple
                ? 'Conservaremos lo interpretado y confirmarás el plan completo.'
                : 'Revisá el mes de impacto antes de registrar.'
            : 'Elegí la tarjeta para continuar sin registrarlo como un gasto simple.',
        evidence: [],
        confidence: resolved.accountId ? 0.97 : 0.88,
        destination: isMultiple
            ? { kind: 'route', href: '/transactions' }
            : { kind: 'inline' },
        draft: {
            kind: 'card_purchase',
            fields,
            provenance: {
                type: 'text',
                amount: 'text',
                currency: 'text',
                date: 'text',
                description: 'text',
                categoryId: input.draft.categoryId ? 'learned' : 'default',
                merchant: input.draft.merchant ? 'text' : 'default',
                cardAccountId: resolved.accountId ? 'alias' : 'default',
                installmentCount: newInstallment || hasOnePayment ? 'text' : 'default',
                firstClosingMonth: 'default',
            },
        },
        actions: [{
            id: 'primary',
            label: isMultiple ? 'Revisar plan' : 'Registrar compra',
        }],
        state: 'shown',
        canPersistDismissal: false,
        card: {
            operation: 'purchase',
            candidateAccountIds: resolved.candidateAccountIds,
            accountId: resolved.accountId,
            installmentCount,
            firstClosingMonth,
        },
    }
}

function buildLearnedCommitmentSuggestion(
    draft: QuickCaptureDraft,
    candidates: CommitmentSuggestion[],
    dismissed: Set<string>
): FunctionalSuggestion | null {
    const description = normalizeRuleText(
        [draft.merchant, draft.description].filter(Boolean).join(' ')
    )
    if (description.length < 3) return null

    const ranked = candidates
        .filter((candidate) => candidate.currency === draft.currency)
        .filter((candidate) => !dismissed.has(candidate.subjectKey))
        .map((candidate) => {
            const subject = normalizeRuleText(candidate.description)
            const score =
                description === subject
                    ? 1
                    : subject.length >= 4 &&
                        (description.includes(subject) || subject.includes(description))
                        ? 0.9
                        : 0
            return { candidate, score }
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
    if (!ranked[0] || ranked[1]?.score === ranked[0].score) return null

    const candidate = ranked[0].candidate
    const fields: Partial<CommitmentDraftFields> = {
        description: candidate.description,
        amount: candidate.amount,
        currency: candidate.currency,
        recurrence: 'monthly',
        dayOfMonth: candidate.dayOfMonth,
        accountId: candidate.accountId,
        categoryId: candidate.categoryId,
        amountPolicy: candidate.amountPolicy,
        startDate: draft.date.toISOString(),
    }
    const provenance: Partial<Record<keyof CommitmentDraftFields, DraftFieldSource>> = {
        description: 'learned',
        amount: 'learned',
        currency: 'learned',
        recurrence: 'learned',
        dayOfMonth: 'learned',
        accountId: candidate.accountId ? 'learned' : 'default',
        categoryId: candidate.categoryId ? 'learned' : 'default',
        amountPolicy: 'learned',
        startDate: 'default',
    }

    return {
        id: candidate.subjectKey,
        intent: 'create_commitment',
        subjectKey: candidate.subjectKey,
        title: 'Esto se repite todos los meses.',
        reason: `Encontramos ${candidate.occurrences} meses con un patrón consistente.`,
        evidence: candidate.evidence,
        confidence: candidate.confidence,
        destination: { kind: 'route', href: '/commitments' },
        draft: { kind: 'commitment', fields, provenance },
        draftFields: fields,
        draftProvenance: provenance,
        actions: [
            { id: 'primary', label: 'Crear compromiso' },
            { id: 'record_simple', label: 'Registrar sólo este gasto' },
            { id: 'dismiss', label: 'Ahora no' },
        ],
        state: 'shown',
    }
}

/**
 * Devuelve las sugerencias funcionales para el texto actual.
 *
 * Como máximo una: no tiene sentido ofrecer dos derivaciones distintas sobre la
 * misma frase, y la coordinación entre superficies exige no duplicar propuestas.
 */
export function detectCaptureIntents(input: DetectCaptureIntentsInput): FunctionalSuggestion[] {
    const dismissed = new Set(input.dismissedSubjects ?? [])

    // Una operación de tarjeta es una clasificación financiera, no una
    // recomendación opcional: nunca debe caer en el alta simple por descarte.
    const cardSuggestion = buildCardSuggestion(input)
    if (cardSuggestion) return [cardSuggestion]

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
                    draft: { kind: 'commitment', fields, provenance },
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
    if (!best) {
        const learned = buildLearnedCommitmentSuggestion(
            input.draft,
            input.learnedCommitmentCandidates ?? [],
            dismissed
        )
        return learned ? [learned] : []
    }

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
