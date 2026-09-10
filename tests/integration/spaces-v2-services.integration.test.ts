import mongoose, { Types } from 'mongoose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
    Account,
    Category,
    Debt,
    InstallmentPlan,
    Notification,
    Space,
    SpaceActivityEvent,
    SpaceEntry,
    SpaceEntryDraft,
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
    setSpaceParticipantActiveV2,
    updateSpaceSettingsV2,
    transferSpaceOwnershipV2,
} from '@/lib/server/space-management-service-v2'
import {
    executeSpaceOperation,
    hashSpaceOperationValue,
} from '@/lib/server/space-operation-executor'
import { resolveSpacePersonalImpactV2 } from '@/lib/server/space-personal-impact-service-v2'
import { previewSpaceEntryV2 } from '@/lib/server/space-financial-preview-v2'
import {
    listLinkCandidatesForImpactV2,
    listLinkCandidatesForNewEntryV2,
} from '@/lib/server/space-link-candidates-v2'
import { settleSpaceDebtV2 } from '@/lib/server/space-settlement-service-v2'
import { getSpaceDetailV2 } from '@/lib/server/space-read-service-v2'
import { resolveE2EEnvironment } from '../e2e/helpers/environment'
import { buildManualConversionSnapshot } from '@/lib/server/space-quote-service'
import { moneyFromDecimal } from '@/lib/utils/money'
import {
    discardSpaceEntryDraftV2,
    getActiveSpaceEntryDraftV2,
    publishSpaceEntryDraftV2,
    saveSpaceEntryDraftV2,
} from '@/lib/server/space-entry-draft-service-v2'
import {
    prepareSpaceEntryDraftAttachment,
    readSpaceEntryDraftAttachment,
    reconcileSpaceEntryDraftAttachments,
    removeSpaceEntryDraftAttachment,
} from '@/lib/server/space-entry-draft-attachment-service'
import { createMemorySpaceAttachmentStorage } from '@/lib/server/space-attachment-storage'

describe.sequential('spaces v2 application services — Mongo transaction integration', () => {
    const runId = new Types.ObjectId().toHexString()
    const trackedUserIds: Types.ObjectId[] = []
    const trackedSpaceIds: Types.ObjectId[] = []
    let ownerUserId: string
    let memberUserId: string
    let ownerAccountId: string
    let ownerCreditCardId: string
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
        const [account, creditCard, category] = await Promise.all([
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
            Account.create({
                userId: owner._id,
                name: `Tarjeta v2 ${runId}`,
                type: 'credit_card',
                currency: 'ARS',
                supportedCurrencies: ['ARS', 'USD'],
                isActive: true,
                includeInNetWorth: true,
                initialBalance: 0,
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
        ownerCreditCardId = creditCard._id.toString()
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
        trackedSpaceIds.push(space._id)
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
            const spaceScope = { $in: trackedSpaceIds }
            const userObjectIds = trackedUserIds
            await Promise.all([
                Notification.deleteMany({
                    $or: [
                        { recipientUserId: { $in: userObjectIds } },
                        { 'entityRefs.spaceId': spaceScope },
                    ],
                }),
                SpaceActivityEvent.deleteMany({ spaceId: spaceScope }),
                SpaceEntryPersonalImpact.deleteMany({ spaceId: spaceScope }),
                Transaction.deleteMany({ spaceId: spaceScope }),
                mongoose.connection.collection('debtmovements').deleteMany({ spaceId: spaceScope }),
                Debt.deleteMany({ spaceId: spaceScope }),
                SpaceOperation.deleteMany({ spaceId: spaceScope }),
                SpaceEntryDraft.deleteMany({ spaceId: spaceScope }),
                SpaceEntry.deleteMany({ spaceId: spaceScope }),
                SpaceParticipant.deleteMany({ spaceId: spaceScope }),
                Account.deleteMany({ userId: { $in: userObjectIds } }),
                Category.deleteMany({ userId: { $in: userObjectIds } }),
            ])
            await Space.deleteMany({ _id: spaceScope })
            await User.deleteMany({ _id: { $in: userObjectIds } })
        }
        await mongoose.disconnect()
    })

    it('crea exactamente una vez movimiento, impacto, transacción, deuda, pendiente y actividad', async () => {
        const request = {
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `create-first-${runId}`,
            expectedRevision: 0,
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

    it('registra un gasto compartido con tarjeta como consumo único y sin plan de cuotas', async () => {
        const cardSpace = await Space.create({
            contractVersion: 2,
            ownerUserId,
            name: `Tarjeta v2 ${runId}`,
            type: 'personal',
            mode: 'solo',
            status: 'active',
            currencies: ['ARS'],
            reportingCurrency: 'ARS',
            defaultSplitMode: 'none',
            debtMode: 'direct',
            timezone: 'America/Argentina/Buenos_Aires',
            revision: 0,
        })
        const participant = await SpaceParticipant.create({
            spaceId: cardSpace._id,
            kind: 'finp_user',
            userId: ownerUserId,
            displayName: 'Owner tarjeta v2',
            role: 'owner',
            inviteStatus: 'accepted',
            isActive: true,
            revision: 0,
        })

        try {
            const created = await createSpaceEntryV2({
                actorUserId: ownerUserId,
                spaceId: cardSpace._id.toString(),
                idempotencyKey: `card-single-payment-${runId}`,
                expectedRevision: 0,
                title: 'Compra compartida con tarjeta',
                amount: 80,
                money: moneyFromDecimal('ARS', 80),
                currency: 'ARS',
                dateKey: '2026-08-24',
                paidByParticipantId: participant._id.toString(),
                sharedWithParticipantIds: [participant._id.toString()],
                splitMode: 'none',
                actorPersonalImpact: {
                    accountId: ownerCreditCardId,
                    categoryId: ownerCategoryId,
                },
            })
            const transaction = await Transaction.findOne({
                spaceEntryId: created.resultRefs.spaceEntryId,
                sourceAccountId: ownerCreditCardId,
            }).lean()

            expect(transaction).toMatchObject({
                type: 'credit_card_expense',
                amount: 80,
                operationalAmount: 80,
                createdFrom: 'space',
            })
            expect(transaction?.installmentPlanId).toBeUndefined()
            expect(await InstallmentPlan.countDocuments({ accountId: ownerCreditCardId })).toBe(0)
        } finally {
            await Promise.all([
                SpaceActivityEvent.deleteMany({ spaceId: cardSpace._id }),
                SpaceEntryPersonalImpact.deleteMany({ spaceId: cardSpace._id }),
                Transaction.deleteMany({ spaceId: cardSpace._id }),
                Debt.deleteMany({ spaceId: cardSpace._id }),
                SpaceOperation.deleteMany({ spaceId: cardSpace._id }),
                SpaceEntry.deleteMany({ spaceId: cardSpace._id }),
                SpaceParticipant.deleteMany({ spaceId: cardSpace._id }),
                InstallmentPlan.deleteMany({ accountId: ownerCreditCardId }),
            ])
            await Space.deleteOne({ _id: cardSpace._id })
        }
    })

    it('aísla, versiona y publica un único borrador privado sin duplicar el movimiento', async () => {
        const draftSpace = await Space.create({
            contractVersion: 2,
            ownerUserId,
            name: `Borradores v2 ${runId}`,
            type: 'other',
            mode: 'managed',
            status: 'active',
            currencies: ['ARS'],
            reportingCurrency: 'ARS',
            defaultSplitMode: 'equal',
            debtMode: 'direct',
            timezone: 'America/Argentina/Buenos_Aires',
            revision: 0,
        })
        const [draftOwner, draftMember] = await SpaceParticipant.create([{
            spaceId: draftSpace._id,
            kind: 'finp_user',
            userId: ownerUserId,
            displayName: 'Owner borradores',
            role: 'owner',
            inviteStatus: 'accepted',
            isActive: true,
            revision: 0,
        }, {
            spaceId: draftSpace._id,
            kind: 'finp_user',
            userId: memberUserId,
            displayName: 'Member borradores',
            role: 'participant',
            inviteStatus: 'accepted',
            isActive: true,
            revision: 0,
        }])
        const draftSpaceId = draftSpace._id.toString()
        const ownerFields = {
            title: 'Borrador privado v2',
            amount: 75.25,
            money: moneyFromDecimal('ARS', 75.25),
            currency: 'ARS',
            dateKey: '2026-08-24',
            paidByParticipantId: draftOwner._id.toString(),
            sharedWithParticipantIds: [draftOwner._id.toString(), draftMember._id.toString()],
            splitMode: 'equal' as const,
            personalImpact: { accountId: ownerAccountId, categoryId: ownerCategoryId },
        }
        try {
        const first = await saveSpaceEntryDraftV2({
            actorUserId: ownerUserId,
            spaceId: draftSpaceId,
            expectedSpaceRevision: 0,
            step: 2,
            fields: ownerFields,
        })
        expect(first).toMatchObject({ revision: 0, step: 2, status: 'active' })
        expect((await getActiveSpaceEntryDraftV2({ actorUserId: ownerUserId, spaceId: draftSpaceId }))?.id).toBe(first.id)
        expect(await getActiveSpaceEntryDraftV2({ actorUserId: memberUserId, spaceId: draftSpaceId })).toBeNull()

        const memberDraft = await saveSpaceEntryDraftV2({
            actorUserId: memberUserId,
            spaceId: draftSpaceId,
            expectedSpaceRevision: 0,
            step: 1,
            fields: { title: 'Sólo del participante' },
        })
        expect(memberDraft.id).not.toBe(first.id)
        expect((await getSpaceDetailV2({ spaceId: draftSpaceId, actorUserId: ownerUserId })).movements.draft?.id).toBe(first.id)
        expect((await getSpaceDetailV2({ spaceId: draftSpaceId, actorUserId: memberUserId })).movements.draft?.id).toBe(memberDraft.id)

        const updated = await saveSpaceEntryDraftV2({
            actorUserId: ownerUserId,
            spaceId: draftSpaceId,
            draftId: first.id,
            expectedRevision: 0,
            expectedSpaceRevision: 0,
            step: 3,
            fields: {
                ...ownerFields,
                title: 'Borrador privado actualizado',
            },
        })
        expect(updated).toMatchObject({ revision: 1, step: 3 })
        await expect(saveSpaceEntryDraftV2({
            actorUserId: ownerUserId,
            spaceId: draftSpaceId,
            draftId: first.id,
            expectedRevision: 0,
            expectedSpaceRevision: 0,
            step: 2,
            fields: ownerFields,
        })).rejects.toMatchObject({ code: 'SPACE_DRAFT_VERSION_CONFLICT' })

        const attachmentStorage = createMemorySpaceAttachmentStorage()
        const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
        const prepared = await prepareSpaceEntryDraftAttachment({
            actorUserId: ownerUserId,
            spaceId: draftSpaceId,
            draftId: first.id,
            expectedRevision: 1,
            idempotencyKey: `attachment-${runId}`,
            file: new File([pngBytes], 'ticket.png', { type: 'image/png' }),
            storage: attachmentStorage,
        })
        expect(prepared).toMatchObject({ draftRevision: 3, attachment: { status: 'ready', fileName: 'ticket.png' } })
        const attachmentId = prepared.attachment!.id
        const replayedAttachment = await prepareSpaceEntryDraftAttachment({
            actorUserId: ownerUserId,
            spaceId: draftSpaceId,
            draftId: first.id,
            expectedRevision: 1,
            idempotencyKey: `attachment-${runId}`,
            file: new File([pngBytes], 'ticket.png', { type: 'image/png' }),
            storage: attachmentStorage,
        })
        expect(replayedAttachment).toMatchObject({ draftRevision: 3, attachment: { id: attachmentId } })
        await expect(readSpaceEntryDraftAttachment({
            actorUserId: memberUserId,
            spaceId: draftSpaceId,
            attachmentId,
            storage: attachmentStorage,
        })).rejects.toMatchObject({ status: 404 })

        const published = await publishSpaceEntryDraftV2({
            actorUserId: ownerUserId,
            spaceId: draftSpaceId,
            draftId: first.id,
            expectedRevision: 3,
        })
        expect(published.replayed).toBe(false)
        const publishedEntryId = published.resultRefs.spaceEntryId?.toString()
        expect(await SpaceEntry.countDocuments({ _id: publishedEntryId, title: 'Borrador privado actualizado' })).toBe(1)
        const publishedEntry = await SpaceEntry.findById(publishedEntryId).lean()
        expect(publishedEntry?.attachments).toHaveLength(1)
        expect(publishedEntry?.attachments?.[0]).toMatchObject({
            fileName: 'ticket.png',
            mimeType: 'image/png',
            storageProvider: 'vercel_blob',
        })
        expect(publishedEntry?.attachments?.[0]?.contentSha256).toMatch(/^[a-f\d]{64}$/)
        expect(await getActiveSpaceEntryDraftV2({ actorUserId: ownerUserId, spaceId: draftSpaceId })).toBeNull()

        const replay = await publishSpaceEntryDraftV2({
            actorUserId: ownerUserId,
            spaceId: draftSpaceId,
            draftId: first.id,
            expectedRevision: 3,
        })
        expect(replay.replayed).toBe(true)
        expect(replay.resultRefs.spaceEntryId?.toString()).toBe(publishedEntryId)
        expect(await SpaceEntry.countDocuments({ _id: publishedEntryId })).toBe(1)

        const failingStorage = {
            ...createMemorySpaceAttachmentStorage(),
            put: async () => { throw new Error('INJECTED_BLOB_FAILURE') },
        }
        await expect(prepareSpaceEntryDraftAttachment({
            actorUserId: memberUserId,
            spaceId: draftSpaceId,
            draftId: memberDraft.id,
            expectedRevision: 0,
            idempotencyKey: `failed-attachment-${runId}`,
            file: new File([pngBytes], 'fallo.png', { type: 'image/png' }),
            storage: failingStorage,
        })).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
        const failedDraft = await SpaceEntryDraft.findById(memberDraft.id).lean()
        expect(failedDraft).toMatchObject({ revision: 2 })
        expect(failedDraft?.attachments?.[0]?.status).toBe('upload_failed')

        const recoveryStorage = createMemorySpaceAttachmentStorage()
        const failedAttachmentId = failedDraft!.attachments![0]._id.toString()
        const retried = await prepareSpaceEntryDraftAttachment({
            actorUserId: memberUserId,
            spaceId: draftSpaceId,
            draftId: memberDraft.id,
            attachmentId: failedAttachmentId,
            expectedRevision: 2,
            idempotencyKey: `retry-attachment-${runId}`,
            file: new File([pngBytes], 'fallo.png', { type: 'image/png' }),
            storage: recoveryStorage,
        })
        expect(retried).toMatchObject({ draftRevision: 4, attachment: { status: 'ready' } })

        const deleteFailingStorage = {
            ...recoveryStorage,
            delete: async () => { throw new Error('INJECTED_DELETE_FAILURE') },
        }
        const removal = await removeSpaceEntryDraftAttachment({
            actorUserId: memberUserId,
            spaceId: draftSpaceId,
            draftId: memberDraft.id,
            attachmentId: failedAttachmentId,
            expectedRevision: 4,
            storage: deleteFailingStorage,
        })
        expect(removal).toEqual({ draftRevision: 5, cleanupPending: true })
        const reconciliation = await reconcileSpaceEntryDraftAttachments({
            draftId: memberDraft.id,
            dryRun: false,
            storage: recoveryStorage,
        })
        expect(reconciliation.deleted).toBe(1)

        const discarded = await discardSpaceEntryDraftV2({
            actorUserId: memberUserId,
            spaceId: draftSpaceId,
            draftId: memberDraft.id,
            expectedRevision: 6,
        })
        expect(discarded.status).toBe('discarded')
        expect(await getActiveSpaceEntryDraftV2({ actorUserId: memberUserId, spaceId: draftSpaceId })).toBeNull()
        } finally {
            await Promise.all([
                Notification.deleteMany({ 'entityRefs.spaceId': draftSpace._id }),
                SpaceActivityEvent.deleteMany({ spaceId: draftSpace._id }),
                SpaceEntryPersonalImpact.deleteMany({ spaceId: draftSpace._id }),
                Transaction.deleteMany({ spaceId: draftSpace._id }),
                mongoose.connection.collection('debtmovements').deleteMany({ spaceId: draftSpace._id }),
                Debt.deleteMany({ spaceId: draftSpace._id }),
                SpaceOperation.deleteMany({ spaceId: draftSpace._id }),
                SpaceEntryDraft.deleteMany({ spaceId: draftSpace._id }),
                SpaceEntry.deleteMany({ spaceId: draftSpace._id }),
                SpaceParticipant.deleteMany({ spaceId: draftSpace._id }),
            ])
            await Space.deleteOne({ _id: draftSpace._id })
        }
    })

    it('revierte una publicación fallida y conserva el borrador activo', async () => {
        const draft = await saveSpaceEntryDraftV2({
            actorUserId: memberUserId,
            spaceId,
            expectedSpaceRevision: 0,
            step: 3,
            fields: {
                title: 'Publicación que debe revertirse',
                amount: 22,
                money: moneyFromDecimal('ARS', 22),
                currency: 'ARS',
                dateKey: '2026-08-24',
                paidByParticipantId: memberParticipantId,
                sharedWithParticipantIds: [memberParticipantId],
                splitMode: 'none',
                personalImpact: { accountId: ownerAccountId },
            },
        })
        await expect(publishSpaceEntryDraftV2({
            actorUserId: memberUserId,
            spaceId,
            draftId: draft.id,
            expectedRevision: 0,
        })).rejects.toBeTruthy()
        expect(await SpaceEntry.countDocuments({ spaceId, title: 'Publicación que debe revertirse' })).toBe(0)
        expect(await getActiveSpaceEntryDraftV2({ actorUserId: memberUserId, spaceId }))
            .toMatchObject({ id: draft.id, revision: 0, status: 'active' })
        await discardSpaceEntryDraftV2({
            actorUserId: memberUserId,
            spaceId,
            draftId: draft.id,
            expectedRevision: 0,
        })
    })

    it('serializa reintentos concurrentes y revierte por completo un fallo inyectado', async () => {
        const request = {
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `create-concurrent-${runId}`,
            expectedRevision: 0,
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

    it('sincroniza la transacción del pagador con el impacto real de cuenta y no con la parte propia', async () => {
        // Espacio propio: la suite es secuencial y comparte balances entre casos.
        const isolated = await Space.create({
            contractVersion: 2,
            ownerUserId: new Types.ObjectId(ownerUserId),
            name: `Espacio sync ${runId}`,
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
        trackedSpaceIds.push(isolated._id)
        const [isolatedOwner, isolatedMember] = await SpaceParticipant.create([
            {
                spaceId: isolated._id,
                kind: 'finp_user',
                userId: new Types.ObjectId(ownerUserId),
                displayName: 'Owner v2',
                role: 'owner',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
            {
                spaceId: isolated._id,
                kind: 'finp_user',
                userId: new Types.ObjectId(memberUserId),
                displayName: 'Member v2',
                role: 'participant',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
        ])

        const shared = {
            actorUserId: ownerUserId,
            spaceId: isolated._id.toString(),
            title: 'Gasto a sincronizar',
            currency: 'ARS',
            dateKey: '2026-08-26',
            paidByParticipantId: isolatedOwner._id.toString(),
            sharedWithParticipantIds: [isolatedOwner._id.toString(), isolatedMember._id.toString()],
            splitMode: 'equal' as const,
        }
        const created = await createSpaceEntryV2({
            ...shared,
            idempotencyKey: `create-sync-${runId}`,
            expectedRevision: 0,
            amount: 200,
            actorPersonalImpact: { accountId: ownerAccountId, categoryId: ownerCategoryId },
        })
        const entryId = created.resultRefs.spaceEntryId!.toString()

        // El pagador adelanta: la cuenta refleja el total real y el reporting sólo su parte.
        expect(await Transaction.findOne({ userId: ownerUserId, spaceEntryId: entryId }).lean())
            .toMatchObject({ amount: 200, operationalAmount: 100 })

        await editSpaceEntryV2({
            ...shared,
            entryId,
            expectedRevision: 0,
            idempotencyKey: `edit-sync-${runId}`,
            amount: 300,
        })

        const review = await SpaceEntryPersonalImpact.findOne({
            entryId,
            userId: ownerUserId,
            status: 'needs_review',
        }).lean()
        expect(review).toBeTruthy()

        const syncRequest = {
            actorUserId: ownerUserId,
            spaceId: isolated._id.toString(),
            entryId,
            impactId: review!._id.toString(),
            idempotencyKey: `sync-transaction-${runId}`,
            expectedRevision: review!.revision ?? 0,
            decision: { type: 'sync_transaction' as const },
        }
        const synced = await resolveSpacePersonalImpactV2(syncRequest)
        expect(synced.replayed).toBe(false)

        expect(await Transaction.findOne({ userId: ownerUserId, spaceEntryId: entryId }).lean())
            .toMatchObject({ amount: 300, operationalAmount: 150 })
        expect(await SpaceEntryPersonalImpact.countDocuments({
            entryId,
            userId: ownerUserId,
            status: 'linked',
        })).toBe(1)

        // Un reintento con la misma clave replica el resultado sin volver a escribir.
        expect((await resolveSpacePersonalImpactV2(syncRequest)).replayed).toBe(true)
        expect(await Transaction.countDocuments({ userId: ownerUserId, spaceEntryId: entryId })).toBe(1)

        // Una clave nueva con la revisión ya consumida choca contra la concurrencia optimista.
        await expect(resolveSpacePersonalImpactV2({
            ...syncRequest,
            idempotencyKey: `sync-transaction-stale-${runId}`,
        })).rejects.toMatchObject({ code: 'SPACE_IMPACT_VERSION_CONFLICT' })
    })

    it('todo candidato que preview marca compatible se vincula sin 409, y uno incompatible falla con la misma razón', async () => {
        const isolated = await Space.create({
            contractVersion: 2,
            ownerUserId: new Types.ObjectId(ownerUserId),
            name: `Espacio vínculo ${runId}`,
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
        trackedSpaceIds.push(isolated._id)
        const [isolatedOwner, isolatedMember] = await SpaceParticipant.create([
            {
                spaceId: isolated._id,
                kind: 'finp_user',
                userId: new Types.ObjectId(ownerUserId),
                displayName: 'Owner v2',
                role: 'owner',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
            {
                spaceId: isolated._id,
                kind: 'finp_user',
                userId: new Types.ObjectId(memberUserId),
                displayName: 'Member v2',
                role: 'participant',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
        ])
        const shared = {
            actorUserId: ownerUserId,
            spaceId: isolated._id.toString(),
            currency: 'ARS',
            dateKey: '2026-08-27',
            paidByParticipantId: isolatedOwner._id.toString(),
            sharedWithParticipantIds: [isolatedOwner._id.toString(), isolatedMember._id.toString()],
            splitMode: 'equal' as const,
            actorPersonalImpact: { accountId: ownerAccountId, categoryId: ownerCategoryId },
        }

        const created = await createSpaceEntryV2({
            ...shared,
            title: 'Cena compartida',
            idempotencyKey: `create-link-${runId}`,
            expectedRevision: 0,
            amount: 1000,
        })
        const entryId = created.resultRefs.spaceEntryId!.toString()
        const pending = await SpaceEntryPersonalImpact.findOne({
            entryId,
            userId: memberUserId,
            status: 'pending',
        }).lean()
        expect(pending).toBeTruthy()

        // La transacción "ya existente" del participante: mismo tipo, moneda,
        // monto y día financiero que exige su parte, sin cuenta — como
        // corresponde a quien no movió dinero real.
        const compatibleTransaction = await Transaction.create({
            userId: memberUserId,
            type: 'expense',
            amount: 500,
            operationalAmount: 500,
            currency: 'ARS',
            date: new Date('2026-08-27T15:00:00.000Z'),
            description: 'Cena (ya registrada)',
            status: 'confirmed',
            createdFrom: 'web',
        })

        const previewInput = {
            actorUserId: memberUserId,
            spaceId: isolated._id.toString(),
            amount: 1000,
            currency: 'ARS',
            paidByParticipantId: isolatedOwner._id.toString(),
            sharedWithParticipantIds: [isolatedOwner._id.toString(), isolatedMember._id.toString()],
            splitMode: 'equal' as const,
        }
        const preview = await previewSpaceEntryV2({
            ...previewInput,
            linkedTransactionId: compatibleTransaction._id.toString(),
        })
        expect(preview.linkExisting).toMatchObject({ compatible: true, issues: [] })

        const resolved = await resolveSpacePersonalImpactV2({
            actorUserId: memberUserId,
            spaceId: isolated._id.toString(),
            entryId,
            impactId: pending!._id.toString(),
            idempotencyKey: `link-existing-${runId}`,
            expectedRevision: pending!.revision ?? 0,
            decision: { type: 'link_existing', transactionId: compatibleTransaction._id.toString() },
        })
        expect(resolved.value!.status).toBe('linked')
        expect(await Transaction.findOne({ _id: compatibleTransaction._id }).lean())
            .toMatchObject({ spaceEntryId: new Types.ObjectId(entryId), type: 'expense' })

        // Un candidato que preview ya marcó incompatible (otra moneda) falla en
        // resolve con el mismo motivo — la misma evaluación, en ambos lados.
        const mismatchedTransaction = await Transaction.create({
            userId: memberUserId,
            type: 'expense',
            amount: 500,
            operationalAmount: 500,
            currency: 'USD',
            date: new Date('2026-08-27T15:00:00.000Z'),
            description: 'Otra moneda',
            status: 'confirmed',
            createdFrom: 'web',
        })
        const mismatchedPreview = await previewSpaceEntryV2({
            ...previewInput,
            linkedTransactionId: mismatchedTransaction._id.toString(),
        })
        expect(mismatchedPreview.linkExisting?.compatible).toBe(false)
        expect(mismatchedPreview.linkExisting?.issues).toContain('currency_mismatch')

        const created2 = await createSpaceEntryV2({
            ...shared,
            title: 'Segunda cena',
            idempotencyKey: `create-link-2-${runId}`,
            expectedRevision: 0,
            amount: 1000,
        })
        const entryId2 = created2.resultRefs.spaceEntryId!.toString()
        const pending2 = await SpaceEntryPersonalImpact.findOne({
            entryId: entryId2,
            userId: memberUserId,
            status: 'pending',
        }).lean()
        expect(pending2).toBeTruthy()

        await expect(resolveSpacePersonalImpactV2({
            actorUserId: memberUserId,
            spaceId: isolated._id.toString(),
            entryId: entryId2,
            impactId: pending2!._id.toString(),
            idempotencyKey: `link-existing-mismatch-${runId}`,
            expectedRevision: pending2!.revision ?? 0,
            decision: { type: 'link_existing', transactionId: mismatchedTransaction._id.toString() },
        })).rejects.toMatchObject({ code: 'SPACE_TRANSACTION_TYPE_MISMATCH' })
    })

    it('la lista de candidatos sólo devuelve transacciones que resolve acepta, y explica lo que excluyó', async () => {
        const isolated = await Space.create({
            contractVersion: 2,
            ownerUserId: new Types.ObjectId(ownerUserId),
            name: `Espacio candidatos ${runId}`,
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
        trackedSpaceIds.push(isolated._id)
        const [isolatedOwner, isolatedMember] = await SpaceParticipant.create([
            {
                spaceId: isolated._id,
                kind: 'finp_user',
                userId: new Types.ObjectId(ownerUserId),
                displayName: 'Owner v2',
                role: 'owner',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
            {
                spaceId: isolated._id,
                kind: 'finp_user',
                userId: new Types.ObjectId(memberUserId),
                displayName: 'Member v2',
                role: 'participant',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
        ])

        const created = await createSpaceEntryV2({
            actorUserId: ownerUserId,
            spaceId: isolated._id.toString(),
            title: 'Almuerzo compartido',
            currency: 'ARS',
            dateKey: '2026-08-28',
            paidByParticipantId: isolatedOwner._id.toString(),
            sharedWithParticipantIds: [isolatedOwner._id.toString(), isolatedMember._id.toString()],
            splitMode: 'equal',
            idempotencyKey: `create-candidates-${runId}`,
            expectedRevision: 0,
            amount: 1000,
            actorPersonalImpact: { accountId: ownerAccountId, categoryId: ownerCategoryId },
        })
        const entryId = created.resultRefs.spaceEntryId!.toString()
        const pending = await SpaceEntryPersonalImpact.findOne({
            entryId,
            userId: memberUserId,
            status: 'pending',
        }).lean()
        expect(pending).toBeTruthy()

        const matching = await Transaction.create({
            userId: memberUserId,
            type: 'expense',
            amount: 500,
            operationalAmount: 500,
            currency: 'ARS',
            date: new Date('2026-08-28T15:00:00.000Z'),
            description: 'Almuerzo (ya registrado)',
            status: 'confirmed',
            createdFrom: 'web',
        })
        const wrongAmount = await Transaction.create({
            userId: memberUserId,
            type: 'expense',
            amount: 999,
            operationalAmount: 999,
            currency: 'ARS',
            date: new Date('2026-08-28T16:00:00.000Z'),
            description: 'Monto distinto',
            status: 'confirmed',
            createdFrom: 'web',
        })
        const otherUsersTransaction = await Transaction.create({
            userId: ownerUserId,
            type: 'expense',
            amount: 500,
            operationalAmount: 500,
            currency: 'ARS',
            date: new Date('2026-08-28T17:00:00.000Z'),
            description: 'Del otro participante',
            status: 'confirmed',
            createdFrom: 'web',
        })

        const result = await listLinkCandidatesForImpactV2({
            actorUserId: memberUserId,
            spaceId: isolated._id.toString(),
            entryId,
            impactId: pending!._id.toString(),
        })

        expect(result.applicable).toBe(true)
        expect(result.candidates).toHaveLength(1)
        expect(result.candidates[0].transactionId).toBe(matching._id.toString())
        expect(result.excluded.amountMismatch).toBe(1)
        expect(result.candidates.map((candidate) => candidate.transactionId))
            .not.toContain(otherUsersTransaction._id.toString())

        // El único candidato que la lista devuelve se vincula sin fricción — la
        // propiedad central que la etapa 2 exige.
        const resolved = await resolveSpacePersonalImpactV2({
            actorUserId: memberUserId,
            spaceId: isolated._id.toString(),
            entryId,
            impactId: pending!._id.toString(),
            idempotencyKey: `link-candidate-${runId}`,
            expectedRevision: pending!.revision ?? 0,
            decision: { type: 'link_existing', transactionId: result.candidates[0].transactionId },
        })
        expect(resolved.value!.status).toBe('linked')

        // Ya vinculada a este movimiento, la misma transacción cuenta como "ya
        // vinculada" para OTRO movimiento que pide exactamente lo mismo — nunca
        // vuelve a ofrecerse como candidato ajeno.
        const created2 = await createSpaceEntryV2({
            actorUserId: ownerUserId,
            spaceId: isolated._id.toString(),
            title: 'Segundo almuerzo',
            currency: 'ARS',
            dateKey: '2026-08-28',
            paidByParticipantId: isolatedOwner._id.toString(),
            sharedWithParticipantIds: [isolatedOwner._id.toString(), isolatedMember._id.toString()],
            splitMode: 'equal',
            idempotencyKey: `create-candidates-2-${runId}`,
            expectedRevision: 0,
            amount: 1000,
            actorPersonalImpact: { accountId: ownerAccountId, categoryId: ownerCategoryId },
        })
        const entryId2 = created2.resultRefs.spaceEntryId!.toString()
        const pending2 = await SpaceEntryPersonalImpact.findOne({
            entryId: entryId2,
            userId: memberUserId,
            status: 'pending',
        }).lean()
        expect(pending2).toBeTruthy()

        const secondResult = await listLinkCandidatesForImpactV2({
            actorUserId: memberUserId,
            spaceId: isolated._id.toString(),
            entryId: entryId2,
            impactId: pending2!._id.toString(),
        })
        expect(secondResult.candidates.map((candidate) => candidate.transactionId))
            .not.toContain(matching._id.toString())
        expect(secondResult.excluded.alreadyLinked).toBeGreaterThanOrEqual(1)

        void wrongAmount
    })

    it('la lista de candidatos de alta no requiere un impacto persistido', async () => {
        const isolated = await Space.create({
            contractVersion: 2,
            ownerUserId: new Types.ObjectId(ownerUserId),
            name: `Espacio candidatos alta ${runId}`,
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
        trackedSpaceIds.push(isolated._id)
        const [isolatedOwner, isolatedMember] = await SpaceParticipant.create([
            {
                spaceId: isolated._id,
                kind: 'finp_user',
                userId: new Types.ObjectId(ownerUserId),
                displayName: 'Owner v2',
                role: 'owner',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
            {
                spaceId: isolated._id,
                kind: 'finp_user',
                userId: new Types.ObjectId(memberUserId),
                displayName: 'Member v2',
                role: 'participant',
                inviteStatus: 'accepted',
                isActive: true,
                revision: 0,
            },
        ])
        const freshTransaction = await Transaction.create({
            userId: memberUserId,
            type: 'expense',
            amount: 500,
            operationalAmount: 500,
            currency: 'ARS',
            date: new Date('2026-08-29T15:00:00.000Z'),
            description: 'Ya registrado antes del alta',
            status: 'confirmed',
            createdFrom: 'web',
        })

        const result = await listLinkCandidatesForNewEntryV2({
            actorUserId: memberUserId,
            spaceId: isolated._id.toString(),
            amount: 1000,
            currency: 'ARS',
            paidByParticipantId: isolatedOwner._id.toString(),
            sharedWithParticipantIds: [isolatedOwner._id.toString(), isolatedMember._id.toString()],
            splitMode: 'equal',
            dateKey: '2026-08-29',
            timezone: 'America/Argentina/Buenos_Aires',
        })

        expect(result.applicable).toBe(true)
        expect(result.candidates.map((candidate) => candidate.transactionId))
            .toContain(freshTransaction._id.toString())

        // Para el pagador, el requisito es la salida real completa (1000), no
        // su parte propia (500) — `accountImpactAmount` manda sobre
        // `ownShareAmount` cuando es positivo.
        const payerResult = await listLinkCandidatesForNewEntryV2({
            actorUserId: ownerUserId,
            spaceId: isolated._id.toString(),
            amount: 1000,
            currency: 'ARS',
            paidByParticipantId: isolatedOwner._id.toString(),
            sharedWithParticipantIds: [isolatedOwner._id.toString(), isolatedMember._id.toString()],
            splitMode: 'equal',
            dateKey: '2026-08-29',
            timezone: 'America/Argentina/Buenos_Aires',
        })
        expect(payerResult.applicable).toBe(true)
        expect(payerResult.requirement?.amount).toBe(1000)
    })

    it('bloquea la moneda de reporte, conserva monedas usadas y permite agregar nuevas', async () => {
        const base = {
            actorUserId: ownerUserId,
            spaceId,
            expectedRevision: 0,
            name: `Espacio v2 ${runId}`,
            currencies: ['ARS'],
            reportingCurrency: 'ARS',
            defaultSplitMode: 'equal' as const,
            timezone: 'America/Argentina/Buenos_Aires',
        }
        await expect(updateSpaceSettingsV2({
            ...base,
            idempotencyKey: `currency-reporting-${runId}`,
            currencies: ['ARS', 'USD'],
            reportingCurrency: 'USD',
        })).rejects.toMatchObject({ code: 'SPACE_REPORTING_CURRENCY_LOCKED' })
        await expect(updateSpaceSettingsV2({
            ...base,
            idempotencyKey: `currency-remove-${runId}`,
            currencies: ['USD'],
            reportingCurrency: 'USD',
        })).rejects.toMatchObject({ code: 'SPACE_CURRENCY_IN_USE' })
        const updated = await updateSpaceSettingsV2({
            ...base,
            idempotencyKey: `currency-add-${runId}`,
            currencies: ['ARS', 'USD'],
        })
        expect(updated.value).toMatchObject({ currencies: ['ARS', 'USD'], revision: 1 })
    })

    it('conserva deudas separadas por moneda y liquida varios tramos sin compensarlas', async () => {
        const usdArs = buildManualConversionSnapshot({
            sourceCurrency: 'USD',
            targetCurrency: 'ARS',
            rate: '1300',
            actorUserId: ownerUserId,
            now: new Date('2026-08-24T15:00:00.000Z'),
        })
        await createSpaceEntryV2({
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `create-usd-${runId}`,
            expectedRevision: 1,
            title: 'Gasto compartido en USD',
            amount: 100,
            money: moneyFromDecimal('USD', 100),
            currency: 'USD',
            exchangeRateDecimal: '1300',
            conversionSnapshot: usdArs,
            dateKey: '2026-08-25',
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId, memberParticipantId],
            splitMode: 'equal',
        })
        const before = await Debt.find({
            userId: ownerUserId,
            spaceId,
            direction: 'receivable',
            status: 'active',
        }).sort({ currency: 1 }).lean()
        expect(before.map((debt) => [debt.currency, debt.remainingAmount])).toEqual([
            ['ARS', 90],
            ['USD', 50],
        ])

        const settlement = await settleSpaceDebtV2({
            mode: 'represented',
            actorUserId: ownerUserId,
            spaceId,
            payerParticipantId: memberParticipantId,
            receiverParticipantId: ownerParticipantId,
            idempotencyKey: `settle-multicurrency-${runId}`,
            expectedRevision: 1,
            originSurface: 'spaces',
            dateKey: '2026-08-26',
            components: [
                { currency: 'ARS', money: moneyFromDecimal('ARS', 10), order: 0 },
                { currency: 'USD', money: moneyFromDecimal('USD', 20), order: 1 },
            ],
            legs: [
                { id: 'ars', currency: 'ARS', money: moneyFromDecimal('ARS', 10) },
                { id: 'usd', currency: 'USD', money: moneyFromDecimal('USD', 20), reportingSnapshot: usdArs },
            ],
        })
        expect(settlement.value!.remainingByCurrency).toEqual([
            moneyFromDecimal('ARS', 0),
            moneyFromDecimal('USD', 0),
        ])
        const entry = await SpaceEntry.findById(settlement.resultRefs.spaceEntryId).lean()
        expect(entry?.settlementLegs).toHaveLength(2)
        expect(entry?.settlementLegs?.flatMap((leg) => leg.applications).map((application) => application.debtCurrency)).toEqual(['ARS', 'USD'])
        expect(await Transaction.countDocuments({ spaceEntryId: settlement.resultRefs.spaceEntryId })).toBe(0)
        expect(await SpaceEntryPersonalImpact.countDocuments({
            entryId: settlement.resultRefs.spaceEntryId,
            status: 'pending',
        })).toBe(2)
        const after = await Debt.find({
            userId: ownerUserId,
            spaceId,
            direction: 'receivable',
            status: 'active',
        }).sort({ currency: 1 }).lean()
        expect(after.map((debt) => [debt.currency, debt.remainingAmount])).toEqual([
            ['ARS', 80],
            ['USD', 30],
        ])
    })

    it('cambia el modo sin dejar claves activas anteriores y liquida igual desde ambas superficies', async () => {
        const mode = await changeSpaceDebtModeV2({
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `mode-${runId}`,
            expectedRevision: 1,
            debtMode: 'simplified',
        })
        expect(mode.value).toMatchObject({ debtMode: 'simplified', revision: 2 })
        expect(await Debt.countDocuments({ spaceId, originMode: 'direct', status: 'active' })).toBe(0)
        let debt = await Debt.findOne({
            userId: ownerUserId,
            spaceId,
            originMode: 'simplified',
            direction: 'receivable',
            currency: 'ARS',
            status: 'active',
        }).lean()
        expect(debt?.remainingAmount).toBe(80)

        await settleSpaceDebtV2({
            actorUserId: ownerUserId,
            spaceId,
            debtId: debt!._id.toString(),
            idempotencyKey: `settle-spaces-${runId}`,
            expectedRevision: 2,
            originSurface: 'spaces',
            amount: 20,
            currency: 'ARS',
            dateKey: '2026-08-26',
            accountId: ownerAccountId,
        })
        debt = await Debt.findById(debt!._id).lean()
        expect(debt?.remainingAmount).toBe(60)

        const transactionCountBeforeRepresented = await Transaction.countDocuments({ spaceId })
        const represented = await settleSpaceDebtV2({
            mode: 'represented',
            actorUserId: ownerUserId,
            spaceId,
            payerParticipantId: memberParticipantId,
            receiverParticipantId: ownerParticipantId,
            idempotencyKey: `settle-represented-${runId}`,
            expectedRevision: 2,
            originSurface: 'spaces',
            amount: 10,
            currency: 'ARS',
            dateKey: '2026-08-27',
        })
        expect(represented.value).toMatchObject({
            represented: true,
            remainingByCurrency: [
                moneyFromDecimal('ARS', 50),
                moneyFromDecimal('USD', 30),
            ],
        })
        expect(represented.value!.remainingAmount).toBeUndefined()
        expect(await Transaction.countDocuments({ spaceId })).toBe(transactionCountBeforeRepresented)
        expect(await SpaceEntryPersonalImpact.countDocuments({
            entryId: represented.resultRefs.spaceEntryId,
            status: 'pending',
        })).toBe(2)
        debt = await Debt.findById(debt!._id).lean()
        expect(debt?.remainingAmount).toBe(50)

        await settleSpaceDebtV2({
            actorUserId: ownerUserId,
            spaceId,
            debtId: debt!._id.toString(),
            idempotencyKey: `settle-debts-${runId}`,
            expectedRevision: 2,
            originSurface: 'debts',
            amount: 50,
            currency: 'ARS',
            dateKey: '2026-08-27',
            accountId: ownerAccountId,
        })
        debt = await Debt.findById(debt!._id).lean()
        expect(debt).toMatchObject({ remainingAmount: 0, status: 'paid' })

        // Ninguna superficie puede devolver una obligación saldada como abierta:
        // se replica el filtro que aplican las rutas de Espacios y de Mi Finp.
        expect(await Debt.countDocuments({
            _id: debt!._id,
            status: { $in: ['active', 'partially_paid', 'ignored'] },
            remainingAmount: { $gt: 0 },
        })).toBe(0)
        expect(await Debt.countDocuments({
            userId: ownerUserId,
            status: { $in: ['active', 'partially_paid'] },
            remainingAmount: { $lte: 0 },
        })).toBe(0)

        const settlements = await SpaceEntry.find({ spaceId, type: 'settlement', contractVersion: 2 }).lean()
        expect(settlements).toHaveLength(4)
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
            expectedRevision: 2,
            targetStatus: 'paused',
        })
        expect(paused.value).toMatchObject({ status: 'paused', revision: 3 })
        await expect(createSpaceEntryV2({
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `blocked-create-${runId}`,
            expectedRevision: 3,
            title: 'No se crea',
            amount: 10,
            currency: 'ARS',
            dateKey: '2026-08-28',
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId],
            splitMode: 'none',
        })).rejects.toMatchObject({ code: 'SPACE_STATE_CONFLICT' })
        await changeSpaceLifecycleV2({
            actorUserId: ownerUserId,
            spaceId,
            idempotencyKey: `reopen-${runId}`,
            expectedRevision: 3,
            targetStatus: 'active',
        })
        const transfer = await transferSpaceOwnershipV2({
            actorUserId: ownerUserId,
            spaceId,
            targetParticipantId: memberParticipantId,
            idempotencyKey: `transfer-${runId}`,
            expectedSpaceRevision: 4,
            expectedActorParticipantRevision: 0,
            expectedTargetParticipantRevision: 0,
        })
        expect(transfer.value).toMatchObject({ ownerUserId: memberUserId, spaceRevision: 5 })
        expect(await SpaceParticipant.findById(ownerParticipantId).lean()).toMatchObject({ role: 'admin', revision: 1 })
        expect(await SpaceParticipant.findById(memberParticipantId).lean()).toMatchObject({ role: 'owner', revision: 1 })
    })

    it('una persona removida conserva historia, impacto privado y liquidación propia', async () => {
        const historicalEntry = await createSpaceEntryV2({
            actorUserId: memberUserId,
            spaceId,
            idempotencyKey: `inactive-origin-${runId}`,
            expectedRevision: 5,
            title: 'Saldo histórico después de transferir',
            amount: 50,
            currency: 'ARS',
            dateKey: '2026-08-29',
            paidByParticipantId: memberParticipantId,
            sharedWithParticipantIds: [ownerParticipantId, memberParticipantId],
            splitMode: 'equal',
        })
        await setSpaceParticipantActiveV2({
            actorUserId: memberUserId,
            spaceId,
            participantId: ownerParticipantId,
            idempotencyKey: `deactivate-historical-${runId}`,
            expectedParticipantRevision: 1,
            isActive: false,
        })
        expect(await SpaceParticipant.findById(ownerParticipantId).lean())
            .toMatchObject({ isActive: false, revision: 2 })
        const historicalEntryId = historicalEntry.resultRefs.spaceEntryId!.toString()
        const edited = await editSpaceEntryV2({
            actorUserId: memberUserId,
            spaceId,
            entryId: historicalEntryId,
            idempotencyKey: `edit-preserve-inactive-${runId}`,
            expectedRevision: 0,
            title: 'Saldo histórico conservado',
            amount: 50,
            money: moneyFromDecimal('ARS', 50),
            currency: 'ARS',
            dateKey: '2026-08-29',
            paidByParticipantId: memberParticipantId,
            sharedWithParticipantIds: [ownerParticipantId, memberParticipantId],
            splitMode: 'equal',
        })
        expect(edited.value).toMatchObject({ revision: 1 })
        await expect(editSpaceEntryV2({
            actorUserId: memberUserId,
            spaceId,
            entryId: historicalEntryId,
            idempotencyKey: `edit-add-inactive-role-${runId}`,
            expectedRevision: 1,
            title: 'No debe cambiar pagador',
            amount: 50,
            money: moneyFromDecimal('ARS', 50),
            currency: 'ARS',
            dateKey: '2026-08-29',
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId, memberParticipantId],
            splitMode: 'equal',
        })).rejects.toMatchObject({ code: 'SPACE_PARTICIPANT_INACTIVE' })
        const debt = await Debt.findOne({
            userId: ownerUserId,
            spaceId,
            currency: 'ARS',
            remainingAmount: 25,
            status: 'active',
        }).lean()
        expect(debt?.remainingAmount).toBe(25)
        const settlement = await settleSpaceDebtV2({
            actorUserId: ownerUserId,
            spaceId,
            debtId: debt!._id.toString(),
            accountId: ownerAccountId,
            idempotencyKey: `inactive-own-settlement-${runId}`,
            expectedRevision: 5,
            originSurface: 'spaces',
            amount: 25,
            currency: 'ARS',
            dateKey: '2026-08-30',
        })
        expect(settlement.value).toMatchObject({ remainingAmount: 0, represented: false })
        expect(await Transaction.countDocuments({
            userId: ownerUserId,
            spaceEntryId: settlement.resultRefs.spaceEntryId,
        })).toBe(1)
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

    it('pagina una historia grande con payload acotado sin cache ni dependencias nuevas', async () => {
        const perfSpace = await Space.create({
            contractVersion: 2,
            ownerUserId,
            name: `Rendimiento v2 ${runId}`,
            type: 'project',
            mode: 'solo',
            status: 'active',
            currencies: ['ARS'],
            reportingCurrency: 'ARS',
            defaultSplitMode: 'none',
            debtMode: 'direct',
            timezone: 'America/Argentina/Buenos_Aires',
            revision: 0,
        })
        const participant = await SpaceParticipant.create({
            spaceId: perfSpace._id,
            kind: 'finp_user',
            userId: ownerUserId,
            displayName: 'Owner rendimiento',
            role: 'owner',
            inviteStatus: 'accepted',
            isActive: true,
            revision: 0,
        })
        try {
            const createdAt = new Date('2026-08-24T12:00:00.000Z')
            await SpaceEntry.insertMany(Array.from({ length: 1_000 }, (_, index) => ({
                contractVersion: 2,
                spaceId: perfSpace._id,
                createdByUserId: ownerUserId,
                createdByParticipantId: participant._id,
                type: 'expense',
                status: 'recorded',
                title: `Movimiento ${index}`,
                amount: 100,
                currency: 'ARS',
                reportingAmount: 100,
                date: createdAt,
                dateKey: `2026-08-${String((index % 24) + 1).padStart(2, '0')}`,
                timezone: 'America/Argentina/Buenos_Aires',
                paidByParticipantId: participant._id,
                sharedWithParticipantIds: [participant._id],
                splitMode: 'none',
                splitAllocations: [],
                revision: 0,
                createdAt,
                updatedAt: createdAt,
            })), { ordered: true })
            const startedAt = performance.now()
            const detail = await getSpaceDetailV2({
                spaceId: perfSpace._id.toString(),
                actorUserId: ownerUserId,
            })
            const elapsedMs = performance.now() - startedAt
            const payloadBytes = Buffer.byteLength(JSON.stringify(detail))
            expect(detail.movements.items).toHaveLength(50)
            expect(detail.movements.nextCursor).toBeTruthy()
            expect(payloadBytes).toBeLessThan(150_000)
            expect(elapsedMs).toBeLessThan(5_000)
            console.info('[spaces-v2-performance] entries=1000 payloadBytes=%d elapsedMs=%d', payloadBytes, Math.round(elapsedMs))
        } finally {
            await Promise.all([
                SpaceEntry.deleteMany({ spaceId: perfSpace._id }),
                SpaceParticipant.deleteMany({ spaceId: perfSpace._id }),
            ])
            await Space.deleteOne({ _id: perfSpace._id })
        }
    }, 15_000)
})
