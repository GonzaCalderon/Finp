import { expect } from 'vitest'
import { Types } from 'mongoose'

export function expectObjectIdEqual(actual: unknown, expected: unknown) {
    expect(actual?.toString()).toBe(expected?.toString())
}

export function expectNoPrivateFields(payload: unknown) {
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('accountId')
    expect(serialized).not.toContain('categoryId')
    expect(serialized).not.toContain('sourceAccountId')
    expect(serialized).not.toContain('destinationAccountId')
}

export function expectNotificationTarget(filter: Record<string, unknown>, userId: string) {
    expect(filter.recipientUserId).toBeInstanceOf(Types.ObjectId)
    expect(filter.recipientUserId?.toString()).toBe(userId)
}

export function expectDateLike(value: unknown) {
    expect(value).toBeInstanceOf(Date)
    expect(Number.isNaN((value as Date).getTime())).toBe(false)
}
