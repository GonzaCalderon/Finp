import { NextResponse } from 'next/server'

import { isServiceError, ServiceError } from '@/lib/server/errors'
import type {
    SpaceApiErrorDto,
    SpaceMutationFailureState,
    SpaceMutationResultDto,
} from '@/types'

export function requireIdempotencyKey(request: Request) {
    const value = request.headers.get('Idempotency-Key')?.trim()
    if (!value) {
        throw new ServiceError(
            400,
            'IDEMPOTENCY_KEY_REQUIRED',
            'La operación requiere el encabezado Idempotency-Key.'
        )
    }
    return value
}

export function requireExpectedRevision(value: unknown, field = 'expectedRevision') {
    if (!Number.isInteger(value) || (value as number) < 0) {
        throw new ServiceError(
            400,
            'EXPECTED_REVISION_REQUIRED',
            `La operación requiere ${field} como entero no negativo.`
        )
    }
    return value as number
}

function failureStateFor(error: ServiceError): SpaceMutationFailureState {
    if (error.status === 409) return 'conflict'
    if (error.code === 'SPACE_OPERATION_NOT_COMMITTED') return 'rolled_back'
    return 'not_started'
}

export function spaceApiErrorResponse(error: unknown, fallbackMessage: string) {
    if (isServiceError(error)) {
        const body: SpaceApiErrorDto = {
            error: error.message,
            code: error.code,
            failureState: failureStateFor(error),
            retryable:
                error.code === 'IDEMPOTENCY_OPERATION_IN_PROGRESS' ||
                error.code === 'SPACE_OPERATION_NOT_COMMITTED' ||
                error.status >= 500,
            details: error.details,
        }
        return NextResponse.json(body, { status: error.status })
    }
    console.error('[spaces-api]', error)
    return NextResponse.json<SpaceApiErrorDto>({
        error: fallbackMessage,
        code: 'SPACE_INTERNAL_ERROR',
        failureState: 'not_started',
        retryable: true,
    }, { status: 500 })
}

export function toSpaceMutationResult<T>(execution: {
    operationId: string
    replayed: boolean
    value?: T
    presentation?: { state: 'not_needed' | 'reconciled' | 'retry_required' }
    resultRefs?: Record<string, unknown>
}): SpaceMutationResultDto<T | undefined> {
    const presentationState = execution.presentation?.state ?? 'not_needed'
    return {
        data: execution.value ?? (
            execution.resultRefs
                ? Object.fromEntries(
                    Object.entries(execution.resultRefs).map(([key, value]) => [
                        key,
                        Array.isArray(value)
                            ? value.map((item) => String(item))
                            : value == null ? value : String(value),
                    ])
                ) as T
                : undefined
        ),
        operation: {
            id: execution.operationId,
            replayed: execution.replayed,
            writeState: 'committed',
            presentation: {
                state: presentationState,
                retryable: presentationState === 'retry_required',
            },
        },
    }
}
