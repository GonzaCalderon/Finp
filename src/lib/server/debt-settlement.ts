import mongoose from 'mongoose'
import { Debt, DebtMovement, SpaceEntry, Transaction } from '@/lib/models'
import { DEBT_STATUSES } from '@/lib/constants'

type DebtSettlementInput = {
    userId: string
    debtId: string
    expectedDirection: 'payable' | 'receivable'
    amount: number
    transaction: Record<string, unknown>
    movement: Record<string, unknown>
    spaceEntry?: Record<string, unknown>
}

export async function createDebtSettlement({
    userId,
    debtId,
    expectedDirection,
    amount,
    transaction: transactionData,
    movement: movementData,
    spaceEntry: spaceEntryData,
}: DebtSettlementInput) {
    const session = await mongoose.startSession()
    let transactionId = ''
    let spaceEntryId: string | undefined

    try {
        await session.withTransaction(async () => {
            const debt = await Debt.findOne({ _id: debtId, userId }).session(session)
            if (!debt) throw new Error('DEBT_NOT_FOUND')
            if (debt.direction !== expectedDirection) throw new Error('INVALID_DEBT_DIRECTION')
            if (debt.status === DEBT_STATUSES.PAID || debt.status === DEBT_STATUSES.CANCELLED) {
                throw new Error('DEBT_ALREADY_SETTLED')
            }
            if (amount > debt.remainingAmount + 0.01) {
                throw new Error('DEBT_AMOUNT_EXCEEDS_REMAINING')
            }

            const [transaction] = await Transaction.create([transactionData], { session })
            transactionId = transaction._id.toString()

            if (spaceEntryData) {
                const [spaceEntry] = await SpaceEntry.create([spaceEntryData], { session })
                spaceEntryId = spaceEntry._id.toString()
                await Transaction.updateOne(
                    { _id: transaction._id },
                    { $set: { spaceEntryId: spaceEntry._id } },
                    { session }
                )
            }

            const remainingAmount = Math.max(0, debt.remainingAmount - amount)
            const status =
                remainingAmount <= 0.01
                    ? DEBT_STATUSES.PAID
                    : DEBT_STATUSES.PARTIALLY_PAID

            await Debt.updateOne(
                { _id: debt._id },
                { $set: { remainingAmount, status } },
                { session }
            )

            await DebtMovement.create(
                [{
                    ...movementData,
                    userId,
                    debtId,
                    transactionId: transaction._id,
                    ...(spaceEntryId ? { spaceEntryId } : {}),
                }],
                { session }
            )
        })
    } finally {
        await session.endSession()
    }

    if (!transactionId) {
        throw new Error('DEBT_SETTLEMENT_NOT_CREATED')
    }

    return { transactionId, spaceEntryId }
}
