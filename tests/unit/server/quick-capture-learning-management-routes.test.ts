import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    getPattern: vi.fn(),
    resetLearning: vi.fn(),
    serializeAliases: vi.fn(),
    updateProfile: vi.fn(),
    updatePatternStatus: vi.fn(),
    upsertAlias: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/server/quick-capture-learning', () => ({
    getQuickCaptureLearningPattern: mocks.getPattern,
    resetQuickCaptureLearning: mocks.resetLearning,
    updateQuickCaptureLearningProfile: mocks.updateProfile,
    updateQuickCapturePatternStatus: mocks.updatePatternStatus,
}))
vi.mock('@/lib/server/quick-capture', () => ({
    serializeQuickCaptureAliases: mocks.serializeAliases,
    upsertQuickCaptureAlias: mocks.upsertAlias,
}))

const profileRoute = await import(
    '@/app/api/quick-capture/learning/profile/route'
)
const resetRoute = await import('@/app/api/quick-capture/learning/route')
const patternRoute = await import(
    '@/app/api/quick-capture/learning/patterns/[key]/route'
)

function patchRequest(path: string, body: unknown) {
    return new Request(`http://localhost${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('quick capture learning management routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.updateProfile.mockResolvedValue({ enabled: false })
        mocks.resetLearning.mockResolvedValue({
            enabled: true,
            resetAt: new Date().toISOString(),
        })
    })

    it('requires authentication before updating the profile', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await profileRoute.PATCH(
            patchRequest('/api/quick-capture/learning/profile', {
                enabled: false,
            })
        )

        expect(response.status).toBe(401)
        expect(mocks.updateProfile).not.toHaveBeenCalled()
    })

    it('validates and scopes profile changes to the authenticated user', async () => {
        const invalid = await profileRoute.PATCH(
            patchRequest('/api/quick-capture/learning/profile', {})
        )
        expect(invalid.status).toBe(400)

        const response = await profileRoute.PATCH(
            patchRequest('/api/quick-capture/learning/profile', {
                enabled: false,
                markIntroSeen: true,
            })
        )

        expect(response.status).toBe(200)
        expect(mocks.updateProfile).toHaveBeenCalledWith({
            userId: 'user-1',
            enabled: false,
            markIntroSeen: true,
        })
    })

    it('resets only the authenticated user learning state', async () => {
        const response = await resetRoute.DELETE()

        expect(response.status).toBe(200)
        expect(mocks.resetLearning).toHaveBeenCalledWith('user-1')
    })

    it('rejects invalid pattern keys before accessing learning data', async () => {
        const response = await patternRoute.GET(
            new Request('http://localhost/api/quick-capture/learning/patterns/no'),
            { params: Promise.resolve({ key: 'no' }) }
        )

        expect(response.status).toBe(400)
        expect(mocks.getPattern).not.toHaveBeenCalled()
    })

    it('loads and forgets patterns inside the authenticated user scope', async () => {
        const key = 'a'.repeat(64)
        mocks.getPattern.mockResolvedValue({ key, targetLabel: 'Alimentos' })
        mocks.updatePatternStatus.mockResolvedValue({
            key,
            status: 'forgotten',
        })

        const getResponse = await patternRoute.GET(
            new Request(`http://localhost/api/quick-capture/learning/patterns/${key}`),
            { params: Promise.resolve({ key }) }
        )
        const patchResponse = await patternRoute.PATCH(
            patchRequest(
                `/api/quick-capture/learning/patterns/${key}`,
                { action: 'forget' }
            ),
            { params: Promise.resolve({ key }) }
        )

        expect(getResponse.status).toBe(200)
        expect(mocks.getPattern).toHaveBeenCalledWith('user-1', key)
        expect(patchResponse.status).toBe(200)
        expect(mocks.updatePatternStatus).toHaveBeenCalledWith({
            userId: 'user-1',
            patternKey: key,
            status: 'forgotten',
        })
    })

    it('turns a correction into an explicit alias and forgets the pattern', async () => {
        const key = 'b'.repeat(64)
        mocks.getPattern.mockResolvedValue({
            key,
            triggerLabel: 'Verdulería',
        })
        mocks.upsertAlias.mockResolvedValue({ _id: 'alias-1' })
        mocks.serializeAliases.mockResolvedValue([{
            id: 'alias-1',
            term: 'Verdulería',
            targetType: 'category',
            targetId: 'category-2',
        }])
        mocks.updatePatternStatus.mockResolvedValue({
            key,
            status: 'forgotten',
        })

        const response = await patternRoute.PATCH(
            patchRequest(
                `/api/quick-capture/learning/patterns/${key}`,
                {
                    action: 'correct',
                    targetType: 'category',
                    targetId: 'category-2',
                }
            ),
            { params: Promise.resolve({ key }) }
        )

        expect(response.status).toBe(200)
        expect(mocks.upsertAlias).toHaveBeenCalledWith({
            userId: 'user-1',
            term: 'Verdulería',
            targetType: 'category',
            targetId: 'category-2',
            targetValue: undefined,
        })
        expect(mocks.updatePatternStatus).toHaveBeenCalledWith({
            userId: 'user-1',
            patternKey: key,
            status: 'forgotten',
        })
    })
})
