import { describe, expect, it } from 'vitest'
import {
    buildDebtSummary,
    computeDirectSpaceDebts,
    computeSimplifiedSpaceDebts,
    consolidateDebtsByPerson,
    isAccountCurrencyCompatible,
} from '@/lib/utils/debt'
import type { SpaceBalanceItem, ISpaceParticipant } from '@/types'
import type { IDebt } from '@/types/debt'

function makeParticipant(id: string, displayName: string, userId?: string): ISpaceParticipant {
    return {
        _id: id,
        spaceId: 'space-1',
        kind: userId ? 'finp_user' : 'external',
        userId: userId as unknown as undefined,
        displayName,
        role: 'participant',
        inviteStatus: 'accepted',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as unknown as ISpaceParticipant
}

function makeBalance(participantId: string, balanceReporting: number): SpaceBalanceItem {
    return {
        participantId,
        displayName: participantId,
        kind: 'finp_user',
        role: 'participant',
        inviteStatus: 'accepted',
        paidReporting: 0,
        shareReporting: 0,
        balanceReporting,
    }
}

function makeDebt(overrides: Partial<IDebt>): IDebt {
    return {
        _id: 'debt-1' as unknown as IDebt['_id'],
        userId: 'user-1' as unknown as IDebt['userId'],
        direction: 'payable',
        sourceType: 'manual',
        counterpartyNameSnapshot: 'Juan',
        amount: 100,
        remainingAmount: 100,
        currency: 'ARS',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    } as IDebt
}

const participants = [
    makeParticipant('p-me', 'Yo', 'user-me'),
    makeParticipant('p-juan', 'Juan', 'user-juan'),
    makeParticipant('p-ana', 'Ana', 'user-ana'),
]

describe('computeSimplifiedSpaceDebts', () => {
    it('detecta que el usuario debe pagar cuando su balance es negativo', () => {
        const balances = [
            makeBalance('p-me', -100),
            makeBalance('p-juan', 100),
        ]
        const result = computeSimplifiedSpaceDebts(balances, participants, 'p-me', 'ARS')
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            counterpartyParticipantId: 'p-juan',
            amount: 100,
            direction: 'payable',
            currency: 'ARS',
        })
    })

    it('detecta que le deben cuando el balance es positivo', () => {
        const balances = [
            makeBalance('p-me', 100),
            makeBalance('p-juan', -100),
        ]
        const result = computeSimplifiedSpaceDebts(balances, participants, 'p-me', 'ARS')
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            counterpartyParticipantId: 'p-juan',
            amount: 100,
            direction: 'receivable',
        })
    })

    it('retorna vacío si el balance del usuario es cero', () => {
        const balances = [
            makeBalance('p-me', 0),
            makeBalance('p-juan', 50),
            makeBalance('p-ana', -50),
        ]
        const result = computeSimplifiedSpaceDebts(balances, participants, 'p-me', 'ARS')
        expect(result).toHaveLength(0)
    })

    it('minimiza transacciones con múltiples participantes', () => {
        // Me: -150, Juan: +100, Ana: +50 → debería pagar 100 a Juan y 50 a Ana
        const balances = [
            makeBalance('p-me', -150),
            makeBalance('p-juan', 100),
            makeBalance('p-ana', 50),
        ]
        const result = computeSimplifiedSpaceDebts(balances, participants, 'p-me', 'ARS')
        expect(result).toHaveLength(2)
        const toJuan = result.find((r) => r.counterpartyParticipantId === 'p-juan')
        const toAna = result.find((r) => r.counterpartyParticipantId === 'p-ana')
        expect(toJuan?.amount).toBe(100)
        expect(toAna?.amount).toBe(50)
        expect(result.every((r) => r.direction === 'payable')).toBe(true)
    })
})

describe('computeDirectSpaceDebts', () => {
    it('calcula proporcional a los créditos de cada acreedor', () => {
        // Me: -100, Juan: +60, Ana: +40 → debo 60 a Juan, 40 a Ana
        const balances = [
            makeBalance('p-me', -100),
            makeBalance('p-juan', 60),
            makeBalance('p-ana', 40),
        ]
        const result = computeDirectSpaceDebts(balances, participants, 'p-me', 'ARS')
        expect(result).toHaveLength(2)
        const toJuan = result.find((r) => r.counterpartyParticipantId === 'p-juan')
        const toAna = result.find((r) => r.counterpartyParticipantId === 'p-ana')
        expect(toJuan?.amount).toBeCloseTo(60, 1)
        expect(toAna?.amount).toBeCloseTo(40, 1)
    })

    it('retorna vacío si el balance del usuario es positivo (es acreedor)', () => {
        const balances = [
            makeBalance('p-me', 100),
            makeBalance('p-juan', -100),
        ]
        const result = computeDirectSpaceDebts(balances, participants, 'p-me', 'ARS')
        expect(result.filter((r) => r.direction === 'payable')).toHaveLength(0)
    })
})

describe('buildDebtSummary', () => {
    it('separa correctamente payable y receivable por moneda', () => {
        const debts = [
            makeDebt({ direction: 'payable', currency: 'ARS', remainingAmount: 1000, status: 'active' }),
            makeDebt({ _id: 'debt-2' as unknown as IDebt['_id'], direction: 'payable', currency: 'USD', remainingAmount: 50, status: 'active' }),
            makeDebt({ _id: 'debt-3' as unknown as IDebt['_id'], direction: 'receivable', currency: 'ARS', remainingAmount: 500, status: 'partially_paid' }),
        ]
        const summary = buildDebtSummary(debts)
        expect(summary.payable.byCurrency['ARS']).toBe(1000)
        expect(summary.payable.byCurrency['USD']).toBe(50)
        expect(summary.receivable.byCurrency['ARS']).toBe(500)
    })

    it('excluye deudas ignored, paid y cancelled del resumen', () => {
        const debts = [
            makeDebt({ direction: 'payable', currency: 'ARS', remainingAmount: 100, status: 'ignored' }),
            makeDebt({ _id: 'debt-2' as unknown as IDebt['_id'], direction: 'payable', currency: 'ARS', remainingAmount: 200, status: 'paid' }),
            makeDebt({ _id: 'debt-3' as unknown as IDebt['_id'], direction: 'payable', currency: 'ARS', remainingAmount: 300, status: 'active' }),
        ]
        const summary = buildDebtSummary(debts)
        expect(summary.payable.byCurrency['ARS']).toBe(300)
    })
})

describe('consolidateDebtsByPerson', () => {
    it('agrupa deudas de la misma contraparte', () => {
        const debts = [
            makeDebt({ counterpartyNameSnapshot: 'Juan', direction: 'payable', currency: 'ARS', remainingAmount: 500, status: 'active' }),
            makeDebt({ _id: 'debt-2' as unknown as IDebt['_id'], counterpartyNameSnapshot: 'Juan', direction: 'payable', currency: 'USD', remainingAmount: 20, status: 'active' }),
        ]
        const consolidated = consolidateDebtsByPerson(debts)
        expect(consolidated).toHaveLength(1)
        expect(consolidated[0]?.counterpartyNameSnapshot).toBe('Juan')
        expect(consolidated[0]?.payable['ARS']).toBe(500)
        expect(consolidated[0]?.payable['USD']).toBe(20)
    })

    it('mantiene payable y receivable separados por persona', () => {
        const debts = [
            makeDebt({ counterpartyNameSnapshot: 'Ana', direction: 'payable', currency: 'ARS', remainingAmount: 100, status: 'active' }),
            makeDebt({ _id: 'debt-2' as unknown as IDebt['_id'], counterpartyNameSnapshot: 'Ana', direction: 'receivable', currency: 'ARS', remainingAmount: 50, status: 'active' }),
        ]
        const consolidated = consolidateDebtsByPerson(debts)
        expect(consolidated).toHaveLength(1)
        expect(consolidated[0]?.payable['ARS']).toBe(100)
        expect(consolidated[0]?.receivable['ARS']).toBe(50)
    })
})

describe('isAccountCurrencyCompatible', () => {
    it('acepta cuando la moneda principal coincide', () => {
        expect(isAccountCurrencyCompatible('ARS', undefined, 'ARS')).toBe(true)
    })

    it('acepta cuando la moneda está en supportedCurrencies', () => {
        expect(isAccountCurrencyCompatible('ARS', ['ARS', 'USD'], 'USD')).toBe(true)
    })

    it('rechaza cuando la moneda no está soportada', () => {
        expect(isAccountCurrencyCompatible('ARS', ['ARS'], 'USD')).toBe(false)
    })
})
