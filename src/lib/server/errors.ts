export class ServiceError extends Error {
    status: number
    code: string
    details?: unknown

    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message)
        this.name = 'ServiceError'
        this.status = status
        this.code = code
        this.details = details
    }
}

export function isServiceError(error: unknown): error is ServiceError {
    return error instanceof ServiceError
}

export function isDuplicateKeyError(error: unknown): boolean {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: unknown }).code === 11000
    )
}
