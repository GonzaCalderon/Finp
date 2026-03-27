import type { ITransactionRule } from '@/types'

export interface RuleMatchContext {
    type: 'expense' | 'income' | string
    description?: string
    merchant?: string
}

export interface RuleMatchResult {
    matched: boolean
    rule: ITransactionRule | null
}

function evaluateCondition(
    field: string,
    condition: ITransactionRule['condition'],
    ruleValue: string
): boolean {
    const normalized = field.toLowerCase().trim()
    const target = ruleValue.toLowerCase().trim()

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
    for (const rule of rules) {
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
            return { matched: true, rule }
        }
    }

    return { matched: false, rule: null }
}
