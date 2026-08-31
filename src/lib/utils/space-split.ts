/**
 * Pure helpers for split allocation calculations.
 * Extracted from SpaceSplitConfigurator for testability.
 */

import { moneyFromDecimal, moneyToNumber } from '@/lib/utils/money'

export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

export function roundCurrency(value: number, currency: string): number {
    try {
        return moneyToNumber(moneyFromDecimal(currency, value))
    } catch {
        return round2(value)
    }
}

export function currencyAmountsEqual(left: number, right: number, currency: string): boolean {
    try {
        return moneyFromDecimal(currency, left).minorUnits === moneyFromDecimal(currency, right).minorUnits
    } catch {
        return Math.abs(left - right) <= 0.01
    }
}

export function sumCurrencyAmounts(amounts: number[], currency: string): number {
    try {
        const zero = moneyFromDecimal(currency, 0)
        const minorUnits = amounts.reduce(
            (sum, amount) => sum + BigInt(moneyFromDecimal(currency, amount).minorUnits),
            BigInt(0)
        )
        return moneyToNumber({ ...zero, minorUnits: minorUnits.toString() })
    } catch {
        return round2(amounts.reduce((sum, amount) => sum + amount, 0))
    }
}

export interface PercentageAllocation {
    participantId: string
    percentage: number
}

export interface FixedAllocation {
    participantId: string
    amount: number
}

/**
 * Smart percentage split: editing one participant auto-calculates the rest.
 *
 * - 1 participant: always 100%, returns fixed allocation.
 * - 2 participants: editing one recalculates the other as residual.
 * - 3+ participants: editing one leaves upper participants unchanged,
 *   distributes remainder among lower participants, last is always residual.
 *
 * Returns the updated allocations, or null if the edit is a no-op
 * (e.g. trying to edit the last residual slot with 3+ participants).
 */
export function applySmartPercentage(
    participantIds: string[],
    currentAllocations: PercentageAllocation[],
    editedId: string,
    rawValue: number
): PercentageAllocation[] | null {
    const count = participantIds.length
    if (count === 0) return null

    const index = participantIds.indexOf(editedId)
    if (index < 0) return null

    if (count === 1) {
        return [{ participantId: editedId, percentage: 100 }]
    }

    const current = participantIds.map((id) => ({
        participantId: id,
        percentage: currentAllocations.find((a) => a.participantId === id)?.percentage ?? 0,
    }))

    if (count === 2) {
        const clamped = round2(Math.max(0, Math.min(100, rawValue)))
        const otherIndex = index === 0 ? 1 : 0
        return participantIds.map((id, i) => ({
            participantId: id,
            percentage: i === index ? clamped : i === otherIndex ? round2(100 - clamped) : 0,
        }))
    }

    // 3+ participants: last slot is residual, not directly editable
    if (index === count - 1) return null

    const upperSum = round2(current.slice(0, index).reduce((acc, item) => acc + item.percentage, 0))
    const maxAllowed = round2(Math.max(0, 100 - upperSum))
    const clamped = round2(Math.max(0, Math.min(maxAllowed, rawValue)))
    const remaining = round2(100 - upperSum - clamped)
    const lowerCount = count - index - 1
    const lowerBase = lowerCount > 0 ? round2(remaining / lowerCount) : 0
    let lowerAssigned = 0

    return current.map((item, i) => {
        if (i < index) return item
        if (i === index) return { ...item, percentage: clamped }
        if (i === count - 1) return { ...item, percentage: round2(remaining - lowerAssigned) }
        lowerAssigned = round2(lowerAssigned + lowerBase)
        return { ...item, percentage: lowerBase }
    })
}

/**
 * Smart fixed-amount split: editing one participant auto-calculates the rest.
 * Mirrors applySmartPercentage but operates on currency amounts.
 *
 * Returns the updated allocations, or null if the edit is a no-op.
 */
export function applySmartFixed(
    participantIds: string[],
    currentAllocations: FixedAllocation[],
    editedId: string,
    rawValue: number,
    totalAmount: number,
    currency = 'ARS'
): FixedAllocation[] | null {
    const count = participantIds.length
    if (count === 0) return null

    const index = participantIds.indexOf(editedId)
    if (index < 0) return null

    if (count === 1) {
        return [{ participantId: editedId, amount: roundCurrency(totalAmount, currency) }]
    }

    const current = participantIds.map((id) => ({
        participantId: id,
        amount: currentAllocations.find((a) => a.participantId === id)?.amount ?? 0,
    }))

    if (count === 2) {
        const clamped = roundCurrency(Math.max(0, Math.min(totalAmount, rawValue)), currency)
        const otherIndex = index === 0 ? 1 : 0
        return participantIds.map((id, i) => ({
            participantId: id,
            amount: i === index ? clamped : i === otherIndex ? roundCurrency(totalAmount - clamped, currency) : 0,
        }))
    }

    // 3+ participants: last slot is residual, not directly editable
    if (index === count - 1) return null

    const upperSum = roundCurrency(current.slice(0, index).reduce((acc, item) => acc + item.amount, 0), currency)
    const maxAllowed = roundCurrency(Math.max(0, totalAmount - upperSum), currency)
    const clamped = roundCurrency(Math.max(0, Math.min(maxAllowed, rawValue)), currency)
    const remaining = roundCurrency(totalAmount - upperSum - clamped, currency)
    const lowerCount = count - index - 1
    const lowerBase = lowerCount > 0 ? roundCurrency(remaining / lowerCount, currency) : 0
    let lowerAssigned = 0

    return current.map((item, i) => {
        if (i < index) return item
        if (i === index) return { ...item, amount: clamped }
        if (i === count - 1) return { ...item, amount: roundCurrency(remaining - lowerAssigned, currency) }
        lowerAssigned = roundCurrency(lowerAssigned + lowerBase, currency)
        return { ...item, amount: lowerBase }
    })
}
