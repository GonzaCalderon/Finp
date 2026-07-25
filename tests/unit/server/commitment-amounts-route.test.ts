import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    findOne: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    ScheduledCommitment: { findOne: mocks.findOne },
}))

const { DELETE, POST } = await import(
    '@/app/api/commitments/[id]/amounts/route'
)

const params = Promise.resolve({ id: 'commitment-1' })

function dateOffset(days: number) {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + days)
    return date
}

describe('/api/commitments/[id]/amounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
    })

    it('rechaza agregar un monto con fecha histórica', async () => {
        const response = await POST(
            new Request('http://localhost/api/commitments/commitment-1/amounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    effectiveFrom: dateOffset(-1).toISOString(),
                    amount: 100,
                }),
            }),
            { params }
        )

        expect(response.status).toBe(409)
        await expect(response.json()).resolves.toMatchObject({
            code: 'IMMUTABLE_COMMITMENT_AMOUNT_HISTORY',
        })
        expect(mocks.findOne).not.toHaveBeenCalled()
    })

    it('rechaza eliminar un monto vigente o histórico', async () => {
        const effectiveFrom = encodeURIComponent(dateOffset(0).toISOString())
        const response = await DELETE(
            new Request(
                `http://localhost/api/commitments/commitment-1/amounts?effectiveFrom=${effectiveFrom}`,
                { method: 'DELETE' }
            ),
            { params }
        )

        expect(response.status).toBe(409)
        await expect(response.json()).resolves.toMatchObject({
            code: 'IMMUTABLE_COMMITMENT_AMOUNT_HISTORY',
        })
        expect(mocks.findOne).not.toHaveBeenCalled()
    })

    it('permite eliminar únicamente un cambio futuro', async () => {
        const future = dateOffset(5)
        const historical = dateOffset(-10)
        const commitment = {
            amountSchedule: [
                { effectiveFrom: historical, amount: 100 },
                { effectiveFrom: future, amount: 150 },
            ],
            save: vi.fn(),
        }
        mocks.findOne.mockResolvedValue(commitment)

        const response = await DELETE(
            new Request(
                `http://localhost/api/commitments/commitment-1/amounts?effectiveFrom=${encodeURIComponent(
                    future.toISOString()
                )}`,
                { method: 'DELETE' }
            ),
            { params }
        )

        expect(response.status).toBe(200)
        expect(commitment.amountSchedule).toEqual([
            { effectiveFrom: historical, amount: 100 },
        ])
        expect(commitment.save).toHaveBeenCalledOnce()
    })
})
