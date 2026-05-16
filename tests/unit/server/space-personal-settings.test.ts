import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

const mocks = vi.hoisted(() => {
    const lean = <T>(result: T) => ({ lean: vi.fn().mockResolvedValue(result) })

    return {
        lean,
        Category: {
            findOne: vi.fn(),
            create: vi.fn(),
            updateMany: vi.fn(),
        },
        SpaceCategory: { findOne: vi.fn() },
        SpaceEntryPersonalImpact: { updateMany: vi.fn() },
        SpaceParticipant: { findOne: vi.fn() },
        Space: { findById: vi.fn() },
        Transaction: { updateMany: vi.fn() },
    }
})

vi.mock('@/lib/models', () => ({
    Category: mocks.Category,
    SpaceCategory: mocks.SpaceCategory,
    SpaceEntryPersonalImpact: mocks.SpaceEntryPersonalImpact,
    SpaceParticipant: mocks.SpaceParticipant,
    Space: mocks.Space,
    Transaction: mocks.Transaction,
}))

const {
    getOrCreateSpaceVirtualCategory,
    getSuggestedPersonalCategoryStrategy,
    migrateSpaceVirtualCategory,
    normalizePersonalSettingsInput,
    resolveSuggestedPersonalCategory,
} = await import('@/lib/server/space-personal-settings')

function category(overrides: Record<string, unknown> = {}) {
    return {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        name: 'Comida',
        type: 'expense',
        isArchived: false,
        isVirtual: false,
        hiddenFromSettings: false,
        save: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.Category.findOne.mockReturnValue(mocks.lean(null))
    mocks.Category.create.mockImplementation(async (payload: Record<string, unknown>) => ({
        _id: new Types.ObjectId(),
        ...payload,
    }))
    mocks.Category.updateMany.mockResolvedValue({ modifiedCount: 0 })
    mocks.SpaceCategory.findOne.mockReturnValue(mocks.lean(null))
    mocks.Transaction.updateMany.mockResolvedValue({ modifiedCount: 0 })
    mocks.SpaceEntryPersonalImpact.updateMany.mockResolvedValue({ modifiedCount: 0 })
})

describe('space personal settings helpers', () => {
    it('devuelve defaults sugeridos por tipo real de espacio', () => {
        expect(getSuggestedPersonalCategoryStrategy('couple')).toBe('map_space_categories')
        expect(getSuggestedPersonalCategoryStrategy('home')).toBe('manual')
        expect(getSuggestedPersonalCategoryStrategy('travel')).toBe('space_name_virtual')
        expect(getSuggestedPersonalCategoryStrategy('project')).toBe('space_name_virtual')
        expect(getSuggestedPersonalCategoryStrategy('event')).toBe('manual')
    })

    it('crea categoría automática idempotente y oculta', async () => {
        const userId = new Types.ObjectId().toString()
        const spaceId = new Types.ObjectId().toString()
        mocks.Category.findOne.mockResolvedValue(null)

        const created = await getOrCreateSpaceVirtualCategory({
            userId,
            spaceId,
            spaceName: 'Viaje a Córdoba',
        })

        expect(mocks.Category.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: expect.any(Types.ObjectId),
            sourceType: 'space',
            sourceSpaceId: expect.any(Types.ObjectId),
            isVirtual: true,
            hiddenFromSettings: true,
            name: 'Viaje a Córdoba',
        }))
        expect(created.name).toBe('Viaje a Córdoba')
    })

    it('reutiliza categoría automática existente y actualiza nombre si cambió el espacio', async () => {
        const existing = category({
            name: 'Nombre viejo',
            isVirtual: true,
            hiddenFromSettings: true,
        })
        mocks.Category.findOne.mockResolvedValue(existing)

        const result = await getOrCreateSpaceVirtualCategory({
            userId: new Types.ObjectId().toString(),
            spaceId: new Types.ObjectId().toString(),
            spaceName: 'Nombre nuevo',
        })

        expect(result).toBe(existing)
        expect(existing.name).toBe('Nombre nuevo')
        expect(existing.save).toHaveBeenCalledOnce()
        expect(mocks.Category.create).not.toHaveBeenCalled()
    })

    it('manual no preselecciona categoría', async () => {
        const result = await resolveSuggestedPersonalCategory({
            userId: new Types.ObjectId().toString(),
            space: {
                _id: new Types.ObjectId(),
                name: 'Grupo',
                type: 'home',
            } as never,
            participant: {
                personalSettings: { categoryStrategy: 'manual' },
            } as never,
            entry: null,
        })

        expect(result).toEqual({ strategy: 'manual', reason: 'manual' })
    })

    it('mapping incompleto cae a manual sin categoría sugerida', async () => {
        const result = await resolveSuggestedPersonalCategory({
            userId: new Types.ObjectId().toString(),
            space: {
                _id: new Types.ObjectId(),
                name: 'Pareja',
                type: 'couple',
            } as never,
            participant: {
                personalSettings: {
                    categoryStrategy: 'map_space_categories',
                    categoryMappings: [],
                },
            } as never,
            entry: { spaceCategoryId: new Types.ObjectId() } as never,
        })

        expect(result.strategy).toBe('map_space_categories')
        expect(result.categoryId).toBeUndefined()
        expect(result.reason).toBe('missing_mapping')
    })

    it('fixed category valida ownership antes de guardar', async () => {
        const userId = new Types.ObjectId().toString()
        const categoryId = new Types.ObjectId().toString()
        mocks.Category.findOne.mockReturnValue(mocks.lean(category({ _id: new Types.ObjectId(categoryId) })))

        const result = await normalizePersonalSettingsInput({
            data: {
                categoryStrategy: 'fixed_personal_category',
                defaultPersonalCategoryId: categoryId,
            },
            userId,
            spaceId: new Types.ObjectId().toString(),
        })

        expect(result.categoryStrategy).toBe('fixed_personal_category')
        expect(result.defaultPersonalCategoryId?.toString()).toBe(categoryId)
        expect(mocks.Category.findOne).toHaveBeenCalledWith(expect.objectContaining({
            _id: categoryId,
            userId,
            isVirtual: { $ne: true },
            hiddenFromSettings: { $ne: true },
        }))
    })

    it('mapping valida categoría personal y categoría interna del espacio', async () => {
        const spaceCategoryId = new Types.ObjectId().toString()
        const personalCategoryId = new Types.ObjectId().toString()
        mocks.SpaceCategory.findOne.mockReturnValue(mocks.lean({ _id: new Types.ObjectId(spaceCategoryId) }))
        mocks.Category.findOne.mockReturnValue(mocks.lean(category({ _id: new Types.ObjectId(personalCategoryId) })))

        const result = await normalizePersonalSettingsInput({
            data: {
                categoryStrategy: 'map_space_categories',
                categoryMappings: [{ spaceCategoryId, personalCategoryId }],
            },
            userId: new Types.ObjectId().toString(),
            spaceId: new Types.ObjectId().toString(),
        })

        expect(result.categoryMappings).toHaveLength(1)
        expect(mocks.SpaceCategory.findOne).toHaveBeenCalledWith(expect.objectContaining({
            _id: spaceCategoryId,
        }))
        expect(mocks.Category.findOne).toHaveBeenCalledWith(expect.objectContaining({
            _id: personalCategoryId,
        }))
    })

    it('migración se limita a transacciones del usuario y espacio actuales', async () => {
        const userId = new Types.ObjectId().toString()
        const spaceId = new Types.ObjectId().toString()
        const virtualCategoryId = new Types.ObjectId()
        const targetCategoryId = new Types.ObjectId()
        mocks.Category.findOne
            .mockReturnValueOnce(mocks.lean(category({ _id: targetCategoryId })))
            .mockReturnValueOnce(mocks.lean(category({
                _id: virtualCategoryId,
                isVirtual: true,
                hiddenFromSettings: true,
                sourceType: 'space',
                sourceSpaceId: new Types.ObjectId(spaceId),
            })))
        mocks.Transaction.updateMany.mockResolvedValue({ modifiedCount: 2 })
        mocks.SpaceEntryPersonalImpact.updateMany.mockResolvedValue({ modifiedCount: 1 })

        const result = await migrateSpaceVirtualCategory({
            userId,
            spaceId,
            targetCategoryId: targetCategoryId.toString(),
        })

        const [transactionFilter, transactionUpdate] = mocks.Transaction.updateMany.mock.calls[0]
        expect(transactionFilter.userId.toString()).toBe(userId)
        expect(transactionFilter.spaceId.toString()).toBe(spaceId)
        expect(transactionFilter.categoryId.toString()).toBe(virtualCategoryId.toString())
        expect(transactionUpdate.$set.categoryId.toString()).toBe(targetCategoryId.toString())
        expect(result.migratedTransactions).toBe(2)
        expect(result.migratedImpacts).toBe(1)
    })
})
