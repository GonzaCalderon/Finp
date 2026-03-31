'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    sankey as d3Sankey,
    sankeyLinkHorizontal,
    SankeyGraph,
    SankeyLink,
    SankeyNode,
} from 'd3-sankey'
import { AnimatePresence, motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

interface SankeyItem {
    name: string
    amount: number
    color: string
}

interface CreditCardSankeyItem {
    id: string
    name: string
    color: string
    totalExpenses: number
    totalPaid: number
    netOwed: number
}

interface SankeyApiData {
    income: SankeyItem[]
    expenses: SankeyItem[]
    totalIncome: number
    totalExpense: number
    balance: number
    currency: 'ARS' | 'USD'
    creditCards?: CreditCardSankeyItem[]
}

type NodeType =
    | 'income-source'
    | 'income-total'
    | 'credit-card-source'
    | 'expense-total'
    | 'available'
    | 'deficit'
    | 'expense-category'

interface ChartNode {
    id: string
    name: string
    color: string
    type: NodeType
    value: number
    layer: number
    sortOrder?: number
}

interface ChartLink {
    source: string
    target: string
    value: number
    color?: string
}

type LayoutNode = SankeyNode<ChartNode, ChartLink>
type LayoutLink = SankeyLink<ChartNode, ChartLink>

interface ActiveInfo {
    title: string
    amount: number
    percentOfIncome?: number
    percentOfExpense?: number
    x: number
    y: number
}

const MONTH_OPTIONS = [
    { value: 1, label: '1M' },
    { value: 3, label: '3M' },
    { value: 6, label: '6M' },
]

const MOBILE_BREAKPOINT = 768
const MAX_VISIBLE_EXPENSE_CATEGORIES = 7
const DEFICIT_COLOR = '#EF4444'
const TOOLTIP_WIDTH = 224
const TOOLTIP_MARGIN = 12

function useElementWidth<T extends HTMLElement>() {
    const ref = useRef<T | null>(null)
    const [width, setWidth] = useState(0)

    useEffect(() => {
        if (!ref.current) return

        const element = ref.current

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            setWidth(entry.contentRect.width)
        })

        observer.observe(element)
        setWidth(element.clientWidth)

        return () => observer.disconnect()
    }, [])

    return { ref, width }
}

function formatCompactMoney(value: number, currency: 'ARS' | 'USD') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
        notation: 'compact',
    }).format(value)
}

function formatMoney(value: number, currency: 'ARS' | 'USD') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(value)
}

function formatPercent(value: number) {
    return `${Math.round(value)}%`
}

function truncate(text: string, max: number) {
    if (text.length <= max) return text
    return `${text.slice(0, max - 1)}…`
}

function hexToRgb(color: string) {
    const normalized = color.trim()
    if (!normalized.startsWith('#')) return null

    const hex = normalized.slice(1)
    const fullHex = hex.length === 3
        ? hex.split('').map((char) => `${char}${char}`).join('')
        : hex

    if (fullHex.length !== 6) return null

    const value = Number.parseInt(fullHex, 16)
    if (Number.isNaN(value)) return null

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    }
}

function getReadableAccent(color: string) {
    if (!color.startsWith('#')) return color

    const rgb = hexToRgb(color)
    if (!rgb) return color

    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
    if (luminance >= 0.5) return color

    const mix = 0.45
    const lift = (channel: number) => Math.round(channel + (255 - channel) * mix)

    return `rgb(${lift(rgb.r)} ${lift(rgb.g)} ${lift(rgb.b)})`
}

function aggregateExpenses(expenses: SankeyItem[]) {
    const sorted = [...expenses].sort((a, b) => b.amount - a.amount)

    if (sorted.length <= MAX_VISIBLE_EXPENSE_CATEGORIES) return sorted

    const visible = sorted.slice(0, MAX_VISIBLE_EXPENSE_CATEGORIES)
    const hidden = sorted.slice(MAX_VISIBLE_EXPENSE_CATEGORIES)
    const otherAmount = hidden.reduce((acc, item) => acc + item.amount, 0)

    if (otherAmount > 0) {
        visible.push({
            name: 'Otros',
            amount: otherAmount,
            color: '#94A3B8',
        })
    }

    return visible
}

function normalizeData(data: SankeyApiData): SankeyApiData {
    const totalIncome =
        data.totalIncome > 0
            ? data.totalIncome
            : data.income.reduce((acc, item) => acc + Math.max(0, item.amount), 0)

    const totalExpense =
        data.totalExpense > 0
            ? data.totalExpense
            : data.expenses.reduce((acc, item) => acc + Math.max(0, item.amount), 0)

    const rawBalance =
        typeof data.balance === 'number' ? data.balance : totalIncome - totalExpense

    return {
        income: data.income.map((item) => ({
            ...item,
            amount: Math.max(0, item.amount),
        })),
        expenses: data.expenses.map((item) => ({
            ...item,
            amount: Math.max(0, item.amount),
        })),
        totalIncome,
        totalExpense,
        balance: rawBalance,
        currency: data.currency,
        creditCards: data.creditCards,
    }
}

function buildGraph(data: SankeyApiData) {
    const normalized = normalizeData(data)
    const expenseCategories = aggregateExpenses(normalized.expenses)

    const totalIncome = normalized.totalIncome
    const totalExpense = normalized.totalExpense

    // Prorrateo de tarjetas: gastos en tarjeta aún no pagados en el período
    // netOwed = max(0, gastos_en_tarjeta - pagos_realizados_este_período)
    const creditCards = (normalized.creditCards ?? []).filter((cc) => cc.netOwed > 0)
    const totalCcOwed = creditCards.reduce((sum, cc) => sum + cc.netOwed, 0)

    // Gastos que requieren financiamiento real (ingreso o déficit), descontando deuda pendiente de tarjetas
    const realFundedExpenses = Math.max(0, totalExpense - totalCcOwed)

    const available = Math.max(0, totalIncome - realFundedExpenses)
    const deficit = Math.max(0, realFundedExpenses - totalIncome)
    const hasDeficit = deficit > 0

    const nodes: ChartNode[] = []
    const links: ChartLink[] = []

    // Layer 0: fuentes de ingreso por categoría
    normalized.income.forEach((item, index) => {
        const id = `income-source-${index}`

        nodes.push({
            id,
            name: item.name,
            color: item.color,
            type: 'income-source',
            value: item.amount,
            layer: 0,
        })

        links.push({
            source: id,
            target: 'income-total',
            value: item.amount,
            color: item.color,
        })
    })

    // Layer 1: nodo de ingresos totales
    nodes.push({
        id: 'income-total',
        name: 'Ingresos',
        color: 'var(--sky)',
        type: 'income-total',
        value: totalIncome,
        layer: 1,
    })

    // Layer 1: nodos de tarjetas con deuda pendiente (prorrateo)
    // Solo aparecen si el gasto en tarjeta supera los pagos realizados en el período
    creditCards.forEach((cc, index) => {
        const id = `cc-source-${index}`

        nodes.push({
            id,
            name: cc.name,
            color: cc.color,
            type: 'credit-card-source',
            value: cc.netOwed,
            layer: 1,
        })

        links.push({
            source: id,
            target: 'expense-total',
            value: cc.netOwed,
            color: cc.color,
        })
    })

    // Layer 2: nodo de gastos totales
    nodes.push({
        id: 'expense-total',
        name: 'Gastos',
        color: '#F59E0B',
        type: 'expense-total',
        value: totalExpense,
        layer: 2,
    })

    // Flujo ingresos → gastos: solo la porción financiada con dinero real
    const incomeToExpense = Math.min(totalIncome, realFundedExpenses)
    if (incomeToExpense > 0) {
        links.push({
            source: 'income-total',
            target: 'expense-total',
            value: incomeToExpense,
            color: '#F59E0B',
        })
    }

    if (hasDeficit) {
        nodes.push({
            id: 'deficit',
            name: 'Déficit',
            color: DEFICIT_COLOR,
            type: 'deficit',
            value: deficit,
            layer: 1,
        })

        links.push({
            source: 'deficit',
            target: 'expense-total',
            value: deficit,
            color: DEFICIT_COLOR,
        })
    } else {
        nodes.push({
            id: 'available',
            name: 'Disponible',
            color: '#10B981',
            type: 'available',
            value: available,
            layer: 2,
        })

        if (available > 0) {
            links.push({
                source: 'income-total',
                target: 'available',
                value: available,
                color: '#10B981',
            })
        }
    }

    // Layer 3: categorías de gasto
    expenseCategories.forEach((item, index) => {
        const id = `expense-category-${index}`

        nodes.push({
            id,
            name: item.name,
            color: item.color,
            type: 'expense-category',
            value: item.amount,
            layer: 3,
        })

        links.push({
            source: 'expense-total',
            target: id,
            value: item.amount,
            color: item.color,
        })
    })

    return {
        nodes,
        links,
        hasDeficit,
        hasCreditCards: creditCards.length > 0,
        totals: {
            income: totalIncome,
            expense: totalExpense,
            available,
            deficit,
        },
        legends: {
            income: normalized.income,
            expense: expenseCategories,
            creditCards: creditCards.map((cc) => ({
                name: cc.name,
                amount: cc.netOwed,
                color: cc.color,
            })),
        },
    }
}

function normalizeGraphLayers(graph: ReturnType<typeof buildGraph>) {
    const orderedLayers = [...new Set(graph.nodes.map((node) => node.layer))].sort((a, b) => a - b)
    const layerMap = new Map(orderedLayers.map((layer, index) => [layer, index]))

    return {
        ...graph,
        nodes: graph.nodes.map((node, index) => ({
            ...node,
            layer: layerMap.get(node.layer) ?? 0,
            sortOrder: index,
        })),
    }
}

function compareSankeyNodes(a: ChartNode, b: ChartNode) {
    if (a.layer === 1 && b.layer === 1) {
        const aIsCard = a.type === 'credit-card-source'
        const bIsCard = b.type === 'credit-card-source'

        if (aIsCard && !bIsCard) return -1
        if (!aIsCard && bIsCard) return 1
    }

    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
}

function computeSankeyLayout(
    graph: ReturnType<typeof buildGraph>,
    generator: ReturnType<typeof d3Sankey<ChartNode, ChartLink>>
) {
    const buildWithGraph = (sourceGraph: ReturnType<typeof buildGraph>) =>
        generator({
            nodes: sourceGraph.nodes.map((n, index) => ({ ...n, sortOrder: index })),
            links: sourceGraph.links.map((l) => ({ ...l })),
        } as SankeyGraph<ChartNode, ChartLink>)

    try {
        return buildWithGraph(graph)
    } catch (error) {
        console.warn('Sankey fallback: normalizando capas por compatibilidad.', error)
        return buildWithGraph(normalizeGraphLayers(graph))
    }
}

function buildDesktopLayout(graph: ReturnType<typeof buildGraph>, width: number) {
    const nodeWidth = 5
    const nodePadding = 18

    const margin = {
        top: 42,
        right: 166,
        bottom: 34,
        left: 110,
    }

    const leftCount = graph.nodes.filter((n) => n.layer === 0).length
    const rightCount = graph.nodes.filter((n) => n.layer === 3).length
    const middleCount = graph.nodes.filter((n) => n.layer === 1).length
    const splitCount = graph.nodes.filter((n) => n.layer === 2).length

    const maxColumnCount = Math.max(leftCount, rightCount, middleCount, splitCount, 1)

    const innerHeight = Math.max(360, maxColumnCount * 48)
    const height = innerHeight + margin.top + margin.bottom

    const sankeyGenerator = d3Sankey<ChartNode, ChartLink>()
        .nodeId((d) => d.id)
        .nodeWidth(nodeWidth)
        .nodePadding(nodePadding)
        .nodeSort(compareSankeyNodes)
        .nodeAlign((node) => node.layer)
        .extent([
            [margin.left, margin.top],
            [width - margin.right, height - margin.bottom],
        ])

    const computed = computeSankeyLayout(graph, sankeyGenerator)

    return {
        ...computed,
        width,
        height,
    }
}

function buildMobileLayout(graph: ReturnType<typeof buildGraph>, width: number) {
    const nodeWidth = 3
    const nodePadding = 6

    const margin = {
        top: 18,
        right: 10,
        bottom: 28,
        left: 10,
    }

    const innerHeight = 224
    const height = innerHeight + margin.top + margin.bottom

    const sankeyGenerator = d3Sankey<ChartNode, ChartLink>()
        .nodeId((d) => d.id)
        .nodeWidth(nodeWidth)
        .nodePadding(nodePadding)
        .nodeSort(compareSankeyNodes)
        .nodeAlign((node) => node.layer)
        .extent([
            [margin.left, margin.top],
            [width - margin.right, height - margin.bottom],
        ])

    const computed = computeSankeyLayout(graph, sankeyGenerator)

    return {
        ...computed,
        width,
        height,
    }
}

function getNodeBounds(node: LayoutNode) {
    return {
        x0: node.x0 ?? 0,
        x1: node.x1 ?? 0,
        y0: node.y0 ?? 0,
        y1: node.y1 ?? 0,
    }
}

function roundedRectSelectivePath(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    options: {
        roundLeft?: boolean
        roundRight?: boolean
        radius?: number
    },
) {
    const { roundLeft = false, roundRight = false, radius = 3 } = options

    const w = Math.max(1, x1 - x0)
    const h = Math.max(1, y1 - y0)
    const r = Math.min(radius, w / 2, h / 2)

    const leftR = roundLeft ? r : 0
    const rightR = roundRight ? r : 0

    return `
    M ${x0 + leftR} ${y0}
    H ${x1 - rightR}
    ${rightR ? `Q ${x1} ${y0} ${x1} ${y0 + rightR}` : `L ${x1} ${y0}`}
    V ${y1 - rightR}
    ${rightR ? `Q ${x1} ${y1} ${x1 - rightR} ${y1}` : `L ${x1} ${y1}`}
    H ${x0 + leftR}
    ${leftR ? `Q ${x0} ${y1} ${x0} ${y1 - leftR}` : `L ${x0} ${y1}`}
    V ${y0 + leftR}
    ${leftR ? `Q ${x0} ${y0} ${x0 + leftR} ${y0}` : `L ${x0} ${y0}`}
    Z
  `
}

function getNodePath(node: LayoutNode) {
    const { x0, x1, y0, y1 } = getNodeBounds(node)

    switch (node.type) {
        case 'income-source':
            return roundedRectSelectivePath(x0, y0, x1, y1, {
                roundLeft: true,
                roundRight: false,
                radius: 3,
            })
        case 'income-total':
        case 'expense-total':
            return roundedRectSelectivePath(x0, y0, x1, y1, {
                roundLeft: false,
                roundRight: false,
                radius: 0,
            })
        case 'available':
            return roundedRectSelectivePath(x0, y0, x1, y1, {
                roundLeft: false,
                roundRight: true,
                radius: 3,
            })
        case 'deficit':
            return roundedRectSelectivePath(x0, y0, x1, y1, {
                roundLeft: false,
                roundRight: false,
                radius: 0,
            })
        case 'credit-card-source':
            return roundedRectSelectivePath(x0, y0, x1, y1, {
                roundLeft: false,
                roundRight: false,
                radius: 0,
            })
        case 'expense-category':
            return roundedRectSelectivePath(x0, y0, x1, y1, {
                roundLeft: false,
                roundRight: true,
                radius: 3,
            })
        default:
            return roundedRectSelectivePath(x0, y0, x1, y1, {
                roundLeft: false,
                roundRight: false,
                radius: 0,
            })
    }
}

function getLinkPath(link: LayoutLink) {
    return sankeyLinkHorizontal()(link) ?? ''
}

function getLinkGradientCoords(link: LayoutLink) {
    const source = link.source as LayoutNode
    const target = link.target as LayoutNode

    return {
        x1: source.x1 ?? 0,
        x2: target.x0 ?? 0,
        y1: 0,
        y2: 0,
    }
}

function buildActiveFromNode(
    node: LayoutNode,
    totals: { income: number; expense: number; available: number; deficit: number },
): ActiveInfo {
    const amount = node.value ?? 0
    const percentOfIncome = totals.income > 0 ? (amount / totals.income) * 100 : 0
    const percentOfExpense =
        (node.type === 'expense-category' || node.type === 'credit-card-source') && totals.expense > 0
            ? (amount / totals.expense) * 100
            : undefined

    const { x0, x1, y0, y1 } = getNodeBounds(node)

    return {
        title: node.name ?? '',
        amount,
        percentOfIncome,
        percentOfExpense,
        x: (x0 + x1) / 2,
        y: (y0 + y1) / 2,
    }
}

function buildActiveFromLink(
    link: LayoutLink,
    totals: { income: number; expense: number; available: number; deficit: number },
): ActiveInfo {
    const source = link.source as LayoutNode
    const target = link.target as LayoutNode
    const amount = link.value ?? 0

    const percentOfIncome = totals.income > 0 ? (amount / totals.income) * 100 : 0

    let percentOfExpense: number | undefined
    if (target.type === 'expense-category' || target.id === 'expense-total') {
        percentOfExpense = totals.expense > 0 ? (amount / totals.expense) * 100 : 0
    }

    return {
        title: `${source.name} → ${target.name}`,
        amount,
        percentOfIncome,
        percentOfExpense,
        x: ((source.x1 ?? 0) + (target.x0 ?? 0)) / 2,
        y: ((link.y0 ?? 0) + (link.y1 ?? 0)) / 2,
    }
}

function SankeyTooltip({
                           active,
                           onClose,
                           containerWidth,
                           containerHeight,
                           currency,
                       }: {
    active: ActiveInfo | null
    onClose: () => void
    containerWidth: number
    containerHeight: number
    currency: 'ARS' | 'USD'
}) {
    if (!active) return null

    const left = Math.min(
        Math.max(active.x, TOOLTIP_WIDTH / 2 + TOOLTIP_MARGIN),
        Math.max(
            TOOLTIP_WIDTH / 2 + TOOLTIP_MARGIN,
            containerWidth - TOOLTIP_WIDTH / 2 - TOOLTIP_MARGIN,
        ),
    )

    const showBelow = active.y < 58
    const preferredTop = showBelow ? active.y + 12 : active.y - 12
    const correctedTop = showBelow
        ? Math.min(preferredTop, containerHeight - 96)
        : Math.max(preferredTop, 12)

    return (
        <>
            <button
                type="button"
                aria-label="Cerrar detalle"
                className="fixed inset-0 z-10 bg-transparent"
                onClick={onClose}
            />

            <div
                className="pointer-events-none absolute z-20 w-56 rounded-xl border p-3 shadow-lg"
                style={{
                    left,
                    top: correctedTop,
                    transform: showBelow ? 'translate(-50%, 0%)' : 'translate(-50%, -100%)',
                    background: 'var(--card)',
                    borderColor: 'var(--border)',
                    fontFamily: 'inherit',
                }}
            >
                <p className="mb-1 text-sm font-semibold text-foreground">{active.title}</p>
                <p className="text-sm font-medium text-foreground">{formatMoney(active.amount, currency)}</p>

                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {typeof active.percentOfIncome === 'number' && (
                        <p>{formatPercent(active.percentOfIncome)} de ingresos</p>
                    )}
                    {typeof active.percentOfExpense === 'number' && (
                        <p>{formatPercent(active.percentOfExpense)} de gastos</p>
                    )}
                </div>
            </div>
        </>
    )
}

function MobileLegend({
                          title,
                          items,
                          totals,
                          onSelect,
                          currency,
                      }: {
    title: string
    items: SankeyItem[]
    totals: { income: number; expense: number; available: number; deficit: number }
    onSelect: (info: ActiveInfo) => void
    currency: 'ARS' | 'USD'
}) {
    return (
        <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {title}
            </p>

            <div className="flex flex-wrap gap-x-3 gap-y-2">
                {items.map((item, index) => {
                    const percentOfIncome = totals.income > 0 ? (item.amount / totals.income) * 100 : 0
                    const percentOfExpense =
                        title === 'Gastos' && totals.expense > 0 ? (item.amount / totals.expense) * 100 : undefined

                    return (
                        <button
                            key={`${title}-${item.name}-${index}`}
                            type="button"
                            className="flex items-center gap-1.5"
                            onClick={() =>
                                onSelect({
                                    title: item.name,
                                    amount: item.amount,
                                    percentOfIncome,
                                    percentOfExpense,
                                    x: 112,
                                    y: 24,
                                })
                            }
                        >
              <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
              />
                            <span
                                className="text-[11px]"
                                style={{ color: getReadableAccent(item.color) }}
                            >
                {truncate(item.name, 18)} · {formatCompactMoney(item.amount, currency)}
              </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function SankeyDiagram({ data }: { data: SankeyApiData }) {
    const { ref: containerRef, width } = useElementWidth<HTMLDivElement>()
    const [active, setActive] = useState<ActiveInfo | null>(null)

    const graph = useMemo(() => buildGraph(data), [data])
    const isMobile = width > 0 && width < MOBILE_BREAKPOINT

    const layout = useMemo(() => {
        if (!width) return null
        return isMobile ? buildMobileLayout(graph, width) : buildDesktopLayout(graph, width)
    }, [graph, isMobile, width])

    if (!layout) {
        return (
            <div ref={containerRef} className="relative w-full">
                <div className="h-72 md:h-96" />
            </div>
        )
    }

    const mobileVisibleLabels = new Set([
        'income-total',
        'expense-total',
        graph.hasDeficit ? 'deficit' : 'available',
        ...graph.nodes
            .filter((n) => n.type === 'credit-card-source')
            .map((n) => String(n.id)),
    ])

    return (
        <div ref={containerRef} className="relative w-full">
            <svg
                width="100%"
                height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="block"
            >
                <defs>
                    {layout.links.map((link, i) => {
                        const source = link.source as LayoutNode
                        const target = link.target as LayoutNode
                        const coords = getLinkGradientCoords(link)

                        return (
                            <linearGradient
                                key={`gradient-${i}`}
                                id={`gradient-${i}`}
                                gradientUnits="userSpaceOnUse"
                                x1={coords.x1}
                                x2={coords.x2}
                                y1={coords.y1}
                                y2={coords.y2}
                            >
                                <stop offset="0%" stopColor={source.color} stopOpacity={isMobile ? 0.22 : 0.2} />
                                <stop offset="100%" stopColor={target.color} stopOpacity={isMobile ? 0.22 : 0.2} />
                            </linearGradient>
                        )
                    })}
                </defs>

                <g>
                    {layout.links.map((link, i) => {
                        const path = getLinkPath(link)

                        return (
                            <g key={`link-${i}`}>
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={`url(#gradient-${i})`}
                                    strokeWidth={Math.max(1, link.width ?? 1)}
                                    opacity={1}
                                />

                                <path
                                    d={path}
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth={Math.max(18, (link.width ?? 1) + 14)}
                                    style={{ cursor: isMobile ? 'pointer' : 'default' }}
                                    onClick={() => {
                                        if (!isMobile) return
                                        setActive(buildActiveFromLink(link, graph.totals))
                                    }}
                                />
                            </g>
                        )
                    })}
                </g>

                <g>
                    {layout.nodes.map((node) => {
                        const showDesktopLabels = !isMobile
                        const showMobileLabel = mobileVisibleLabels.has(String(node.id))
                        const bounds = getNodeBounds(node)

                        return (
                            <g key={node.id}>
                                <path
                                    d={getNodePath(node)}
                                    fill={node.color}
                                    style={{ cursor: isMobile ? 'pointer' : 'default' }}
                                    onClick={() => {
                                        if (!isMobile) return
                                        setActive(buildActiveFromNode(node, graph.totals))
                                    }}
                                />

                                {showDesktopLabels && node.type === 'income-source' && (
                                    <text
                                        x={bounds.x0 - 8}
                                        y={(bounds.y0 + bounds.y1) / 2}
                                        textAnchor="end"
                                        dominantBaseline="middle"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        <tspan fontSize={11} fill="var(--muted-foreground)">
                                            {truncate(node.name ?? '', 22)}
                                        </tspan>
                                        <tspan
                                            x={bounds.x0 - 8}
                                            dy="1.25em"
                                            fontSize={11}
                                            fontWeight={600}
                                            fill={getReadableAccent(node.color)}
                                        >
                                            {formatCompactMoney(node.value ?? 0, data.currency)}
                                        </tspan>
                                    </text>
                                )}

                                {showDesktopLabels && node.type === 'income-total' && (
                                    <text
                                        x={(bounds.x0 + bounds.x1) / 2}
                                        y={bounds.y0 - 22}
                                        textAnchor="middle"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        <tspan fontSize={11} fill="var(--muted-foreground)">
                                            {node.name}
                                        </tspan>
                                        <tspan
                                            x={(bounds.x0 + bounds.x1) / 2}
                                            dy="1.2em"
                                            fontSize={12}
                                            fontWeight={600}
                                            fill={getReadableAccent(node.color)}
                                        >
                                            {formatCompactMoney(node.value ?? 0, data.currency)}
                                        </tspan>
                                    </text>
                                )}

                                {showDesktopLabels && node.type === 'expense-total' && (
                                    <text
                                        x={(bounds.x0 + bounds.x1) / 2}
                                        y={bounds.y0 - 14}
                                        textAnchor="middle"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        <tspan fontSize={11} fill="var(--muted-foreground)">
                                            {node.name}
                                        </tspan>
                                        <tspan
                                            x={(bounds.x0 + bounds.x1) / 2}
                                            dy="1.2em"
                                            fontSize={12}
                                            fontWeight={600}
                                            fill={getReadableAccent(node.color)}
                                        >
                                            {formatCompactMoney(node.value ?? 0, data.currency)}
                                        </tspan>
                                    </text>
                                )}

                                {showDesktopLabels && node.type === 'available' && (
                                    <text
                                        x={(bounds.x0 + bounds.x1) / 2}
                                        y={bounds.y0 - 14}
                                        textAnchor="middle"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        <tspan fontSize={11} fill="var(--muted-foreground)">
                                            {node.name}
                                        </tspan>
                                        <tspan
                                            x={(bounds.x0 + bounds.x1) / 2}
                                            dy="1.2em"
                                            fontSize={12}
                                            fontWeight={600}
                                            fill={getReadableAccent(node.color)}
                                        >
                                            {formatCompactMoney(node.value ?? 0, data.currency)}
                                        </tspan>
                                    </text>
                                )}

                                {showDesktopLabels && node.type === 'deficit' && (
                                    <text
                                        x={(bounds.x0 + bounds.x1) / 2}
                                        y={bounds.y0 - 14}
                                        textAnchor="middle"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        <tspan fontSize={11} fill="var(--muted-foreground)">
                                            {node.name}
                                        </tspan>
                                        <tspan
                                            x={(bounds.x0 + bounds.x1) / 2}
                                            dy="1.2em"
                                            fontSize={12}
                                            fontWeight={600}
                                            fill={getReadableAccent(node.color)}
                                        >
                                            {formatCompactMoney(node.value ?? 0, data.currency)}
                                        </tspan>
                                    </text>
                                )}

                                {showDesktopLabels && node.type === 'credit-card-source' && (
                                    <text
                                        x={(bounds.x0 + bounds.x1) / 2}
                                        y={bounds.y0 - 14}
                                        textAnchor="middle"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        <tspan fontSize={11} fill="var(--muted-foreground)">
                                            {truncate(node.name ?? '', 18)}
                                        </tspan>
                                        <tspan
                                            x={(bounds.x0 + bounds.x1) / 2}
                                            dy="1.2em"
                                            fontSize={11}
                                            fontWeight={600}
                                            fill={getReadableAccent(node.color)}
                                        >
                                            {formatCompactMoney(node.value ?? 0, data.currency)}
                                        </tspan>
                                    </text>
                                )}

                                {showDesktopLabels && node.type === 'expense-category' && (
                                    <text
                                        x={bounds.x1 + 10}
                                        y={(bounds.y0 + bounds.y1) / 2}
                                        textAnchor="start"
                                        dominantBaseline="middle"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        <tspan fontSize={11} fill="var(--muted-foreground)">
                                            {truncate(node.name ?? '', 22)}
                                        </tspan>
                                        <tspan
                                            x={bounds.x1 + 10}
                                            dy="1.25em"
                                            fontSize={11}
                                            fontWeight={600}
                                            fill={getReadableAccent(node.color)}
                                        >
                                            {formatCompactMoney(node.value ?? 0, data.currency)}
                                        </tspan>
                                    </text>
                                )}

                                {isMobile && showMobileLabel && (
                                    <text
                                        x={(bounds.x0 + bounds.x1) / 2}
                                        y={
                                            node.type === 'available' || node.type === 'deficit'
                                                ? bounds.y1 + 14
                                                : bounds.y0 - 9
                                        }
                                        textAnchor="middle"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        <tspan fontSize={10.5} fill="var(--muted-foreground)">
                                            {truncate(node.name ?? '', 16)}
                                        </tspan>
                                    </text>
                                )}
                            </g>
                        )
                    })}
                </g>
            </svg>

            {isMobile && (
                <>
                    <div className="mt-5 space-y-3">
                        <MobileLegend
                            title="Ingresos"
                            items={graph.legends.income}
                            totals={graph.totals}
                            onSelect={setActive}
                            currency={data.currency}
                        />
                        <MobileLegend
                            title="Gastos"
                            items={graph.legends.expense}
                            totals={graph.totals}
                            onSelect={setActive}
                            currency={data.currency}
                        />
                        {graph.legends.creditCards.length > 0 && (
                            <MobileLegend
                                title="Tarjetas (deuda pendiente)"
                                items={graph.legends.creditCards}
                                totals={graph.totals}
                                onSelect={setActive}
                                currency={data.currency}
                            />
                        )}
                    </div>

                    <SankeyTooltip
                        active={active}
                        onClose={() => setActive(null)}
                        containerWidth={layout.width}
                        containerHeight={layout.height + 120}
                        currency={data.currency}
                    />
                </>
            )}
        </div>
    )
}

export function SankeyChart({ month }: { month?: string }) {
    const [months, setMonths] = useState(1)
    const [data, setData] = useState<SankeyApiData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)

                const query = month ? `month=${month}&currency=ARS` : `months=${months}&currency=ARS`
                const response = await fetch(`/api/sankey?${query}`)
                const json = await response.json()

                if (!response.ok) {
                    setData(null)
                    return
                }

                setData(json)
            } catch {
                setData(null)
            } finally {
                setLoading(false)
            }
        }

        void fetchData()
    }, [month, months])

    return (
        <div
            className="rounded-2xl p-4 md:p-5"
            style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                fontFamily: 'inherit',
            }}
        >
            <div className="mb-4 flex items-start justify-between gap-3 md:mb-5">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Flujo de dinero
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        {month ? 'Mes seleccionado' : 'Últimos meses, incluido el actual'}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {!month && (
                        <div
                            className="flex w-fit shrink-0 overflow-hidden rounded-lg"
                            style={{ border: '1px solid var(--border)' }}
                        >
                            {MONTH_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setMonths(option.value)}
                                    className="px-3 py-1.5 text-xs font-medium transition-colors"
                                    style={{
                                        background: months === option.value ? 'var(--sky)' : 'transparent',
                                        color: months === option.value ? '#FFFFFF' : 'var(--muted-foreground)',
                                        borderRight:
                                            option.value !== MONTH_OPTIONS[MONTH_OPTIONS.length - 1].value
                                                ? '1px solid var(--border)'
                                                : 'none',
                                    }}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <Skeleton className="h-72 w-full rounded-xl md:h-96" />
                    </motion.div>
                ) : !data || (data.income.length === 0 && data.expenses.length === 0) ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex h-72 items-center justify-center md:h-96"
                    >
                        <p className="text-sm text-muted-foreground">Sin datos para mostrar</p>
                    </motion.div>
                ) : (
                    <motion.div
                        key={`sankey-${month ?? months}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        <SankeyDiagram data={data} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
