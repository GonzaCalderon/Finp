import type { Currency } from '@/lib/constants'
import type { CommitmentApplicationState } from '@/lib/constants'
import { normalizeRuleText } from '@/lib/utils/rules'
import { getTextSimilarity } from '@/lib/utils/category-ranking'

/**
 * Matching entre lo que el usuario escribió y los compromisos con aplicación
 * pendiente.
 *
 * Reutiliza `normalizeRuleText` — la misma normalización del motor de reglas —
 * para no introducir un segundo criterio que pueda divergir, y el umbral de
 * similitud de 0.72 que ya usa la detección de duplicados.
 */

/** Estados en los que todavía tiene sentido ofrecer aplicar el compromiso. */
const APPLICABLE_STATES: ReadonlySet<CommitmentApplicationState> = new Set([
    'ready',
    'awaiting_amount',
])

const SIMILARITY_THRESHOLD = 0.72

export interface CommitmentCandidate {
    commitmentId: string
    description: string
    normalizedDescription?: string
    aliases?: string[]
    period: string
    currency: Currency
    resolvedAmount: number
    amountPolicy: 'fixed' | 'variable'
    accountId?: string
    categoryId?: string
    state: CommitmentApplicationState
}

export interface CommitmentMatchContext {
    type: 'expense' | 'income'
    description: string
    merchant?: string
    currency: Currency
}

export type CommitmentMatchKind = 'description' | 'alias' | 'merchant' | 'partial' | 'similarity'

export interface CommitmentMatch {
    candidate: CommitmentCandidate
    score: number
    matchedOn: CommitmentMatchKind
    reason: string
}

function normalizedOf(candidate: CommitmentCandidate): string {
    return candidate.normalizedDescription || normalizeRuleText(candidate.description)
}

function scoreCandidate(
    candidate: CommitmentCandidate,
    normalizedDescription: string,
    normalizedMerchant: string
): { score: number; matchedOn: CommitmentMatchKind } | null {
    const target = normalizedOf(candidate)
    if (!target) return null

    if (normalizedDescription && normalizedDescription === target) {
        return { score: 1, matchedOn: 'description' }
    }

    const aliases = (candidate.aliases ?? []).filter(Boolean)
    if (normalizedDescription && aliases.includes(normalizedDescription)) {
        return { score: 0.95, matchedOn: 'alias' }
    }

    if (normalizedMerchant && (normalizedMerchant === target || aliases.includes(normalizedMerchant))) {
        return { score: 0.9, matchedOn: 'merchant' }
    }

    // "pague alquiler" contra "alquiler": el texto libre suele traer un verbo.
    if (
        normalizedDescription &&
        target.length >= 4 &&
        (normalizedDescription.includes(target) || target.includes(normalizedDescription))
    ) {
        return { score: 0.85, matchedOn: 'partial' }
    }

    const similarity = Math.max(
        normalizedDescription ? getTextSimilarity(normalizedDescription, target) : 0,
        normalizedMerchant ? getTextSimilarity(normalizedMerchant, target) : 0
    )

    if (similarity >= SIMILARITY_THRESHOLD) {
        return { score: similarity * 0.8, matchedOn: 'similarity' }
    }

    return null
}

function buildReason(candidate: CommitmentCandidate, matchedOn: CommitmentMatchKind): string {
    const base = `“${candidate.description}” tiene ${
        candidate.state === 'awaiting_amount' ? 'un monto pendiente' : 'una aplicación pendiente'
    }`

    switch (matchedOn) {
        case 'description':
            return `${base} y la descripción coincide.`
        case 'alias':
            return `${base} y reconocimos esa forma de nombrarlo.`
        case 'merchant':
            return `${base} y el comercio coincide.`
        case 'partial':
            return `${base} y tu texto lo menciona.`
        default:
            return `${base} y se parece a lo que escribiste.`
    }
}

/**
 * Devuelve los compromisos aplicables ordenados por confianza.
 *
 * Nunca aplica nada: sólo propone. Descarta por moneda, tipo y estado antes de
 * mirar el texto, para no confundir una transacción parecida con una aplicación
 * pendiente de otra moneda o ya registrada.
 */
export function findApplicableCommitments(
    candidates: CommitmentCandidate[],
    context: CommitmentMatchContext,
    options: { limit?: number } = {}
): CommitmentMatch[] {
    // Los compromisos generan gastos: un ingreso nunca aplica uno.
    if (context.type !== 'expense') return []

    const normalizedDescription = normalizeRuleText(context.description)
    const normalizedMerchant = normalizeRuleText(context.merchant ?? '')
    if (!normalizedDescription && !normalizedMerchant) return []

    const matches: CommitmentMatch[] = []

    for (const candidate of candidates) {
        if (candidate.currency !== context.currency) continue
        if (!APPLICABLE_STATES.has(candidate.state)) continue

        const scored = scoreCandidate(candidate, normalizedDescription, normalizedMerchant)
        if (!scored) continue

        matches.push({
            candidate,
            score: scored.score,
            matchedOn: scored.matchedOn,
            reason: buildReason(candidate, scored.matchedOn),
        })
    }

    return matches
        .sort((a, b) => b.score - a.score || a.candidate.description.localeCompare(b.candidate.description))
        .slice(0, options.limit ?? 3)
}
