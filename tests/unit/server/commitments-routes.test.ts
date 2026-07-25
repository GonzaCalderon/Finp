import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    commitmentCreate: vi.fn(),
    commitmentFindOneAndUpdate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    ScheduledCommitment: {
        create: mocks.commitmentCreate,
        findOneAndUpdate: mocks.commitmentFindOneAndUpdate,
        find: vi.fn(),
    },
    CommitmentApplication: { find: vi.fn() },
    User: { findById: vi.fn() },
}))

const { POST } = await import('@/app/api/commitments/route')
const { PATCH } = await import('@/app/api/commitments/[id]/route')

function post(body: unknown) {
    return new Request('http://localhost/api/commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

function patch(body: unknown) {
    return new Request('http://localhost/api/commitments/commitment-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

const params = Promise.resolve({ id: 'commitment-1' })

const validBody = {
    description: 'Alquiler',
    amount: 650_000,
    currency: 'ARS',
    recurrence: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-01-01',
}

describe('POST /api/commitments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.commitmentCreate.mockResolvedValue({ _id: 'commitment-1' })
    })

    it('exige autenticación', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await POST(post(validBody))

        expect(response.status).toBe(401)
        expect(mocks.commitmentCreate).not.toHaveBeenCalled()
    })

    it('crea el compromiso con la agenda inicial y la descripción normalizada', async () => {
        const response = await POST(post(validBody))

        expect(response.status).toBe(201)
        const payload = mocks.commitmentCreate.mock.calls[0][0]
        expect(payload).toMatchObject({
            userId: 'user-1',
            description: 'Alquiler',
            amount: 650_000,
            amountPolicy: 'fixed',
            createdFrom: 'web',
            normalizedDescription: 'alquiler',
        })
        expect(payload.amountSchedule).toEqual([
            expect.objectContaining({ amount: 650_000, source: 'initial' }),
        ])
    })

    it('rechaza un dayOfMonth fuera de rango con 400, no con 500', async () => {
        const response = await POST(post({ ...validBody, dayOfMonth: 99 }))

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_COMMITMENT_DATA' })
        expect(mocks.commitmentCreate).not.toHaveBeenCalled()
    })

    it('rechaza un monto negativo', async () => {
        const response = await POST(post({ ...validBody, amount: -100 }))

        expect(response.status).toBe(400)
        expect(mocks.commitmentCreate).not.toHaveBeenCalled()
    })

    it('rechaza monto cero cuando la política es fija', async () => {
        const response = await POST(post({ ...validBody, amount: 0 }))

        expect(response.status).toBe(400)
        expect(mocks.commitmentCreate).not.toHaveBeenCalled()
    })

    it('acepta monto cero cuando la política es variable y no arma agenda inicial', async () => {
        const response = await POST(post({ ...validBody, amount: 0, amountPolicy: 'variable' }))

        expect(response.status).toBe(201)
        expect(mocks.commitmentCreate.mock.calls[0][0].amountSchedule).toEqual([])
    })

    it('rechaza una fecha de fin anterior al inicio', async () => {
        const response = await POST(
            post({ ...validBody, startDate: '2026-06-01', endDate: '2026-01-01' })
        )

        expect(response.status).toBe(400)
        expect(mocks.commitmentCreate).not.toHaveBeenCalled()
    })

    it('normaliza los alias con el criterio del motor de reglas', async () => {
        await POST(post({ ...validBody, aliases: ['  Alquíler  ', 'ALQUILER', 'x'] }))

        // Se deduplica tras normalizar y se descarta el alias demasiado corto.
        expect(mocks.commitmentCreate.mock.calls[0][0].aliases).toEqual(['alquiler'])
    })
})

describe('PATCH /api/commitments/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.commitmentFindOneAndUpdate.mockResolvedValue({ _id: 'commitment-1' })
    })

    it('sólo escribe los campos enviados', async () => {
        await PATCH(patch({ amount: 700_000 }), { params })

        const [filter, update] = mocks.commitmentFindOneAndUpdate.mock.calls[0]
        expect(filter).toEqual({ _id: 'commitment-1', userId: 'user-1' })
        expect(update.$set).toEqual({ amount: 700_000 })
    })

    it('resincroniza normalizedDescription cuando cambia la descripción', async () => {
        await PATCH(patch({ description: 'Alquíler Nuevo' }), { params })

        expect(mocks.commitmentFindOneAndUpdate.mock.calls[0][1].$set).toEqual({
            description: 'Alquíler Nuevo',
            normalizedDescription: 'alquiler nuevo',
        })
    })

    it('permite limpiar endDate sin pasar por 1970', async () => {
        await PATCH(patch({ endDate: null }), { params })

        expect(mocks.commitmentFindOneAndUpdate.mock.calls[0][1].$set).toEqual({ endDate: null })
    })

    it('rechaza un patch vacío', async () => {
        const response = await PATCH(patch({}), { params })

        expect(response.status).toBe(400)
        expect(mocks.commitmentFindOneAndUpdate).not.toHaveBeenCalled()
    })

    it('devuelve 404 cuando el compromiso es de otro usuario', async () => {
        mocks.commitmentFindOneAndUpdate.mockResolvedValue(null)

        const response = await PATCH(patch({ amount: 1 }), { params })

        expect(response.status).toBe(404)
    })
})
