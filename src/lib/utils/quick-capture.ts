import type {
    IAccount,
    ICategory,
    ITransactionRule,
    QuickCaptureAliasDto,
    QuickCaptureFrequent,
    QuickCaptureInterpretation,
    QuickCaptureLearnedPatternDto,
    QuickCaptureSuggestion,
    QuickCaptureToken,
    QuickCaptureDraft,
    TransactionPreviewResponse,
} from '@/types'
import type { Currency } from '@/lib/constants'
import {
    getSupportedCurrencies,
    isSimpleTransactionAccountType,
    supportsCurrency,
} from '@/lib/utils/accounts'
import { levenshteinDistance, normalizeDescriptionDisplay } from '@/lib/utils/transaction-description-intelligence'
import { normalizeComparisonText } from '@/lib/utils/category-ranking'
import { resolveEntityId } from '@/lib/utils/entity-id'
import { evaluateRules } from '@/lib/utils/rules'

type TokenState = QuickCaptureToken & { consumed: boolean }

type ParseQuickCaptureOptions = {
    accounts: IAccount[]
    categories: ICategory[]
    aliases?: QuickCaptureAliasDto[]
    frequents?: QuickCaptureFrequent[]
    rules?: ITransactionRule[]
    learnedPatterns?: QuickCaptureLearnedPatternDto[]
    defaultAccountId?: string
    lastExpenseAccountId?: string
    lastIncomeAccountId?: string
    now?: Date
}

const INCOME_WORDS = new Set([
    'cobre',
    'cobro',
    'cobrado',
    'ingreso',
    'ingrese',
])

const INCOME_DESCRIPTION_WORDS = new Set(['sueldo', 'salario', 'honorarios'])
const EXPENSE_WORDS = new Set(['gasto', 'pague', 'pago', 'compre', 'compra'])
const ARS_WORDS = new Set(['ars', 'peso', 'pesos'])
const USD_WORDS = new Set(['usd', 'dolar', 'dolares', 'us$', 'u$s'])
const SHORT_DESCRIPTION_WORDS = new Set([
    'a',
    'al',
    'con',
    'de',
    'del',
    'e',
    'el',
    'en',
    'la',
    'las',
    'los',
    'mi',
    'mis',
    'o',
    'para',
    'por',
    'que',
    'sin',
    'sus',
    'tu',
    'un',
    'una',
    'y',
])
const WEEKDAYS = new Map<string, number>([
    ['domingo', 0],
    ['dom', 0],
    ['lunes', 1],
    ['lun', 1],
    ['martes', 2],
    ['mar', 2],
    ['miercoles', 3],
    ['mie', 3],
    ['jueves', 4],
    ['jue', 4],
    ['viernes', 5],
    ['vie', 5],
    ['sabado', 6],
    ['sab', 6],
])
const SPANISH_COUNTS = new Map<string, number>([
    ['un', 1],
    ['una', 1],
    ['uno', 1],
    ['dos', 2],
    ['tres', 3],
    ['cuatro', 4],
    ['cinco', 5],
    ['seis', 6],
    ['siete', 7],
    ['ocho', 8],
    ['nueve', 9],
    ['diez', 10],
])

export function normalizeQuickCaptureTerm(value: string) {
    return normalizeComparisonText(value)
}

export function getQuickCaptureInlineCompletion(
    text: string,
    suggestion?: QuickCaptureSuggestion
) {
    if (
        !suggestion ||
        !['description', 'account'].includes(suggestion.targetType) ||
        suggestion.end !== text.trimEnd().length ||
        text.slice(suggestion.end).trim()
    ) {
        return undefined
    }

    const target = suggestion.targetValue ?? suggestion.targetLabel
    const source = text.slice(suggestion.start, suggestion.end)
    const normalizedSource = normalizeQuickCaptureTerm(source)
    const normalizedTarget = normalizeQuickCaptureTerm(target)

    if (
        normalizedSource.length < 2 ||
        normalizedTarget === normalizedSource ||
        !normalizedTarget.startsWith(normalizedSource) ||
        target.length <= source.length
    ) {
        return undefined
    }

    return {
        suggestion,
        target,
        suffix: target.slice(source.length),
    }
}

export function resolveQuickCapturePreviewDraft(
    draft: QuickCaptureDraft,
    preview?: TransactionPreviewResponse
): QuickCaptureDraft {
    if (!preview?.normalized) return draft

    const normalized = preview.normalized
    const normalizedDate = new Date(normalized.date)
    return {
        type: normalized.type,
        amount: normalized.amount,
        currency: normalized.currency,
        date: Number.isNaN(normalizedDate.getTime()) ? draft.date : normalizedDate,
        description: normalized.description,
        accountId:
            normalized.type === 'income'
                ? normalized.destinationAccountId ?? draft.accountId
                : normalized.sourceAccountId ?? draft.accountId,
        categoryId: normalized.categoryId,
        merchant: normalized.merchant,
    }
}

function tokenize(value: string): TokenState[] {
    return Array.from(value.matchAll(/\S+/g)).map((match) => {
        const start = match.index ?? 0
        const tokenValue = match[0]
        return {
            value: tokenValue,
            normalizedValue: normalizeQuickCaptureTerm(tokenValue),
            start,
            end: start + tokenValue.length,
            kind: 'unknown',
            consumed: false,
        }
    })
}

function parseAmountToken(rawValue: string) {
    const cleaned = rawValue
        .replace(/^(ars|usd|u\$s|us\$|\$)\s*/i, '')
        .replace(/\s*(ars|usd)$/i, '')
        .trim()

    if (!/^\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?$/.test(cleaned)) return undefined

    const separators = cleaned.match(/[.,]/g) ?? []
    let normalized = cleaned

    if (separators.length === 1) {
        const separator = separators[0]
        const [whole, fraction = ''] = cleaned.split(separator)
        normalized = fraction.length === 3 ? `${whole}${fraction}` : `${whole}.${fraction}`
    } else if (separators.length > 1) {
        const lastSeparatorIndex = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','))
        const decimalDigits = cleaned.length - lastSeparatorIndex - 1
        normalized = decimalDigits <= 2
            ? `${cleaned.slice(0, lastSeparatorIndex).replace(/[.,]/g, '')}.${cleaned.slice(lastSeparatorIndex + 1)}`
            : cleaned.replace(/[.,]/g, '')
    }

    const amount = Number(normalized)
    return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

function dayAtLocalMidnight(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function relativeDate(now: Date, offset: number) {
    const result = dayAtLocalMidnight(now)
    result.setDate(result.getDate() + offset)
    return result
}

function previousWeekday(now: Date, weekday: number, occurrence = 1) {
    const current = dayAtLocalMidnight(now)
    let daysBack = (current.getDay() - weekday + 7) % 7
    if (daysBack === 0) daysBack = 7
    return relativeDate(now, -(daysBack + (Math.max(1, occurrence) - 1) * 7))
}

function nextWeekday(now: Date, weekday: number, occurrence = 1) {
    const current = dayAtLocalMidnight(now)
    let daysAhead = (weekday - current.getDay() + 7) % 7
    if (daysAhead === 0) daysAhead = 7
    return relativeDate(now, daysAhead + (Math.max(1, occurrence) - 1) * 7)
}

function parseRelativeDatePhrases(tokens: TokenState[], now: Date) {
    let parsedDate: Date | undefined

    function consume(start: number, length: number, value: Date, label: string) {
        tokens.slice(start, start + length).forEach((token, offset) => {
            markToken(token, 'date', offset === 0 ? label : undefined)
        })
        parsedDate = value
    }

    function numericToken(index: number) {
        const normalized = tokens[index]?.normalizedValue
        const value = SPANISH_COUNTS.get(normalized) ?? Number(normalized)
        return Number.isInteger(value) && value > 0 ? value : undefined
    }

    for (let index = 0; index < tokens.length; index += 1) {
        if (tokens[index].consumed) continue
        const current = tokens[index].normalizedValue
        const next = tokens[index + 1]?.normalizedValue
        const third = tokens[index + 2]?.normalizedValue
        const fourth = tokens[index + 3]?.normalizedValue

        if (current === 'antes' && next === 'de' && third === 'ayer') {
            consume(index, 3, relativeDate(now, -2), 'Antes de ayer')
            continue
        }
        if (current === 'ante' && next === 'ayer') {
            consume(index, 2, relativeDate(now, -2), 'Anteayer')
            continue
        }
        if (current === 'pasado' && (next === 'manana' || next === 'mañana')) {
            consume(index, 2, relativeDate(now, 2), 'Pasado mañana')
            continue
        }
        if (current === 'manana' || current === 'mañana') {
            consume(index, 1, relativeDate(now, 1), 'Mañana')
            continue
        }
        if (
            (current === 'semana' && next === 'pasada') ||
            (current === 'la' && next === 'semana' && third === 'pasada')
        ) {
            const length = current === 'la' ? 3 : 2
            consume(index, length, relativeDate(now, -7), 'Semana pasada')
            continue
        }
        if (
            (current === 'semana' && next === 'que' && third === 'viene') ||
            (
                current === 'la' &&
                next === 'semana' &&
                third === 'que' &&
                fourth === 'viene'
            )
        ) {
            const length = current === 'la' ? 4 : 3
            consume(index, length, relativeDate(now, 7), 'Semana que viene')
            continue
        }
        if (current === 'hace') {
            const count = numericToken(index + 1)
            const weekday = WEEKDAYS.get(third)
            if (count && weekday !== undefined) {
                consume(index, 3, previousWeekday(now, weekday, count), `Hace ${count} ${tokens[index + 2].value}`)
                continue
            }
            if (count && (third === 'dia' || third === 'dias')) {
                consume(index, 3, relativeDate(now, -count), `Hace ${count} días`)
                continue
            }
            if (count && (third === 'semana' || third === 'semanas')) {
                consume(index, 3, relativeDate(now, -count * 7), `Hace ${count} semanas`)
                continue
            }
        }
        if (current === 'dentro' && next === 'de') {
            const count = numericToken(index + 2)
            const weekday = WEEKDAYS.get(fourth)
            if (count && weekday !== undefined) {
                consume(index, 4, nextWeekday(now, weekday, count), `Dentro de ${count} ${tokens[index + 3].value}`)
                continue
            }
            if (count && (fourth === 'dia' || fourth === 'dias')) {
                consume(index, 4, relativeDate(now, count), `Dentro de ${count} días`)
                continue
            }
            if (count && (fourth === 'semana' || fourth === 'semanas')) {
                consume(index, 4, relativeDate(now, count * 7), `Dentro de ${count} semanas`)
                continue
            }
        }

        const count = numericToken(index)
        const unit = next
        if (count && (third === 'atras' || third === 'atrás')) {
            const weekday = WEEKDAYS.get(unit)
            if (weekday !== undefined) {
                consume(index, 3, previousWeekday(now, weekday, count), `${count} ${tokens[index + 1].value} atrás`)
                continue
            }
            if (unit === 'dia' || unit === 'dias') {
                consume(index, 3, relativeDate(now, -count), `${count} días atrás`)
                continue
            }
            if (unit === 'semana' || unit === 'semanas') {
                consume(index, 3, relativeDate(now, -count * 7), `${count} semanas atrás`)
                continue
            }
        }

        const weekday = WEEKDAYS.get(current)
        if ((current === 'prox' || current === 'proximo') && WEEKDAYS.has(next)) {
            consume(index, 2, nextWeekday(now, WEEKDAYS.get(next)!), `Próximo ${tokens[index + 1].value}`)
            continue
        }
        if (weekday !== undefined && next === 'que' && third === 'viene') {
            consume(index, 3, nextWeekday(now, weekday), `${tokens[index].value} que viene`)
            continue
        }
        if (weekday !== undefined && next === 'pasado') {
            consume(index, 2, previousWeekday(now, weekday), `${tokens[index].value} pasado`)
            continue
        }
        if (current === 'el' && WEEKDAYS.has(next)) {
            consume(index, 2, previousWeekday(now, WEEKDAYS.get(next)!), `El ${tokens[index + 1].value}`)
            continue
        }
        if (weekday !== undefined) {
            consume(index, 1, previousWeekday(now, weekday), `Último ${tokens[index].value}`)
        }
    }

    return parsedDate
}

function parseExplicitDate(value: string, now: Date) {
    const match = value.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/)
    if (!match) return undefined
    const day = Number(match[1])
    const month = Number(match[2])
    let year = match[3] ? Number(match[3]) : now.getFullYear()
    if (year < 100) year += 2000
    const date = new Date(year, month - 1, day)
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return undefined
    }
    return date
}

function isActiveSimpleAccount(account: IAccount) {
    return (
        account.isActive !== false &&
        isSimpleTransactionAccountType(account.type)
    )
}

function accountAcronym(name: string) {
    return normalizeQuickCaptureTerm(name)
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
}

function buildEntitySuggestion(params: {
    token: TokenState
    accounts: IAccount[]
    categories: ICategory[]
    frequentWords: string[]
    frequentMerchants: string[]
    completionWords: string[]
    learnedPatterns: QuickCaptureLearnedPatternDto[]
    allowCompletion: boolean
}) {
    const {
        token,
        accounts,
        categories,
        frequentWords,
        frequentMerchants,
        completionWords,
        learnedPatterns,
        allowCompletion,
    } = params
    const normalized = token.normalizedValue
    if (normalized.length < 2) return undefined

    const candidates: QuickCaptureSuggestion[] = []

    if (allowCompletion && normalized.length >= 3) {
        completionWords.forEach((word) => {
            const target = normalizeQuickCaptureTerm(word)
            if (
                target === normalized ||
                !target.startsWith(normalized) ||
                target.length - normalized.length < 2
            ) {
                return
            }
            candidates.push({
                id: `completion:${target}:${token.start}`,
                sourceText: token.value,
                targetType: 'description',
                targetValue: normalizeDescriptionDisplay(word),
                targetLabel: normalizeDescriptionDisplay(word),
                reason: 'Autocompletado desde tus reglas, atajos o movimientos frecuentes.',
                confidence: Math.min(0.95, 0.82 + normalized.length / Math.max(target.length, 1) * 0.12),
                start: token.start,
                end: token.end,
                source: 'frequent',
            })
        })
        learnedPatterns
            .filter((pattern) => pattern.targetType === 'description')
            .forEach((pattern) => {
                const target = normalizeQuickCaptureTerm(
                    pattern.targetValue ?? pattern.targetLabel
                )
                if (
                    target === normalized ||
                    !target.startsWith(normalized) ||
                    target.length - normalized.length < 2
                ) {
                    return
                }
                candidates.push({
                    id: `learned-completion:${pattern.key}:${token.start}`,
                    sourceText: token.value,
                    targetType: 'description',
                    targetValue: pattern.targetValue ?? pattern.targetLabel,
                    targetLabel: pattern.targetLabel,
                    reason: pattern.reason,
                    confidence: pattern.confidence,
                    start: token.start,
                    end: token.end,
                    source: 'learned',
                    patternKey: pattern.key,
                    evidence: {
                        occurrences: pattern.occurrences,
                        total: pattern.total,
                        consistency: pattern.consistency,
                    },
                    autoApplicable: pattern.autoApply,
                })
            })
    }

    accounts.filter(isActiveSimpleAccount).forEach((account) => {
        const target = normalizeQuickCaptureTerm(account.name)
        const acronym = accountAcronym(account.name)
        const distance = levenshteinDistance(normalized, target)
        const isAcronym = normalized.length >= 2 && normalized === acronym
        const isPrefix =
            normalized.length >= 3 &&
            target.startsWith(normalized) &&
            target.length - normalized.length >= 2
        const isClose = normalized.length >= 4 && distance <= (target.length >= 8 ? 2 : 1)
        if (!isAcronym && !isPrefix && !isClose) return
        candidates.push({
            id: `account:${resolveEntityId(account._id)}:${token.start}`,
            sourceText: token.value,
            targetType: 'account',
            targetId: resolveEntityId(account._id),
            targetValue: account.name,
            targetLabel: account.name,
            reason: isPrefix
                ? `Podés completar la cuenta ${account.name}.`
                : isAcronym
                    ? `Coincide con las iniciales de ${account.name}.`
                    : `Se parece al nombre de la cuenta ${account.name}.`,
            confidence: isPrefix
                ? Math.min(
                    0.96,
                    0.84 + normalized.length / target.length * 0.12
                )
                : isAcronym
                    ? 0.91
                    : Math.max(0.72, 1 - distance / target.length),
            start: token.start,
            end: token.end,
            source: isPrefix ? 'entity' : 'similarity',
        })
    })

    categories.filter((category) => !category.isArchived).forEach((category) => {
        const target = normalizeQuickCaptureTerm(category.name)
        const distance = levenshteinDistance(normalized, target)
        if (normalized.length < 4 || distance > (target.length >= 9 ? 2 : 1)) return
        candidates.push({
            id: `category:${resolveEntityId(category._id)}:${token.start}`,
            sourceText: token.value,
            targetType: 'category',
            targetId: resolveEntityId(category._id),
            targetLabel: category.name,
            reason: `Se parece a la categoría ${category.name}.`,
            confidence: Math.max(0.7, 1 - distance / target.length),
            start: token.start,
            end: token.end,
            source: 'similarity',
        })
    })

    frequentWords.forEach((word) => {
        const target = normalizeQuickCaptureTerm(word)
        const distance = levenshteinDistance(normalized, target)
        if (normalized.length < 4 || distance !== 1 || target === normalized) return
        candidates.push({
            id: `description:${target}:${token.start}`,
            sourceText: token.value,
            targetType: 'description',
            targetValue: normalizeDescriptionDisplay(word),
            targetLabel: normalizeDescriptionDisplay(word),
            reason: 'Se parece a una descripción que usaste antes.',
            confidence: Math.max(0.7, 1 - distance / Math.max(target.length, normalized.length)),
            start: token.start,
            end: token.end,
            source: 'frequent',
        })
    })

    frequentMerchants.forEach((merchant) => {
        const target = normalizeQuickCaptureTerm(merchant)
        const distance = levenshteinDistance(normalized, target)
        const isExact = normalized === target
        const isClose = normalized.length >= 4 && distance === 1
        if (!isExact && !isClose) return
        candidates.push({
            id: `merchant:${target}:${token.start}`,
            sourceText: token.value,
            targetType: 'merchant',
            targetValue: merchant,
            targetLabel: merchant,
            reason: isExact
                ? 'Coincide con un comercio que usaste antes.'
                : 'Se parece a un comercio que usaste antes.',
            confidence: isExact ? 0.94 : 0.74,
            start: token.start,
            end: token.end,
            source: 'frequent',
        })
    })

    const sourcePriority: Record<string, number> = {
        alias: 6,
        rule: 5,
        learned: 4,
        entity: 3.5,
        frequent: 3,
        similarity: 1,
        date: 0,
    }
    return candidates.sort((left, right) => {
        const sourceDifference =
            (sourcePriority[right.source ?? 'similarity'] ?? 0) -
            (sourcePriority[left.source ?? 'similarity'] ?? 0)
        return sourceDifference || right.confidence - left.confidence
    })[0]
}

function markToken(
    token: TokenState,
    kind: QuickCaptureToken['kind'],
    label?: string,
    color?: string
) {
    token.kind = kind
    token.label = label
    token.color = color
    token.consumed = kind !== 'description' && kind !== 'unknown'
}

export function parseQuickCapture(
    text: string,
    options: ParseQuickCaptureOptions
): QuickCaptureInterpretation {
    const now = options.now ?? new Date()
    const tokens = tokenize(text)
    let amount: number | undefined
    let currency: Currency = 'ARS'
    let currencyExplicit = false
    let type: 'expense' | 'income' = 'expense'
    let date = dayAtLocalMidnight(now)
    let accountId: string | undefined
    let categoryId: string | undefined
    let merchant: string | undefined
    const suggestions: QuickCaptureSuggestion[] = []
    const corrections: QuickCaptureInterpretation['corrections'] = []
    const appliedAliasIds = new Set<string>()
    const personalizations: NonNullable<
        QuickCaptureInterpretation['personalizations']
    > = []
    const phraseDate = parseRelativeDatePhrases(tokens, now)
    if (phraseDate) date = phraseDate
    const knownEntityPhrases = [
        ...options.accounts.filter(isActiveSimpleAccount).map((account) => account.name),
        ...options.categories.filter((category) => !category.isArchived).map((category) => category.name),
    ]
        .map((name) => normalizeQuickCaptureTerm(name).split(' '))
        .filter((parts) => parts.length > 1)

    function belongsToKnownEntityPhrase(tokenIndex: number) {
        return knownEntityPhrases.some((parts) => {
            for (let start = 0; start <= tokens.length - parts.length; start += 1) {
                if (tokenIndex < start || tokenIndex >= start + parts.length) continue
                if (
                    tokens
                        .slice(start, start + parts.length)
                        .map((token) => token.normalizedValue)
                        .join(' ') === parts.join(' ')
                ) {
                    return true
                }
            }
            return false
        })
    }

    tokens.forEach((token, tokenIndex) => {
        if (token.consumed) return
        const normalized = token.normalizedValue
        if (!normalized) return

        if (INCOME_WORDS.has(normalized)) {
            type = 'income'
            markToken(token, 'type', 'Ingreso')
            return
        }
        if (INCOME_DESCRIPTION_WORDS.has(normalized)) {
            type = 'income'
            markToken(token, 'description', 'Ingreso')
            return
        }
        if (EXPENSE_WORDS.has(normalized) && !belongsToKnownEntityPhrase(tokenIndex)) {
            type = 'expense'
            markToken(token, 'type', 'Gasto')
            return
        }

        if (USD_WORDS.has(normalized) || /^(usd|u\$s|us\$)/i.test(token.value)) {
            currency = 'USD'
            currencyExplicit = true
            markToken(token, 'currency', 'USD')
            return
        }
        if (ARS_WORDS.has(normalized) || token.value.startsWith('$')) {
            currency = 'ARS'
            currencyExplicit = true
            if (!parseAmountToken(token.value)) {
                markToken(token, 'currency', 'ARS')
                return
            }
        }

        if (normalized === 'hoy') {
            date = relativeDate(now, 0)
            markToken(token, 'date', 'Hoy')
            return
        }
        if (normalized === 'ayer') {
            date = relativeDate(now, -1)
            markToken(token, 'date', 'Ayer')
            return
        }
        if (normalized === 'anteayer') {
            date = relativeDate(now, -2)
            markToken(token, 'date', 'Anteayer')
            return
        }
        if (
            normalized.length >= 4 &&
            levenshteinDistance(normalized, 'ayer') === 1
        ) {
            date = relativeDate(now, -1)
            markToken(token, 'correction', 'Ayer')
            corrections.push({
                source: token.value,
                target: 'ayer',
                reason: 'Interpretamos una fecha relativa muy cercana.',
            })
            return
        }

        const explicitDate = parseExplicitDate(token.value, now)
        if (explicitDate) {
            date = explicitDate
            markToken(token, 'date', explicitDate.toLocaleDateString('es-AR'))
            return
        }

        const parsedAmount = parseAmountToken(token.value)
        if (!amount && parsedAmount) {
            amount = parsedAmount
            markToken(token, 'amount', new Intl.NumberFormat('es-AR').format(parsedAmount))
        }
    })

    const aliasMap = new Map<string, QuickCaptureAliasDto[]>()
    ;(options.aliases ?? [])
        .filter((alias) => !alias.isStale)
        .forEach((alias) => {
            const matches = aliasMap.get(alias.normalizedTerm) ?? []
            matches.push(alias)
            aliasMap.set(alias.normalizedTerm, matches)
        })

    Array.from(aliasMap.entries())
        .filter(([term]) => term.includes(' '))
        .sort(([left], [right]) => right.split(' ').length - left.split(' ').length)
        .forEach(([term, matches]) => {
            const parts = term.split(' ')
            for (let index = 0; index <= tokens.length - parts.length; index += 1) {
                const matchedTokens = tokens.slice(index, index + parts.length)
                if (
                    matchedTokens.some((token) => token.consumed) ||
                    matchedTokens.map((token) => token.normalizedValue).join(' ') !== term
                ) {
                    continue
                }
                const accountAlias = matches.find(
                    (alias) => alias.targetType === 'account' && alias.targetId
                )
                const categoryAlias = matches.find(
                    (alias) => alias.targetType === 'category' && alias.targetId
                )
                const descriptionAlias = matches.find(
                    (alias) => alias.targetType === 'description' && alias.targetValue
                )
                const merchantAlias = matches.find(
                    (alias) => alias.targetType === 'merchant' && alias.targetValue
                )
                if (accountAlias?.targetId) {
                    appliedAliasIds.add(accountAlias._id)
                    accountId = accountAlias.targetId
                    matchedTokens.forEach((token, tokenIndex) =>
                        markToken(
                            token,
                            'account',
                            tokenIndex === 0 ? accountAlias.targetLabel : undefined,
                            accountAlias.targetColor
                        )
                    )
                } else if (categoryAlias?.targetId) {
                    appliedAliasIds.add(categoryAlias._id)
                    categoryId = categoryAlias.targetId
                    matchedTokens.forEach((token, tokenIndex) =>
                        markToken(
                            token,
                            'category',
                            tokenIndex === 0 ? categoryAlias.targetLabel : undefined,
                            categoryAlias.targetColor
                        )
                    )
                } else if (descriptionAlias?.targetValue) {
                    appliedAliasIds.add(descriptionAlias._id)
                    if (merchantAlias?.targetValue) merchant = merchantAlias.targetValue
                    if (merchantAlias?.targetValue) {
                        appliedAliasIds.add(merchantAlias._id)
                    }
                    matchedTokens[0].value = descriptionAlias.targetValue
                    matchedTokens[0].normalizedValue = normalizeQuickCaptureTerm(
                        descriptionAlias.targetValue
                    )
                    matchedTokens[0].kind = 'description'
                    matchedTokens.slice(1).forEach((token) =>
                        markToken(token, 'correction', 'Incluido en el atajo')
                    )
                } else if (merchantAlias?.targetValue) {
                    appliedAliasIds.add(merchantAlias._id)
                    merchant = merchantAlias.targetValue
                    matchedTokens.forEach((token, tokenIndex) =>
                        markToken(
                            token,
                            'merchant',
                            tokenIndex === 0 ? merchantAlias.targetLabel : undefined
                        )
                    )
                }
                break
            }
        })

    tokens.filter((token) => !token.consumed).forEach((token) => {
        const matches = aliasMap.get(token.normalizedValue)
        if (!matches?.length) return

        const accountAlias = matches.find(
            (alias) => alias.targetType === 'account' && alias.targetId
        )
        const categoryAlias = matches.find(
            (alias) => alias.targetType === 'category' && alias.targetId
        )
        const descriptionAlias = matches.find(
            (alias) => alias.targetType === 'description' && alias.targetValue
        )
        const merchantAlias = matches.find(
            (alias) => alias.targetType === 'merchant' && alias.targetValue
        )

        if (accountAlias?.targetId) {
            appliedAliasIds.add(accountAlias._id)
            accountId = accountAlias.targetId
            markToken(token, 'account', accountAlias.targetLabel, accountAlias.targetColor)
            return
        }
        if (categoryAlias?.targetId) {
            appliedAliasIds.add(categoryAlias._id)
            categoryId = categoryAlias.targetId
            markToken(token, 'category', categoryAlias.targetLabel, categoryAlias.targetColor)
            return
        }
        if (merchantAlias?.targetValue) {
            appliedAliasIds.add(merchantAlias._id)
            merchant = merchantAlias.targetValue
        }
        if (descriptionAlias?.targetValue) {
            appliedAliasIds.add(descriptionAlias._id)
            token.value = descriptionAlias.targetValue
            token.normalizedValue = normalizeQuickCaptureTerm(descriptionAlias.targetValue)
            token.kind = 'description'
            token.label = descriptionAlias.targetLabel
        } else if (merchantAlias) {
            markToken(token, 'merchant', merchantAlias.targetLabel)
        }
    })

    const exactEntities = [
        ...options.accounts
            .filter(isActiveSimpleAccount)
            .map((account) => ({
                kind: 'account' as const,
                id: resolveEntityId(account._id),
                label: account.name,
                color: account.color,
                normalized: normalizeQuickCaptureTerm(account.name),
            })),
        ...options.categories
            .filter((category) => !category.isArchived && category.type === type)
            .map((category) => ({
                kind: 'category' as const,
                id: resolveEntityId(category._id),
                label: category.name,
                color: category.color,
                normalized: normalizeQuickCaptureTerm(category.name),
            })),
    ]
        .filter((entity) => entity.normalized.includes(' '))
        .sort((left, right) =>
            right.normalized.split(' ').length - left.normalized.split(' ').length
        )

    exactEntities.forEach((entity) => {
        if (
            (entity.kind === 'account' && accountId) ||
            (entity.kind === 'category' && categoryId)
        ) {
            return
        }
        const parts = entity.normalized.split(' ')
        for (let index = 0; index <= tokens.length - parts.length; index += 1) {
            const matchedTokens = tokens.slice(index, index + parts.length)
            if (
                matchedTokens.some((token) => token.consumed) ||
                matchedTokens.map((token) => token.normalizedValue).join(' ') !==
                    entity.normalized
            ) {
                continue
            }
            if (entity.kind === 'account') accountId = entity.id
            else categoryId = entity.id
            matchedTokens.forEach((token, tokenIndex) =>
                markToken(
                    token,
                    entity.kind,
                    tokenIndex === 0 ? entity.label : undefined,
                    entity.color
                )
            )
            break
        }
    })

    tokens.filter((token) => !token.consumed).forEach((token) => {
        const matchingAccount = options.accounts.find((account) => {
            if (!isActiveSimpleAccount(account)) return false
            const accountName = normalizeQuickCaptureTerm(account.name)
            return token.normalizedValue === accountName ||
                token.normalizedValue === accountName.replace(/\s+/g, '')
        })
        if (matchingAccount && !accountId) {
            accountId = resolveEntityId(matchingAccount._id)
            markToken(token, 'account', matchingAccount.name, matchingAccount.color)
            return
        }

        const matchingCategory = options.categories.find((category) => {
            if (category.isArchived) return false
            return token.normalizedValue === normalizeQuickCaptureTerm(category.name)
        })
        if (matchingCategory && !categoryId) {
            categoryId = resolveEntityId(matchingCategory._id)
            markToken(token, 'category', matchingCategory.name, matchingCategory.color)
        }
    })

    const frequentWords = Array.from(new Set(
        (options.frequents ?? []).flatMap((frequent) =>
            frequent.description.split(/\s+/).filter((word) => normalizeQuickCaptureTerm(word).length >= 4)
        )
    ))
    const frequentMerchants = Array.from(new Set(
        (options.frequents ?? [])
            .map((frequent) => frequent.merchant)
            .filter((merchant): merchant is string => Boolean(merchant?.trim()))
    ))
    const completionWords = Array.from(new Set([
        ...frequentWords,
        ...frequentMerchants,
        ...(options.rules ?? [])
            .filter((rule) => rule.isActive)
            .map((rule) => rule.value)
            .filter((value) => value.trim().length >= 3),
        ...(options.aliases ?? []).map((alias) => alias.term),
    ]))
    const learnedPatterns = (options.learnedPatterns ?? []).filter(
        (pattern) =>
            pattern.status === 'active' &&
            pattern.transactionType === type &&
            pattern.currency === currency
    )
    const lastAvailableToken = [...tokens].reverse().find((token) => !token.consumed)

    tokens.filter((token) => !token.consumed).forEach((token) => {
        const suggestion = buildEntitySuggestion({
            token,
            accounts: options.accounts,
            categories: options.categories.filter((category) => category.type === type),
            frequentWords,
            frequentMerchants,
            completionWords,
            learnedPatterns,
            allowCompletion: token === lastAvailableToken,
        })
        if (suggestion && !suggestions.some((item) => item.sourceText === token.value)) {
            suggestions.push(suggestion)
        }
        token.kind =
            suggestion &&
            suggestion.targetType !== 'description' &&
            !suggestion.preserveSourceText
                ? 'suggestion'
                : 'description'
    })

    const description = normalizeDescriptionDisplay(
        tokens
            .filter((token) => token.kind === 'description' || token.kind === 'unknown')
            .map((token) => token.value)
            .join(' ')
    )
    const normalizedDescription = normalizeQuickCaptureTerm(description)
    const descriptionTerms = new Set(
        tokens
            .filter((token) => token.kind === 'description' || token.kind === 'unknown')
            .map((token) => token.normalizedValue)
    )
    const ruleEvaluation = evaluateRules(options.rules ?? [], {
        type,
        description,
        merchant,
    })
    const winningRule = ruleEvaluation.matched ? ruleEvaluation.rule : undefined
    const explicitAccount = Boolean(accountId)
    const explicitCategory = Boolean(categoryId)
    const explicitMerchant = Boolean(merchant)
    const applicableLearnedPatterns = learnedPatterns.filter((pattern) => {
        if (pattern.targetType === 'description') return false
        if (pattern.triggerKind === 'description') {
            return normalizedDescription === pattern.triggerTerm
        }
        if (pattern.triggerKind === 'token') {
            return descriptionTerms.has(pattern.triggerTerm)
        }
        return normalizeQuickCaptureTerm(merchant ?? '') === pattern.triggerTerm
    })
    const learnedTargetTypes = new Set<string>()

    applicableLearnedPatterns.forEach((pattern) => {
        if (learnedTargetTypes.has(pattern.targetType)) return
        if (
            pattern.targetType === 'account' &&
            explicitAccount
        ) {
            return
        }
        if (
            pattern.targetType === 'category' &&
            (
                explicitCategory ||
                Boolean(winningRule?.categoryId) ||
                Boolean(winningRule?.setType)
            )
        ) {
            return
        }
        if (
            pattern.targetType === 'merchant' &&
            (
                explicitMerchant ||
                Boolean(winningRule?.normalizeMerchant)
            )
        ) {
            return
        }
        learnedTargetTypes.add(pattern.targetType)

        const sourceToken = tokens.find(
            (token) => token.normalizedValue === pattern.triggerTerm
        )
        const sourceStart = sourceToken?.start ?? 0
        const sourceEnd = sourceToken?.end ?? text.trimEnd().length
        const sourceText =
            sourceToken?.value || description || pattern.triggerLabel

        if (pattern.autoApply) {
            if (pattern.targetType === 'account' && pattern.targetId) {
                accountId = pattern.targetId
            } else if (pattern.targetType === 'category' && pattern.targetId) {
                categoryId = pattern.targetId
            } else if (
                pattern.targetType === 'merchant' &&
                pattern.targetValue
            ) {
                merchant = pattern.targetValue
            } else {
                return
            }
            personalizations.push({
                patternKey: pattern.key,
                targetType: pattern.targetType,
                targetId: pattern.targetId,
                targetValue: pattern.targetValue,
                targetLabel: pattern.targetLabel,
                triggerLabel: pattern.triggerLabel,
                reason: pattern.reason,
                confidence: pattern.confidence,
                occurrences: pattern.occurrences,
                total: pattern.total,
            })
            return
        }

        suggestions.push({
            id: `learned:${pattern.key}:${sourceStart}`,
            sourceText,
            targetType: pattern.targetType,
            targetId: pattern.targetId,
            targetValue: pattern.targetValue,
            targetLabel: pattern.targetLabel,
            reason: pattern.reason,
            confidence: pattern.confidence,
            start: sourceStart,
            end: sourceEnd,
            source: 'learned',
            patternKey: pattern.key,
            evidence: {
                occurrences: pattern.occurrences,
                total: pattern.total,
                consistency: pattern.consistency,
            },
            autoApplicable: pattern.autoApply,
            preserveSourceText: true,
        })
    })

    const candidateAccountId =
        accountId ||
        options.defaultAccountId ||
        (type === 'expense' ? options.lastExpenseAccountId : options.lastIncomeAccountId)

    let selectedAccount = candidateAccountId
        ? options.accounts.find((account) =>
            resolveEntityId(account._id) === candidateAccountId &&
            isActiveSimpleAccount(account)
        )
        : undefined

    if (!accountId && selectedAccount && !supportsCurrency(selectedAccount, currency)) {
        selectedAccount = undefined
    }

    if (!accountId && !selectedAccount) {
        selectedAccount = options.accounts.find((account) =>
            isActiveSimpleAccount(account) && supportsCurrency(account, currency)
        )
    }

    if (!currencyExplicit && selectedAccount) {
        const supported = getSupportedCurrencies(selectedAccount)
        if (supported.length === 1) currency = supported[0]
    }

    accountId =
        accountId ??
        (selectedAccount ? resolveEntityId(selectedAccount._id) : undefined)

    const unresolvedTokens = tokens
        .filter((token) =>
            token.kind === 'description' &&
            token.normalizedValue.length >= 2 &&
            token.normalizedValue.length <= 3 &&
            !/[aeiou]/.test(token.normalizedValue) &&
            !SHORT_DESCRIPTION_WORDS.has(token.normalizedValue) &&
            !INCOME_DESCRIPTION_WORDS.has(token.normalizedValue)
        )
        .map((token) => token.value)

    return {
        draft: {
            type,
            amount,
            currency,
            date,
            description,
            accountId,
            categoryId,
            merchant,
        },
        tokens: tokens.map((token) => ({
            value: token.value,
            normalizedValue: token.normalizedValue,
            start: token.start,
            end: token.end,
            kind: token.kind,
            label: token.label,
            color: token.color,
        })),
        suggestions: suggestions
            .sort((left, right) => {
                const sourcePriority: Record<string, number> = {
                    alias: 6,
                    rule: 5,
                    learned: 4,
                    entity: 3.5,
                    frequent: 3,
                    similarity: 1,
                    date: 0,
                }
                return (
                    (sourcePriority[right.source ?? 'similarity'] ?? 0) -
                        (sourcePriority[left.source ?? 'similarity'] ?? 0) ||
                    right.confidence - left.confidence
                )
            })
            .slice(0, 4),
        unresolvedTokens,
        corrections,
        appliedAliasIds: Array.from(appliedAliasIds),
        personalizations,
    }
}

export function replaceQuickCaptureRange(
    text: string,
    start: number,
    end: number,
    replacement: string
) {
    return `${text.slice(0, start)}${replacement}${text.slice(end)}`
}

export function quickCaptureTextFromFrequent(frequent: QuickCaptureFrequent) {
    const currency = frequent.currency === 'USD' ? ' usd' : ''
    return `${frequent.description} ${new Intl.NumberFormat('es-AR').format(frequent.amount)}${currency}`
}
