import { Account, Category, User } from '@/lib/models'
import { getProjectionForUser } from '@/lib/server/projection'
import { getSupportedCurrencies } from '@/lib/utils/accounts'
import { buildProjectionScenario } from '@/lib/utils/projection-scenario'
import type { ProjectionScenarioRequest } from '@/lib/validations/projection-scenario'
import type { ProjectionReference, ProjectionScenarioResponse } from '@/types/projection'

type CategoryDocument = {
    _id: { toString(): string }
    name: string
    color?: string
}

type AccountDocument = {
    _id: { toString(): string }
    name: string
    color?: string
    type: string
    currency?: string
    supportedCurrencies?: string[]
    creditCardConfig?: { dueDay?: number }
}

export class InvalidScenarioCategoryError extends Error {
    constructor() {
        super('Una categoría seleccionada no está disponible')
        this.name = 'InvalidScenarioCategoryError'
    }
}

export class InvalidScenarioAccountError extends Error {
    constructor() {
        super('La tarjeta seleccionada no está disponible para esa moneda')
        this.name = 'InvalidScenarioAccountError'
    }
}

export async function getProjectionScenarioPreviewForUser(
    userId: string,
    input: ProjectionScenarioRequest
): Promise<ProjectionScenarioResponse> {
    const categoryIds = Array.from(new Set(input.changes.flatMap((change) => (
        change.type === 'hypothetical' && change.categoryId ? [change.categoryId] : []
    ))))
    const accountIds = Array.from(new Set(input.changes.flatMap((change) => (
        change.type === 'hypothetical' && change.expense.type !== 'commitment'
            ? [change.expense.accountId]
            : []
    ))))

    const categoryQuery = categoryIds.length > 0
        ? Category.find({
            userId,
            _id: { $in: categoryIds },
            type: 'expense',
            isArchived: false,
        }).select({ name: 1, color: 1 }).lean<CategoryDocument[]>()
        : Promise.resolve([] as CategoryDocument[])
    const accountQuery = accountIds.length > 0
        ? Account.find({
            userId,
            _id: { $in: accountIds },
            type: 'credit_card',
            isActive: true,
        }).select({
            name: 1,
            color: 1,
            type: 1,
            currency: 1,
            supportedCurrencies: 1,
            creditCardConfig: 1,
        }).lean<AccountDocument[]>()
        : Promise.resolve([] as AccountDocument[])

    const [base, user, categoryDocuments, accountDocuments] = await Promise.all([
        getProjectionForUser(userId, {
            mode: input.view.mode,
            year: input.view.year,
            monthCount: input.view.months,
        }),
        User.findById(userId, { 'preferences.monthStartDay': 1 }).lean(),
        categoryQuery,
        accountQuery,
    ])

    if (categoryDocuments.length !== categoryIds.length) {
        throw new InvalidScenarioCategoryError()
    }
    if (accountDocuments.length !== accountIds.length) {
        throw new InvalidScenarioAccountError()
    }

    const accountsById = new Map(accountDocuments.map((account) => [account._id.toString(), account]))
    for (const change of input.changes) {
        if (change.type !== 'hypothetical' || change.expense.type === 'commitment') continue
        const account = accountsById.get(change.expense.accountId)
        if (!account || !getSupportedCurrencies(account).includes(change.currency)) {
            throw new InvalidScenarioAccountError()
        }
    }

    const categories: ProjectionReference[] = categoryDocuments.map((category) => ({
        id: category._id.toString(),
        name: category.name,
        color: category.color,
    }))
    const cards = accountDocuments.map((account) => ({
        id: account._id.toString(),
        name: account.name,
        color: account.color,
        dueDay: account.creditCardConfig?.dueDay,
    }))

    return buildProjectionScenario({
        base,
        changes: input.changes,
        monthStartDay: user?.preferences?.monthStartDay ?? 1,
        categories,
        cards,
    })
}
