import type { ITransactionRule } from '@/types'

export interface RuleMatchContext {
    type: 'expense' | 'income' | string
    description?: string
    merchant?: string
}

export interface RuleMatchResult {
    matched: boolean
    rule: ITransactionRule | null
    match?: {
        field: ITransactionRule['field']
        condition: ITransactionRule['condition']
        value: string
        normalizedFieldValue: string
        normalizedRuleValue: string
    }
}

const VARIABLE_REFERENCE_PATTERN =
    /\b(?:ref(?:erencia)?|operacion|op|comprobante|nro|numero|id)\s*[:#-]?\s*[a-z0-9-]+\b/g
const LONG_MIXED_REFERENCE_PATTERN = /\b(?=[a-z0-9]*\d)[a-z0-9]{10,}\b/g
const LEADING_OPERATION_PATTERN =
    /^(?:compra|pago|debito|consumo|transferencia)(?:\s+(?:de|en|a))?\s+/

/**
 * Produces the canonical text used by every rule entry point.
 * It intentionally removes presentation noise and variable banking references,
 * but keeps ordinary words and short numbers that may be meaningful to a rule.
 */
export function normalizeRuleText(value: string): string {
    let normalized = value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLocaleLowerCase('es-AR')
        .replace(VARIABLE_REFERENCE_PATTERN, ' ')
        .replace(LONG_MIXED_REFERENCE_PATTERN, ' ')
        .replace(/[\p{P}\p{S}_]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    // Bank descriptions often prepend the operation kind. Strip it only when
    // another meaningful token remains, so a rule for the word itself still works.
    while (LEADING_OPERATION_PATTERN.test(normalized)) {
        normalized = normalized.replace(LEADING_OPERATION_PATTERN, '').trim()
    }

    return normalized
}

function evaluateCondition(
    field: string,
    condition: ITransactionRule['condition'],
    ruleValue: string
): boolean {
    const normalized = normalizeRuleText(field)
    const target = normalizeRuleText(ruleValue)

    if (!normalized || !target) return false

    switch (condition) {
        case 'contains':
            return normalized.includes(target)
        case 'equals':
            return normalized === target
        case 'starts_with':
            return normalized.startsWith(target)
        default:
            return false
    }
}

/**
 * Evaluates a list of rules (ordered by priority desc) against a transaction context.
 * Returns the first matching rule, or null if none match.
 */
export function evaluateRules(
    rules: ITransactionRule[],
    context: RuleMatchContext
): RuleMatchResult {
    const orderedRules = rules
        .map((rule, index) => ({ rule, index }))
        .sort((left, right) => right.rule.priority - left.rule.priority || left.index - right.index)

    for (const { rule } of orderedRules) {
        if (!rule.isActive) continue

        // Check if the rule applies to this transaction type
        if (rule.appliesTo !== 'any') {
            if (rule.appliesTo !== context.type) continue
        }

        // Get the field value from the context
        const fieldValue =
            rule.field === 'description'
                ? (context.description ?? '')
                : (context.merchant ?? '')

        if (!fieldValue) continue

        if (evaluateCondition(fieldValue, rule.condition, rule.value)) {
            return {
                matched: true,
                rule,
                match: {
                    field: rule.field,
                    condition: rule.condition,
                    value: rule.value,
                    normalizedFieldValue: normalizeRuleText(fieldValue),
                    normalizedRuleValue: normalizeRuleText(rule.value),
                },
            }
        }
    }

    return { matched: false, rule: null }
}
