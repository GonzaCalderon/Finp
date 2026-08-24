import { describe, expect, it } from 'vitest'

import {
    SpaceFinancialRuleError,
    calculateSpaceBalancesV2,
    calculateSpaceDebtProjectionsV2,
    calculateSpaceSharesV2,
    convertSpaceAmountV2,
    derivePersonalImpactAmountsV2,
    financialDateKeyFromInstant,
    financialDateKeyToInstant,
    normalizeFinancialDateKey,
} from '@/lib/utils/space-financial-v2'

describe('space financial v2 — reparto estricto', () => {
    it('cierra un reparto igual en centavos con residuo determinista', () => {
        const shares = calculateSpaceSharesV2({
            amount: 100,
            reportingAmount: 100,
            splitMode: 'equal',
            participantIds: ['a', 'b', 'c'],
        })
        expect(shares).toEqual([
            { participantId: 'a', amount: 33.33, reportingAmount: 33.33 },
            { participantId: 'b', amount: 33.33, reportingAmount: 33.33 },
            { participantId: 'c', amount: 33.34, reportingAmount: 33.34 },
        ])
    })

    it('calcula porcentajes y conserva el total convertido', () => {
        const shares = calculateSpaceSharesV2({
            amount: 10,
            reportingAmount: 12_345.67,
            splitMode: 'percentage',
            participantIds: ['a', 'b'],
            allocations: [
                { participantId: 'a', percentage: 25 },
                { participantId: 'b', percentage: 75 },
            ],
        })
        expect(shares.reduce((sum, share) => sum + share.amount, 0)).toBe(10)
        expect(shares.reduce((sum, share) => sum + share.reportingAmount, 0)).toBe(12_345.67)
    })

    it('rechaza porcentajes incompletos, montos que no cierran y duplicados', () => {
        expect(() => calculateSpaceSharesV2({
            amount: 100,
            reportingAmount: 100,
            splitMode: 'percentage',
            participantIds: ['a', 'b'],
            allocations: [
                { participantId: 'a', percentage: 50 },
                { participantId: 'b', percentage: 49 },
            ],
        })).toThrow(SpaceFinancialRuleError)
        expect(() => calculateSpaceSharesV2({
            amount: 100,
            reportingAmount: 100,
            splitMode: 'fixed',
            participantIds: ['a', 'b'],
            allocations: [
                { participantId: 'a', amount: 40 },
                { participantId: 'b', amount: 50 },
            ],
        })).toThrow('cerrar exactamente')
        expect(() => calculateSpaceSharesV2({
            amount: 100,
            reportingAmount: 100,
            splitMode: 'equal',
            participantIds: ['a', 'a'],
        })).toThrow('duplicados')
    })

    it('responsable único exige una identidad y monto cero no inventa partes', () => {
        expect(calculateSpaceSharesV2({
            amount: 0,
            reportingAmount: 0,
            splitMode: 'equal',
            participantIds: ['a', 'b'],
        })).toEqual([])
        expect(() => calculateSpaceSharesV2({
            amount: 10,
            reportingAmount: 10,
            splitMode: 'none',
            participantIds: ['a', 'b'],
        })).toThrow('exactamente una')
    })
})

describe('space financial v2 — moneda y día financiero', () => {
    it('exige cotización al cambiar moneda y conserva snapshot explícito', () => {
        expect(convertSpaceAmountV2({
            amount: 10,
            currency: 'USD',
            reportingCurrency: 'ARS',
            exchangeRate: 1_234.567,
        })).toEqual({ reportingAmount: 12_345.67, exchangeRate: 1_234.567 })
        expect(() => convertSpaceAmountV2({
            amount: 10,
            currency: 'USD',
            reportingCurrency: 'ARS',
        })).toThrow('cotización explícita')
    })

    it('representa el día civil sin corrimiento durante cambios DST', () => {
        for (const dateKey of ['2026-03-08', '2026-11-01']) {
            const instant = financialDateKeyToInstant(dateKey, 'America/New_York')
            expect(financialDateKeyFromInstant(instant, 'America/New_York')).toBe(dateKey)
        }
        const buenosAires = financialDateKeyToInstant('2026-08-24', 'America/Argentina/Buenos_Aires')
        expect(financialDateKeyFromInstant(buenosAires, 'America/Argentina/Buenos_Aires')).toBe('2026-08-24')
    })

    it('rechaza fechas inexistentes y zonas no IANA', () => {
        expect(() => normalizeFinancialDateKey('2026-02-30')).toThrow('no existe')
        expect(() => financialDateKeyToInstant('2026-08-24', 'Buenos Aires')).toThrow('IANA')
    })
})

describe('space financial v2 — matriz de impacto personal', () => {
    it.each([
        ['pagador total', { entryType: 'expense' as const, entryAmount: 100, ownShareAmount: 100, isPayer: true }, 'personal_expense', 100, 100, 0],
        ['pagador con adelanto', { entryType: 'expense' as const, entryAmount: 100, ownShareAmount: 40, isPayer: true }, 'personal_expense', 100, 40, 60],
        ['pagador con parte cero', { entryType: 'expense' as const, entryAmount: 100, ownShareAmount: 0, isPayer: true }, 'advance', 100, 0, 100],
        ['no pagador con parte', { entryType: 'expense' as const, entryAmount: 100, ownShareAmount: 40, isPayer: false }, 'personal_expense', 0, 40, 0],
    ])('%s', (_label, input, kind, accountImpact, operational, recoverable) => {
        const result = derivePersonalImpactAmountsV2(input)
        expect(result).toMatchObject({
            action: 'create',
            kind,
            accountImpactAmount: accountImpact,
            operationalAmount: operational,
            recoverableAdvanceAmount: recoverable,
        })
    })

    it('no pagador con parte cero no tiene acción financiera', () => {
        expect(derivePersonalImpactAmountsV2({
            entryType: 'expense',
            entryAmount: 100,
            ownShareAmount: 0,
            isPayer: false,
        })).toEqual({
            action: 'none',
            ownShareAmount: 0,
            accountImpactAmount: 0,
            operationalAmount: 0,
            recoverableAdvanceAmount: 0,
        })
    })

    it('liquidaciones mueven cuenta y nunca reporting operacional', () => {
        expect(derivePersonalImpactAmountsV2({
            entryType: 'settlement',
            entryAmount: 30,
            ownShareAmount: 0,
            isPayer: true,
        })).toMatchObject({ kind: 'settlement_paid', accountImpactAmount: 30, operationalAmount: 0 })
        expect(derivePersonalImpactAmountsV2({
            entryType: 'settlement',
            entryAmount: 30,
            ownShareAmount: 0,
            isPayer: false,
            isReceiver: true,
        })).toMatchObject({ kind: 'settlement_received', accountImpactAmount: 30, operationalAmount: 0 })
    })
})

describe('space financial v2 — ledger y deudas', () => {
    const participants = [
        { participantId: 'a', displayName: 'A', userId: 'ua' },
        { participantId: 'b', displayName: 'B', userId: 'ub' },
        { participantId: 'c', displayName: 'C' },
    ]

    it('incluye historia de participantes y descuenta una liquidación una sola vez', () => {
        const entries = [
            {
                entryId: 'expense', status: 'recorded' as const, type: 'expense' as const,
                amount: 100, reportingAmount: 100, paidByParticipantId: 'a',
                sharedWithParticipantIds: ['b'], splitMode: 'none' as const,
            },
            {
                entryId: 'settlement', status: 'recorded' as const, type: 'settlement' as const,
                amount: 40, reportingAmount: 40, paidByParticipantId: 'b',
                sharedWithParticipantIds: ['a'], splitMode: 'none' as const,
            },
        ]
        const balances = calculateSpaceBalancesV2(entries, participants)
        expect(balances.find((balance) => balance.participantId === 'a')?.balanceReporting).toBe(60)
        expect(balances.find((balance) => balance.participantId === 'b')?.balanceReporting).toBe(-60)
        expect(balances.find((balance) => balance.participantId === 'c')?.balanceReporting).toBe(0)
        expect(calculateSpaceDebtProjectionsV2({ mode: 'direct', entries, participants })).toEqual([
            { fromParticipantId: 'b', toParticipantId: 'a', amount: 60 },
        ])
    })

    it('simplifica sin mezclar el total con la parte propia', () => {
        const entries = [{
            entryId: 'expense', status: 'recorded' as const, type: 'expense' as const,
            amount: 90, reportingAmount: 90, paidByParticipantId: 'a',
            sharedWithParticipantIds: ['a', 'b', 'c'], splitMode: 'equal' as const,
        }]
        expect(calculateSpaceDebtProjectionsV2({ mode: 'simplified', entries, participants })).toEqual([
            { fromParticipantId: 'b', toParticipantId: 'a', amount: 30 },
            { fromParticipantId: 'c', toParticipantId: 'a', amount: 30 },
        ])
    })
})
