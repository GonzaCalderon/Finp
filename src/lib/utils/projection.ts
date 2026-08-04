import {
    addCurrencyAmount,
    emptyCurrencyTotals,
    type CurrencyTotals,
} from '@/lib/utils/currency-totals'
import type {
    ProjectionGroup,
    ProjectionGrouping,
    ProjectionItem,
    ProjectionItemKind,
} from '@/types/projection'

const TYPE_LABELS: Record<ProjectionItemKind, string> = {
    commitment: 'Compromisos',
    card_single: 'TC · un pago',
    card_installment: 'TC · cuotas',
    hypothetical: 'Otros simulados',
}

type GroupDescriptor = {
    key: string
    label: string
    href?: string
    linkLabel?: string
}

function totalsForItems(items: ProjectionItem[]): CurrencyTotals {
    const totals = emptyCurrencyTotals()
    for (const item of items) addCurrencyAmount(totals, item.currency, item.amount)
    return totals
}

function groupByDescriptor(
    items: ProjectionItem[],
    resolve: (item: ProjectionItem) => GroupDescriptor
): Array<{ descriptor: GroupDescriptor; items: ProjectionItem[] }> {
    const groups = new Map<string, { descriptor: GroupDescriptor; items: ProjectionItem[] }>()

    for (const item of items) {
        const descriptor = resolve(item)
        const existing = groups.get(descriptor.key)
        if (existing) existing.items.push(item)
        else groups.set(descriptor.key, { descriptor, items: [item] })
    }

    return Array.from(groups.values()).sort((left, right) =>
        left.descriptor.label.localeCompare(right.descriptor.label, 'es')
    )
}

function leafGroups(
    items: ProjectionItem[],
    resolve: (item: ProjectionItem) => GroupDescriptor
): ProjectionGroup[] {
    return groupByDescriptor(items, resolve).map(({ descriptor, items: groupedItems }) => ({
        ...descriptor,
        totals: totalsForItems(groupedItems),
        children: [],
        items: groupedItems,
    }))
}

function categoryDescriptor(item: ProjectionItem): GroupDescriptor {
    return item.category
        ? { key: `category:${item.category.id}`, label: item.category.name }
        : { key: 'category:uncategorized', label: 'Sin categoría' }
}

function cardDescriptor(item: ProjectionItem): GroupDescriptor {
    return item.card
        ? {
            key: `card:${item.card.id}`,
            label: item.card.name,
            href: item.link?.href,
            linkLabel: 'Ver en Tarjetas',
        }
        : { key: 'card:unknown', label: 'Sin tarjeta' }
}

function typeDescriptor(item: ProjectionItem): GroupDescriptor {
    return { key: `type:${item.kind}`, label: TYPE_LABELS[item.kind] }
}

function buildTypeGroups(items: ProjectionItem[]): ProjectionGroup[] {
    return groupByDescriptor(items, typeDescriptor).map(({ descriptor, items: typeItems }) => {
        const children = typeItems[0]?.kind === 'commitment' || typeItems[0]?.kind === 'hypothetical'
            ? leafGroups(typeItems, categoryDescriptor)
            : groupByDescriptor(typeItems, cardDescriptor).map(({ descriptor: card, items: cardItems }) => ({
                ...card,
                totals: totalsForItems(cardItems),
                children: leafGroups(cardItems, categoryDescriptor),
                items: [],
            }))

        return {
            ...descriptor,
            totals: totalsForItems(typeItems),
            href: typeItems[0]?.kind === 'commitment' ? '/commitments' : undefined,
            linkLabel: typeItems[0]?.kind === 'commitment' ? 'Ver Compromisos' : undefined,
            children,
            items: [],
        }
    })
}

function buildCardGroups(items: ProjectionItem[]): ProjectionGroup[] {
    const commitments = items.filter((item) => item.kind === 'commitment')
    const cardItems = items.filter((item) => item.kind === 'card_single' || item.kind === 'card_installment')
    const hypotheticalItems = items.filter((item) => item.kind === 'hypothetical')
    const result: ProjectionGroup[] = []

    if (commitments.length > 0) {
        result.push({
            key: 'card:commitments',
            label: 'Compromisos',
            totals: totalsForItems(commitments),
            href: '/commitments',
            linkLabel: 'Ver Compromisos',
            children: leafGroups(commitments, categoryDescriptor),
            items: [],
        })
    }

    if (hypotheticalItems.length > 0) {
        result.push({
            key: 'card:hypothetical',
            label: 'Otros simulados',
            totals: totalsForItems(hypotheticalItems),
            children: leafGroups(hypotheticalItems, categoryDescriptor),
            items: [],
        })
    }

    result.push(
        ...groupByDescriptor(cardItems, cardDescriptor).map(({ descriptor, items: groupedItems }) => ({
            ...descriptor,
            totals: totalsForItems(groupedItems),
            children: groupByDescriptor(groupedItems, typeDescriptor).map(({ descriptor: type, items: typeItems }) => ({
                ...type,
                totals: totalsForItems(typeItems),
                children: leafGroups(typeItems, categoryDescriptor),
                items: [],
            })),
            items: [],
        }))
    )

    return result
}

function buildCategoryGroups(items: ProjectionItem[]): ProjectionGroup[] {
    return groupByDescriptor(items, categoryDescriptor).map(({ descriptor, items: categoryItems }) => ({
        ...descriptor,
        totals: totalsForItems(categoryItems),
        children: groupByDescriptor(categoryItems, typeDescriptor).map(({ descriptor: type, items: typeItems }) => ({
            ...type,
            totals: totalsForItems(typeItems),
            children: typeItems[0]?.kind === 'commitment' || typeItems[0]?.kind === 'hypothetical'
                ? []
                : leafGroups(typeItems, cardDescriptor),
            items: typeItems[0]?.kind === 'commitment' || typeItems[0]?.kind === 'hypothetical'
                ? typeItems
                : [],
        })),
        items: [],
    }))
}

export function buildProjectionGroups(
    items: ProjectionItem[],
    grouping: ProjectionGrouping
): ProjectionGroup[] {
    if (grouping === 'card') return buildCardGroups(items)
    if (grouping === 'category') return buildCategoryGroups(items)
    return buildTypeGroups(items)
}

export function projectionTypeLabel(kind: ProjectionItemKind): string {
    return TYPE_LABELS[kind]
}
