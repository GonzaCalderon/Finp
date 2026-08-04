import type { ClientSession } from 'mongoose'
import { CommitmentApplication, ScheduledCommitment, Transaction, User } from '@/lib/models'
import { createTransactionForUser } from '@/lib/server/transactions'
import { isDuplicateKeyError, ServiceError } from '@/lib/server/errors'
import { parseFinancialPeriod } from '@/lib/utils/period'
import { normalizeRuleText } from '@/lib/utils/rules'
import {
    resolveCommitmentAmountForPeriod,
} from '@/lib/server/commitment-amounts'
import { resolveCommitmentOccurrenceForPeriod } from '@/lib/utils/commitment-dates'
import {
    COMMITMENT_APPLICATION_DERIVED_STATUSES,
    COMMITMENT_APPLICATION_ORIGINS,
    COMMITMENT_APPLICATION_STATUSES,
    type CommitmentAmountPolicy,
    type CommitmentAmountSource,
    type CommitmentApplicationOrigin,
    type CommitmentApplicationState,
    type CommitmentApplicationStatus,
} from '@/lib/constants'

/**
 * Normaliza las denominaciones alternativas de un compromiso con el mismo
 * criterio que el motor de reglas, para que el matching de Captura rápida no
 * tenga su propia normalización divergente.
 */
export function normalizeCommitmentAliases(aliases: string[] | undefined): string[] {
    if (!aliases?.length) return []

    const normalized = aliases
        .map((alias) => normalizeRuleText(alias))
        .filter((alias) => alias.length >= 2)

    return Array.from(new Set(normalized))
}

type ApplyCommitmentInput = {
    period?: unknown
    amount?: unknown
    accountId?: unknown
    date?: unknown
    notes?: unknown
    origin?: unknown
}

/**
 * Estado de la aplicación de un compromiso en un período.
 *
 * Sólo se persisten los estados que representan algo que ocurrió. Los previos
 * se derivan de la plantilla y el período, para no llenar la base de filas
 * fantasma ni pelear contra el índice único.
 */
export function resolveApplicationStateForPeriod(
    commitment: { amountPolicy?: CommitmentAmountPolicy },
    period: string,
    currentPeriod: string,
    application?: { status?: CommitmentApplicationStatus } | null
): CommitmentApplicationState {
    if (application?.status && application.status !== COMMITMENT_APPLICATION_STATUSES.REVERTED) {
        return application.status
    }

    if (period > currentPeriod) return COMMITMENT_APPLICATION_DERIVED_STATUSES.SCHEDULED

    if (commitment.amountPolicy === 'variable') {
        return COMMITMENT_APPLICATION_DERIVED_STATUSES.AWAITING_AMOUNT
    }

    return COMMITMENT_APPLICATION_DERIVED_STATUSES.READY
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

    const dueDate = resolveCommitmentOccurrenceForPeriod(
        commitment,
        period,
        monthStartDay
    )
    if (!dueDate) {
        throw new ServiceError(
            409,
            'COMMITMENT_NO_OCCURRENCE_IN_PERIOD',
            'Este compromiso no tiene un vencimiento dentro del periodo informado.'
        )
    }

    const existing = await CommitmentApplication.findOne({
        userId,
        commitmentId,
        period,
    })

    // Una aplicación revertida deja el período reabierto: se reutiliza la fila en
    // vez de crear otra, para conservar historial sin chocar contra el índice único.
    if (existing && existing.status !== COMMITMENT_APPLICATION_STATUSES.REVERTED) {
        throw new ServiceError(409, 'COMMITMENT_ALREADY_APPLIED', 'Este compromiso ya fue aplicado en este periodo.')
    }

    const explicitNotes = typeof input.notes === 'string' && input.notes.trim()
        ? input.notes.trim()
        : undefined

    const origin: CommitmentApplicationOrigin =
        input.origin === COMMITMENT_APPLICATION_ORIGINS.QUICK_CAPTURE
            ? COMMITMENT_APPLICATION_ORIGINS.QUICK_CAPTURE
            : COMMITMENT_APPLICATION_ORIGINS.MANUAL

    // De dónde salió el importe: si coincide con el vigente es el calculado,
    // si el usuario lo cambió es manual. Queda guardado en la foto.
    const resolved = resolveCommitmentAmountForPeriod(commitment, period, {
        monthStartDay,
        dueDate,
    })
    const amountSource: CommitmentAmountSource =
        amount === resolved.amount ? resolved.source : 'manual'

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
            createdFrom: origin === COMMITMENT_APPLICATION_ORIGINS.QUICK_CAPTURE ? 'quick_capture' : 'web',
            status: 'confirmed',
            metadata: {
                commitmentId: commitment._id,
                commitmentPeriod: period,
                // Sobrevive al borrado del compromiso.
                commitmentNameSnapshot: commitment.description,
            },
        }
    )

    if (!transaction) {
        throw new ServiceError(500, 'COMMITMENT_TRANSACTION_CREATE_FAILED', 'No se pudo crear la transaccion del compromiso.')
    }

    try {
        // Filtrar por status != registered hace el upsert atómico: si otra request
        // ya registró el período, el upsert intenta insertar y el índice único lo
        // rechaza con 11000 en vez de pisar la aplicación existente.
        const application = await CommitmentApplication.findOneAndUpdate(
            {
                userId,
                commitmentId,
                period,
                status: { $ne: COMMITMENT_APPLICATION_STATUSES.REGISTERED },
            },
            {
                $set: {
                    transactionId: transaction._id,
                    appliedAt: new Date(),
                    appliedBy: 'manual',
                    status: COMMITMENT_APPLICATION_STATUSES.REGISTERED,
                    origin,
                    snapshot: {
                        amount,
                        currency: commitment.currency,
                        description: commitment.description,
                        categoryId: commitment.categoryId,
                        accountId,
                        amountSource,
                        dueDate,
                        computedAt: new Date(),
                    },
                },
                $unset: { revertedAt: '', revertedReason: '' },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        )

        if (!application) {
            throw new ServiceError(
                500,
                'COMMITMENT_APPLICATION_CREATE_FAILED',
                'No se pudo registrar la aplicacion del compromiso.'
            )
        }

        // Se cierra el vínculo en las dos direcciones para poder mostrar
        // procedencia sin resolver la relación inversa por cada fila del listado.
        await Transaction.updateOne(
            { _id: transaction._id, userId },
            { $set: { commitmentApplicationId: application._id } }
        )

        return { transaction, application }
    } catch (error) {
        await cleanupCreatedTransaction({
            transactionId: transaction._id,
            userId,
        })

        if (isDuplicateKeyError(error)) {
            throw new ServiceError(409, 'COMMITMENT_ALREADY_APPLIED', 'Este compromiso ya fue aplicado en este periodo.')
        }

        if (error instanceof ServiceError) throw error

        throw new ServiceError(
            500,
            'COMMITMENT_APPLICATION_CREATE_FAILED',
            'No se pudo registrar la aplicacion del compromiso.'
        )
    }
}

/**
 * Revierte la aplicación vinculada a una transacción que se está eliminando.
 *
 * La fila no se borra: pasa a `reverted` y suelta el `transactionId`, así el
 * período vuelve a estar pendiente, el compromiso sigue existiendo y queda
 * registro de que hubo una aplicación. Es idempotente.
 */
export async function revertApplicationForTransaction(
    userId: string,
    transactionId: string,
    reason = 'transaction_deleted',
    session?: ClientSession
): Promise<{ commitmentId: string; period: string } | null> {
    const application = await CommitmentApplication.findOneAndUpdate(
        { userId, transactionId },
        {
            $set: {
                status: COMMITMENT_APPLICATION_STATUSES.REVERTED,
                revertedAt: new Date(),
                revertedReason: reason,
            },
            $unset: { transactionId: '' },
        },
        { new: true, ...(session ? { session } : {}) }
    )

    if (!application) return null

    return {
        commitmentId: application.commitmentId.toString(),
        period: application.period,
    }
}

/**
 * Sincroniza la foto de la aplicación cuando se edita la transacción generada.
 * Nunca toca la plantilla: cambiar los períodos futuros es una acción aparte.
 */
export async function syncApplicationSnapshotFromTransaction(
    userId: string,
    transactionId: string,
    snapshot: { amount: number; currency: string; description: string; categoryId?: string; accountId?: string }
): Promise<boolean> {
    const result = await CommitmentApplication.updateOne(
        { userId, transactionId },
        {
            $set: {
                'snapshot.amount': snapshot.amount,
                'snapshot.currency': snapshot.currency,
                'snapshot.description': snapshot.description,
                'snapshot.categoryId': snapshot.categoryId,
                'snapshot.accountId': snapshot.accountId,
                'snapshot.amountSource': 'manual',
                'snapshot.computedAt': new Date(),
            },
        }
    )

    return result.matchedCount > 0
}
