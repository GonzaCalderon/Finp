import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

const mocks = vi.hoisted(() => ({
    connectDB: vi.fn().mockResolvedValue(undefined),
    hash: vi.fn().mockResolvedValue('hashed-password'),
    User: {
        findOne: vi.fn(),
        create: vi.fn(),
    },
    Category: {
        insertMany: vi.fn(),
    },
    Account: {
        create: vi.fn(),
    },
}))

vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))
vi.mock('@/lib/models', () => ({
    User: mocks.User,
    Category: mocks.Category,
    Account: mocks.Account,
}))

const { POST } = await import('@/app/api/auth/register/route')

function registerRequest(extra: Record<string, unknown> = {}) {
    return new Request('https://finp.test/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'ana@finp.test',
            password: 'Password123',
            displayName: 'Ana',
            ...extra,
        }),
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.User.findOne.mockResolvedValue(null)
    mocks.User.create.mockResolvedValue({
        _id: new Types.ObjectId(),
        email: 'ana@finp.test',
        displayName: 'Ana',
    })
    mocks.Category.insertMany.mockResolvedValue([])
    mocks.Account.create.mockResolvedValue({})
})

describe('register route onboarding defaults', () => {
    it('crea defaults en registro normal', async () => {
        const response = await POST(registerRequest())

        expect(response.status).toBe(201)
        expect(mocks.Category.insertMany).toHaveBeenCalledOnce()
        expect(mocks.Account.create).toHaveBeenCalledOnce()
    })

    it('setupPersonalFinp=false solo saltea defaults con invite callback seguro', async () => {
        const response = await POST(registerRequest({
            setupPersonalFinp: false,
            callbackUrl: '/spaces/invite/abcdefghijklmnopqrstuvwxyz',
        }))

        expect(response.status).toBe(201)
        expect(mocks.Category.insertMany).not.toHaveBeenCalled()
        expect(mocks.Account.create).not.toHaveBeenCalled()
    })

    it('setupPersonalFinp=false no afecta registro con callback inseguro', async () => {
        const response = await POST(registerRequest({
            setupPersonalFinp: false,
            callbackUrl: '/dashboard',
        }))

        expect(response.status).toBe(201)
        expect(mocks.Category.insertMany).toHaveBeenCalledOnce()
        expect(mocks.Account.create).toHaveBeenCalledOnce()
    })
})
