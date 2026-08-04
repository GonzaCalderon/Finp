import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiceError } from '@/lib/server/errors'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn().mockResolvedValue(undefined),
    getAccessibleSpaceContext: vi.fn(),
    spaceEntryFindOne: vi.fn(),
    impactFindOne: vi.fn(),
    deleteAuthorizedPersonalTransactions: vi.fn(),
    removePersonalImpactWithoutTransaction: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    SpaceEntry: { findOne: mocks.spaceEntryFindOne },
    SpaceEntryPersonalImpact: { findOne: mocks.impactFindOne },
}))
vi.mock('@/lib/server/spaces', () => ({
    getAccessibleSpaceContext: mocks.getAccessibleSpaceContext,
}))
vi.mock('@/lib/server/transaction-teardown', () => ({
    deleteAuthorizedPersonalTransactions: mocks.deleteAuthorizedPersonalTransactions,
    removePersonalImpactWithoutTransaction: mocks.removePersonalImpactWithoutTransaction,
}))
vi.mock('@/lib/server/space-personal-impact', () => ({
    createPersonalImpactFromSpaceEntry: vi.fn(),
    getPersonalImpactForEntries: vi.fn(),
    resolveCurrentUserEntryShare: vi.fn(),
}))
vi.mock('@/lib/server/space-personal-settings', () => ({
    resolveSuggestedPersonalCategory: vi.fn(),
}))

const { DELETE } = await import(
    '@/app/api/spaces/[id]/entries/[entryId]/personal-impact/route'
)

const spaceId = '64b000000000000000000001'
const entryId = '64b000000000000000000002'
const impactId = '64b000000000000000000003'
const transactionId = '64b000000000000000000004'

function leanResult<T>(value: T) {
    return { lean: vi.fn().mockResolvedValue(value) }
}

function request(selectedTransactionId = transactionId) {
    return new Request(
        `https://finp.test/api/spaces/${spaceId}/entries/${entryId}/personal-impact?transactionId=${selectedTransactionId}`,
        { method: 'DELETE' }
    )
}

function params(overrides: Partial<{ id: string; entryId: string }> = {}) {
    return { params: Promise.resolve({ id: spaceId, entryId, ...overrides }) }
}

describe('DELETE personal-impact', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.getAccessibleSpaceContext.mockResolvedValue({ space: { _id: spaceId } })
        mocks.impactFindOne.mockReturnValue(leanResult({
            _id: { toString: () => impactId },
            transactionId,
            status: 'linked',
        }))
        mocks.deleteAuthorizedPersonalTransactions.mockResolvedValue({
            deletedTransactions: [{ _id: transactionId }],
            teardowns: [],
            normalizedGroups: [],
        })
        mocks.removePersonalImpactWithoutTransaction.mockResolvedValue(true)
    })

    it('requiere autenticacion', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await DELETE(request(), params())

        expect(response.status).toBe(401)
        expect(mocks.connectDB).not.toHaveBeenCalled()
    })

    it('valida los tres identificadores antes de consultar la base', async () => {
        const invalidSpace = await DELETE(request(), params({ id: 'invalido' }))
        const invalidEntry = await DELETE(request(), params({ entryId: 'invalido' }))
        const invalidTransaction = await DELETE(request('invalido'), params())

        expect(invalidSpace.status).toBe(404)
        expect(invalidEntry.status).toBe(404)
        expect(invalidTransaction.status).toBe(400)
        expect(mocks.connectDB).not.toHaveBeenCalled()
    })

    it.each(['linked', 'needs_review'])('elimina un impacto %s sin tocar el movimiento compartido', async (status) => {
        mocks.impactFindOne.mockReturnValue(leanResult({
            _id: { toString: () => impactId },
            transactionId,
            status,
        }))

        const response = await DELETE(request(), params())

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            ok: true,
            deletedTransaction: true,
            orphanTransactionDeleted: false,
        })
        expect(mocks.deleteAuthorizedPersonalTransactions).toHaveBeenCalledWith(
            'user-1',
            [{ transactionId, spaceId, spaceEntryId: entryId }]
        )
        expect(mocks.impactFindOne).toHaveBeenCalledWith({
            spaceId,
            entryId,
            userId: 'user-1',
            status: { $in: ['linked', 'needs_review'] },
        })
        expect(mocks.spaceEntryFindOne).not.toHaveBeenCalled()
        expect(mocks.removePersonalImpactWithoutTransaction).not.toHaveBeenCalled()
    })

    it('elimina exclusivamente la transaccion huerfana indicada aunque no exista el SpaceEntry', async () => {
        mocks.impactFindOne.mockReturnValue(leanResult(null))

        const response = await DELETE(request(), params())

        await expect(response.json()).resolves.toEqual({
            ok: true,
            deletedTransaction: true,
            orphanTransactionDeleted: true,
        })
        expect(mocks.deleteAuthorizedPersonalTransactions).toHaveBeenCalledWith(
            'user-1',
            [{ transactionId, spaceId, spaceEntryId: entryId }]
        )
    })

    it('no enumera una transaccion ajena o asociada a otro contexto', async () => {
        mocks.impactFindOne.mockReturnValue(leanResult(null))
        mocks.deleteAuthorizedPersonalTransactions.mockResolvedValue({
            deletedTransactions: [],
            teardowns: [],
            normalizedGroups: [],
        })

        const response = await DELETE(request(), params())

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            ok: true,
            deletedTransaction: false,
            orphanTransactionDeleted: false,
        })
    })

    it('rechaza un transactionId distinto del asociado sin eliminar ninguna transaccion', async () => {
        const otherTransactionId = '64b000000000000000000099'

        const response = await DELETE(request(otherTransactionId), params())

        expect(response.status).toBe(409)
        expect(mocks.deleteAuthorizedPersonalTransactions).not.toHaveBeenCalled()
        expect(mocks.removePersonalImpactWithoutTransaction).not.toHaveBeenCalled()
    })

    it('cierra un impacto vigente si su transaccion ya no existe', async () => {
        mocks.deleteAuthorizedPersonalTransactions.mockResolvedValue({
            deletedTransactions: [],
            teardowns: [],
            normalizedGroups: [],
        })

        const response = await DELETE(request(), params())

        await expect(response.json()).resolves.toEqual({
            ok: true,
            deletedTransaction: false,
            orphanTransactionDeleted: false,
        })
        expect(mocks.removePersonalImpactWithoutTransaction).toHaveBeenCalledWith(
            'user-1',
            impactId
        )
    })

    it('no informa exito si falla el teardown', async () => {
        mocks.deleteAuthorizedPersonalTransactions.mockRejectedValue(
            new ServiceError(
                500,
                'TRANSACTION_TEARDOWN_FAILED',
                'No se pudo eliminar la transaccion. No se confirmaron cambios.'
            )
        )

        const response = await DELETE(request(), params())

        expect(response.status).toBe(500)
        await expect(response.json()).resolves.toMatchObject({
            code: 'TRANSACTION_TEARDOWN_FAILED',
        })
        expect(mocks.removePersonalImpactWithoutTransaction).not.toHaveBeenCalled()
    })
})
