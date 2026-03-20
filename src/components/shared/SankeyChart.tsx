'use client'

import { useState, useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey'
import { Skeleton } from '@/components/ui/skeleton'
import { motion, AnimatePresence } from 'framer-motion'

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

function SankeyDiagram({ data }: { data: SankeyData }) {
    const svgRef = useRef<SVGSVGElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return

        const svg = d3.select(svgRef.current)
        svg.selectAll('*').remove()

        const style = getComputedStyle(containerRef.current)
        const mutedColor = style.getPropertyValue('--muted-foreground').trim() || '#6B7280'
        const cashflowColor = data.balance >= 0 ? '#10B981' : '#EF4444'
        const hasDeficit = data.totalExpense > data.totalIncome
        const deficitAmount = hasDeficit ? data.totalExpense - data.totalIncome : 0

        const width = containerRef.current.clientWidth || 700
        const height = 400

        const padding = {
            top: 48,
            right: 110,
            bottom: 16,
            left: 80,
        }

        const nodes: { name: string; color: string; type: string }[] = []
        const links: { source: number; target: number; value: number }[] = []

        // Nodos de ingresos
        data.income.forEach((inc) => {
            nodes.push({ name: inc.name, color: inc.color, type: 'income' })
        })

        // Nodo déficit si gastos > ingresos
        const deficitIndex = hasDeficit ? nodes.length : -1
        if (hasDeficit) {
            nodes.push({ name: 'Déficit', color: '#EF4444', type: 'income' })
        }

        // Nodo cashflow
        const cashflowIndex = nodes.length
        nodes.push({ name: 'Cashflow', color: cashflowColor, type: 'center' })

        // Nodos de gastos
        const expenseStartIndex = nodes.length
        data.expenses.forEach((exp) => {
            nodes.push({ name: exp.name, color: exp.color, type: 'expense' })
        })

        // Links: ingresos → cashflow
        data.income.forEach((inc, i) => {
            links.push({ source: i, target: cashflowIndex, value: inc.amount })
        })

        // Link: déficit → cashflow
        if (hasDeficit && deficitIndex !== -1) {
            links.push({ source: deficitIndex, target: cashflowIndex, value: deficitAmount })
        }

        // Links: cashflow → gastos
        data.expenses.forEach((exp, i) => {
            links.push({ source: cashflowIndex, target: expenseStartIndex + i, value: exp.amount })
        })

        const sankeyGenerator = sankey()
            .nodeWidth(10)
            .nodePadding(20)
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

        // Gradientes por link
        const defs = svg.append('defs')

        sankeyLinks.forEach((link, i) => {
            const sourceNode = link.source as { color: string; x0?: number; x1?: number }
            const targetNode = link.target as { color: string; x0?: number; x1?: number }
            const gradientId = `gradient-${i}`

            const gradient = defs.append('linearGradient')
                .attr('id', gradientId)
                .attr('gradientUnits', 'userSpaceOnUse')
                .attr('x1', sourceNode.x1 ?? 0)
                .attr('x2', targetNode.x0 ?? 0)

            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', sourceNode.color || '#9CA3AF')
                .attr('stop-opacity', 0.3)

            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', targetNode.color || '#9CA3AF')
                .attr('stop-opacity', 0.3)
        })

        // Links
        g.append('g')
            .selectAll('path')
            .data(sankeyLinks)
            .join('path')
            .attr('d', sankeyLinkHorizontal())
            .attr('fill', 'none')
            .attr('stroke', (_, i) => `url(#gradient-${i})`)
            .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
            .attr('opacity', 1)

        // Nodos con redondeo selectivo
        sankeyNodes.forEach((d) => {
            const x0 = d.x0 ?? 0
            const y0 = d.y0 ?? 0
            const x1 = d.x1 ?? 0
            const y1 = Math.max(y0 + 1, d.y1 ?? 0)
            const w = x1 - x0
            const h = y1 - y0
            const r = Math.min(4, w / 2, h / 2)
            const type = (d as { type: string }).type
            const color = (d as { color: string }).color || '#9CA3AF'

            let path = ''
            if (type === 'income') {
                path = `M${x0 + r},${y0} H${x1} V${y1} H${x0 + r} Q${x0},${y1} ${x0},${y1 - r} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} Z`
            } else if (type === 'expense') {
                path = `M${x0},${y0} H${x1 - r} Q${x1},${y0} ${x1},${y0 + r} V${y1 - r} Q${x1},${y1} ${x1 - r},${y1} H${x0} V${y0} Z`
            } else {
                path = `M${x0},${y0} H${x1} V${y1} H${x0} Z`
            }

            g.append('path').attr('d', path).attr('fill', color)
        })

        const fmt = (v: number) =>
            new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
                maximumFractionDigits: 0,
                notation: 'compact',
            }).format(v)

        // Labels izquierda (ingresos + déficit)
        g.append('g')
            .selectAll('text.left-label')
            .data(sankeyNodes.filter((d) => (d as { type: string }).type === 'income'))
            .join('text')
            .attr('class', 'left-label')
            .attr('x', (d) => (d.x0 ?? 0) - 10)
            .attr('y', (d) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .each(function (d) {
                const el = d3.select(this)
                const node = d as { name: string; value?: number; color: string }
                el.append('tspan').text(node.name)
                    .attr('x', (d.x0 ?? 0) - 10).attr('dy', '-0.7em')
                    .attr('font-size', '11').attr('fill', mutedColor)
                el.append('tspan').text(fmt(node.value ?? 0))
                    .attr('x', (d.x0 ?? 0) - 10).attr('dy', '1.4em')
                    .attr('font-size', '11').attr('font-weight', '500').attr('fill', node.color)
            })

        // Label central (Cashflow)
        g.append('g')
            .selectAll('text.center-label')
            .data(sankeyNodes.filter((d) => (d as { type: string }).type === 'center'))
            .join('text')
            .attr('class', 'center-label')
            .attr('x', (d) => ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2)
            .attr('y', (d) => (d.y0 ?? 0) - 22)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'auto')
            .each(function (d) {
                const el = d3.select(this)
                el.append('tspan').text('Cashflow')
                    .attr('x', ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2).attr('dy', '0')
                    .attr('font-size', '11').attr('fill', mutedColor)
                el.append('tspan').text(fmt(data.totalExpense))
                    .attr('x', ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2).attr('dy', '1.4em')
                    .attr('font-size', '12').attr('font-weight', '500').attr('fill', cashflowColor)
            })

        // Labels derecha (gastos)
        g.append('g')
            .selectAll('text.right-label')
            .data(sankeyNodes.filter((d) => (d as { type: string }).type === 'expense'))
            .join('text')
            .attr('class', 'right-label')
            .attr('x', (d) => (d.x1 ?? 0) + 10)
            .attr('y', (d) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .each(function (d) {
                const el = d3.select(this)
                const node = d as { name: string; value?: number; color: string }
                el.append('tspan').text(node.name)
                    .attr('x', (d.x1 ?? 0) + 10).attr('dy', '-0.7em')
                    .attr('font-size', '11').attr('fill', mutedColor)
                el.append('tspan').text(fmt(node.value ?? 0))
                    .attr('x', (d.x1 ?? 0) + 10).attr('dy', '1.4em')
                    .attr('font-size', '11').attr('font-weight', '500').attr('fill', node.color)
            })

    }, [data])

    return (
        <div ref={containerRef} style={{ width: '100%' }}>
            <svg ref={svgRef} width="100%" height="400" style={{ overflow: 'visible' }} />
        </div>
    )
}

export function SankeyChart() {
    const [months, setMonths] = useState(1)
    const [data, setData] = useState<SankeyData | null>(null)
    const [loading, setLoading] = useState(true)

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

    return (
        <div
            className="rounded-xl p-5"
            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
        >
            <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Flujo de dinero
                </p>
                <div className="flex rounded-md overflow-hidden"
                     style={{ border: '0.5px solid var(--border)' }}>
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

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                        <Skeleton className="h-[400px] w-full rounded-lg" />
                    </motion.div>
                ) : !data || (data.income.length === 0 && data.expenses.length === 0) ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                                className="h-[400px] flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Sin datos para mostrar</p>
                    </motion.div>
                ) : (
                    <motion.div key={`sankey-${months}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                        <SankeyDiagram data={data} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}