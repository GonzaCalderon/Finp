import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Debt, DebtMovement, SpaceEntry, SpaceParticipant, Transaction } from '@/lib/models'
import { payDebtSchema } from '@/lib/validations/debt'
import { isAccountCurrencyCompatible } from '@/lib/utils/debt'
import { calculateReportingAmount } from '@/lib/utils/spaces'
import { syncSpaceDebtsForActiveParticipants } from '@/lib/server/debt-sync'
import { DEBT_STATUSES, DEBT_MOVEMENT_TYPES, TRANSACTION_TYPES } from '@/lib/constants'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params
        const body = await request.json()
        const parsed = payDebtSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const debt = await Debt.findOne({ _id: id, userId: session.user.id })
        if (!debt) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })

        if (debt.direction !== 'payable') {
            return NextResponse.json(
                { error: 'Este endpoint es para pagar deudas que vos debés (payable)' },
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

        // Crear transacción personal — afecta balance real de la cuenta (dinero sale)
        // No suma a gasto operativo (tipo no reconocido por dashboard/cashflow/sankey)
        const transaction = await Transaction.create({
            userId: session.user.id,
            type: TRANSACTION_TYPES.PERSONAL_DEBT_PAYMENT,
            amount: parsed.data.amount,
            currency: debt.currency,
            date: parsed.data.date,
            description: `Pago de deuda a ${debt.counterpartyNameSnapshot}`,
            sourceAccountId: account._id,
            ...(debt.spaceId && { spaceId: debt.spaceId }),
            notes: parsed.data.notes,
            createdFrom: 'web',
            status: 'confirmed',
        })

        let spaceEntryId: string | undefined

        // Si la deuda viene de un espacio, crear settlement automáticamente
        if (debt.sourceType === 'space' && debt.spaceId && debt.counterpartyParticipantId) {
            // Encontrar el participante del usuario actual en el espacio
            const currentParticipant = await SpaceParticipant.findOne({
                spaceId: debt.spaceId,
                userId: session.user.id,
                isActive: true,
            })

            if (currentParticipant) {
                const settlement = await SpaceEntry.create({
                    spaceId: debt.spaceId,
                    createdByUserId: session.user.id,
                    createdByParticipantId: currentParticipant._id,
                    type: 'settlement',
                    status: 'confirmed',
                    title: `Pago a ${debt.counterpartyNameSnapshot}`,
                    amount: parsed.data.amount,
                    currency: debt.currency,
                    reportingAmount: calculateReportingAmount({
                        amount: parsed.data.amount,
                        currency: debt.currency,
                        reportingCurrency: debt.currency,
                    }),
                    date: parsed.data.date,
                    paidByParticipantId: currentParticipant._id,
                    sharedWithParticipantIds: [debt.counterpartyParticipantId],
                    splitMode: 'none',
                    confirmationRequired: false,
                    confirmedByUserId: session.user.id,
                    confirmedAt: new Date(),
                    notes: parsed.data.notes,
                })
                spaceEntryId = settlement._id.toString()
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
            type: DEBT_MOVEMENT_TYPES.PAYMENT,
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
                console.error('[debt-sync] pay route:', err)
            }
        }

        const updated = await Debt.findById(id)
        return NextResponse.json({ debt: updated, transactionId: transaction._id.toString(), spaceEntryId })
    } catch (error) {
        console.error('Error al registrar pago de deuda:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
