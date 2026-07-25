import type { ITransactionRule } from '@/types'

export interface RuleMatchContext {
    type: 'expense' | 'income' | string
    description?: string
    merchant?: string
}

export interface RuleMatchSnapshot {
    field: ITransactionRule['field']
    condition: ITransactionRule['condition']
    value: string
    normalizedFieldValue: string
    normalizedRuleValue: string
}

export interface RuleMatchResult {
    matched: boolean
    rule: ITransactionRule | null
    match?: RuleMatchSnapshot
}

export interface RuleAppliedActions {
    categoryId?: string
    setType?: 'expense' | 'income'
    normalizeMerchant?: string
}

export interface RuleActionPreview {
    result: {
        type: string
        categoryId?: string
        merchant?: string
    }
    appliedActions: RuleAppliedActions
    skippedActions: Array<{
        action: keyof RuleAppliedActions
        reason: 'explicit_value' | 'specialized_type' | 'same_value'
    }>
}

export interface RuleConflict {
    ruleId: string
    ruleName: string
    kind: 'contradictory_actions' | 'shadowed_action' | 'redundant'
    severity: 'warning' | 'info'
    priorityRelation: 'candidate_wins' | 'existing_wins' | 'same_priority'
    differingActions: Array<keyof RuleAppliedActions>
    message: string
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

function getReferenceId(value: unknown): string | undefined {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'object' && '_id' in value) {
        const id = (value as { _id?: { toString(): string } })._id
        return id?.toString()
    }
    return typeof (value as { toString?: unknown }).toString === 'function'
        ? String(value)
        : undefined
}

function getRuleActions(rule: ITransactionRule): RuleAppliedActions {
    return {
        categoryId: getReferenceId(rule.categoryId),
        setType: rule.setType,
        normalizeMerchant: rule.normalizeMerchant?.trim() || undefined,
    }
}

function matchRule(
    rule: ITransactionRule,
    context: RuleMatchContext,
    includeInactive = false
): RuleMatchSnapshot | null {
    if (!includeInactive && !rule.isActive) return null
    if (rule.appliesTo !== 'any' && rule.appliesTo !== context.type) return null

    const fieldValue =
        rule.field === 'description'
            ? (context.description ?? '')
            : (context.merchant ?? '')

    if (!fieldValue || !evaluateCondition(fieldValue, rule.condition, rule.value)) {
        return null
    }

    return {
        field: rule.field,
        condition: rule.condition,
        value: rule.value,
        normalizedFieldValue: normalizeRuleText(fieldValue),
        normalizedRuleValue: normalizeRuleText(rule.value),
    }
}

export function findMatchingRules(
    rules: ITransactionRule[],
    context: RuleMatchContext,
    options: { includeInactive?: boolean } = {}
): Array<{ rule: ITransactionRule; match: RuleMatchSnapshot }> {
    return rules
        .map((rule, index) => ({ rule, index }))
        .sort((left, right) => right.rule.priority - left.rule.priority || left.index - right.index)
        .flatMap(({ rule }) => {
            const match = matchRule(rule, context, options.includeInactive)
            return match ? [{ rule, match }] : []
        })
}

/**
 * Evaluates a list of rules (ordered by priority desc) against a transaction context.
 * Returns the first matching rule, or null if none match.
 */
export function evaluateRules(
    rules: ITransactionRule[],
    context: RuleMatchContext
): RuleMatchResult {
    const [firstMatch] = findMatchingRules(rules, context)

    if (firstMatch) {
        return {
            matched: true,
            rule: firstMatch.rule,
            match: firstMatch.match,
        }
    }

    return { matched: false, rule: null }
}

/**
 * Resolves exactly the actions that the transaction service is allowed to apply.
 * Explicit category/merchant values win; specialized financial types cannot be
 * silently reclassified as plain income or expense.
 */
export function previewRuleActions(
    rule: ITransactionRule,
    context: RuleMatchContext & {
        categoryId?: string
    }
): RuleActionPreview {
    const result = {
        type: context.type,
        categoryId: context.categoryId,
        merchant: context.merchant,
    }
    const appliedActions: RuleAppliedActions = {}
    const skippedActions: RuleActionPreview['skippedActions'] = []
    const actions = getRuleActions(rule)
    const specializedTypeBlocksReclassification =
        Boolean(actions.setType) &&
        context.type !== 'expense' &&
        context.type !== 'income'

    if (actions.setType) {
        if (specializedTypeBlocksReclassification) {
            skippedActions.push({ action: 'setType', reason: 'specialized_type' })
        } else if (actions.setType === context.type) {
            skippedActions.push({ action: 'setType', reason: 'same_value' })
        } else {
            result.type = actions.setType
            appliedActions.setType = actions.setType
        }
    }

    if (actions.categoryId) {
        if (context.categoryId) {
            skippedActions.push({ action: 'categoryId', reason: 'explicit_value' })
        } else if (specializedTypeBlocksReclassification) {
            // A category configured together with a blocked type change most likely
            // belongs to the intended resulting type, not the specialized input.
            skippedActions.push({ action: 'categoryId', reason: 'specialized_type' })
        } else {
            result.categoryId = actions.categoryId
            appliedActions.categoryId = actions.categoryId
        }
    }

    if (actions.normalizeMerchant) {
        if (context.merchant) {
            skippedActions.push({ action: 'normalizeMerchant', reason: 'explicit_value' })
        } else {
            result.merchant = actions.normalizeMerchant
            appliedActions.normalizeMerchant = actions.normalizeMerchant
        }
    }

    return { result, appliedActions, skippedActions }
}

function scopesOverlap(
    left: ITransactionRule['appliesTo'],
    right: ITransactionRule['appliesTo']
) {
    return left === 'any' || right === 'any' || left === right
}

function conditionsOverlap(left: ITransactionRule, right: ITransactionRule) {
    const leftValue = normalizeRuleText(left.value)
    const rightValue = normalizeRuleText(right.value)
    if (!leftValue || !rightValue) return false

    if (left.condition === 'equals') {
        if (right.condition === 'equals') return leftValue === rightValue
        if (right.condition === 'contains') return leftValue.includes(rightValue)
        return leftValue.startsWith(rightValue)
    }

    if (right.condition === 'equals') {
        if (left.condition === 'contains') return rightValue.includes(leftValue)
        return rightValue.startsWith(leftValue)
    }

    // For non-exact rules, report only meaningful textual overlap. Treating any
    // two "contains" rules as conflicting would create too much noise.
    return leftValue.includes(rightValue) || rightValue.includes(leftValue)
}

function describePriorityRelation(candidate: ITransactionRule, existing: ITransactionRule) {
    if (candidate.priority > existing.priority) return 'candidate_wins' as const
    if (candidate.priority < existing.priority) return 'existing_wins' as const
    return 'same_priority' as const
}

export function detectRuleConflicts(
    candidate: ITransactionRule,
    existingRules: ITransactionRule[]
): RuleConflict[] {
    const candidateActions = getRuleActions(candidate)

    return existingRules.flatMap((existing) => {
        if (!existing.isActive) return []
        if (existing._id?.toString() === candidate._id?.toString()) return []
        if (candidate.field !== existing.field) return []
        if (!scopesOverlap(candidate.appliesTo, existing.appliesTo)) return []
        if (!conditionsOverlap(candidate, existing)) return []

        const existingActions = getRuleActions(existing)
        const actionKeys: Array<keyof RuleAppliedActions> = [
            'categoryId',
            'setType',
            'normalizeMerchant',
        ]
        const differingActions = actionKeys.filter(
            (key) => candidateActions[key] !== existingActions[key]
        )
        const bothDefineDifferent = differingActions.some(
            (key) => candidateActions[key] !== undefined && existingActions[key] !== undefined
        )
        const kind: RuleConflict['kind'] =
            differingActions.length === 0
                ? 'redundant'
                : bothDefineDifferent
                    ? 'contradictory_actions'
                    : 'shadowed_action'
        const priorityRelation = describePriorityRelation(candidate, existing)
        const priorityMessage =
            priorityRelation === 'same_priority'
                ? 'Tienen la misma prioridad; la regla más reciente se evaluará primero.'
                : priorityRelation === 'candidate_wins'
                    ? 'La regla que estás editando se evaluará primero.'
                    : `“${existing.name}” se evaluará primero.`

        return [{
            ruleId: existing._id.toString(),
            ruleName: existing.name,
            kind,
            severity: kind === 'redundant' ? 'info' : 'warning',
            priorityRelation,
            differingActions,
            message:
                kind === 'redundant'
                    ? `Se superpone con “${existing.name}” y aplica las mismas acciones.`
                    : `Se superpone con “${existing.name}”. ${priorityMessage}`,
        }]
    })
}
