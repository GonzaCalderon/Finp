import type { Types } from 'mongoose'
import type { IAccount, ICategory, ISpace, ISpaceEntry, ISpaceEntryPersonalImpact, ISpaceParticipant, ITransaction, IUser } from '@/types'
import type { IDebt, IDebtMovement } from '@/types/debt'
import type { INotification } from '@/types/notification'
import { objectId } from './ids'

type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends Date | Types.ObjectId | Array<unknown>
        ? T[K]
        : T[K] extends object
            ? DeepPartial<T[K]>
            : T[K]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !('_bsontype' in (value as Record<string, unknown>))
}

function deepMerge<T>(base: T, overrides?: DeepPartial<T>): T {
    if (!overrides) return base

    const output = { ...(base as Record<string, unknown>) }
    Object.entries(overrides as Record<string, unknown>).forEach(([key, value]) => {
        if (isPlainObject(value) && isPlainObject(output[key])) {
            output[key] = deepMerge(output[key], value)
        } else {
            output[key] = value
        }
    })

    return output as T
}

const now = () => new Date('2026-05-15T12:00:00.000Z')

export function buildUser(overrides?: DeepPartial<IUser>): IUser {
    return deepMerge({
        _id: objectId(),
        email: 'user@finp.test',
        passwordHash: 'hash',
        displayName: 'Finp User',
        baseCurrency: 'ARS',
        timezone: 'America/Buenos_Aires',
        preferences: {
            defaultView: 'dashboard',
            monthStartDay: 1,
            consolidatedCurrency: 'ARS',
        },
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildAccount(overrides?: DeepPartial<IAccount>): IAccount {
    return deepMerge({
        _id: objectId(),
        userId: objectId(),
        name: 'Cuenta test',
        type: 'bank',
        currency: 'ARS',
        isActive: true,
        includeInNetWorth: true,
        balance: 0,
        allowNegativeBalance: true,
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildCategory(overrides?: DeepPartial<ICategory>): ICategory {
    return deepMerge({
        _id: objectId(),
        userId: objectId(),
        name: 'Categoria test',
        type: 'expense',
        color: '#2563eb',
        isDefault: false,
        isArchived: false,
        sortOrder: 1,
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildSpace(overrides?: DeepPartial<ISpace>): ISpace {
    return deepMerge({
        _id: objectId(),
        ownerUserId: objectId(),
        name: 'Espacio test',
        type: 'couple',
        mode: 'synchronized',
        status: 'active',
        currencies: ['ARS'],
        reportingCurrency: 'ARS',
        defaultSplitMode: 'equal',
        debtMode: 'simplified',
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildSpaceParticipant(overrides?: DeepPartial<ISpaceParticipant>): ISpaceParticipant {
    return deepMerge({
        _id: objectId(),
        spaceId: objectId(),
        kind: 'finp_user',
        userId: objectId(),
        displayName: 'Participante test',
        role: 'participant',
        inviteStatus: 'accepted',
        isActive: true,
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildSpaceEntry(overrides?: DeepPartial<ISpaceEntry>): ISpaceEntry {
    const payerId = objectId()
    return deepMerge({
        _id: objectId(),
        spaceId: objectId(),
        createdByUserId: objectId(),
        createdByParticipantId: payerId,
        type: 'expense',
        status: 'confirmed',
        title: 'Gasto test',
        amount: 1000,
        currency: 'ARS',
        reportingAmount: 1000,
        date: now(),
        paidByParticipantId: payerId,
        sharedWithParticipantIds: [payerId],
        splitMode: 'equal',
        confirmationRequired: false,
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildSpaceEntryPersonalImpact(overrides?: DeepPartial<ISpaceEntryPersonalImpact>): ISpaceEntryPersonalImpact {
    return deepMerge({
        _id: objectId(),
        spaceId: objectId(),
        entryId: objectId(),
        userId: objectId(),
        participantId: objectId(),
        transactionId: objectId(),
        accountId: objectId(),
        impactKind: 'participant_share',
        amount: 500,
        currency: 'ARS',
        status: 'linked',
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildDebt(overrides?: DeepPartial<IDebt>): IDebt {
    return deepMerge({
        _id: objectId(),
        userId: objectId(),
        direction: 'payable',
        sourceType: 'manual',
        counterpartyNameSnapshot: 'Contraparte test',
        amount: 1000,
        remainingAmount: 1000,
        currency: 'ARS',
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildDebtMovement(overrides?: DeepPartial<IDebtMovement>): IDebtMovement {
    return deepMerge({
        _id: objectId(),
        userId: objectId(),
        debtId: objectId(),
        type: 'creation',
        amount: 1000,
        currency: 'ARS',
        date: now(),
        createdAt: now(),
    }, overrides)
}

export function buildNotification(overrides?: DeepPartial<INotification>): INotification {
    return deepMerge({
        _id: objectId(),
        recipientUserId: objectId(),
        type: 'system_info',
        category: 'system',
        priority: 'normal',
        status: 'unread',
        actionStatus: 'none',
        title: 'Notificacion test',
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}

export function buildTransaction(overrides?: DeepPartial<ITransaction>): ITransaction {
    return deepMerge({
        _id: objectId(),
        userId: objectId(),
        type: 'expense',
        amount: 1000,
        currency: 'ARS',
        date: now(),
        description: 'Transaccion test',
        sourceAccountId: objectId(),
        createdFrom: 'web',
        createdAt: now(),
        updatedAt: now(),
    }, overrides)
}
