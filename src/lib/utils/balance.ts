import type { Types } from 'mongoose'
import { Transaction } from '@/lib/models'

/**
 * Calcula el saldo actual de una cuenta sumando todas sus transacciones.
 *
 * Lógica tipo-agnóstica: cualquier transacción que mueva dinero hacia o desde
 * la cuenta afecta el saldo sin importar el tipo (income, expense, transfer, etc.).
 *   - incoming (+): transacciones donde esta cuenta es destinationAccountId
 *   - outgoing (-): transacciones donde esta cuenta es sourceAccountId
 *
 * Esta función es la fuente de verdad para el cálculo de saldo en toda la app.
 * Todos los endpoints que muestren el saldo de una cuenta deben usar esta función.
 */
export async function calculateAccountBalance(
    accountId: Types.ObjectId,
    userId: Types.ObjectId,
    initialBalance = 0
): Promise<number> {
    const [result] = await Transaction.aggregate<{ incoming: number; outgoing: number }>([
        {
            $match: {
                userId,
                $or: [
                    { sourceAccountId: accountId },
                    { destinationAccountId: accountId },
                ],
            },
        },
        {
            $group: {
                _id: null,
                incoming: {
                    $sum: {
                        $cond: [{ $eq: ['$destinationAccountId', accountId] }, '$amount', 0],
                    },
                },
                outgoing: {
                    $sum: {
                        $cond: [{ $eq: ['$sourceAccountId', accountId] }, '$amount', 0],
                    },
                },
            },
        },
    ])

    return initialBalance + (result?.incoming ?? 0) - (result?.outgoing ?? 0)
}
