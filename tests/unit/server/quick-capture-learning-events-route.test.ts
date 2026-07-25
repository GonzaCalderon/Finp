import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    recordEvents: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/server/quick-capture-learning', () => ({
    recordQuickCaptureLearningEvents: mocks.recordEvents,
}))

const { POST } = await import(
    '@/app/api/quick-capture/learning/events/route'
)

function request(body: unknown) {
    return new Request('http://localhost/api/quick-capture/learning/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('POST /api/quick-capture/learning/events', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.recordEvents.mockResolvedValue(undefined)
    })

    it('requires authentication', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await POST(request({ events: [] }))

        expect(response.status).toBe(401)
        expect(mocks.recordEvents).not.toHaveBeenCalled()
    })

    it('rejects more than fifty events', async () => {
        const events = Array.from({ length: 51 }, (_, index) => ({
            eventId: `event-${index}`,
            sessionId: 'session-1',
            type: 'suggestion_shown',
        }))

        const response = await POST(request({ events }))

        expect(response.status).toBe(400)
        expect(mocks.recordEvents).not.toHaveBeenCalled()
    })

    it('delegates a validated, user-scoped batch', async () => {
        const events = [{
            eventId: 'event-1',
            sessionId: 'session-1',
            type: 'suggestion_accepted',
            method: 'enter',
            inputTerms: ['Verdulería', '1500'],
            patternKey: 'a'.repeat(64),
            source: 'learned',
            targetType: 'category',
            confidence: 0.92,
        }]

        const response = await POST(request({ events }))

        expect(response.status).toBe(200)
        expect(mocks.recordEvents).toHaveBeenCalledWith('user-1', events)
    })
})
