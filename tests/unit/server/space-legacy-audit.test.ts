// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
    auditSpaceBundle,
    buildSpaceAuditResult,
    type AuditDocument,
    type SpaceAuditBundle,
} from '@/lib/server/audits/space-legacy-audit'

function validBundle(overrides: Partial<SpaceAuditBundle> = {}): SpaceAuditBundle {
    const space: AuditDocument = {
        _id: 'space-1',
        ownerUserId: 'user-1',
        status: 'active',
        currencies: ['ARS'],
        reportingCurrency: 'ARS',
        debtMode: 'simplified',
        timezone: 'America/Argentina/Buenos_Aires',
    }
    const participants: AuditDocument[] = [
        {
            _id: 'participant-1', spaceId: 'space-1', userId: 'user-1',
            role: 'owner', isActive: true, inviteStatus: 'active',
        },
        {
            _id: 'participant-2', spaceId: 'space-1', userId: 'user-2',
            role: 'participant', isActive: true, inviteStatus: 'active',
        },
    ]
    const entries: AuditDocument[] = [{
        _id: 'entry-1', spaceId: 'space-1', type: 'expense', status: 'recorded',
        amount: 100, reportingAmount: 100, currency: 'ARS',
        date: new Date('2026-08-01T12:00:00Z'), dateKey: '2026-08-01',
        paidByParticipantId: 'participant-1',
        sharedWithParticipantIds: ['participant-1', 'participant-2'],
        splitMode: 'equal', splitAllocations: [],
    }]
    const activityEvents: AuditDocument[] = [{
        _id: 'activity-1', spaceId: 'space-1', entityType: 'entry', entityId: 'entry-1',
    }]
    const impacts: AuditDocument[] = [
        {
            _id: 'impact-1', spaceId: 'space-1', entryId: 'entry-1',
            userId: 'user-1', participantId: 'participant-1', status: 'ignored',
            amount: 50, ignoredAt: new Date('2026-08-02T12:00:00Z'),
        },
        {
            _id: 'impact-2', spaceId: 'space-1', entryId: 'entry-1',
            userId: 'user-2', participantId: 'participant-2', status: 'ignored',
            amount: 50, ignoredAt: new Date('2026-08-02T12:00:00Z'),
        },
    ]
    const debts: AuditDocument[] = [
        {
            _id: 'debt-1', userId: 'user-1', spaceId: 'space-1',
            counterpartyParticipantId: 'participant-2', direction: 'receivable',
            currency: 'ARS', sourceType: 'space', spaceDebtKey: 'key-1',
            amount: 50, remainingAmount: 50, status: 'active',
            metadata: { syncSnapshot: { debtMode: 'simplified' } },
        },
        {
            _id: 'debt-2', userId: 'user-2', spaceId: 'space-1',
            counterpartyParticipantId: 'participant-1', direction: 'payable',
            currency: 'ARS', sourceType: 'space', spaceDebtKey: 'key-2',
            amount: 50, remainingAmount: 50, status: 'active',
            metadata: { syncSnapshot: { debtMode: 'simplified' } },
        },
    ]

    return {
        space,
        participants,
        entries,
        impacts,
        transactions: [],
        debts,
        debtMovements: [],
        notifications: [],
        activityEvents,
        users: [{ _id: 'user-1' }, { _id: 'user-2' }],
        accounts: [],
        ...overrides,
    }
}

describe('auditSpaceBundle', () => {
    it('mantiene estable y determinista el contrato de salida', () => {
        const first = auditSpaceBundle(validBundle())
        const second = auditSpaceBundle(validBundle())

        expect(first).toEqual(second)
        expect(first.map((finding) => finding.code)).toEqual([
            'SPACE_ENTRY_LEGACY_SHARED_STATE',
        ])
    })

    it('detecta ownership, referencias y reparto inválidos', () => {
        const bundle = validBundle({
            space: {
                ...validBundle().space,
                ownerUserId: 'missing-owner',
            },
            entries: [{
                ...validBundle().entries[0],
                paidByParticipantId: 'missing-participant',
                sharedWithParticipantIds: ['participant-2', 'participant-2'],
                splitMode: 'fixed',
                splitAllocations: [{ participantId: 'participant-2', amount: 40 }],
            }],
        })
        const codes = auditSpaceBundle(bundle).map((finding) => finding.code)

        expect(codes).toContain('SPACE_OWNER_PARTICIPANT_INVALID')
        expect(codes).toContain('SPACE_OWNER_ROLE_INVALID')
        expect(codes).toContain('SPACE_ENTRY_PAYER_INVALID')
        expect(codes).toContain('SPACE_ENTRY_SHARED_PARTICIPANTS_INVALID')
        expect(codes).toContain('SPACE_ENTRY_SPLIT_INVALID')
    })

    it('distingue la matriz de parte propia cero entre pagador y no pagador', () => {
        const base = validBundle()
        const participant3 = {
            _id: 'participant-3', spaceId: 'space-1', userId: 'user-3',
            role: 'participant', isActive: true, inviteStatus: 'active',
        }
        const entry = {
            ...base.entries[0],
            sharedWithParticipantIds: ['participant-1', 'participant-2', 'participant-3'],
            splitMode: 'fixed',
            splitAllocations: [
                { participantId: 'participant-1', amount: 0 },
                { participantId: 'participant-2', amount: 100 },
                { participantId: 'participant-3', amount: 0 },
            ],
        }
        const impacts = [
            {
                _id: 'impact-payer', spaceId: 'space-1', entryId: 'entry-1',
                userId: 'user-1', participantId: 'participant-1', status: 'pending',
                amount: 100, actionType: 'impact_space_expense',
            },
            {
                _id: 'impact-nonpayer', spaceId: 'space-1', entryId: 'entry-1',
                userId: 'user-3', participantId: 'participant-3', status: 'pending',
                amount: 0, actionType: 'impact_space_expense',
            },
        ]
        const findings = auditSpaceBundle({
            ...base,
            participants: [...base.participants, participant3],
            entries: [entry],
            impacts,
            users: [...base.users, { _id: 'user-3' }],
            notifications: impacts.map((impact, index) => ({
                _id: `notification-${index}`,
                recipientUserId: impact.userId,
                pendingActionId: impact._id,
            })),
        })

        expect(findings.find((finding) => finding.code === 'SPACE_PAYER_ZERO_SHARE_ACTION_MISCLASSIFIED')?.recordIds)
            .toEqual(['impact-payer'])
        expect(findings.find((finding) => finding.code === 'SPACE_PENDING_UNNEEDED_ZERO_SHARE')?.recordIds)
            .toEqual(['impact-nonpayer'])
    })

    it('marca impactos duplicados y referencias privadas cruzadas como críticas', () => {
        const base = validBundle()
        const impacts = [
            {
                _id: 'impact-1', spaceId: 'space-1', entryId: 'entry-1',
                userId: 'user-2', participantId: 'participant-1', status: 'linked',
                amount: 50, transactionId: 'transaction-1', accountId: 'account-1',
            },
            {
                _id: 'impact-2', spaceId: 'space-1', entryId: 'entry-1',
                userId: 'user-2', participantId: 'participant-2', status: 'ignored', amount: 50,
            },
        ]
        const findings = auditSpaceBundle({
            ...base,
            impacts,
            transactions: [{
                _id: 'transaction-1', userId: 'user-1', spaceId: 'space-1',
                spaceEntryId: 'entry-1', sourceAccountId: 'account-1',
            }],
            accounts: [{ _id: 'account-1', userId: 'user-1' }],
        })
        const result = buildSpaceAuditResult(findings, 1)

        expect(result.countsByCode.SPACE_PERSONAL_IMPACT_DUPLICATE).toBe(1)
        expect(result.countsByCode.SPACE_PERSONAL_IMPACT_CROSS_USER).toBe(1)
        expect(result.countsByCode.SPACE_PERSONAL_TRANSACTION_CROSS_USER_OR_ENTRY).toBe(1)
        expect(result.migrationReadiness.readyForAutomaticMigration).toBe(false)
    })

    it('detecta deuda activa en cero y movimientos incompletos', () => {
        const base = validBundle()
        const findings = auditSpaceBundle({
            ...base,
            debts: [{
                _id: 'debt-1', spaceId: 'space-1', sourceType: 'space',
                spaceDebtKey: 'key-1', amount: 100, remainingAmount: 0,
                status: 'active', metadata: { syncSnapshot: { debtMode: 'direct' } },
            }],
            debtMovements: [{
                _id: 'movement-1', spaceId: 'space-1', debtId: 'missing-debt',
                transactionId: 'missing-transaction', spaceEntryId: 'missing-entry',
            }],
        })
        const codes = findings.map((finding) => finding.code)

        expect(codes).toContain('SPACE_DEBT_ACTIVE_ZERO')
        expect(codes).toContain('SPACE_DEBT_MODE_STALE')
        expect(codes).toContain('SPACE_DEBT_MOVEMENT_LINKS_INVALID')
    })
})
