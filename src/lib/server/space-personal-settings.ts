import { Types } from 'mongoose'
import {
    CATEGORY_TYPES,
    SPACE_PERSONAL_CATEGORY_STRATEGIES,
    type SpacePersonalCategoryStrategy,
} from '@/lib/constants'
import {
    Category,
    Space,
    SpaceCategory,
    SpaceEntryPersonalImpact,
    SpaceParticipant,
    Transaction,
} from '@/lib/models'
import { extractId } from '@/lib/utils/spaces'
import type { ICategory, ISpace, ISpaceEntry, ISpaceParticipant, ISpaceCategory } from '@/types'

type CategoryMappingInput = {
    spaceCategoryId: string
    personalCategoryId: string
}

export type SpacePersonalSettingsInput = {
    categoryStrategy: SpacePersonalCategoryStrategy
    defaultPersonalCategoryId?: string
    categoryMappings?: CategoryMappingInput[]
}

export type ResolvedPersonalCategorySuggestion = {
    categoryId?: string
    strategy: SpacePersonalCategoryStrategy
    reason?: 'manual' | 'invalid_category' | 'missing_mapping' | 'invalid_mapping'
}

const DEFAULT_STRATEGY_BY_SPACE_TYPE: Partial<Record<string, SpacePersonalCategoryStrategy>> = {
    couple: SPACE_PERSONAL_CATEGORY_STRATEGIES.MAP_SPACE_CATEGORIES,
    home: SPACE_PERSONAL_CATEGORY_STRATEGIES.MANUAL,
    travel: SPACE_PERSONAL_CATEGORY_STRATEGIES.SPACE_NAME_VIRTUAL,
    project: SPACE_PERSONAL_CATEGORY_STRATEGIES.SPACE_NAME_VIRTUAL,
}

export function getSuggestedPersonalCategoryStrategy(spaceType?: string): SpacePersonalCategoryStrategy {
    return DEFAULT_STRATEGY_BY_SPACE_TYPE[spaceType ?? ''] ?? SPACE_PERSONAL_CATEGORY_STRATEGIES.MANUAL
}

function toObjectId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
        throw new Error('Id invalido')
    }

    return new Types.ObjectId(value)
}

function getSettingsStrategy(participant?: Pick<ISpaceParticipant, 'personalSettings'> | null) {
    return participant?.personalSettings?.categoryStrategy ?? SPACE_PERSONAL_CATEGORY_STRATEGIES.MANUAL
}

export async function getSpaceVirtualCategory(userId: string, spaceId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(spaceId)) return null

    return Category.findOne({
        userId,
        sourceType: 'space',
        sourceSpaceId: spaceId,
        isVirtual: true,
    }).lean<ICategory | null>()
}

export async function getOrCreateSpaceVirtualCategory({
    userId,
    spaceId,
    spaceName,
}: {
    userId: string
    spaceId: string
    spaceName: string
}) {
    const userObjectId = toObjectId(userId)
    const spaceObjectId = toObjectId(spaceId)

    const existing = await Category.findOne({
        userId: userObjectId,
        sourceType: 'space',
        sourceSpaceId: spaceObjectId,
    })

    if (existing) {
        let changed = false
        if (existing.name !== spaceName) {
            existing.name = spaceName
            changed = true
        }
        if (!existing.isVirtual || !existing.hiddenFromSettings) {
            existing.isVirtual = true
            existing.hiddenFromSettings = true
            changed = true
        }
        if (changed) await existing.save()
        return existing
    }

    return Category.create({
        userId: userObjectId,
        name: spaceName,
        type: CATEGORY_TYPES.EXPENSE,
        icon: 'users',
        color: '#4A9ECC',
        isDefault: false,
        isArchived: false,
        sortOrder: 0,
        isVirtual: true,
        hiddenFromSettings: true,
        sourceType: 'space',
        sourceSpaceId: spaceObjectId,
    })
}

export async function updateSpaceVirtualCategoryNames(spaceId: string, spaceName: string) {
    if (!Types.ObjectId.isValid(spaceId)) return

    await Category.updateMany(
        {
            sourceType: 'space',
            sourceSpaceId: spaceId,
            isVirtual: true,
        },
        { $set: { name: spaceName } }
    )
}

export async function validatePersonalCategoryForSettings(categoryId: string, userId: string) {
    if (!Types.ObjectId.isValid(categoryId) || !Types.ObjectId.isValid(userId)) return null

    return Category.findOne({
        _id: categoryId,
        userId,
        isArchived: { $ne: true },
        isVirtual: { $ne: true },
        hiddenFromSettings: { $ne: true },
    }).lean<ICategory | null>()
}

export async function validatePersonalCategoryForImpact(categoryId: string, userId: string) {
    if (!Types.ObjectId.isValid(categoryId) || !Types.ObjectId.isValid(userId)) return null

    return Category.findOne({
        _id: categoryId,
        userId,
        isArchived: { $ne: true },
    }).lean<ICategory | null>()
}

export async function validateSpaceCategoryForSettings(spaceCategoryId: string, spaceId: string) {
    if (!Types.ObjectId.isValid(spaceCategoryId) || !Types.ObjectId.isValid(spaceId)) return null

    return SpaceCategory.findOne({
        _id: spaceCategoryId,
        spaceId,
        isArchived: { $ne: true },
    }).lean<ISpaceCategory | null>()
}

export async function normalizePersonalSettingsInput({
    data,
    userId,
    spaceId,
}: {
    data: SpacePersonalSettingsInput
    userId: string
    spaceId: string
}) {
    const strategy = data.categoryStrategy

    if (strategy === SPACE_PERSONAL_CATEGORY_STRATEGIES.MANUAL) {
        return {
            categoryStrategy: strategy,
            categoryMappings: [],
            updatedAt: new Date(),
        }
    }

    if (strategy === SPACE_PERSONAL_CATEGORY_STRATEGIES.SPACE_NAME_VIRTUAL) {
        return {
            categoryStrategy: strategy,
            categoryMappings: [],
            updatedAt: new Date(),
        }
    }

    if (strategy === SPACE_PERSONAL_CATEGORY_STRATEGIES.FIXED_PERSONAL_CATEGORY) {
        if (!data.defaultPersonalCategoryId) {
            throw new Error('Elegí una categoría personal para usar esta estrategia.')
        }

        const category = await validatePersonalCategoryForSettings(
            data.defaultPersonalCategoryId,
            userId
        )
        if (!category) {
            throw new Error('La categoría personal no existe o no pertenece a tu usuario.')
        }

        return {
            categoryStrategy: strategy,
            defaultPersonalCategoryId: toObjectId(data.defaultPersonalCategoryId),
            categoryMappings: [],
            updatedAt: new Date(),
        }
    }

    const mappings = data.categoryMappings ?? []
    const normalizedMappings: Array<{
        spaceCategoryId: Types.ObjectId
        personalCategoryId: Types.ObjectId
    }> = []

    for (const mapping of mappings) {
        const [spaceCategory, personalCategory] = await Promise.all([
            validateSpaceCategoryForSettings(mapping.spaceCategoryId, spaceId),
            validatePersonalCategoryForSettings(mapping.personalCategoryId, userId),
        ])

        if (!spaceCategory) {
            throw new Error('Una categoría del espacio ya no existe o no pertenece a este espacio.')
        }
        if (!personalCategory) {
            throw new Error('Una categoría personal del mapping no existe o no pertenece a tu usuario.')
        }

        normalizedMappings.push({
            spaceCategoryId: toObjectId(mapping.spaceCategoryId),
            personalCategoryId: toObjectId(mapping.personalCategoryId),
        })
    }

    return {
        categoryStrategy: strategy,
        categoryMappings: normalizedMappings,
        updatedAt: new Date(),
    }
}

export async function resolveSuggestedPersonalCategory({
    userId,
    space,
    participant,
    entry,
}: {
    userId: string
    space: ISpace
    participant?: ISpaceParticipant | null
    entry?: Pick<ISpaceEntry, 'spaceCategoryId'> | null
}): Promise<ResolvedPersonalCategorySuggestion> {
    const strategy = getSettingsStrategy(participant)

    if (strategy === SPACE_PERSONAL_CATEGORY_STRATEGIES.MANUAL) {
        return { strategy, reason: 'manual' }
    }

    if (strategy === SPACE_PERSONAL_CATEGORY_STRATEGIES.SPACE_NAME_VIRTUAL) {
        const category = await getOrCreateSpaceVirtualCategory({
            userId,
            spaceId: extractId(space._id) ?? '',
            spaceName: space.name,
        })

        return { strategy, categoryId: extractId(category._id) }
    }

    if (strategy === SPACE_PERSONAL_CATEGORY_STRATEGIES.FIXED_PERSONAL_CATEGORY) {
        const categoryId = extractId(participant?.personalSettings?.defaultPersonalCategoryId)
        if (!categoryId) return { strategy, reason: 'invalid_category' }

        const category = await validatePersonalCategoryForSettings(categoryId, userId)
        if (!category) return { strategy, reason: 'invalid_category' }

        return { strategy, categoryId: extractId(category._id) }
    }

    const entrySpaceCategoryId = extractId(entry?.spaceCategoryId)
    if (!entrySpaceCategoryId) return { strategy, reason: 'missing_mapping' }

    const mapping = participant?.personalSettings?.categoryMappings?.find(
        (item) => extractId(item.spaceCategoryId) === entrySpaceCategoryId
    )

    if (!mapping) return { strategy, reason: 'missing_mapping' }

    const personalCategoryId = extractId(mapping.personalCategoryId)
    if (!personalCategoryId) return { strategy, reason: 'invalid_mapping' }

    const category = await validatePersonalCategoryForSettings(personalCategoryId, userId)
    if (!category) return { strategy, reason: 'invalid_mapping' }

    return { strategy, categoryId: extractId(category._id) }
}

export async function updateParticipantPersonalSettings({
    spaceId,
    userId,
    data,
}: {
    spaceId: string
    userId: string
    data: SpacePersonalSettingsInput
}) {
    const participant = await SpaceParticipant.findOne({
        spaceId,
        userId,
        isActive: true,
    })

    if (!participant) return null

    const normalized = await normalizePersonalSettingsInput({ data, userId, spaceId })
    participant.personalSettings = normalized
    await participant.save()

    if (normalized.categoryStrategy === SPACE_PERSONAL_CATEGORY_STRATEGIES.SPACE_NAME_VIRTUAL) {
        const space = await Space.findById(spaceId).lean<ISpace | null>()
        if (space) {
            await getOrCreateSpaceVirtualCategory({ userId, spaceId, spaceName: space.name })
        }
    }

    return participant.toObject() as ISpaceParticipant
}

export async function migrateSpaceVirtualCategory({
    spaceId,
    userId,
    targetCategoryId,
}: {
    spaceId: string
    userId: string
    targetCategoryId: string
}) {
    const [targetCategory, virtualCategory] = await Promise.all([
        validatePersonalCategoryForSettings(targetCategoryId, userId),
        getSpaceVirtualCategory(userId, spaceId),
    ])

    if (!targetCategory) {
        throw new Error('La categoría destino no existe o no pertenece a tu usuario.')
    }

    if (!virtualCategory) {
        return {
            migratedTransactions: 0,
            migratedImpacts: 0,
            virtualCategoryId: null,
        }
    }

    const transactionFilter = {
        userId: new Types.ObjectId(userId),
        spaceId: new Types.ObjectId(spaceId),
        categoryId: virtualCategory._id,
    }

    const [transactionResult, impactResult] = await Promise.all([
        Transaction.updateMany(transactionFilter, {
            $set: { categoryId: targetCategory._id },
        }),
        SpaceEntryPersonalImpact.updateMany(
            {
                userId: new Types.ObjectId(userId),
                spaceId: new Types.ObjectId(spaceId),
                categoryId: virtualCategory._id,
            },
            {
                $set: { categoryId: targetCategory._id },
            }
        ),
    ])

    return {
        migratedTransactions: transactionResult.modifiedCount ?? 0,
        migratedImpacts: impactResult.modifiedCount ?? 0,
        virtualCategoryId: extractId(virtualCategory._id),
    }
}
