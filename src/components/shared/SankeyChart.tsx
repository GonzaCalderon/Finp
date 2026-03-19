'use client'

import { useState, useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey'
import { Skeleton } from '@/components/ui/skeleton'

interface SankeyData {
    income: { name: string; amount: number; color: string }[]
    expenses: { name: string; amount: number; color: string }[]
    totalIncome: number
    totalExpense: number
    balance: number
}

const MONTH_OPTIONS = [
    { value: 1, label: '1M' },
    { value: 3, label: '3M' },
    { value: 6, label: '6M' },
]

export function SankeyChart() {
    const [months, setMonths] = useState(1)
    const [data, setData] = useState<SankeyData | null>(null)
    const [loading, setLoading] = useState(true)
    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const res = await fetch(`/api/sankey?months=${months}`)
                const json = await res.json()
                if (res.ok) setData(json)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [months])

    useEffect(() => {
        if (!data || !svgRef.current) return

        const svg = d3.select(svgRef.current)
        svg.selectAll('*').remove()

        const width = svgRef.current.clientWidth || 700
        const height = 320
        const padding = { top: 16, right: 180, bottom: 16, left: 160 }

        // Construir nodos y links
        const nodes: { name: string; color: string; type: string }[] = []
        const links: { source: number; target: number; value: number }[] = []

        // Nodos de ingresos (izquierda)
        data.income.forEach((inc) => {
            nodes.push({ name: inc.name, color: inc.color, type: 'income' })
        })

        // Nodo central "Cashflow"
        const cashflowIndex = nodes.length
        nodes.push({ name: 'Cashflow', color: 'var(--sky)', type: 'center' })

        // Nodos de gastos (derecha)
        const expenseStartIndex = nodes.length
        data.expenses.forEach((exp) => {
            nodes.push({ name: exp.name, color: exp.color, type: 'expense' })
        })

        // Nodo de superávit si hay balance positivo
        let surplusIndex = -1
        if (data.balance > 0) {
            surplusIndex = nodes.length
            nodes.push({ name: 'Superávit', color: '#10B981', type: 'surplus' })
        }

        // Links: ingresos → cashflow
        data.income.forEach((inc, i) => {
            links.push({ source: i, target: cashflowIndex, value: inc.amount })
        })

        // Links: cashflow → gastos
        data.expenses.forEach((exp, i) => {
            links.push({
                source: cashflowIndex,
                target: expenseStartIndex + i,
                value: exp.amount,
            })
        })

        // Link: cashflow → superávit
        if (surplusIndex !== -1 && data.balance > 0) {
            links.push({
                source: cashflowIndex,
                target: surplusIndex,
                value: data.balance,
            })
        }

        // Sankey layout
        const sankeyGenerator = sankey()
            .nodeWidth(12)
            .nodePadding(10)
            .nodeAlign(sankeyLeft)
            .extent([
                [padding.left, padding.top],
                [width - padding.right, height - padding.bottom],
            ])

        const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator({
            nodes: nodes.map((d, i) => ({ ...d, index: i })),
            links: links.map((d) => ({ ...d })),
        })

        const g = svg.append('g')

        // Links
        g.append('g')
            .selectAll('path')
            .data(sankeyLinks)
            .join('path')
            .attr('d', sankeyLinkHorizontal())
            .attr('fill', 'none')
            .attr('stroke', (d) => {
                const sourceNode = d.source as { color: string }
                return sourceNode.color || '#9CA3AF'
            })
            .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
            .attr('opacity', 0.25)

        // Nodos
        g.append('g')
            .selectAll('rect')
            .data(sankeyNodes)
            .join('rect')
            .attr('x', (d) => d.x0 ?? 0)
            .attr('y', (d) => d.y0 ?? 0)
            .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
            .attr('height', (d) => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
            .attr('fill', (d) => (d as { color: string }).color || '#9CA3AF')
            .attr('rx', 3)

        const fmt = (v: number) =>
            new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
                maximumFractionDigits: 0,
                notation: 'compact',
            }).format(v)

        // Labels izquierda (ingresos)
        g.append('g')
            .selectAll('text.left-label')
            .data(sankeyNodes.filter((d) => (d as { type: string }).type === 'income'))
            .join('text')
            .attr('class', 'left-label')
            .attr('x', (d) => (d.x0 ?? 0) - 8)
            .attr('y', (d) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .each(function (d) {
                const el = d3.select(this)
                const node = d as { name: string; value?: number; color: string }
                el.append('tspan')
                    .text(node.name)
                    .attr('x', (d.x0 ?? 0) - 8)
                    .attr('dy', '-0.6em')
                    .attr('font-size', '11')
                    .attr('fill', 'var(--muted-foreground)')
                el.append('tspan')
                    .text(fmt(node.value ?? 0))
                    .attr('x', (d.x0 ?? 0) - 8)
                    .attr('dy', '1.2em')
                    .attr('font-size', '11')
                    .attr('font-weight', '500')
                    .attr('fill', node.color)
            })

        // Label central (Cashflow)
        g.append('g')
            .selectAll('text.center-label')
            .data(sankeyNodes.filter((d) => (d as { type: string }).type === 'center'))
            .join('text')
            .attr('class', 'center-label')
            .attr('x', (d) => ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2)
            .attr('y', (d) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2 - 20)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .each(function (d) {
                const el = d3.select(this)
                const node = d as { name: string; value?: number }
                el.append('tspan')
                    .text(node.name)
                    .attr('x', ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2)
                    .attr('dy', '0')
                    .attr('font-size', '11')
                    .attr('fill', 'var(--muted-foreground)')
                el.append('tspan')
                    .text(fmt(node.value ?? 0))
                    .attr('x', ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2)
                    .attr('dy', '1.4em')
                    .attr('font-size', '12')
                    .attr('font-weight', '500')
                    .attr('fill', 'var(--sky)')
            })

        // Labels derecha (gastos + superávit)
        g.append('g')
            .selectAll('text.right-label')
            .data(sankeyNodes.filter((d) => {
                const type = (d as { type: string }).type
                return type === 'expense' || type === 'surplus'
            }))
            .join('text')
            .attr('class', 'right-label')
            .attr('x', (d) => (d.x1 ?? 0) + 8)
            .attr('y', (d) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .each(function (d) {
                const el = d3.select(this)
                const node = d as { name: string; value?: number; color: string }
                el.append('tspan')
                    .text(node.name)
                    .attr('x', (d.x1 ?? 0) + 8)
                    .attr('dy', '-0.6em')
                    .attr('font-size', '11')
                    .attr('fill', 'var(--muted-foreground)')
                el.append('tspan')
                    .text(fmt(node.value ?? 0))
                    .attr('x', (d.x1 ?? 0) + 8)
                    .attr('dy', '1.2em')
                    .attr('font-size', '11')
                    .attr('font-weight', '500')
                    .attr('fill', node.color)
            })

    }, [data])

    return (
        <div
            className="rounded-xl p-5"
            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
        >
            <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Flujo de dinero
                </p>
                <div
                    className="flex rounded-md overflow-hidden"
                    style={{ border: '0.5px solid var(--border)' }}
                >
                    {MONTH_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setMonths(opt.value)}
                            className="px-3 py-1 text-xs transition-colors"
                            style={{
                                background: months === opt.value ? 'var(--sky)' : 'transparent',
                                color: months === opt.value ? '#FFFFFF' : 'var(--muted-foreground)',
                                borderRight: opt.value !== 6 ? '0.5px solid var(--border)' : 'none',
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Skeleton className="h-80 w-full rounded-lg" />
            ) : !data || (data.income.length === 0 && data.expenses.length === 0) ? (
                <div className="h-80 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Sin datos para mostrar</p>
                </div>
            ) : (
                <svg
                    ref={svgRef}
                    width="100%"
                    height="320"
                    style={{ overflow: 'visible' }}
                />
            )}
        </div>
    )
}