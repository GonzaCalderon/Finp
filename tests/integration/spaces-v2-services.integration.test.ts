import mongoose, { Types } from 'mongoose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
    Account,
    Category,
    Debt,
    Notification,
    Space,
    SpaceActivityEvent,
    SpaceEntry,
    SpaceEntryPersonalImpact,
    SpaceOperation,
    SpaceParticipant,
    Transaction,
    User,
} from '@/lib/models'
import { createSpaceEntryV2 } from '@/lib/server/space-entry-service-v2'
import { editSpaceEntryV2 } from '@/lib/server/space-entry-history-service-v2'
import {
    changeSpaceDebtModeV2,
    changeSpaceLifecycleV2,
    transferSpaceOwnershipV2,
} from '@/lib/server/space-management-service-v2'
import {
    executeSpaceOperation,
    hashSpaceOperationValue,
} from '@/lib/server/space-operation-executor'
import { settleSpaceDebtV2 } from '@/lib/server/space-settlement-service-v2'
import { resolveE2EEnvironment } from '../e2e/helpers/environment'

describe.sequential('spaces v2 application services — Mongo transaction integration', () => {
    const runId = new Types.ObjectId().toHexString()
    const trackedUserIds: Types.ObjectId[] = []
    let ownerUserId: string
    let memberUserId: string
    let ownerAccountId: string
    let ownerCategoryId: string
    let spaceId: string
    let ownerParticipantId: string
    let memberParticipantId: string
    let firstEntryId: string

    beforeAll(async () => {
        const environment = resolveE2EEnvironment()
        if (environment.databaseName !== 'finp-e2e') {
            throw new Error('La integración v2 sólo puede ejecutarse contra finp-e2e.')
        }
        await mongoose.connect(environment.variables.MONGODB_URI, {
            dbName: environment.databaseName,
            autoIndex: false,
            serverSelectionTimeoutMS: 10_000,
        })
        const [owner, member] = await User.create([
            {
                email: `spaces-v2-owner-${runId}@example.invalid`,
                passwordHash: 'integration-only',
                displayName: 'Owner v2',
                baseCurrency: 'ARS',
                timezone: 'America/Argentina/Buenos_Aires',
                preferences: { defaultView: 'dashboard', monthStartDay: 1 },
            },
            {
                email: `spaces-v2-member-${runId}@example.invalid`,
                passwordHash: 'integration-only',
                displayName: 'Member v2',
                baseCurrency: 'ARS',
                timezone: 'America/Argentina/Buenos_Aires',
                preferences: { defaultView: 'dashboard', monthStartDay: 1 },
            },
        ])
        trackedUserIds.push(owner._id, member._id)
        ownerUserId = owner._id.toString()
        memberUserId = member._id.toString()
        const [account, category] = await Promise.all([
            Account.create({
                userId: owner._id,
                name: `Cuenta v2 ${runId}`,
                type: 'bank',
                currency: 'ARS',
                supportedCurrencies: ['ARS'],
                isActive: true,
                includeInNetWorth: true,
                initialBalance: 1_000,
            }),
            Category.create({
                userId: owner._id,
                name: `Categoría v2 ${runId}`,
                type: 'expense',
                isDefault: false,
                isArchived: false,
                sortOrder: 0,
            }),
        ])
        ownerAccountId = account._id.toString()
        ownerCategoryId = category._id.toString()
        const space = await Space.create({
            contractVersion: 2,
            ownerUserId: owner._id,
            name: `Espacio v2 ${runId}`,
            type: 'travel',
            mode: 'managed',
            status: 'active',
            currencies: ['ARS'],
            reportingCurrency: 'ARS',
            defaultSplitMode: 'equal',
            debtMode: 'direct',
            timezone: 'America/Argentina/Buenos_Aires',
            revision: 0,
        })
        spaceId = space._id.toString()
        const [ownerParticipant, memberParticipant] = await SpaceParticipant.create([
            {
                spaceId: space._id,
                kind: 'finp_user',
                userId: owner._id,
                displayName: 'Owner v2',
                role: 'owner',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
            {
                spaceId: space._id,
                kind: 'finp_user',
                userId: member._id,
                displayName: 'Member v2',
                role: 'participant',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
        ])
        ownerParticipantId = ownerParticipant._id.toString()
        memberParticipantId = memberParticipant._id.toString()
    })

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            const spaceObjectId = new Types.ObjectId(spaceId)
            const userObjectIds = trackedUserIds
            await Promise.all([
                Notification.deleteMany({
                    $or: [
                        { recipientUserId: { $in: userObjectIds } },
                        { 'entityRefs.spaceId': spaceObjectId },
                    ],
                }),
                SpaceActivityEvent.deleteMany({ spaceId: spaceObjectId }),
                SpaceEntryPersonalImpact.deleteMany({ spaceId: spaceObjectId }),
                Transaction.deleteMany({ spaceId: spaceObjectId }),
                mongoose.connection.collection('debtmovements').deleteMany({ spaceId: spaceObjectId }),
                Debt.deleteMany({ spaceId: spaceObjectId }),
                SpaceOperation.deleteMany({ spaceId: spaceObjectId }),
                SpaceEntry.deleteMany({ spaceId: spaceObjectId }),
                SpaceParticipant.deleteMany({ spaceId: spaceObjectId }),
                Account.deleteMany({ userId: { $in: userObjectIds } }),
                Category.deleteMany({ userId: { $in: userObjectIds } }),
            ])
            await Space.deleteOne({ _id: spaceObjectId })
            await User.deleteMany({ _id: { $in: userObjectIds } })
        }
        await mongoose.disconnect()
    })

    it('crea exactamente una vez movimiento, impacto, transacción, deuda, pendiente y actividad', async () => {
        const request = {
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `create-first-${runId}`,
            title: 'Gasto compartido v2',
            amount: 100,
            currency: 'ARS',
            dateKey: '2026-08-24',
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId, memberParticipantId],
            splitMode: 'equal' as const,
            actorPersonalImpact: {
                accountId: ownerAccountId,
                categoryId: ownerCategoryId,
            },
        }
        const first = await createSpaceEntryV2(request)
        firstEntryId = first.resultRefs.spaceEntryId!.toString()
        expect(first.replayed).toBe(false)
        expect(first.presentation.state).toBe('reconciled')

        const replay = await createSpaceEntryV2(request)
        expect(replay.replayed).toBe(true)
        expect(replay.resultRefs.spaceEntryId?.toString()).toBe(firstEntryId)
        expect(await SpaceEntry.countDocuments({ spaceId, title: request.title })).toBe(1)
        expect(await Transaction.countDocuments({ userId: ownerUserId, spaceEntryId: firstEntryId })).toBe(1)
        const transaction = await Transaction.findOne({ userId: ownerUserId, spaceEntryId: firstEntryId }).lean()
        expect(transaction).toMatchObject({ amount: 100, operationalAmount: 50, createdFrom: 'space' })
        const impacts = await SpaceEntryPersonalImpact.find({ entryId: firstEntryId }).sort({ userId: 1 }).lean()
        expect(impacts).toHaveLength(2)
        expect(impacts.map((impact) => impact.status).sort()).toEqual(['linked', 'pending'])
        expect(impacts.every((impact) => impact.ownShareAmount === 50)).toBe(true)
        expect(await Debt.countDocuments({ spaceId, remainingAmount: 50, status: 'active' })).toBe(2)
        expect(await SpaceActivityEvent.countDocuments({ spaceId, operationId: first.operationId })).toBe(1)

        await expect(createSpaceEntryV2({ ...request, amount: 101 }))
            .rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' })
    })

    it('serializa reintentos concurrentes y revierte por completo un fallo inyectado', async () => {
        const request = {
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `create-concurrent-${runId}`,
            title: 'Concurrente v2',
            amount: 60,
            currency: 'ARS',
            dateKey: '2026-08-25',
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId, memberParticipantId],
            splitMode: 'equal' as const,
        }
        const results = await Promise.all([createSpaceEntryV2(request), createSpaceEntryV2(request)])
        expect(results.filter((result) => result.replayed)).toHaveLength(1)
        expect(await SpaceEntry.countDocuments({ spaceId, title: request.title })).toBe(1)

        const originalName = (await Space.findById(spaceId).lean())!.name
        await expect(executeSpaceOperation({
            actorUserId: ownerUserId,
            spaceId,
            type: 'create_entry',
            idempotencyKey: `injected-failure-${runId}`,
            payload: { failure: true },
            run: async (session) => {
                await Space.updateOne({ _id: spaceId }, { $set: { name: 'NO DEBE CONFIRMARSE' } }, { session })
                throw new Error('INJECTED_FAILURE')
            },
        })).rejects.toThrow('INJECTED_FAILURE')
        expect((await Space.findById(spaceId).lean())!.name).toBe(originalName)
        expect(await SpaceOperation.countDocuments({
            spaceId,
            idempotencyKeyHash: hashSpaceOperationValue(`injected-failure-${runId}`),
            status: 'pending',
        })).toBe(0)
    })

    it('detecta edición concurrente y lleva historia vinculada a revisión', async () => {
        const base = {
            actorUserId: ownerUserId,
            spaceId,
            entryId: firstEntryId,
            expectedRevision: 0,
            title: 'Gasto compartido editado',
            amount: 120,
            currency: 'ARS',
            dateKey: '2026-08-24',
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId, memberParticipantId],
            splitMode: 'equal' as const,
        }
        const edited = await editSpaceEntryV2({
            ...base,
            idempotencyKey: `edit-first-${runId}`,
        })
        expect(edited.value).toMatchObject({ revision: 1 })
        expect(await SpaceEntryPersonalImpact.countDocuments({
            entryId: firstEntryId,
            status: 'needs_review',
        })).toBe(1)
        await expect(editSpaceEntryV2({
            ...base,
            title: 'Edición obsoleta',
            idempotencyKey: `edit-conflict-${runId}`,
        })).rejects.toMatchObject({ code: 'SPACE_ENTRY_VERSION_CONFLICT' })
    })

    it('cambia el modo sin dejar claves activas anteriores y liquida igual desde ambas superficies', async () => {
        const mode = await changeSpaceDebtModeV2({
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `mode-${runId}`,
            expectedRevision: 0,
            debtMode: 'simplified',
        })
        expect(mode.value).toMatchObject({ debtMode: 'simplified', revision: 1 })
        expect(await Debt.countDocuments({ spaceId, originMode: 'direct', status: 'active' })).toBe(0)
        let debt = await Debt.findOne({
            userId: ownerUserId,
            spaceId,
            originMode: 'simplified',
            direction: 'receivable',
            status: 'active',
        }).lean()
        expect(debt?.remainingAmount).toBe(90)

        await settleSpaceDebtV2({
            actorUserId: ownerUserId,
            spaceId,
            debtId: debt!._id.toString(),
            idempotencyKey: `settle-spaces-${runId}`,
            originSurface: 'spaces',
            amount: 20,
            currency: 'ARS',
            dateKey: '2026-08-26',
            accountId: ownerAccountId,
        })
        debt = await Debt.findById(debt!._id).lean()
        expect(debt?.remainingAmount).toBe(70)

        await settleSpaceDebtV2({
            actorUserId: ownerUserId,
            spaceId,
            debtId: debt!._id.toString(),
            idempotencyKey: `settle-debts-${runId}`,
            originSurface: 'debts',
            amount: 70,
            currency: 'ARS',
            dateKey: '2026-08-27',
            accountId: ownerAccountId,
        })
        debt = await Debt.findById(debt!._id).lean()
        expect(debt).toMatchObject({ remainingAmount: 0, status: 'paid' })
        const settlements = await SpaceEntry.find({ spaceId, type: 'settlement', contractVersion: 2 }).lean()
        expect(settlements).toHaveLength(2)
        const settlementTransactions = await Transaction.find({
            userId: ownerUserId,
            spaceEntryId: { $in: settlements.map((entry) => entry._id) },
        }).lean()
        expect(settlementTransactions).toHaveLength(2)
        expect(settlementTransactions.every((transaction) => transaction.operationalAmount === 0)).toBe(true)
    })

    it('aplica ciclo de vida y transferencia con versiones sin perder el último owner', async () => {
        const paused = await changeSpaceLifecycleV2({
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `pause-${runId}`,
            expectedRevision: 1,
            targetStatus: 'paused',
        })
        expect(paused.value).toMatchObject({ status: 'paused', revision: 2 })
        await expect(createSpaceEntryV2({
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `blocked-create-${runId}`,
            title: 'No se crea',
            amount: 10,
            currency: 'ARS',
            dateKey: '2026-08-28',
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId],
            splitMode: 'none',
        })).rejects.toMatchObject({ code: 'SPACE_CAPABILITY_DENIED' })
        await changeSpaceLifecycleV2({
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `reopen-${runId}`,
            expectedRevision: 2,
            targetStatus: 'active',
        })
        const transfer = await transferSpaceOwnershipV2({
            actorUserId: ownerUserId,
            spaceId,
            targetParticipantId: memberParticipantId,
            idempotencyKey: `transfer-${runId}`,
            expectedSpaceRevision: 3,
            expectedActorParticipantRevision: 0,
            expectedTargetParticipantRevision: 0,
        })
        expect(transfer.value).toMatchObject({ ownerUserId: memberUserId, spaceRevision: 4 })
        expect(await SpaceParticipant.findById(ownerParticipantId).lean()).toMatchObject({ role: 'admin', revision: 1 })
        expect(await SpaceParticipant.findById(memberParticipantId).lean()).toMatchObject({ role: 'owner', revision: 1 })
    })

    it('los índices parciales v2 conviven con impactos legacy paralelos', async () => {
        const legacyEntry = await SpaceEntry.create({
            spaceId,
            createdByUserId: ownerUserId,
            type: 'expense',
            status: 'recorded',
            title: 'Legacy compatible',
            amount: 1,
            reportingAmount: 1,
            currency: 'ARS',
            date: new Date(),
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId],
            splitMode: 'none',
        })
        await SpaceEntryPersonalImpact.create([
            {
                spaceId,
                entryId: legacyEntry._id,
                userId: ownerUserId,
                participantId: ownerParticipantId,
                impactKind: 'participant_share',
                amount: 1,
                currency: 'ARS',
                status: 'removed',
            },
            {
                spaceId,
                entryId: legacyEntry._id,
                userId: ownerUserId,
                participantId: ownerParticipantId,
                impactKind: 'participant_share',
                amount: 1,
                currency: 'ARS',
                status: 'cancelled',
            },
        ])
        expect(await SpaceEntryPersonalImpact.countDocuments({ entryId: legacyEntry._id })).toBe(2)
        const indexNames = (await mongoose.connection.collection('spaceentrypersonalimpacts').indexes())
            .map((index) => index.name)
        expect(indexNames).toContain('v2_unique_personal_impact_per_user_entry')
    })
})
