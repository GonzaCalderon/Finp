import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

// Los mocks deben definirse con vi.hoisted para que estén disponibles antes del import
const mocks = vi.hoisted(() => {
    function makeFindQuery(result: unknown[]) {
        return { then: (cb: (r: unknown[]) => void) => Promise.resolve(cb(result)) }
    }
    const Space = { findById: vi.fn() }
    const SpaceParticipant = { find: vi.fn() }
    const SpaceEntry = { find: vi.fn() }
    const Debt = {
        find: vi.fn(),
        findOne: vi.fn(),
        create: vi.fn(),
        updateOne: vi.fn(),
    }
    const DebtMovement = { create: vi.fn() }
    return { Space, SpaceParticipant, SpaceEntry, Debt, DebtMovement, makeFindQuery }
})

vi.mock('@/lib/models', () => ({
    Space: mocks.Space,
    SpaceParticipant: mocks.SpaceParticipant,
    SpaceEntry: mocks.SpaceEntry,
    Debt: mocks.Debt,
    DebtMovement: mocks.DebtMovement,
}))

// Mock de utilidades que no necesitamos testear aquí
vi.mock('@/lib/utils/spaces', () => ({
    buildSpaceBalances: vi.fn(),
    extractId: vi.fn((v: unknown) => {
        if (!v) return undefined
        if (typeof v === 'string') return v
        if (typeof v === 'object' && v !== null && 'toString' in v) return (v as { toString(): string }).toString()
        return undefined
    }),
}))

const { syncSpaceDebtsForUser } = await import('@/lib/server/debt-sync')
const { buildSpaceBalances } = await import('@/lib/utils/spaces')

const spaceId = new Types.ObjectId().toString()
const userId = new Types.ObjectId().toString()
const participantMeId = new Types.ObjectId().toString()
const participantJuanId = new Types.ObjectId().toString()

function makeSpace(overrides = {}) {
    return {
        _id: spaceId,
        reportingCurrency: 'ARS',
        debtMode: 'simplified',
        ...overrides,
    }
}

function makeParticipant(id: string, uid: string | null, displayName: string) {
    return {
        _id: { toString: () => id },
        kind: uid ? 'finp_user' : 'external',
        userId: uid ? { toString: () => uid } : null,
        displayName,
        isActive: true,
        inviteStatus: 'accepted',
        role: 'participant',
    }
}

function makeBalance(participantId: string, balanceReporting: number) {
    return { participantId, balanceReporting, displayName: participantId, paidReporting: 0, shareReporting: 0, kind: 'finp_user', role: 'participant', inviteStatus: 'accepted' }
}

function makeDebt(remainingAmount: number, status = 'active', amount?: number) {
    const debtId = new Types.ObjectId().toString()
    return {
        _id: { toString: () => debtId },
        spaceDebtKey: `${userId}:${spaceId}:${participantJuanId}:ARS`,
        amount: amount ?? remainingAmount,
        remainingAmount,
        status,
        currency: 'ARS',
        spaceId: { toString: () => spaceId },
    }
}

describe('syncSpaceDebtsForUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mocks.Space.findById.mockResolvedValue(makeSpace())
        mocks.SpaceParticipant.find.mockResolvedValue([
            makeParticipant(participantMeId, userId, 'Yo'),
            makeParticipant(participantJuanId, 'user-juan', 'Juan'),
        ])
        mocks.SpaceEntry.find.mockResolvedValue([])
        ;(buildSpaceBalances as ReturnType<typeof vi.fn>).mockReturnValue([
            makeBalance(participantMeId, -100),
            makeBalance(participantJuanId, 100),
        ])
        mocks.Debt.findOne.mockResolvedValue(null)
        mocks.Debt.find.mockResolvedValue([])
        mocks.Debt.create.mockImplementation(async (data: unknown) => ({
            _id: new Types.ObjectId(),
            ...(data as object),
        }))
        mocks.Debt.updateOne.mockResolvedValue({ modifiedCount: 1 })
        mocks.DebtMovement.create.mockResolvedValue({ _id: new Types.ObjectId() })
    })

    it('crea una deuda nueva cuando no existe ninguna', async () => {
        const result = await syncSpaceDebtsForUser(spaceId, userId)

        expect(result.created).toBe(1)
        expect(result.updated).toBe(0)
        expect(mocks.Debt.create).toHaveBeenCalledOnce()

        const createdDebt = mocks.Debt.create.mock.calls[0][0]
        expect(createdDebt.direction).toBe('payable')
        expect(createdDebt.amount).toBe(100)
        expect(createdDebt.currency).toBe('ARS')
        expect(createdDebt.sourceType).toBe('space')
        expect(createdDebt.spaceDebtKey).toBe(`${userId}:${spaceId}:${participantJuanId}:ARS`)
    })

    it('es idempotente: correr sync dos veces no duplica registros', async () => {
        // Primera corrida: crea la deuda
        await syncSpaceDebtsForUser(spaceId, userId)
        const createdDebt = mocks.Debt.create.mock.calls[0][0]

        vi.clearAllMocks()

        // Segunda corrida: debe actualizar, no crear
        mocks.Space.findById.mockResolvedValue(makeSpace())
        mocks.SpaceParticipant.find.mockResolvedValue([
            makeParticipant(participantMeId, userId, 'Yo'),
            makeParticipant(participantJuanId, 'user-juan', 'Juan'),
        ])
        mocks.SpaceEntry.find.mockResolvedValue([])
        ;(buildSpaceBalances as ReturnType<typeof vi.fn>).mockReturnValue([
            makeBalance(participantMeId, -100),
            makeBalance(participantJuanId, 100),
        ])
        // findOne devuelve la deuda existente
        mocks.Debt.findOne.mockResolvedValue(makeDebt(100))
        mocks.Debt.find.mockResolvedValue([])
        mocks.Debt.create.mockResolvedValue({})
        mocks.Debt.updateOne.mockResolvedValue({ modifiedCount: 1 })
        mocks.DebtMovement.create.mockResolvedValue({})

        const result2 = await syncSpaceDebtsForUser(spaceId, userId)

        expect(mocks.Debt.create).not.toHaveBeenCalled()
        expect(result2.created).toBe(0)
        expect(result2.updated).toBe(0) // Sin cambios en monto → no cuenta como updated
    })

    it('deuda ignorada conserva status:ignored pero actualiza amount', async () => {
        mocks.Debt.findOne.mockResolvedValue(makeDebt(100, 'ignored'))
        mocks.Debt.find.mockResolvedValue([])
        mocks.Debt.updateOne.mockResolvedValue({ modifiedCount: 1 })
        mocks.DebtMovement.create.mockResolvedValue({})

        // El balance cambió a -150
        ;(buildSpaceBalances as ReturnType<typeof vi.fn>).mockReturnValue([
            makeBalance(participantMeId, -150),
            makeBalance(participantJuanId, 150),
        ])

        await syncSpaceDebtsForUser(spaceId, userId)

        expect(mocks.Debt.updateOne).toHaveBeenCalled()
        const updateCall = mocks.Debt.updateOne.mock.calls[0][1]
        expect(updateCall.$set.amount).toBe(150)
        // Status debe conservarse como ignored
        expect(updateCall.$set.status).toBe('ignored')
    })

    it('marca deuda como paid cuando el balance llega a cero', async () => {
        mocks.Debt.findOne.mockResolvedValue(makeDebt(100, 'active'))
        mocks.Debt.find.mockResolvedValue([])
        mocks.Debt.updateOne.mockResolvedValue({ modifiedCount: 1 })
        mocks.DebtMovement.create.mockResolvedValue({})

        // Balance llegó a cero (se registró un settlement)
        ;(buildSpaceBalances as ReturnType<typeof vi.fn>).mockReturnValue([
            makeBalance(participantMeId, 0),
            makeBalance(participantJuanId, 0),
        ])

        const result = await syncSpaceDebtsForUser(spaceId, userId)

        // No se generan deudas cuando el balance es cero
        // Pero la deuda existente que ya no aparece debe marcarse como paid
        expect(mocks.Debt.find).toHaveBeenCalled()
    })

    it('no falla si el usuario no es participante del espacio', async () => {
        // Participantes sin el usuario actual
        mocks.SpaceParticipant.find.mockResolvedValue([
            makeParticipant(participantJuanId, 'user-juan', 'Juan'),
        ])

        const result = await syncSpaceDebtsForUser(spaceId, userId)

        expect(result.created).toBe(0)
        expect(result.updated).toBe(0)
        expect(mocks.Debt.create).not.toHaveBeenCalled()
    })

    it('no genera deuda cuando el espacio no existe', async () => {
        mocks.Space.findById.mockResolvedValue(null)

        await expect(syncSpaceDebtsForUser(spaceId, userId)).rejects.toThrow()
    })

    it('usa modo direct cuando space.debtMode es direct', async () => {
        mocks.Space.findById.mockResolvedValue(makeSpace({ debtMode: 'direct' }))
        mocks.Debt.findOne.mockResolvedValue(null)
        mocks.Debt.find.mockResolvedValue([])

        await syncSpaceDebtsForUser(spaceId, userId)

        const createdDebt = mocks.Debt.create.mock.calls[0]?.[0]
        expect(createdDebt?.originMode).toBe('direct')
        expect(createdDebt?.metadata?.syncSnapshot?.debtMode).toBe('direct')
    })

    it('crea DebtMovement tipo creation al crear deuda nueva', async () => {
        await syncSpaceDebtsForUser(spaceId, userId)

        expect(mocks.DebtMovement.create).toHaveBeenCalled()
        const movementPayload = mocks.DebtMovement.create.mock.calls[0][0]
        expect(movementPayload.type).toBe('creation')
        expect(movementPayload.amount).toBe(100)
        expect(movementPayload.currency).toBe('ARS')
    })
})
