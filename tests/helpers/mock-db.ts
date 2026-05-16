import { vi } from 'vitest'

export function makeLeanResult<T>(data: T) {
    return {
        lean: vi.fn().mockResolvedValue(data),
    }
}

export function makeFindOneAndUpdateResult<T>(data: T) {
    return makeLeanResult(data)
}

export function makeFindResult<T>(data: T[]) {
    return {
        lean: vi.fn().mockResolvedValue(data),
        then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(data)),
    }
}

export function mockQueryLean<T>(data: T) {
    return makeLeanResult(data)
}

export function resetModelMocks(...models: Array<Record<string, unknown>>) {
    models.forEach((model) => {
        Object.values(model).forEach((value) => {
            if (vi.isMockFunction(value)) value.mockReset()
        })
    })
}
