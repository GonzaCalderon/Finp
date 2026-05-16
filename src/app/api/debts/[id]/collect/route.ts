import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Debt, DebtMovement, Space, SpaceEntry, SpaceParticipant, Transaction } from '@/lib/models'
import { collectDebtSchema } from '@/lib/validations/debt'
import { isAccountCurrencyCompatible } from '@/lib/utils/debt'
import { calculateReportingAmount } from '@/lib/utils/spaces'
import { syncSpaceDebtsForActiveParticipants } from '@/lib/server/debt-sync'
import { upsertLinkedPersonalImpact } from '@/lib/server/space-personal-impact'
import { emitPersonalSyncEvent } from '@/lib/server/personal-sync-events'
import { DEBT_STATUSES, DEBT_MOVEMENT_TYPES, TRANSACTION_TYPES, SPACE_PERSONAL_PENDING_ACTION_TYPES, SPACE_PERSONAL_IMPACT_SOURCE_TYPES } from '@/lib/constants'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params
        const body = await request.json()
        const parsed = collectDebtSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const debt = await Debt.findOne({ _id: id, userId: session.user.id })
        if (!debt) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })

        if (debt.direction !== 'receivable') {
            return NextResponse.json(
                { error: 'Este endpoint es para cobrar deudas que te deben (receivable)' },
                { status: 400 }
            )
        }

        if (debt.status === DEBT_STATUSES.PAID || debt.status === DEBT_STATUSES.CANCELLED) {
            return NextResponse.json(
                { error: 'La deuda ya está saldada o cancelada' },
                { status: 400 }
            )
        }

        if (parsed.data.amount > debt.remainingAmount + 0.01) {
            return NextResponse.json(
                { error: `El monto no puede superar el saldo pendiente (${debt.remainingAmount} ${debt.currency})` },
                { status: 400 }
            )
        }

        // Validar que la cuenta pertenece al usuario y soporta la moneda de la deuda
        const account = await Account.findOne({ _id: parsed.data.accountId, userId: session.user.id })
        if (!account) {
            return NextResponse.json({ error: 'La cuenta no existe o no te pertenece' }, { status: 400 })
        }

        if (!isAccountCurrencyCompatible(account.currency, account.supportedCurrencies, debt.currency)) {
            return NextResponse.json(
                { error: `La cuenta no soporta la moneda de la deuda (${debt.currency})` },
                { status: 400 }
            )
        }

        // Crear transacción personal — afecta balance real de la cuenta (dinero entra)
        // No suma a ingreso operativo (tipo no reconocido por dashboard/cashflow/sankey)
        const transaction = await Transaction.create({
            userId: session.user.id,
            type: TRANSACTION_TYPES.PERSONAL_DEBT_COLLECT,
            amount: parsed.data.amount,
            currency: debt.currency,
            date: parsed.data.date,
            description: `${debt.counterpartyNameSnapshot} te pagó`,
            destinationAccountId: account._id,
            ...(debt.spaceId && { spaceId: debt.spaceId }),
            notes: parsed.data.notes,
            createdFrom: 'web',
            status: 'confirmed',
        })

        let spaceEntryId: string | undefined

        // Si la deuda viene de un espacio, crear settlement reflejando que la contraparte pagó
        // El usuario actual (acreedor) registra que la contraparte (deudor) le pagó.
        if (debt.sourceType === 'space' && debt.spaceId && debt.counterpartyParticipantId) {
            const spaceDoc = await Space.findById(debt.spaceId, { name: 1 }).lean<{ name: string } | null>()
            const currentParticipant = await SpaceParticipant.findOne({
                spaceId: debt.spaceId,
                userId: session.user.id,
                isActive: true,
            })

            if (currentParticipant) {
                // paidByParticipantId = contraparte (el deudor que efectuó el pago)
                // sharedWithParticipantIds = usuario actual (el acreedor que recibe)
                const settlement = await SpaceEntry.create({
                    spaceId: debt.spaceId,
                    createdByUserId: session.user.id,
                    createdByParticipantId: currentParticipant._id,
                    type: 'settlement',
                    status: 'confirmed',
                    title: `Cobro de ${debt.counterpartyNameSnapshot}`,
                    amount: parsed.data.amount,
                    currency: debt.currency,
                    reportingAmount: calculateReportingAmount({
                        amount: parsed.data.amount,
                        currency: debt.currency,
                        reportingCurrency: debt.currency,
                    }),
                    date: parsed.data.date,
                    paidByParticipantId: debt.counterpartyParticipantId,
                    sharedWithParticipantIds: [currentParticipant._id],
                    splitMode: 'none',
                    confirmationRequired: false,
                    confirmedByUserId: session.user.id,
                    confirmedAt: new Date(),
                    notes: parsed.data.notes,
                })
                spaceEntryId = settlement._id.toString()

                // Actualizar transacción con spaceEntryId y spaceNameSnapshot
                await Transaction.updateOne(
                    { _id: transaction._id },
                    { $set: { spaceEntryId: settlement._id, spaceNameSnapshot: spaceDoc?.name ?? '' } }
                )

                // Actor: linked impact (ya tiene transaction — cobró)
                try {
                    await upsertLinkedPersonalImpact({
                        spaceId: debt.spaceId.toString(),
                        entryId: spaceEntryId,
                        userId: session.user.id,
                        participantId: currentParticipant._id.toString(),
                        impactKind: 'settlement_received',
                        actionType: SPACE_PERSONAL_PENDING_ACTION_TYPES.IMPACT_SPACE_COLLECT,
                        transactionId: transaction._id.toString(),
                        accountId: account._id.toString(),
                        amount: parsed.data.amount,
                        currency: debt.currency,
                    })
                } catch (err) {
                    console.error('[personal-sync] collect upsert linked:', err)
                }

                // Contraparte (pagador real): pending si tiene userId
                try {
                    const counterpartyParticipant = await SpaceParticipant.findById(
                        debt.counterpartyParticipantId
                    ).lean()
                    if (counterpartyParticipant?.userId) {
                        await emitPersonalSyncEvent({
                            actorUserId: session.user.id,
                            spaceId: debt.spaceId.toString(),
                            entryId: spaceEntryId,
                            sourceType: SPACE_PERSONAL_IMPACT_SOURCE_TYPES.DEBT_COLLECT,
                            debtId: id,
                            pendingTargets: [{
                                userId: counterpartyParticipant.userId.toString(),
                                participantId: counterpartyParticipant._id.toString(),
                                impactKind: 'settlement_paid',
                                actionType: SPACE_PERSONAL_PENDING_ACTION_TYPES.IMPACT_SPACE_PAYMENT,
                                amount: parsed.data.amount,
                                currency: debt.currency,
                                counterpartyParticipantId: currentParticipant._id.toString(),
                                counterpartyNameSnapshot: debt.counterpartyNameSnapshot,
                            }],
                        })
                    }
                } catch (err) {
                    console.error('[personal-sync] collect counterparty pending:', err)
                }
            }
        }

        // Actualizar saldo pendiente de la deuda
        const newRemaining = Math.max(0, debt.remainingAmount - parsed.data.amount)
        const newStatus =
            newRemaining <= 0.01
                ? DEBT_STATUSES.PAID
                : DEBT_STATUSES.PARTIALLY_PAID

        await Debt.updateOne(
            { _id: id },
            { $set: { remainingAmount: newRemaining, status: newStatus } }
        )

        await DebtMovement.create({
            userId: session.user.id,
            debtId: id,
            type: DEBT_MOVEMENT_TYPES.COLLECT,
            amount: parsed.data.amount,
            currency: debt.currency,
            accountId: account._id,
            transactionId: transaction._id,
            ...(debt.spaceId && { spaceId: debt.spaceId }),
            ...(spaceEntryId && { spaceEntryId }),
            date: parsed.data.date,
            notes: parsed.data.notes,
        })

        if (debt.sourceType === 'space' && debt.spaceId) {
            try {
                await syncSpaceDebtsForActiveParticipants(debt.spaceId.toString())
            } catch (err) {
                console.error('[debt-sync] collect route:', err)
            }
        }

        const updated = await Debt.findById(id)
        return NextResponse.json({ debt: updated, transactionId: transaction._id.toString(), spaceEntryId })
    } catch (error) {
        console.error('Error al registrar cobro de deuda:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
