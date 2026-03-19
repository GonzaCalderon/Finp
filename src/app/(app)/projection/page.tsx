'use client'

import { useState, useEffect, useRef } from 'react'
import {AnimatePresence, motion} from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { fadeIn } from '@/lib/utils/animations'
import { Skeleton } from '@/components/ui/skeleton'

const USD_TO_ARS = 1450

const MONTH_NAMES: Record<string, string> = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
}

const formatMonth = (month: string) => {
    const [, m] = month.split('-')
    return MONTH_NAMES[m]
}

const fmt = (amount: number) =>
    new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
    }).format(amount)

interface InstallmentItem {
    description: string
    installmentAmount: number
    currency: string
    amountARS: number
    currentInstallment: number
    installmentCount: number
}

interface InstallmentByAccount {
    accountId: string
    accountName: string
    items: InstallmentItem[]
    totalARS: number
}

interface CommitmentItem {
    _id: string
    description: string
    amount: number
    currency: string
    amountARS: number
    dayOfMonth?: number
}

interface MonthProjection {
    month: string
    isCurrentMonth: boolean
    isPast: boolean
    commitments: CommitmentItem[]
    installmentsByAccount: InstallmentByAccount[]
    totalCommitmentsARS: number
    totalInstallmentsARS: number
    totalARS: number
}

const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
const MONTH_OPTIONS = [1, 3, 6, 9, 12]

type Mode = 'annual' | 'monthly'

function ModeToggle({
                        mode, setMode, year, setYear, months, setMonths,
                    }: {
    mode: Mode
    setMode: (m: Mode) => void
    year: number
    setYear: (y: number) => void
    months: number
    setMonths: (m: number) => void
}) {
    const [annualOpen, setAnnualOpen] = useState(false)
    const [monthlyOpen, setMonthlyOpen] = useState(false)
    const annualRef = useRef<HTMLDivElement>(null)
    const monthlyRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (annualRef.current && !annualRef.current.contains(e.target as Node)) setAnnualOpen(false)
            if (monthlyRef.current && !monthlyRef.current.contains(e.target as Node)) setMonthlyOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div className="flex gap-2">
            <div className="relative" ref={annualRef}>
                <button
                    onClick={() => { setMode('annual'); setAnnualOpen((p) => !p); setMonthlyOpen(false) }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors"
                    style={{
                        background: mode === 'annual' ? 'var(--sky)' : 'transparent',
                        color: mode === 'annual' ? '#FFFFFF' : 'var(--muted-foreground)',
                        borderColor: mode === 'annual' ? 'var(--sky)' : 'var(--border)',
                    }}
                >
                    Vista Anual
                    <ChevronDown size={14} className={annualOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {annualOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 rounded-lg overflow-y-auto max-h-48 w-32 shadow-sm"
                         style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                        {YEARS.map((y) => (
                            <button key={y} onClick={() => { setYear(y); setAnnualOpen(false) }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                                    style={{ color: y === year ? 'var(--sky)' : 'var(--foreground)', fontWeight: y === year ? 500 : 400 }}>
                                {y}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative" ref={monthlyRef}>
                <button
                    onClick={() => { setMode('monthly'); setMonthlyOpen((p) => !p); setAnnualOpen(false) }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors"
                    style={{
                        background: mode === 'monthly' ? 'var(--sky)' : 'transparent',
                        color: mode === 'monthly' ? '#FFFFFF' : 'var(--muted-foreground)',
                        borderColor: mode === 'monthly' ? 'var(--sky)' : 'var(--border)',
                    }}
                >
                    Proyección Mensual
                    <ChevronDown size={14} className={monthlyOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {monthlyOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 rounded-lg w-40 shadow-sm"
                         style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                        {MONTH_OPTIONS.map((m) => (
                            <button key={m} onClick={() => { setMonths(m); setMonthlyOpen(false) }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                                    style={{ color: m === months ? 'var(--sky)' : 'var(--foreground)', fontWeight: m === months ? 500 : 400 }}>
                                {m === 1 ? '1 mes' : `${m} meses`}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function ExpandableRow({
                           label, totalARS, children, level = 0,
                       }: {
    label: string
    totalARS: number
    children?: React.ReactNode
    level?: number
}) {
    const [open, setOpen] = useState(false)
    const hasChildren = !!children

    return (
        <div>
            <button
                onClick={() => hasChildren && setOpen((p) => !p)}
                className="w-full flex items-center justify-between py-2 text-sm transition-colors rounded-md px-2"
                style={{
                    cursor: hasChildren ? 'pointer' : 'default',
                    paddingLeft: level === 1 ? 24 : level === 2 ? 40 : 8,
                }}
            >
        <span className="flex items-center gap-2">
          <motion.span
              animate={{ rotate: open && hasChildren ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex' }}
          >
            {hasChildren
                ? <ChevronRight size={12} />
                : <span className="w-3" />}
          </motion.span>
          <span style={{
              color: level === 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
              fontWeight: level === 0 ? 500 : 400,
              fontSize: 13,
          }}>
            {label}
          </span>
        </span>
                <span className="text-sm tabular-nums"
                      style={{ color: totalARS > 0 ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
          {totalARS > 0 ? fmt(totalARS) : '—'}
        </span>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.0, 0.0, 0.2, 1.0] }}
                        style={{ overflow: 'hidden' }}
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function ProjectionPage() {
    const [mode, setMode] = useState<Mode>('annual')
    const [year, setYear] = useState(currentYear)
    const [months, setMonths] = useState(3)
    const [projection, setProjection] = useState<MonthProjection[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchProjection = async () => {
            try {
                setLoading(true)
                const params = new URLSearchParams({ mode })
                if (mode === 'annual') params.set('year', year.toString())
                else params.set('months', months.toString())
                const res = await fetch(`/api/projection?${params}`)
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setProjection(data.projection)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al cargar proyección')
            } finally {
                setLoading(false)
            }
        }
        fetchProjection()
    }, [mode, year, months])

    const maxTotal = Math.max(...projection.map((p) => p.totalARS), 1)

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>

    return (
        <motion.div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" {...fadeIn}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Proyección</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        {mode === 'annual'
                            ? `Año ${year}`
                            : `Próximos ${months === 1 ? '1 mes' : `${months} meses`} desde hoy`}
                    </p>
                </div>
                <ModeToggle mode={mode} setMode={setMode} year={year} setYear={setYear} months={months} setMonths={setMonths} />
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
            ) : (
                <>
                    <div className="rounded-xl overflow-hidden"
                         style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                        <div className="grid grid-cols-4 gap-2 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"
                             style={{ borderBottom: '0.5px solid var(--border)' }}>
                            <span>Mes</span>
                            <span className="text-right">Compromisos</span>
                            <span className="text-right">Cuotas</span>
                            <span className="text-right font-semibold">Total</span>
                        </div>

                        {projection.map((row) => (
                            <div
                                key={row.month}
                                className="transition-colors"
                                style={{
                                    borderBottom: '0.5px solid var(--border)',
                                    background: row.isCurrentMonth ? 'rgba(74,158,204,0.05)' : 'transparent',
                                }}
                            >
                                <div className="grid grid-cols-4 gap-2 px-4 py-3 text-sm">
                  <span className="font-medium flex items-center gap-2"
                        style={{ color: row.isPast ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                    {formatMonth(row.month)}
                      {row.isCurrentMonth && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--sky-light)', color: 'var(--sky-dark)' }}>
                        hoy
                      </span>
                      )}
                  </span>
                                    <span className="text-right tabular-nums text-muted-foreground">
                    {row.totalCommitmentsARS > 0 ? fmt(row.totalCommitmentsARS) : '—'}
                  </span>
                                    <span className="text-right tabular-nums text-muted-foreground">
                    {row.totalInstallmentsARS > 0 ? fmt(row.totalInstallmentsARS) : '—'}
                  </span>
                                    <span className="text-right tabular-nums font-semibold">
                    {row.totalARS > 0 ? fmt(row.totalARS) : '—'}
                  </span>
                                </div>

                                <div className="px-4 pb-2">
                                    <div className="h-1 rounded-full overflow-hidden"
                                         style={{ background: 'var(--secondary)' }}>
                                        <div className="h-full rounded-full transition-all"
                                             style={{
                                                 width: `${(row.totalARS / maxTotal) * 100}%`,
                                                 background: 'var(--sky)',
                                                 opacity: row.isPast ? 0.4 : 1,
                                             }} />
                                    </div>
                                </div>

                                <div className="hidden md:block px-4 pb-3 space-y-0.5">
                                    {row.commitments.length > 0 && (
                                        <ExpandableRow label="Compromisos" totalARS={row.totalCommitmentsARS} level={0}>
                                            {row.commitments.map((c) => (
                                                <div key={c._id} className="flex items-center justify-between py-1.5 text-xs"
                                                     style={{ paddingLeft: 32, paddingRight: 8, color: 'var(--muted-foreground)' }}>
                          <span>
                            {c.description}
                              {c.dayOfMonth && <span className="opacity-60 ml-1">· día {c.dayOfMonth}</span>}
                              {c.currency === 'USD' && <span className="opacity-60 ml-1">(U$D {c.amount})</span>}
                          </span>
                                                    <span className="tabular-nums">{fmt(c.amountARS)}</span>
                                                </div>
                                            ))}
                                        </ExpandableRow>
                                    )}

                                    {row.installmentsByAccount.length > 0 && (
                                        <ExpandableRow label="Cuotas" totalARS={row.totalInstallmentsARS} level={0}>
                                            {row.installmentsByAccount.map((account) => (
                                                <ExpandableRow
                                                    key={account.accountId}
                                                    label={account.accountName}
                                                    totalARS={account.totalARS}
                                                    level={1}
                                                >
                                                    {account.items.map((item, i) => (
                                                        <div key={i} className="flex items-center justify-between py-1.5 text-xs"
                                                             style={{ paddingLeft: 48, paddingRight: 8, color: 'var(--muted-foreground)' }}>
                              <span>
                                {item.description}
                                  <span className="opacity-60 ml-1">{item.currentInstallment}/{item.installmentCount}</span>
                                  {item.currency === 'USD' && <span className="opacity-60 ml-1">(U$D {item.installmentAmount})</span>}
                              </span>
                                                            <span className="tabular-nums">{fmt(item.amountARS)}</span>
                                                        </div>
                                                    ))}
                                                </ExpandableRow>
                                            ))}
                                        </ExpandableRow>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl p-4"
                             style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Compromisos</p>
                            <p className="text-xl font-semibold tracking-tight">
                                {fmt(projection.reduce((sum, p) => sum + p.totalCommitmentsARS, 0))}
                            </p>
                        </div>
                        <div className="rounded-xl p-4"
                             style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Cuotas</p>
                            <p className="text-xl font-semibold tracking-tight">
                                {fmt(projection.reduce((sum, p) => sum + p.totalInstallmentsARS, 0))}
                            </p>
                        </div>
                        <div className="rounded-xl p-4"
                             style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--amber)' }}>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total proyectado</p>
                            <p className="text-xl font-semibold tracking-tight" style={{ color: 'var(--amber-dark)' }}>
                                {fmt(projection.reduce((sum, p) => sum + p.totalARS, 0))}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    )
}