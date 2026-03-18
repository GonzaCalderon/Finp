'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronRight } from 'lucide-react'

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

// Años disponibles: 2 atrás, actual, 2 adelante
const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
const MONTH_OPTIONS = [1, 3, 6, 9, 12]

type Mode = 'annual' | 'monthly'

function ModeToggle({
                        mode,
                        setMode,
                        year,
                        setYear,
                        months,
                        setMonths,
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

    // Cerrar al hacer click afuera
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
            {/* Vista Anual */}
            <div className="relative" ref={annualRef}>
                <button
                    onClick={() => {
                        setMode('annual')
                        setAnnualOpen((prev) => !prev)
                        setMonthlyOpen(false)
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors
            ${mode === 'annual'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'text-muted-foreground border-border hover:bg-muted'
                    }`}
                >
                    Vista Anual
                    <ChevronDown className={`h-4 w-4 transition-transform ${annualOpen ? 'rotate-180' : ''}`} />
                </button>

                {annualOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-background border rounded-md shadow-md overflow-y-auto max-h-48 w-36">
                        {YEARS.map((y) => (
                            <button
                                key={y}
                                onClick={() => {
                                    setYear(y)
                                    setAnnualOpen(false)
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors
                  ${y === year ? 'font-semibold text-primary' : ''}`}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Proyección Mensual */}
            <div className="relative" ref={monthlyRef}>
                <button
                    onClick={() => {
                        setMode('monthly')
                        setMonthlyOpen((prev) => !prev)
                        setAnnualOpen(false)
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors
            ${mode === 'monthly'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'text-muted-foreground border-border hover:bg-muted'
                    }`}
                >
                    Proyección Mensual
                    <ChevronDown className={`h-4 w-4 transition-transform ${monthlyOpen ? 'rotate-180' : ''}`} />
                </button>

                {monthlyOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-background border rounded-md shadow-md w-40">
                        {MONTH_OPTIONS.map((m) => (
                            <button
                                key={m}
                                onClick={() => {
                                    setMonths(m)
                                    setMonthlyOpen(false)
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors
                  ${m === months ? 'font-semibold text-primary' : ''}`}
                            >
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
                           label,
                           totalARS,
                           children,
                           level = 0,
                           isCurrentMonth = false,
                       }: {
    label: string
    totalARS: number
    children?: React.ReactNode
    level?: number
    isCurrentMonth?: boolean
}) {
    const [open, setOpen] = useState(false)
    const hasChildren = !!children

    return (
        <div>
            <button
                onClick={() => hasChildren && setOpen((p) => !p)}
                className={`w-full flex items-center justify-between py-2 text-sm transition-colors rounded-md px-2
          ${hasChildren ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'}
          ${level === 0 ? 'font-medium' : ''}
          ${level === 1 ? 'pl-6 text-muted-foreground' : ''}
          ${level === 2 ? 'pl-10 text-muted-foreground' : ''}
        `}
            >
        <span className="flex items-center gap-2">
          {hasChildren && (
              open
                  ? <ChevronDown className="h-3 w-3 shrink-0" />
                  : <ChevronRight className="h-3 w-3 shrink-0" />
          )}
            {!hasChildren && <span className="w-3" />}
            {label}
            {isCurrentMonth && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              hoy
            </span>
            )}
        </span>
                <span className={totalARS > 0 ? '' : 'text-muted-foreground'}>
          {totalARS > 0 ? fmt(totalARS) : '—'}
        </span>
            </button>
            {open && children}
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

    if (error) return <div className="p-8 text-center text-destructive">{error}</div>

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Proyección</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {mode === 'annual'
                            ? `Año ${year}`
                            : `Próximos ${months === 1 ? '1 mes' : `${months} meses`} desde hoy`}
                    </p>
                </div>
                <ModeToggle
                    mode={mode}
                    setMode={setMode}
                    year={year}
                    setYear={setYear}
                    months={months}
                    setMonths={setMonths}
                />
            </div>

            {loading ? (
                <div className="p-8 text-center text-muted-foreground">Cargando proyección...</div>
            ) : (
                <>
                    {/* Tabla principal */}
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                <span>Mes</span>
                                <span className="text-right">Compromisos</span>
                                <span className="text-right">Cuotas</span>
                                <span className="text-right font-semibold">Total</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-1 pt-0">
                            {projection.map((row) => (
                                <div
                                    key={row.month}
                                    className={`rounded-md border ${row.isCurrentMonth ? 'border-primary/40 bg-primary/5' : 'border-transparent'}`}
                                >
                                    {/* Fila resumen del mes */}
                                    <div className="grid grid-cols-4 gap-2 px-2 py-3 text-sm">
                    <span className={`font-medium ${row.isPast ? 'text-muted-foreground' : ''}`}>
                      {formatMonth(row.month)}
                        {row.isCurrentMonth && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                          hoy
                        </span>
                        )}
                    </span>
                                        <span className="text-right text-muted-foreground">
                      {row.totalCommitmentsARS > 0 ? fmt(row.totalCommitmentsARS) : '—'}
                    </span>
                                        <span className="text-right text-muted-foreground">
                      {row.totalInstallmentsARS > 0 ? fmt(row.totalInstallmentsARS) : '—'}
                    </span>
                                        <span className="text-right font-semibold">
                      {row.totalARS > 0 ? fmt(row.totalARS) : '—'}
                    </span>
                                    </div>

                                    {/* Barra proporcional */}
                                    <div className="px-2 pb-2">
                                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary/40 rounded-full transition-all"
                                                style={{ width: `${(row.totalARS / maxTotal) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Detalle expandible — solo desktop */}
                                    <div className="hidden md:block px-2 pb-2 space-y-1">
                                        {/* Compromisos expandibles */}
                                        {row.commitments.length > 0 && (
                                            <ExpandableRow
                                                label="Compromisos"
                                                totalARS={row.totalCommitmentsARS}
                                                level={0}
                                            >
                                                {row.commitments.map((c) => (
                                                    <div
                                                        key={c._id}
                                                        className="flex items-center justify-between py-1.5 pl-8 pr-2 text-sm text-muted-foreground"
                                                    >
                            <span>
                              {c.description}
                                {c.dayOfMonth && (
                                    <span className="ml-1 text-xs opacity-60">· día {c.dayOfMonth}</span>
                                )}
                                {c.currency === 'USD' && (
                                    <span className="ml-1 text-xs opacity-60">
                                  (U$D {c.amount} → ARS)
                                </span>
                                )}
                            </span>
                                                        <span>{fmt(c.amountARS)}</span>
                                                    </div>
                                                ))}
                                            </ExpandableRow>
                                        )}

                                        {/* Cuotas expandibles por tarjeta */}
                                        {row.installmentsByAccount.length > 0 && (
                                            <ExpandableRow
                                                label="Cuotas"
                                                totalARS={row.totalInstallmentsARS}
                                                level={0}
                                            >
                                                {row.installmentsByAccount.map((account) => (
                                                    <ExpandableRow
                                                        key={account.accountId}
                                                        label={account.accountName}
                                                        totalARS={account.totalARS}
                                                        level={1}
                                                    >
                                                        {account.items.map((item, i) => (
                                                            <div
                                                                key={i}
                                                                className="flex items-center justify-between py-1.5 pl-12 pr-2 text-sm text-muted-foreground"
                                                            >
                                <span>
                                  {item.description}
                                    <span className="ml-1 text-xs opacity-60">
                                    {item.currentInstallment}/{item.installmentCount}
                                  </span>
                                    {item.currency === 'USD' && (
                                        <span className="ml-1 text-xs opacity-60">
                                      (U$D {item.installmentAmount} → ARS)
                                    </span>
                                    )}
                                </span>
                                                                <span>{fmt(item.amountARS)}</span>
                                                            </div>
                                                        ))}
                                                    </ExpandableRow>
                                                ))}
                                            </ExpandableRow>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Totales */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-sm text-muted-foreground">Compromisos</p>
                                <p className="text-xl font-bold">
                                    {fmt(projection.reduce((sum, p) => sum + p.totalCommitmentsARS, 0))}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-sm text-muted-foreground">Cuotas</p>
                                <p className="text-xl font-bold">
                                    {fmt(projection.reduce((sum, p) => sum + p.totalInstallmentsARS, 0))}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-sm text-muted-foreground">Total proyectado</p>
                                <p className="text-xl font-bold">
                                    {fmt(projection.reduce((sum, p) => sum + p.totalARS, 0))}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    )
}