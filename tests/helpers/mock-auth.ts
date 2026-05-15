import { vi } from 'vitest'
import { objectIdString } from './ids'

type MockUserOverrides = Partial<{
    id: string
    email: string
    name: string
}>

export const authMock = vi.fn()

export function mockAuthenticatedUser(userOverrides: MockUserOverrides = {}) {
    const session = {
        user: {
            id: userOverrides.id ?? objectIdString(),
            email: userOverrides.email ?? 'user@finp.test',
            name: userOverrides.name ?? 'Finp User',
        },
    }
    authMock.mockResolvedValue(session)
    return session
}

export function mockUnauthenticated() {
    authMock.mockResolvedValue(null)
}

export function resetAuthMock() {
    authMock.mockReset()
    mockUnauthenticated()
}

export const authMockModule = {
    auth: authMock,
}
