import { CommitmentApplication, ScheduledCommitment, Transaction, User } from '@/lib/models'
import { createTransactionForUser } from '@/lib/server/transactions'
import { isDuplicateKeyError, ServiceError } from '@/lib/server/errors'
import { parseFinancialPeriod } from '@/lib/utils/period'

type ApplyCommitmentInput = {
    period?: unknown
    amount?: unknown
    accountId?: unknown
    date?: unknown
    notes?: unknown
}

function parseAmount(value: unknown): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const parsed = Number(value.replace(',', '.').trim())
        return Number.isNaN(parsed) ? NaN : parsed
    }
    return NaN
}

function parseDate(value: unknown): Date {
    if (!value) return new Date()
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number)
        return new Date(year, month - 1, day)
    }

    const parsed = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(parsed.getTime())) {
        throw new ServiceError(400, 'INVALID_COMMITMENT_DATE', 'La fecha de aplicacion es invalida.')
    }
    return parsed
}

function isDateInRange(date: Date, start: Date, end: Date) {
    return date >= start && date < end
}

async function cleanupCreatedTransaction(args: {
    transactionId?: { toString(): string } | string
    userId: string
}) {
    if (!args.transactionId) return

    const linkedApplication = await CommitmentApplication.exists({
        transactionId: args.transactionId,
        userId: args.userId,
    })

    if (linkedApplication) return

    await Transaction.deleteOne({
        _id: args.transactionId,
        userId: args.userId,
    })
}

export async function applyCommitmentForUser(
    userId: string,
    commitmentId: string,
    input: ApplyCommitmentInput
) {
    const period = typeof input.period === 'string' ? input.period.trim() : ''
    if (!/^\d{4}-\d{2}$/.test(period)) {
        throw new ServiceError(400, 'INVALID_COMMITMENT_PERIOD', 'El periodo debe tener formato YYYY-MM.')
    }

    const amount = parseAmount(input.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ServiceError(400, 'INVALID_COMMITMENT_AMOUNT', 'El monto debe ser numerico y mayor a cero.')
    }

    const accountId = typeof input.accountId === 'string' ? input.accountId.trim() : ''
    if (!accountId) {
        throw new ServiceError(400, 'COMMITMENT_ACCOUNT_REQUIRED', 'La cuenta es requerida.')
    }

    const date = parseDate(input.date)
    const user = await User.findById(userId, { 'preferences.monthStartDay': 1 })
    const monthStartDay = user?.preferences?.monthStartDay ?? 1
    const { start, end } = parseFinancialPeriod(period, monthStartDay)

    // period is the commitment application period; date is the real transaction date.
    // If they diverge in the future, that must be intentional and visible in the UI.
    if (!isDateInRange(date, start, end)) {
        throw new ServiceError(
            400,
            'COMMITMENT_DATE_OUTSIDE_PERIOD',
            'La fecha de la transaccion no pertenece al periodo informado. Elegi una fecha dentro del periodo financiero.'
        )
    }

    const commitment = await ScheduledCommitment.findOne({
        _id: commitmentId,
        userId,
    })

    if (!commitment) {
        throw new ServiceError(404, 'COMMITMENT_NOT_FOUND', 'Compromiso no encontrado.')
    }

    if (!commitment.isActive) {
        throw new ServiceError(409, 'COMMITMENT_INACTIVE', 'El compromiso no esta activo.')
    }

    const existing = await CommitmentApplication.findOne({
        userId,
        commitmentId,
        period,
    })

    if (existing) {
        throw new ServiceError(409, 'COMMITMENT_ALREADY_APPLIED', 'Este compromiso ya fue aplicado en este periodo.')
    }

    const explicitNotes = typeof input.notes === 'string' && input.notes.trim()
        ? input.notes.trim()
        : undefined

    const transaction = await createTransactionForUser(
        userId,
        {
            type: 'expense',
            amount,
            currency: commitment.currency,
            date,
            description: commitment.description,
            categoryId: commitment.categoryId?.toString(),
            sourceAccountId: accountId,
            notes: explicitNotes,
        },
        {
            createdFrom: 'web',
            status: 'confirmed',
        }
    )

    if (!transaction) {
        throw new ServiceError(500, 'COMMITMENT_TRANSACTION_CREATE_FAILED', 'No se pudo crear la transaccion del compromiso.')
    }

    try {
        const application = await CommitmentApplication.create({
            userId,
            commitmentId,
            period,
            transactionId: transaction._id,
            appliedAt: new Date(),
            appliedBy: 'manual',
        })

        return { transaction, application }
    } catch (error) {
        await cleanupCreatedTransaction({
            transactionId: transaction._id,
            userId,
        })

        if (isDuplicateKeyError(error)) {
            throw new ServiceError(409, 'COMMITMENT_ALREADY_APPLIED', 'Este compromiso ya fue aplicado en este periodo.')
        }

        throw new ServiceError(
            500,
            'COMMITMENT_APPLICATION_CREATE_FAILED',
            'No se pudo registrar la aplicacion del compromiso.'
        )
    }
}
