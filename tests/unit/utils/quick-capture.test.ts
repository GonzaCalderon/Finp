import { describe, expect, it } from 'vitest'

import {
    getQuickCaptureInlineCompletion,
    parseQuickCapture,
    resolveQuickCapturePreviewDraft,
} from '@/lib/utils/quick-capture'
import { buildAccount, buildCategory } from '../../helpers/factories'
import type {
    ITransactionRule,
    QuickCaptureAliasDto,
    QuickCaptureFrequent,
    QuickCaptureLearnedPatternDto,
} from '@/types'

const NOW = new Date('2026-07-24T15:00:00-03:00')
const mercadoPago = buildAccount({
    name: 'Mercado Pago',
    type: 'wallet',
    currency: 'ARS',
    supportedCurrencies: ['ARS'],
})
const galicia = buildAccount({
    name: 'Galicia',
    type: 'bank',
    currency: 'ARS',
    supportedCurrencies: ['ARS', 'USD'],
})
const usdAccount = buildAccount({
    name: 'Caja USD',
    type: 'savings',
    currency: 'USD',
    supportedCurrencies: ['USD'],
})
const restaurant = buildCategory({
    name: 'Delivery y restaurantes',
    type: 'expense',
})
const salary = buildCategory({
    name: 'Sueldo',
    type: 'income',
})
const groceries = buildCategory({
    name: 'Alimentos',
    type: 'expense',
})

const aliases: QuickCaptureAliasDto[] = [{
    _id: 'alias-mp',
    term: 'mp',
    normalizedTerm: 'mp',
    targetType: 'account',
    targetId: mercadoPago._id.toString(),
    targetLabel: 'Mercado Pago',
    usageCount: 0,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
}]

const frequents: QuickCaptureFrequent[] = [{
    key: 'cafe',
    type: 'expense',
    amount: 1500,
    currency: 'ARS',
    description: 'Café',
    occurrences: 3,
    lastUsedAt: NOW.toISOString(),
}]

function parse(text: string, withAliases = aliases) {
    return parseQuickCapture(text, {
        accounts: [mercadoPago, galicia, usdAccount],
        categories: [restaurant],
        aliases: withAliases,
        frequents,
        now: NOW,
    })
}

describe('parseQuickCapture', () => {
    it.each([
        'Café 1500 ayer mp',
        '1500 café mp ayer',
    ])('interpreta monto, fecha y alias sin depender del orden: %s', (text) => {
        const result = parse(text)

        expect(result.draft).toMatchObject({
            type: 'expense',
            amount: 1500,
            currency: 'ARS',
            description: 'Café',
            accountId: mercadoPago._id.toString(),
        })
        expect(result.draft.date).toEqual(new Date(2026, 6, 23))
    })

    it('detecta ingresos y conserva la cuenta destino inferida', () => {
        const result = parse('cobré 800000 sueldo galicia')

        expect(result.draft).toMatchObject({
            type: 'income',
            amount: 800000,
            currency: 'ARS',
            accountId: galicia._id.toString(),
        })
        expect(result.draft.description).toBe('Sueldo')
    })

    it('respeta USD y limita la cuenta inferida a una compatible', () => {
        const result = parse('12 usd netflix', [])

        expect(result.draft).toMatchObject({
            type: 'expense',
            amount: 12,
            currency: 'USD',
            description: 'Netflix',
            accountId: galicia._id.toString(),
        })
    })

    it.each(['syer', 'ayyer'])('corrige %s como ayer y lo deja visible', (text) => {
        const result = parse(`Café 1500 ${text} mp`)

        expect(result.draft.date).toEqual(new Date(2026, 6, 23))
        expect(result.corrections).toContainEqual(expect.objectContaining({
            source: text,
            target: 'ayer',
        }))
        expect(result.tokens.find((token) => token.value === text)?.kind).toBe('correction')
    })

    it.each(['cafw', 'xafé'])('sugiere Café para %s sin reemplazar el texto', (text) => {
        const result = parse(`${text} 1500 mp`)

        expect(result.draft.description).toBe(
            text[0].toLocaleUpperCase('es-AR') + text.slice(1)
        )
        expect(result.suggestions).toContainEqual(expect.objectContaining({
            sourceText: text,
            targetType: 'description',
            targetLabel: 'Café',
        }))
    })

    it('no reemplaza automáticamente cage', () => {
        const result = parse('cage 1500 mp')

        expect(result.draft.description).toBe('Cage')
    })

    it('propone mp como Mercado Pago antes de aprender el alias', () => {
        const result = parse('Café 1500 ayer mp', [])

        expect(result.draft.description).toBe('Café')
        expect(result.suggestions).toContainEqual(expect.objectContaining({
            sourceText: 'mp',
            targetType: 'account',
            targetLabel: 'Mercado Pago',
        }))
    })

    it('reconoce nombres de cuenta y categoría de varias palabras', () => {
        const result = parse(
            'Café 1500 delivery y restaurantes mercado pago',
            []
        )

        expect(result.draft).toMatchObject({
            description: 'Café',
            accountId: mercadoPago._id.toString(),
            categoryId: restaurant._id.toString(),
        })
    })

    it.each([
        ['antes de ayer', new Date(2026, 6, 22)],
        ['lunes', new Date(2026, 6, 20)],
        ['lun', new Date(2026, 6, 20)],
        ['el lunes', new Date(2026, 6, 20)],
        ['lunes pasado', new Date(2026, 6, 20)],
        ['prox lunes', new Date(2026, 6, 27)],
        ['próximo lunes', new Date(2026, 6, 27)],
        ['lunes que viene', new Date(2026, 6, 27)],
        ['hace 2 lunes', new Date(2026, 6, 13)],
        ['2 lunes atrás', new Date(2026, 6, 13)],
        ['dentro de 2 lunes', new Date(2026, 7, 3)],
        ['hace 2 semanas', new Date(2026, 6, 10)],
        ['hace dos semanas', new Date(2026, 6, 10)],
        ['la semana pasada', new Date(2026, 6, 17)],
        ['la semana que viene', new Date(2026, 6, 31)],
        ['hace 3 días', new Date(2026, 6, 21)],
        ['3 días atrás', new Date(2026, 6, 21)],
    ])('interpreta la expresión argentina de fecha "%s"', (phrase, expectedDate) => {
        const result = parse(`Café 1500 ${phrase} mp`)

        expect(result.draft.date).toEqual(expectedDate)
        expect(result.draft.description).toBe('Café')
    })

    it('autocompleta prefijos usando valores de reglas activas', () => {
        const rules = [{
            _id: 'rule-verduleria',
            userId: 'user',
            name: 'Verdulería',
            isActive: true,
            priority: 10,
            appliesTo: 'expense',
            field: 'description',
            condition: 'contains',
            value: 'Verdulería',
            createdAt: NOW,
            updatedAt: NOW,
        }] as unknown as ITransactionRule[]

        const result = parseQuickCapture('Verdu', {
            accounts: [mercadoPago],
            categories: [restaurant],
            rules,
            now: NOW,
        })

        expect(result.suggestions[0]).toMatchObject({
            sourceText: 'Verdu',
            targetType: 'description',
            targetLabel: 'Verdulería',
        })
    })

    it('deja una palabra común como descripción y marca abreviaturas no resueltas', () => {
        const result = parseQuickCapture('chino 1500 ayer zz', {
            accounts: [galicia],
            categories: [restaurant],
            aliases: [],
            now: NOW,
        })

        expect(result.draft.description).toBe('Chino zz')
        expect(result.unresolvedTokens).toEqual(['zz'])
    })
})

describe('quick capture presentation helpers', () => {
    it('expone sólo el sufijo pendiente para mostrarlo dentro del texto', () => {
        const suggestion = parseQuickCapture('Verdu', {
            accounts: [mercadoPago],
            categories: [restaurant],
            rules: [{
                _id: 'rule-verduleria',
                userId: 'user',
                name: 'Verdulería',
                isActive: true,
                priority: 10,
                appliesTo: 'expense',
                field: 'description',
                condition: 'contains',
                value: 'Verdulería',
                createdAt: NOW,
                updatedAt: NOW,
            }] as unknown as ITransactionRule[],
            now: NOW,
        }).suggestions[0]

        expect(getQuickCaptureInlineCompletion('Verdu', suggestion)).toMatchObject({
            target: 'Verdulería',
            suffix: 'lería',
        })
    })

    it('no muestra ghost text cuando la sugerencia no completa el último fragmento', () => {
        const suggestion = {
            id: 'description:verduleria:0',
            sourceText: 'Verdu',
            targetType: 'description' as const,
            targetValue: 'Verdulería',
            targetLabel: 'Verdulería',
            reason: 'Completar',
            confidence: 0.9,
            start: 0,
            end: 5,
        }

        expect(getQuickCaptureInlineCompletion('Verdu 1500', suggestion)).toBeUndefined()
    })

    it('refleja todos los valores resueltos por reglas en el borrador visible', () => {
        const draft = parse('Sueldo 800000 galicia').draft
        const resolved = resolveQuickCapturePreviewDraft(draft, {
            valid: true,
            normalized: {
                type: 'income',
                amount: 800000,
                currency: 'ARS',
                date: '2026-07-24T03:00:00.000Z',
                description: 'Sueldo',
                destinationAccountId: galicia._id.toString(),
                categoryId: salary._id.toString(),
                merchant: 'Empresa SA',
            },
            category: {
                id: salary._id.toString(),
                name: salary.name,
            },
            issues: [],
        })

        expect(resolved).toMatchObject({
            type: 'income',
            amount: 800000,
            currency: 'ARS',
            description: 'Sueldo',
            accountId: galicia._id.toString(),
            categoryId: salary._id.toString(),
            merchant: 'Empresa SA',
        })
        expect(resolved.date).toEqual(new Date('2026-07-24T03:00:00.000Z'))
    })
})

describe('quick capture learned patterns', () => {
    function learnedPattern(
        overrides: Partial<QuickCaptureLearnedPatternDto> = {}
    ): QuickCaptureLearnedPatternDto {
        return {
            key: 'a'.repeat(64),
            triggerKind: 'token',
            triggerTerm: 'verduleria',
            triggerLabel: 'Verdulería',
            transactionType: 'expense',
            currency: 'ARS',
            targetType: 'category',
            targetId: groceries._id.toString(),
            targetLabel: groceries.name,
            occurrences: 5,
            total: 5,
            consistency: 1,
            confidence: 0.95,
            lead: 5,
            acceptedCount: 0,
            dismissedCount: 0,
            revertedCount: 0,
            correctedCount: 0,
            lastSeenAt: NOW.toISOString(),
            autoApply: true,
            status: 'active',
            reason: 'Usaste Verdulería con Alimentos en 5 de 5 movimientos similares.',
            canConvertToRule: false,
            ...overrides,
        }
    }

    it('auto-applies high-confidence category evidence with provenance', () => {
        const result = parseQuickCapture('Verdulería 1500', {
            accounts: [mercadoPago],
            categories: [groceries, restaurant],
            learnedPatterns: [learnedPattern()],
            now: NOW,
        })

        expect(result.draft.categoryId).toBe(groceries._id.toString())
        expect(result.personalizations).toEqual([
            expect.objectContaining({
                patternKey: 'a'.repeat(64),
                targetType: 'category',
                targetLabel: 'Alimentos',
            }),
        ])
    })

    it('shows medium evidence as a suggestion without removing the description', () => {
        const result = parseQuickCapture('Verdulería 1500', {
            accounts: [mercadoPago],
            categories: [groceries],
            learnedPatterns: [learnedPattern({
                occurrences: 3,
                total: 4,
                consistency: 0.75,
                confidence: 0.72,
                autoApply: false,
            })],
            now: NOW,
        })

        expect(result.draft.categoryId).toBeUndefined()
        expect(result.draft.description).toBe('Verdulería')
        expect(result.suggestions[0]).toMatchObject({
            source: 'learned',
            targetType: 'category',
            preserveSourceText: true,
        })
    })

    it('never overrides an explicitly written category', () => {
        const result = parseQuickCapture(
            'Verdulería Delivery y restaurantes 1500',
            {
                accounts: [mercadoPago],
                categories: [groceries, restaurant],
                learnedPatterns: [learnedPattern()],
                now: NOW,
            }
        )

        expect(result.draft.categoryId).toBe(restaurant._id.toString())
        expect(result.personalizations).toEqual([])
    })

    it('keeps an active rule above a learned category', () => {
        const result = parseQuickCapture('Verdulería 1500', {
            accounts: [mercadoPago],
            categories: [groceries, restaurant],
            learnedPatterns: [learnedPattern()],
            rules: [{
                _id: 'rule-verduleria',
                userId: 'user',
                name: 'Verdulería',
                isActive: true,
                priority: 10,
                appliesTo: 'expense',
                field: 'description',
                condition: 'contains',
                value: 'Verdulería',
                categoryId: restaurant._id,
                createdAt: NOW,
                updatedAt: NOW,
            }] as unknown as ITransactionRule[],
            now: NOW,
        })

        expect(result.draft.categoryId).toBeUndefined()
        expect(result.personalizations).toEqual([])
    })
})
