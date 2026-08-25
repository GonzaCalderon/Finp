import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Debt, Space, SpaceParticipant } from '@/lib/models'
import { collectDebtSchema } from '@/lib/validations/debt'
import { isAccountCurrencyCompatible } from '@/lib/utils/debt'
import { calculateReportingAmount } from '@/lib/utils/spaces'
import { syncSpaceDebtsForActiveParticipants } from '@/lib/server/debt-sync'
import { createDebtSettlement } from '@/lib/server/debt-settlement'
import { upsertLinkedPersonalImpact } from '@/lib/server/space-personal-impact'
import { emitPersonalSyncEvent } from '@/lib/server/personal-sync-events'
import {
    DEBT_MOVEMENT_TYPES,
    DEBT_STATUSES,
    SPACE_PERSONAL_IMPACT_SOURCE_TYPES,
    SPACE_PERSONAL_PENDING_ACTION_TYPES,
    TRANSACTION_TYPES,
} from '@/lib/constants'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { settleSpaceDebtV2 } from '@/lib/server/space-settlement-service-v2'

const spaceDebtSettlementV2Schema = z.object({
    expectedRevision: z.number().int().nonnegative(),
    amount: z.number().finite().positive(),
    currency: z.string().min(1).max(12),
    exchangeRate: z.number().finite().positive().optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    accountId: z.string().min(1),
    notes: z.string().trim().max(1000).optional(),
}).strict()

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authSession = await auth()
        if (!authSession) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params
        if (!Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID de deuda inválido' }, { status: 400 })
        }

        const body: unknown = await request.json()
        await connectDB()

        const debt = await Debt.findOne({ _id: id, userId: authSession.user.id })
        if (!debt) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
        if (debt.contractVersion === 2 && debt.sourceType === 'space' && debt.spaceId) {
            const parsedV2 = spaceDebtSettlementV2Schema.safeParse(body)
            if (!parsedV2.success) {
                return NextResponse.json({
                    error: 'Datos de liquidación inválidos',
                    code: 'SPACE_SETTLEMENT_INVALID',
                    failureState: 'not_started',
                    retryable: false,
                    details: parsedV2.error.flatten(),
                }, { status: 400 })
            }
            if (debt.direction !== 'receivable') {
                return NextResponse.json({
                    error: 'La obligación no corresponde a un cobro.',
                    code: 'SPACE_DEBT_DIRECTION_CONFLICT',
                    failureState: 'conflict',
                    retryable: false,
                }, { status: 409 })
            }
            const execution = await settleSpaceDebtV2({
                mode: 'own',
                actorUserId: authSession.user.id,
                spaceId: debt.spaceId.toString(),
                debtId: id,
                accountId: parsedV2.data.accountId,
                idempotencyKey: requireIdempotencyKey(request),
                expectedRevision: parsedV2.data.expectedRevision,
                originSurface: 'debts',
                amount: parsedV2.data.amount,
                currency: parsedV2.data.currency,
                exchangeRate: parsedV2.data.exchangeRate,
                dateKey: parsedV2.data.dateKey,
                description: parsedV2.data.notes,
            })
            return NextResponse.json(toSpaceMutationResult(execution))
        }
        const parsed = collectDebtSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }
        if (debt.direction !== 'receivable') {
            return NextResponse.json(
                { error: 'Este endpoint es para cobrar deudas que te deben (receivable)' },
                { status: 400 }
            )
        }
        if (debt.status === DEBT_STATUSES.PAID || debt.status === DEBT_STATUSES.CANCELLED) {
            return NextResponse.json({ error: 'La deuda ya está saldada o cancelada' }, { status: 400 })
        }
        if (parsed.data.amount > debt.remainingAmount + 0.01) {
            return NextResponse.json(
                { error: `El monto no puede superar el saldo pendiente (${debt.remainingAmount} ${debt.currency})` },
                { status: 400 }
            )
        }

        const account = await Account.findOne({
            _id: parsed.data.accountId,
            userId: authSession.user.id,
        })
        if (!account) {
            return NextResponse.json({ error: 'La cuenta no existe o no te pertenece' }, { status: 400 })
        }
        if (!isAccountCurrencyCompatible(account.currency, account.supportedCurrencies, debt.currency)) {
            return NextResponse.json(
                { error: `La cuenta no soporta la moneda de la deuda (${debt.currency})` },
                { status: 400 }
            )
        }

        let currentParticipantId: string | undefined
        let spaceNameSnapshot: string | undefined
        let spaceEntry: Record<string, unknown> | undefined

        if (debt.sourceType === 'space' && debt.spaceId && debt.counterpartyParticipantId) {
            const [space, currentParticipant] = await Promise.all([
                Space.findById(debt.spaceId, { name: 1, reportingCurrency: 1 })
                    .lean<{ name: string; reportingCurrency?: string } | null>(),
                SpaceParticipant.findOne({
                    spaceId: debt.spaceId,
                    userId: authSession.user.id,
                    isActive: true,
                }),
            ])

            if (currentParticipant) {
                currentParticipantId = currentParticipant._id.toString()
                spaceNameSnapshot = space?.name ?? ''
                spaceEntry = {
                    spaceId: debt.spaceId,
                    createdByUserId: authSession.user.id,
                    createdByParticipantId: currentParticipant._id,
                    type: 'settlement',
                    status: 'confirmed',
                    title: `Cobro de ${debt.counterpartyNameSnapshot}`,
                    amount: parsed.data.amount,
                    currency: debt.currency,
                    reportingAmount: calculateReportingAmount({
                        amount: parsed.data.amount,
                        currency: debt.currency,
                        reportingCurrency: space?.reportingCurrency ?? debt.currency,
                    }),
                    date: parsed.data.date,
                    paidByParticipantId: debt.counterpartyParticipantId,
                    sharedWithParticipantIds: [currentParticipant._id],
                    splitMode: 'none',
                    confirmationRequired: false,
                    confirmedByUserId: authSession.user.id,
                    confirmedAt: new Date(),
                    notes: parsed.data.notes,
                }
            }
        }

        const { transactionId, spaceEntryId } = await createDebtSettlement({
            userId: authSession.user.id,
            debtId: id,
            expectedDirection: 'receivable',
            amount: parsed.data.amount,
            transaction: {
                userId: authSession.user.id,
                type: TRANSACTION_TYPES.PERSONAL_DEBT_COLLECT,
                amount: parsed.data.amount,
                currency: debt.currency,
                date: parsed.data.date,
                description: `${debt.counterpartyNameSnapshot} te pagó`,
                destinationAccountId: account._id,
                ...(debt.spaceId && { spaceId: debt.spaceId }),
                ...(spaceNameSnapshot !== undefined && { spaceNameSnapshot }),
                notes: parsed.data.notes,
                createdFrom: 'web',
                status: 'confirmed',
            },
            movement: {
                type: DEBT_MOVEMENT_TYPES.COLLECT,
                amount: parsed.data.amount,
                currency: debt.currency,
                accountId: account._id,
                ...(debt.spaceId && { spaceId: debt.spaceId }),
                date: parsed.data.date,
                notes: parsed.data.notes,
            },
            spaceEntry,
        })

        if (spaceEntryId && currentParticipantId && debt.spaceId) {
            try {
                await upsertLinkedPersonalImpact({
                    spaceId: debt.spaceId.toString(),
                    entryId: spaceEntryId,
                    userId: authSession.user.id,
                    participantId: currentParticipantId,
                    impactKind: 'settlement_received',
                    actionType: SPACE_PERSONAL_PENDING_ACTION_TYPES.IMPACT_SPACE_COLLECT,
                    transactionId,
                    accountId: account._id.toString(),
                    amount: parsed.data.amount,
                    currency: debt.currency,
                })

                const counterparty = await SpaceParticipant.findById(debt.counterpartyParticipantId).lean()
                if (!counterparty?.userId) {
                    console.info(
                        '[collect] settlement con contraparte externa, debtId=%s, counterpartyParticipantId=%s',
                        id,
                        debt.counterpartyParticipantId
                    )
                } else {
                    await emitPersonalSyncEvent({
                        actorUserId: authSession.user.id,
                        spaceId: debt.spaceId.toString(),
                        entryId: spaceEntryId,
                        sourceType: SPACE_PERSONAL_IMPACT_SOURCE_TYPES.DEBT_COLLECT,
                        debtId: id,
                        pendingTargets: [{
                            userId: counterparty.userId.toString(),
                            participantId: counterparty._id.toString(),
                            impactKind: 'settlement_paid',
                            actionType: SPACE_PERSONAL_PENDING_ACTION_TYPES.IMPACT_SPACE_PAYMENT,
                            amount: parsed.data.amount,
                            currency: debt.currency,
                            counterpartyParticipantId: currentParticipantId,
                            counterpartyNameSnapshot: debt.counterpartyNameSnapshot,
                        }],
                    })
                }
            } catch (error) {
                console.error('[personal-sync] collect post-commit:', error)
            }
        }

        if (debt.sourceType === 'space' && debt.spaceId) {
            try {
                await syncSpaceDebtsForActiveParticipants(debt.spaceId.toString())
            } catch (error) {
                console.error('[debt-sync] collect route:', error)
            }
        }

        const updated = await Debt.findById(id)
        return NextResponse.json({ debt: updated, transactionId, spaceEntryId })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo registrar el cobro de la deuda.')
    }
}
