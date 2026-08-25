import { createHash } from 'node:crypto'
import mongoose, { Types, type ClientSession } from 'mongoose'

import { SpaceOperation } from '@/lib/models'
import { ServiceError, isDuplicateKeyError } from '@/lib/server/errors'
import { assertSpaceV2WriteEnabled } from '@/lib/server/space-v2-write-gate'
import type { SpaceOperationType } from '@/lib/constants'
import type { ISpaceOperation } from '@/types'

export type SpaceOperationResultRefs = NonNullable<ISpaceOperation['resultRefs']>

export interface SpaceOperationExecution<T> {
    operationId: string
    replayed: boolean
    resultRefs: SpaceOperationResultRefs
    value?: T
}

function normalizeForHash(value: unknown): unknown {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('El payload idempotente no admite números no finitos.')
        return value
    }
    if (value instanceof Date) return value.toISOString()
    if (value instanceof Types.ObjectId) return value.toHexString()
    if (Array.isArray(value)) return value.map(normalizeForHash)
    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, nested]) => nested !== undefined)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, normalizeForHash(nested)])
        )
    }
    throw new TypeError('El payload idempotente contiene un tipo no serializable.')
}

export function hashSpaceOperationValue(value: unknown) {
    return createHash('sha256')
        .update(JSON.stringify(normalizeForHash(value)))
        .digest('hex')
}

export function validateSpaceIdempotencyKey(value: string) {
    const normalized = value.trim()
    if (normalized.length < 16 || normalized.length > 200 || /\s/.test(normalized)) {
        throw new ServiceError(
            400,
            'INVALID_IDEMPOTENCY_KEY',
            'La clave de idempotencia debe ser opaca, sin espacios y tener entre 16 y 200 caracteres.'
        )
    }
    return normalized
}

async function findExistingOperation(input: {
    actorUserId: string
    spaceId: string
    type: SpaceOperationType
    idempotencyKeyHash: string
}) {
    return SpaceOperation.findOne(input).lean<ISpaceOperation | null>()
}

function replayOrConflict<T>(operation: ISpaceOperation, payloadHash: string): SpaceOperationExecution<T> {
    if (operation.payloadHash !== payloadHash) {
        throw new ServiceError(
            409,
            'IDEMPOTENCY_PAYLOAD_CONFLICT',
            'La clave de idempotencia ya fue usada con otra intención.'
        )
    }
    if (operation.status !== 'committed') {
        throw new ServiceError(
            409,
            'IDEMPOTENCY_OPERATION_IN_PROGRESS',
            'La misma operación todavía se está confirmando. Reintentá en unos instantes.'
        )
    }
    return {
        operationId: operation._id.toString(),
        replayed: true,
        resultRefs: operation.resultRefs ?? {},
    }
}

export async function executeSpaceOperation<T>(input: {
    actorUserId: string
    spaceId: string
    type: SpaceOperationType
    idempotencyKey: string
    payload: unknown
    run: (
        session: ClientSession,
        operationId: Types.ObjectId
    ) => Promise<{ value: T; resultRefs?: SpaceOperationResultRefs }>
}): Promise<SpaceOperationExecution<T>> {
    assertSpaceV2WriteEnabled()
    if (!Types.ObjectId.isValid(input.actorUserId) || !Types.ObjectId.isValid(input.spaceId)) {
        throw new ServiceError(400, 'INVALID_SPACE_OPERATION_CONTEXT', 'El contexto de la operación no es válido.')
    }
    const idempotencyKey = validateSpaceIdempotencyKey(input.idempotencyKey)
    const idempotencyKeyHash = hashSpaceOperationValue(idempotencyKey)
    const payloadHash = hashSpaceOperationValue(input.payload)
    const identity = {
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: input.type,
        idempotencyKeyHash,
    }
    const existing = await findExistingOperation(identity)
    if (existing) return replayOrConflict<T>(existing, payloadHash)

    const session = await mongoose.startSession()
    let execution: SpaceOperationExecution<T> | undefined
    try {
        await session.withTransaction(async () => {
            const [operation] = await SpaceOperation.create([{
                contractVersion: 2,
                ...identity,
                payloadHash,
                status: 'pending',
            }], { session })
            const result = await input.run(session, operation._id)
            const resultRefs = result.resultRefs ?? {}
            const committedAt = new Date()
            const update = await SpaceOperation.updateOne(
                { _id: operation._id, status: 'pending' },
                { $set: { status: 'committed', resultRefs, committedAt } },
                { session }
            )
            if (update.modifiedCount !== 1) {
                throw new ServiceError(
                    409,
                    'SPACE_OPERATION_STATE_CONFLICT',
                    'La operación cambió mientras se confirmaba.'
                )
            }
            execution = {
                operationId: operation._id.toString(),
                replayed: false,
                resultRefs,
                value: result.value,
            }
        }, {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
        })
    } catch (error) {
        if (!isDuplicateKeyError(error)) throw error
        const concurrent = await findExistingOperation(identity)
        if (!concurrent) {
            throw new ServiceError(
                409,
                'IDEMPOTENCY_OPERATION_IN_PROGRESS',
                'La misma operación se está confirmando. Reintentá en unos instantes.'
            )
        }
        return replayOrConflict<T>(concurrent, payloadHash)
    } finally {
        await session.endSession()
    }

    if (!execution) {
        throw new ServiceError(
            500,
            'SPACE_OPERATION_NOT_COMMITTED',
            'La operación se revirtió antes de confirmarse.'
        )
    }
    return execution
}
