import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'

import {
    assessLinkCandidateV2,
    describeLinkIssue,
    expectedLinkTransactionType,
    firstLinkIssue,
    linkAccountRuleForVariant,
    linkIssueErrorCode,
    resolveLinkImpactVariant,
    type LinkRequirementV2,
} from '@/lib/server/space-link-candidate-v2'
import type { ITransaction } from '@/types'

function transaction(overrides: Partial<ITransaction> = {}): Parameters<typeof assessLinkCandidateV2>[0] {
    return {
        type: 'expense',
        currency: 'ARS',
        amount: 1000,
        operationalAmount: 1000,
        date: new Date('2026-09-10T12:00:00.000Z'),
        sourceAccountId: new Types.ObjectId(),
        destinationAccountId: undefined,
        ...overrides,
    }
}

function requirement(overrides: Partial<LinkRequirementV2> = {}): LinkRequirementV2 {
    return {
        transactionType: 'expense',
        currency: 'ARS',
        amount: 1000,
        operationalAmount: 1000,
        accountRule: 'source_required',
        dateKey: '2026-09-10',
        timezone: 'America/Argentina/Buenos_Aires',
        ...overrides,
    }
}

describe('resolveLinkImpactVariant', () => {
    it('distingue pagador de participante en un gasto personal', () => {
        expect(resolveLinkImpactVariant({ kind: 'personal_expense', isPayer: true })).toBe('payer_expense')
        expect(resolveLinkImpactVariant({ kind: 'personal_expense', isPayer: false })).toBe('participant_expense')
    })

    it('adelanto y liquidaciones no dependen de isPayer', () => {
        expect(resolveLinkImpactVariant({ kind: 'advance', isPayer: false })).toBe('advance')
        expect(resolveLinkImpactVariant({ kind: 'settlement_paid', isPayer: false })).toBe('settlement_paid')
        expect(resolveLinkImpactVariant({ kind: 'settlement_received', isPayer: true })).toBe('settlement_received')
    })
})

describe('expectedLinkTransactionType y linkAccountRuleForVariant', () => {
    it('un gasto personal (pagador o participante) espera expense', () => {
        expect(expectedLinkTransactionType('payer_expense')).toBe('expense')
        expect(expectedLinkTransactionType('participant_expense')).toBe('expense')
        expect(expectedLinkTransactionType('advance')).toBe('expense')
    })

    it('liquidaciones esperan el tipo de deuda correspondiente', () => {
        expect(expectedLinkTransactionType('settlement_paid')).toBe('personal_debt_payment')
        expect(expectedLinkTransactionType('settlement_received')).toBe('personal_debt_collect')
    })

    it('sólo el participante sin parte propia no debe mover cuenta', () => {
        expect(linkAccountRuleForVariant('participant_expense')).toBe('none')
        expect(linkAccountRuleForVariant('payer_expense')).toBe('source_required')
        expect(linkAccountRuleForVariant('advance')).toBe('source_required')
        expect(linkAccountRuleForVariant('settlement_paid')).toBe('source_required')
        expect(linkAccountRuleForVariant('settlement_received')).toBe('destination_required')
    })
})

describe('assessLinkCandidateV2', () => {
    it('una transacción que cumple todo es compatible', () => {
        const result = assessLinkCandidateV2(transaction(), requirement())
        expect(result).toEqual({ compatible: true, issues: [] })
    })

    it('acepta credit_card_expense como equivalente de expense (decisión 0012)', () => {
        const result = assessLinkCandidateV2(
            transaction({ type: 'credit_card_expense' }),
            requirement()
        )
        expect(result.compatible).toBe(true)
    })

    it('un tipo genuinamente distinto es incompatible', () => {
        const result = assessLinkCandidateV2(
            transaction({ type: 'income' }),
            requirement()
        )
        expect(result.issues).toContain('type_mismatch')
    })

    it('detecta moneda distinta', () => {
        const result = assessLinkCandidateV2(
            transaction({ currency: 'USD' }),
            requirement()
        )
        expect(result.issues).toContain('currency_mismatch')
    })

    it('detecta un monto que no coincide en unidades menores exactas', () => {
        const result = assessLinkCandidateV2(
            transaction({ amount: 1000.5 }),
            requirement({ amount: 1000 })
        )
        expect(result.issues).toContain('amount_mismatch')
    })

    it('detecta un monto operacional que no coincide', () => {
        const result = assessLinkCandidateV2(
            transaction({ operationalAmount: 500 }),
            requirement({ operationalAmount: 1000 })
        )
        expect(result.issues).toContain('operational_mismatch')
    })

    it('usa el monto como operacional cuando la transacción no lo tiene', () => {
        const result = assessLinkCandidateV2(
            transaction({ amount: 1000, operationalAmount: undefined }),
            requirement({ operationalAmount: 1000 })
        )
        expect(result.issues).not.toContain('operational_mismatch')
    })

    it('detecta una fecha fuera del día financiero cuando el requisito la exige', () => {
        const result = assessLinkCandidateV2(
            transaction({ date: new Date('2026-09-11T12:00:00.000Z') }),
            requirement({ dateKey: '2026-09-10', timezone: 'America/Argentina/Buenos_Aires' })
        )
        expect(result.issues).toContain('date_mismatch')
    })

    it('omite el chequeo de fecha cuando el requisito no la trae (preview sin dateKey)', () => {
        const result = assessLinkCandidateV2(
            transaction({ date: new Date('2026-01-01T12:00:00.000Z') }),
            requirement({ dateKey: undefined, timezone: undefined })
        )
        expect(result.issues).not.toContain('date_mismatch')
    })

    it('un participante sin parte propia no debe traer cuenta', () => {
        const result = assessLinkCandidateV2(
            transaction({ sourceAccountId: new Types.ObjectId() }),
            requirement({ accountRule: 'none' })
        )
        expect(result.issues).toContain('account_mismatch')
    })

    it('un pagador exige cuenta origen', () => {
        const result = assessLinkCandidateV2(
            transaction({ sourceAccountId: undefined }),
            requirement({ accountRule: 'source_required' })
        )
        expect(result.issues).toContain('account_mismatch')
    })

    it('un cobro de liquidación exige cuenta destino', () => {
        const result = assessLinkCandidateV2(
            transaction({ sourceAccountId: undefined, destinationAccountId: new Types.ObjectId() }),
            requirement({ accountRule: 'destination_required' })
        )
        expect(result.issues).not.toContain('account_mismatch')

        const missing = assessLinkCandidateV2(
            transaction({ sourceAccountId: undefined, destinationAccountId: undefined }),
            requirement({ accountRule: 'destination_required' })
        )
        expect(missing.issues).toContain('account_mismatch')
    })

    it('acumula todos los issues encontrados, no sólo el primero', () => {
        const result = assessLinkCandidateV2(
            transaction({ type: 'income', currency: 'USD', amount: 1 }),
            requirement()
        )
        expect(result.issues).toEqual(
            expect.arrayContaining(['type_mismatch', 'currency_mismatch', 'amount_mismatch'])
        )
        expect(result.compatible).toBe(false)
    })
})

describe('firstLinkIssue', () => {
    it('respeta el orden tipo/moneda, monto, operacional, fecha, cuenta', () => {
        expect(firstLinkIssue(['account_mismatch', 'type_mismatch'])).toBe('type_mismatch')
        expect(firstLinkIssue(['date_mismatch', 'amount_mismatch'])).toBe('amount_mismatch')
        expect(firstLinkIssue(['account_mismatch'])).toBe('account_mismatch')
        expect(firstLinkIssue([])).toBeUndefined()
    })
})

describe('describeLinkIssue', () => {
    it('da un mensaje específico por regla de cuenta', () => {
        expect(describeLinkIssue('account_mismatch', 'none')).toMatch(/no pagador/)
        expect(describeLinkIssue('account_mismatch', 'source_required')).toMatch(/cuenta origen/)
        expect(describeLinkIssue('account_mismatch', 'destination_required')).toMatch(/cuenta destino/)
    })
})

describe('linkIssueErrorCode', () => {
    it('tipo y moneda comparten un solo código, como las copias que reemplaza', () => {
        expect(linkIssueErrorCode('type_mismatch')).toBe('SPACE_TRANSACTION_TYPE_MISMATCH')
        expect(linkIssueErrorCode('currency_mismatch')).toBe('SPACE_TRANSACTION_TYPE_MISMATCH')
    })

    it('el resto tiene un código propio', () => {
        expect(linkIssueErrorCode('amount_mismatch')).toBe('SPACE_TRANSACTION_AMOUNT_MISMATCH')
        expect(linkIssueErrorCode('operational_mismatch')).toBe('SPACE_TRANSACTION_OPERATIONAL_MISMATCH')
        expect(linkIssueErrorCode('date_mismatch')).toBe('SPACE_TRANSACTION_DATE_MISMATCH')
        expect(linkIssueErrorCode('account_mismatch')).toBe('SPACE_TRANSACTION_ACCOUNT_MISMATCH')
    })
})
