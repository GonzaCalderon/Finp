'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import {
    orderCategoryIds,
    type CategoryHistoryRanking,
} from '@/lib/utils/category-ranking'
import { getRecentCategoryIds } from '@/components/shared/transaction-dialog-prefs'
import type { ICategory } from '@/types'

export function useRankedCommitmentCategories(args: {
    open: boolean
    description: string
    categories: ICategory[]
    selectedCategoryId?: string
}) {
    const [ranking, setRanking] = useState<CategoryHistoryRanking[]>([])

    useEffect(() => {
        if (!args.open) return

        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => {
            const params = new URLSearchParams({ type: 'expense' })
            const description = args.description.trim()
            if (description) params.set('description', description)

            void apiJson<{ ranking?: CategoryHistoryRanking[] }>(
                `/api/categories/ranking?${params.toString()}`,
                { cache: 'no-store', signal: controller.signal }
            )
                .then((response) => setRanking(response.ranking ?? []))
                .catch((error: unknown) => {
                    if (
                        typeof error === 'object' &&
                        error !== null &&
                        'name' in error &&
                        error.name === 'AbortError'
                    ) {
                        return
                    }
                    setRanking([])
                })
        }, 220)

        return () => {
            window.clearTimeout(timeoutId)
            controller.abort()
        }
    }, [args.description, args.open])

    return useMemo(() => {
        const categoryIds = args.categories.map((category) =>
            category._id.toString()
        )
        const orderedIds = orderCategoryIds({
            categoryIds,
            historyRanking: args.open ? ranking : [],
            recentCategoryIds: getRecentCategoryIds('expense'),
            selectedCategoryId: args.selectedCategoryId,
        })
        const byId = new Map(
            args.categories.map((category) => [
                category._id.toString(),
                category,
            ])
        )
        return orderedIds
            .map((categoryId) => byId.get(categoryId))
            .filter((category): category is ICategory => Boolean(category))
    }, [args.categories, args.open, args.selectedCategoryId, ranking])
}
