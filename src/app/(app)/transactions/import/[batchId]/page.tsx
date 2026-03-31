'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertTriangle,
    ArrowLeft,
    ArrowLeftRight,
    Banknote,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Copy,
    CreditCard,
    EyeOff,
    Save,
    SlidersHorizontal,
    TrendingDown,
    TrendingUp,
    XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/shared/Spinner'
import { useImportBatchDetail } from '@/hooks/useImportBatch'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'
import type { IAccount, ICategory, IImportRow, ImportParsedData } from '@/types'
import {
    getCompatibleDestinationAccounts,
    getCompatibleSourceAccounts,
    getDefaultFirstClosingMonth,
    getImportCategoryKind,
    mergeImportRawDataFallbacks,
    IMPORT_TRANSACTION_TYPE_LABELS,
    IMPORT_TRANSACTION_TYPE_OPTIONS,
    normalizeImportTransactionType,
    typeRequiresDestinationAccount,
    typeSupportsCategory,
} from '@/lib/utils/import-transactions'

// ── Tipos ────────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'invalid' | 'incomplete' | 'possible_duplicate' | 'ignored' | 'ok'

// ── Constantes ───────────────────────────────────────────────────────────────────

const TYPE_ORDER = [
    'income',
    'expense',
    'credit_card_expense',
    'transfer',
    'adjustment',
    'credit_card_payment',
]

const TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    income: { label: 'Ingresos', color: '#16a34a', icon: TrendingUp },
    expense: { label: 'Gastos', color: '#dc2626', icon: TrendingDown },
    credit_card_expense: { label: 'Gastos con TC', color: '#0284c7', icon: CreditCard },
    transfer: { label: 'Transferencias', color: '#7c3aed', icon: ArrowLeftRight },
    adjustment: { label: 'Ajustes', color: '#d97706', icon: SlidersHorizontal },
    credit_card_payment: { label: 'Pago de tarjeta', color: '#ea580c', icon: Banknote },
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    ok: { label: 'Lista', color: '#16a34a', icon: CheckCircle2 },
    incomplete: { label: 'Error', color: '#dc2626', icon: XCircle },
    invalid: { label: 'Error', color: '#dc2626', icon: XCircle },
    possible_duplicate: { label: 'Revisar', color: '#7c3aed', icon: Copy },
    ignored: { label: 'Ignorada', color: '#6b7280', icon: EyeOff },
    imported: { label: 'Importada', color: '#0284c7', icon: CheckCircle2 },
}

type ColDef = { key: string; header: string; width?: string }

const COLUMNS_BY_TYPE: Record<string, ColDef[]> = {
    income: [
        { key: 'date', header: 'Fecha', width: 'w-24' },
        { key: 'description', header: 'Descripción', width: 'min-w-48' },
        { key: 'amount', header: 'Monto', width: 'w-28' },
        { key: 'currency', header: 'Mon.', width: 'w-16' },
        { key: 'sourceAccount', header: 'Cuenta', width: 'min-w-44' },
        { key: 'categoryId', header: 'Categoría', width: 'min-w-40' },
    ],
    expense: [
        { key: 'date', header: 'Fecha', width: 'w-24' },
        { key: 'description', header: 'Descripción', width: 'min-w-48' },
        { key: 'amount', header: 'Monto', width: 'w-28' },
        { key: 'currency', header: 'Mon.', width: 'w-16' },
        { key: 'sourceAccount', header: 'Cuenta origen', width: 'min-w-44' },
        { key: 'categoryId', header: 'Categoría', width: 'min-w-40' },
    ],
    credit_card_expense: [
        { key: 'date', header: 'Fecha', width: 'w-24' },
        { key: 'description', header: 'Descripción', width: 'min-w-44' },
        { key: 'amount', header: 'Monto', width: 'w-28' },
        { key: 'currency', header: 'Mon.', width: 'w-16' },
        { key: 'sourceAccount', header: 'Tarjeta', width: 'min-w-40' },
        { key: 'categoryId', header: 'Categoría', width: 'min-w-36' },
        { key: 'installmentCount', header: 'Cuotas', width: 'w-16' },
        { key: 'firstClosingMonth', header: '1ª cuota', width: 'min-w-32' },
    ],
    transfer: [
        { key: 'date', header: 'Fecha', width: 'w-24' },
        { key: 'description', header: 'Descripción', width: 'min-w-44' },
        { key: 'amount', header: 'Monto', width: 'w-28' },
        { key: 'currency', header: 'Mon.', width: 'w-16' },
        { key: 'sourceAccount', header: 'Cta. origen', width: 'min-w-40' },
        { key: 'destinationAccount', header: 'Cta. destino', width: 'min-w-40' },
    ],
    adjustment: [
        { key: 'date', header: 'Fecha', width: 'w-24' },
        { key: 'description', header: 'Descripción', width: 'min-w-52' },
        { key: 'amount', header: 'Monto', width: 'w-28' },
        { key: 'currency', header: 'Mon.', width: 'w-16' },
        { key: 'sourceAccount', header: 'Cuenta', width: 'min-w-44' },
    ],
    credit_card_payment: [
        { key: 'date', header: 'Fecha', width: 'w-24' },
        { key: 'description', header: 'Descripción', width: 'min-w-44' },
        { key: 'amount', header: 'Monto', width: 'w-28' },
        { key: 'currency', header: 'Mon.', width: 'w-16' },
        { key: 'sourceAccount', header: 'Cta. origen', width: 'min-w-40' },
        { key: 'destinationAccount', header: 'Tarjeta destino', width: 'min-w-40' },
    ],
}

const CURRENCY_OPTIONS = [
    { value: 'ARS', label: 'ARS' },
    { value: 'USD', label: 'USD' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────────

function getEffectiveData(row: IImportRow, dirty?: Partial<ImportParsedData>): ImportParsedData {
    return {
        ...mergeImportRawDataFallbacks(
            (row.parsedData ?? {}) as ImportParsedData,
            (row.rawData as Record<string, string | undefined> | undefined) ?? undefined
        ),
        ...(row.reviewedData ?? {}),
        ...(dirty ?? {}),
    } as ImportParsedData
}

function formatAmount(amount: number | undefined, currency: string | undefined) {
    if (amount === undefined || amount === null) return '—'
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency ?? 'ARS',
        minimumFractionDigits: 0,
    }).format(amount)
}

function parseDateValue(value?: Date | string) {
    if (!value) return undefined
    const parsed = value instanceof Date ? value : new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function formatDateValue(value?: Date | string) {
    const parsed = parseDateValue(value)
    return parsed
        ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
        : '—'
}

function parseMonthValue(value?: string | Date) {
    if (!value) return undefined
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return { year: value.getFullYear(), month: value.getMonth() + 1 }
    }

    const raw = String(value)
    const direct = raw.match(/^(\d{4})-(\d{1,2})$/)
    if (direct) {
        return { year: Number(direct[1]), month: Number(direct[2]) }
    }

    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
        return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 }
    }

    return undefined
}

function formatMonthValue(value?: string | Date) {
    const parsed = parseMonthValue(value)
    if (!parsed) return '—'
    return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
        new Date(parsed.year, parsed.month - 1, 1)
    )
}

function getDisplayValue(key: string, data: ImportParsedData, accounts: IAccount[], categories: ICategory[]): string {
    switch (key) {
        case 'date':
            return formatDateValue(data.date)
        case 'description':
            return data.description ?? '—'
        case 'amount':
            return formatAmount(data.amount, data.currency)
        case 'currency':
            return data.currency ?? '—'
        case 'sourceAccount':
            return data.accountName ?? accounts.find((a) => String(a._id) === data.sourceAccountId)?.name ?? '—'
        case 'destinationAccount':
            return data.destinationAccountName ?? accounts.find((a) => String(a._id) === data.destinationAccountId)?.name ?? '—'
        case 'categoryId':
            return data.categoryName ?? categories.find((c) => String(c._id) === data.categoryId)?.name ?? '—'
        case 'installmentCount':
            return data.installmentCount ? String(data.installmentCount) : '—'
        case 'firstClosingMonth':
            return formatMonthValue(data.firstClosingMonth)
        default:
            return '—'
    }
}

function applyTypeChange(currentData: ImportParsedData, newType: string | undefined): Partial<ImportParsedData> {
    const updates: Partial<ImportParsedData> = { type: newType }

    if (!typeSupportsCategory(newType)) {
        updates.categoryId = undefined
        updates.categoryName = undefined
    }
    if (!typeRequiresDestinationAccount(newType)) {
        updates.destinationAccountId = undefined
        updates.destinationAccountName = undefined
    }
    if (newType !== 'credit_card_expense') {
        updates.installmentCount = undefined
        updates.installmentNumber = undefined
        updates.firstClosingMonth = undefined
    } else if (!currentData.installmentCount) {
        updates.installmentCount = 1
        updates.firstClosingMonth = currentData.firstClosingMonth ?? getDefaultFirstClosingMonth(currentData.date)
    }
    // Al pasar de credit_card_expense a expense, limpiar campos de TC
    if (newType === 'expense' && currentData.type === 'credit_card_expense') {
        updates.cardName = undefined
    }

    return updates
}

// ── Componentes pequeños ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const meta = STATUS_META[status] ?? { label: status, color: '#6b7280', icon: AlertTriangle }
    const Icon = meta.icon
    return (
        <Badge
            variant={status === 'invalid' ? 'destructive' : 'outline'}
            className="gap-1 rounded-md px-1.5 py-0 text-[11px] font-medium whitespace-nowrap"
            style={{ background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}22` }}
        >
            <Icon className="w-3 h-3 flex-shrink-0" />
            {meta.label}
        </Badge>
    )
}

function getRowFeedback(row: IImportRow): string | undefined {
    if (!row.ignored && row.errors.length > 0) return row.errors[0]
    if (!row.ignored && row.warnings.length > 0) return row.warnings[0]
    if (row.status === 'possible_duplicate') {
        return 'Posible duplicado: revisá si esta fila ya fue importada antes.'
    }
    return undefined
}

function DirtyIndicator() {
    return (
        <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: '#0284c7' }}
            title="Cambios pendientes de aplicar"
        />
    )
}

function DatePickerInput({
    value,
    onChange,
    disabled,
    hasError,
}: {
    value?: Date | string
    onChange: (value?: Date) => void
    disabled?: boolean
    hasError?: boolean
}) {
    const [open, setOpen] = useState(false)
    const parsed = parseDateValue(value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        'h-7 w-full justify-start px-2 text-left text-xs font-normal',
                        !parsed && 'text-muted-foreground',
                        hasError && 'border-destructive'
                    )}
                >
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    {parsed ? formatDateValue(parsed) : 'Seleccionar fecha'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={parsed}
                    onSelect={(date) => {
                        onChange(date ?? undefined)
                        if (date) setOpen(false)
                    }}
                    captionLayout="dropdown"
                    startMonth={new Date(2020, 0)}
                    endMonth={new Date(2035, 11)}
                />
            </PopoverContent>
        </Popover>
    )
}

function MonthPickerInput({
    value,
    onChange,
    disabled,
    hasError,
}: {
    value?: string | Date
    onChange: (value?: string) => void
    disabled?: boolean
    hasError?: boolean
}) {
    const [open, setOpen] = useState(false)
    const parsed = parseMonthValue(value)
    const currentYear = new Date().getFullYear()
    const [selectedYear, setSelectedYear] = useState(parsed?.year ?? currentYear)
    const displayedYear = open ? selectedYear : parsed?.year ?? currentYear

    const yearOptions = Array.from({ length: 9 }, (_, index) => currentYear - 2 + index)
    const monthOptions = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1
        return {
            value: month,
            label: new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(new Date(2026, index, 1)),
        }
    })

    return (
        <Popover
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen)
                if (nextOpen) {
                    setSelectedYear(parsed?.year ?? currentYear)
                }
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        'h-7 w-full justify-start px-2 text-left text-xs font-normal',
                        !parsed && 'text-muted-foreground',
                        hasError && 'border-destructive'
                    )}
                >
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    {parsed ? formatMonthValue(value) : 'Seleccionar mes'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Primer pago</span>
                    <NativeSelect
                        value={String(displayedYear)}
                        onChange={(nextYear) => setSelectedYear(Number(nextYear ?? currentYear))}
                        options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
                        className="w-24"
                    />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {monthOptions.map((month) => {
                        const isSelected = parsed?.year === displayedYear && parsed.month === month.value

                        return (
                            <Button
                                key={month.value}
                                type="button"
                                variant={isSelected ? 'default' : 'outline'}
                                className="h-8 text-xs"
                                onClick={() => {
                                    onChange(`${displayedYear}-${String(month.value).padStart(2, '0')}`)
                                    setOpen(false)
                                }}
                            >
                                {month.label}
                            </Button>
                        )
                    })}
                </div>
                <div className="mt-3 flex justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            onChange(undefined)
                            setOpen(false)
                        }}
                    >
                        Limpiar
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// ── Select nativo compacto ───────────────────────────────────────────────────────

function NativeSelect({
                          value,
                          onChange,
                          options,
                          placeholder,
                          disabled,
                          hasError,
                          className,
                      }: {
    value?: string
    onChange: (value: string | undefined) => void
    options: { value: string; label: string }[]
    placeholder?: string
    disabled?: boolean
    hasError?: boolean
    className?: string
}) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            disabled={disabled}
            className={cn(
                'w-full h-7 text-xs rounded border px-1.5 py-0',
                'bg-background cursor-pointer',
                'focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring',
                hasError ? 'border-destructive' : 'border-border',
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
        >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    )
}

// ── FieldCell: renderiza el control inline para cada campo ───────────────────────

function FieldCell({
                       columnKey,
                       effectiveData,
                       rowType,
                       accounts,
                       categories,
                       onChange,
                       disabled,
                       hasError,
                   }: {
    columnKey: string
    effectiveData: ImportParsedData
    rowType: string
    accounts: IAccount[]
    categories: ICategory[]
    onChange: (updates: Partial<ImportParsedData>) => void
    disabled?: boolean
    hasError?: (field: string) => boolean
}) {
    const normalizedType = normalizeImportTransactionType(rowType)
    const inputClass = cn(
        'w-full h-7 text-xs rounded border px-1.5 bg-background',
        'focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring border-border',
        disabled && 'opacity-50 cursor-not-allowed'
    )

    switch (columnKey) {
        case 'date':
            return (
                <DatePickerInput
                    value={effectiveData.date}
                    onChange={(value) => onChange({ date: value })}
                    disabled={disabled}
                    hasError={hasError?.('date')}
                />
            )

        case 'description':
            return (
                <Input
                    className={inputClass}
                    value={effectiveData.description ?? ''}
                    onChange={(e) => onChange({ description: e.target.value })}
                    disabled={disabled}
                    placeholder="Descripción"
                />
            )

        case 'amount':
            return (
                <Input
                    type="number"
                    step="0.01"
                    className={cn(inputClass, 'text-right')}
                    value={effectiveData.amount ?? ''}
                    onChange={(e) =>
                        onChange({ amount: e.target.value === '' ? undefined : Number(e.target.value) })
                    }
                    disabled={disabled}
                    placeholder="0"
                />
            )

        case 'currency':
            return (
                <NativeSelect
                    value={effectiveData.currency}
                    onChange={(v) => onChange({ currency: v })}
                    options={CURRENCY_OPTIONS}
                    placeholder="—"
                    disabled={disabled}
                />
            )

        case 'sourceAccount': {
            const compatible = getCompatibleSourceAccounts(accounts, normalizedType)
            return (
                <NativeSelect
                    value={effectiveData.sourceAccountId}
                    onChange={(v) => {
                        const account = accounts.find((a) => String(a._id) === v)
                        onChange({
                            sourceAccountId: v,
                            accountName: account?.name,
                            ...(account?.type === 'credit_card' ? { cardName: account.name } : {}),
                        })
                    }}
                    options={compatible.map((a) => ({ value: String(a._id), label: `${a.name} · ${a.currency}` }))}
                    placeholder="Sin cuenta"
                    disabled={disabled}
                    hasError={hasError?.('sourceAccount')}
                />
            )
        }

        case 'destinationAccount': {
            const compatible = getCompatibleDestinationAccounts(accounts, normalizedType)
            return (
                <NativeSelect
                    value={effectiveData.destinationAccountId}
                    onChange={(v) => {
                        const account = accounts.find((a) => String(a._id) === v)
                        onChange({
                            destinationAccountId: v,
                            destinationAccountName: account?.name,
                            ...(normalizedType === 'credit_card_payment' && account?.type === 'credit_card'
                                ? { cardName: account.name }
                                : {}),
                        })
                    }}
                    options={compatible.map((a) => ({ value: String(a._id), label: `${a.name} · ${a.currency}` }))}
                    placeholder="Sin cuenta"
                    disabled={disabled}
                    hasError={hasError?.('destinationAccount')}
                />
            )
        }

        case 'categoryId': {
            const kind = getImportCategoryKind(normalizedType)
            const relevant = kind ? categories.filter((c) => c.type === kind) : categories
            return (
                <NativeSelect
                    value={effectiveData.categoryId}
                    onChange={(v) => {
                        const cat = categories.find((c) => String(c._id) === v)
                        onChange({ categoryId: v, categoryName: cat?.name })
                    }}
                    options={relevant.map((c) => ({ value: String(c._id), label: c.name }))}
                    placeholder="Sin categoría"
                    disabled={disabled}
                    hasError={hasError?.('categoryId')}
                />
            )
        }

        case 'installmentCount':
            return (
                <Input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={effectiveData.installmentCount ?? ''}
                    onChange={(e) =>
                        onChange({ installmentCount: e.target.value === '' ? undefined : Number(e.target.value) })
                    }
                    disabled={disabled}
                    placeholder="1"
                />
            )

        case 'firstClosingMonth':
            return (
                <MonthPickerInput
                    value={effectiveData.firstClosingMonth ?? ''}
                    onChange={(value) => onChange({ firstClosingMonth: value })}
                    disabled={disabled}
                    hasError={hasError?.('firstClosingMonth')}
                />
            )

        default:
            return null
    }
}

// ── Fila inline (desktop) ────────────────────────────────────────────────────────

function InlineTableRow({
                            row,
                            groupType,
                            columns,
                            dirty,
                            accounts,
                            categories,
                            onFieldChange,
                            onToggleIgnore,
                            disabled,
                            isFocused,
                        }: {
    row: IImportRow
    groupType: string
    columns: ColDef[]
    dirty?: Partial<ImportParsedData>
    accounts: IAccount[]
    categories: ICategory[]
    onFieldChange: (rowId: string, updates: Partial<ImportParsedData>) => void
    onToggleIgnore: (row: IImportRow) => void
    disabled?: boolean
    isFocused?: boolean
}) {
    const effectiveData = getEffectiveData(row, dirty)
    const isDirty = !!dirty && Object.keys(dirty).length > 0
    const rowId = String(row._id)
    const isReadOnly = row.status === 'imported' || row.ignored
    const feedbackMessage = getRowFeedback(row)

    const handleChange = useCallback(
        (updates: Partial<ImportParsedData>) => onFieldChange(rowId, updates),
        [rowId, onFieldChange]
    )

    const handleTypeChange = useCallback(
        (newType: string | undefined) => {
            if (!newType) return
            onFieldChange(rowId, applyTypeChange(effectiveData, newType))
        },
        [rowId, effectiveData, onFieldChange]
    )

    // Detectar campos con error para resaltarlos
    const errorFields = useMemo(() => {
        const fields = new Set<string>()
        for (const msg of row.errors) {
            const normalized = msg.toLowerCase()
            if (normalized.includes('fecha')) fields.add('date')
            if (normalized.includes('categoría')) fields.add('categoryId')
            if (
                normalized.includes('cuenta origen') ||
                normalized.includes('tarjeta "') ||
                normalized.includes('tarjeta es req') ||
                normalized.includes('la cuenta es obligatoria')
            ) {
                fields.add('sourceAccount')
            }
            if (normalized.includes('cuenta destino') || normalized.includes('tarjeta destino')) fields.add('destinationAccount')
            if (normalized.includes('primera cuota') || normalized.includes('mes de primer pago')) fields.add('firstClosingMonth')
            if (normalized.includes('cuotas son requeridas') || normalized.includes('cuotas son obligatorias')) fields.add('installmentCount')
        }
        return fields
    }, [row.errors])

    return (
        <tr
            id={`row-${rowId}`}
            className={cn(
                'border-b align-middle transition-colors',
                isDirty && 'bg-blue-50/30 dark:bg-blue-950/10',
                isFocused && 'bg-amber-50/40 dark:bg-amber-950/15',
                row.ignored && 'opacity-45'
            )}
            style={{ borderColor: 'var(--border)' }}
        >
            {/* # */}
            <td className="px-2 py-1.5 text-xs text-muted-foreground w-10">
                <div className="flex items-center gap-1.5">
                    <span>{row.rowNumber}</span>
                    {isDirty && <DirtyIndicator />}
                </div>
            </td>

            {/* Estado */}
            <td className="px-2 py-1.5 min-w-24 align-top">
                <div className="space-y-1 pt-0.5">
                    <StatusBadge status={row.status} />
                    {feedbackMessage && !row.ignored && (
                        <p
                            className="text-xs leading-tight"
                            style={{ color: row.errors.length > 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }}
                        >
                            {feedbackMessage}
                        </p>
                    )}
                </div>
            </td>

            {/* Tipo */}
            <td className="px-2 py-1.5 min-w-36">
                <NativeSelect
                    value={effectiveData.type}
                    onChange={handleTypeChange}
                    options={IMPORT_TRANSACTION_TYPE_OPTIONS}
                    placeholder="Sin tipo"
                    disabled={disabled || isReadOnly}
                />
            </td>

            {/* Columnas específicas del tipo */}
            {columns.map((col) => (
                <td key={col.key} className={cn('px-2 py-1.5', col.width)}>
                    {isReadOnly ? (
                        <span className="text-xs text-muted-foreground">
                            {getDisplayValue(col.key, effectiveData, accounts, categories)}
                        </span>
                    ) : (
                        <FieldCell
                            columnKey={col.key}
                            effectiveData={effectiveData}
                            rowType={effectiveData.type ?? groupType}
                            accounts={accounts}
                            categories={categories}
                            onChange={handleChange}
                            disabled={disabled}
                            hasError={(field) => errorFields.has(field)}
                        />
                    )}
                </td>
            ))}

            {/* Ignorar */}
            <td className="px-2 py-1.5 w-10">
                {row.status !== 'imported' && (
                    <Button
                        type="button"
                        variant={row.ignored ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onToggleIgnore(row)}
                        title={row.ignored ? 'Dejar de ignorar' : 'Ignorar fila'}
                    >
                        <EyeOff
                            className={cn(
                                'w-3.5 h-3.5',
                                row.ignored ? 'text-foreground' : 'text-muted-foreground'
                            )}
                        />
                    </Button>
                )}
            </td>
        </tr>
    )
}

// ── Tarjeta mobile ───────────────────────────────────────────────────────────────

function MobileCardRow({
                           row,
                           groupType,
                           dirty,
                           accounts,
                           categories,
                           onFieldChange,
                           onToggleIgnore,
                           disabled,
                       }: {
    row: IImportRow
    groupType: string
    dirty?: Partial<ImportParsedData>
    accounts: IAccount[]
    categories: ICategory[]
    onFieldChange: (rowId: string, updates: Partial<ImportParsedData>) => void
    onToggleIgnore: (row: IImportRow) => void
    disabled?: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const effectiveData = getEffectiveData(row, dirty)
    const isDirty = !!dirty && Object.keys(dirty).length > 0
    const rowId = String(row._id)
    const columns = COLUMNS_BY_TYPE[groupType] ?? []
    const isReadOnly = row.status === 'imported'
    const feedbackMessage = getRowFeedback(row)

    const typeLabel = effectiveData.type
        ? IMPORT_TRANSACTION_TYPE_LABELS[effectiveData.type] ?? effectiveData.type
        : 'Sin tipo'
    const dateLabel = formatDateValue(effectiveData.date)
    const amountLabel = formatAmount(effectiveData.amount, effectiveData.currency)

    const handleTypeChange = (newType: string | undefined) => {
        if (!newType) return
        onFieldChange(rowId, applyTypeChange(effectiveData, newType))
    }

    return (
        <div
            id={`row-${rowId}`}
            className={cn(
                'rounded-xl border overflow-hidden',
                isDirty && 'border-blue-300/60 dark:border-blue-700/40',
                row.ignored && 'opacity-45'
            )}
            style={{ borderColor: isDirty ? undefined : 'var(--border)' }}
        >
            {/* Header */}
            <div
                className="flex items-start gap-3 p-3 cursor-pointer select-none"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">#{row.rowNumber}</span>
                        <StatusBadge status={row.status} />
                        {isDirty && <DirtyIndicator />}
                    </div>
                    <p
                        className={cn(
                            'text-sm font-medium truncate',
                            row.ignored && 'line-through text-muted-foreground'
                        )}
                    >
                        {effectiveData.description || <span className="italic text-muted-foreground">Sin descripción</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                        <span className="text-sm font-semibold text-foreground">{amountLabel}</span>
                        <span>{dateLabel}</span>
                        <span>{typeLabel}</span>
                    </div>
                    {feedbackMessage && !row.ignored && (
                        <p
                            className="text-xs mt-1.5 font-medium"
                            style={{ color: row.errors.length > 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }}
                        >
                            {row.errors.length > 0 ? '⚠ ' : ''}
                            {feedbackMessage}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                    {row.status !== 'imported' && (
                        <Button
                            type="button"
                            variant={row.ignored ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7 rounded-lg"
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggleIgnore(row)
                            }}
                        >
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                    )}
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
            </div>

            {/* Formulario expandido */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                    >
                        <div
                            className="px-3 pb-4 space-y-3 border-t pt-3"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            {/* Errores */}
                            {row.errors.length > 0 && !row.ignored && (
                                <div
                                    className="rounded-lg p-2.5 space-y-1 text-xs"
                                    style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}
                                >
                                    {row.errors.map((err, i) => (
                                        <p key={i}>⚠ {err}</p>
                                    ))}
                                </div>
                            )}

                            {/* Tipo */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                                <NativeSelect
                                    value={effectiveData.type}
                                    onChange={handleTypeChange}
                                    options={IMPORT_TRANSACTION_TYPE_OPTIONS}
                                    placeholder="Sin tipo"
                                    disabled={disabled || isReadOnly}
                                />
                            </div>

                            {/* Fecha (solo lectura) */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                                <p className="text-sm">{dateLabel}</p>
                            </div>

                            {/* Columnas del tipo (sin fecha) */}
                            {columns
                                .filter((col) => col.key !== 'date')
                                .map((col) => (
                                    <div key={col.key} className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            {col.header}
                                        </label>
                                        {isReadOnly ? (
                                            <p className="text-sm">
                                                {getDisplayValue(col.key, effectiveData, accounts, categories)}
                                            </p>
                                        ) : (
                                            <FieldCell
                                                columnKey={col.key}
                                                effectiveData={effectiveData}
                                                rowType={effectiveData.type ?? groupType}
                                                accounts={accounts}
                                                categories={categories}
                                                onChange={(updates) => onFieldChange(rowId, updates)}
                                                disabled={disabled}
                                            />
                                        )}
                                    </div>
                                ))}

                            {/* Warnings */}
                            {row.warnings.length > 0 && (
                                <div className="space-y-1">
                                    {row.warnings.map((w, i) => (
                                        <p key={i} className="text-xs text-muted-foreground">
                                            • {w}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Sección por tipo ─────────────────────────────────────────────────────────────

function TypeGroupSection({
                              type,
                              rows,
                              dirtyRows,
                              accounts,
                              categories,
                              onFieldChange,
                              onToggleIgnore,
                              disabled,
                              focusRowId,
                          }: {
    type: string
    rows: IImportRow[]
    dirtyRows: Record<string, Partial<ImportParsedData>>
    accounts: IAccount[]
    categories: ICategory[]
    onFieldChange: (rowId: string, updates: Partial<ImportParsedData>) => void
    onToggleIgnore: (row: IImportRow) => void
    disabled?: boolean
    focusRowId: string | null
}) {
    const meta = TYPE_META[type]
    const columns = COLUMNS_BY_TYPE[type] ?? []
    const Icon = meta?.icon ?? AlertTriangle

    return (
        <div className="mb-8">
            {/* Encabezado del grupo */}
            <div className="flex items-center gap-2 mb-3 px-1">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: meta?.color }} />
                <h2 className="text-sm font-semibold">{meta?.label ?? type}</h2>
                <span className="text-xs text-muted-foreground">({rows.length})</span>
            </div>

            {/* Vista desktop: tabla por tipo */}
            <div
                className="hidden md:block rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--border)' }}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr
                            style={{
                                background: 'var(--secondary)',
                                borderBottom: '1px solid var(--border)',
                            }}
                        >
                            <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground w-10">#</th>
                            <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground min-w-24">Estado</th>
                            <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground min-w-36">Tipo</th>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        'text-left px-2 py-2 text-xs font-medium text-muted-foreground',
                                        col.width
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                            <th className="w-10" />
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((row) => (
                            <InlineTableRow
                                key={String(row._id)}
                                row={row}
                                groupType={type}
                                columns={columns}
                                dirty={dirtyRows[String(row._id)]}
                                accounts={accounts}
                                categories={categories}
                                onFieldChange={onFieldChange}
                                onToggleIgnore={onToggleIgnore}
                                disabled={disabled}
                                isFocused={focusRowId === String(row._id)}
                            />
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Vista mobile: tarjetas */}
            <div className="md:hidden space-y-2">
                {rows.map((row) => (
                    <MobileCardRow
                        key={String(row._id)}
                        row={row}
                        groupType={type}
                        dirty={dirtyRows[String(row._id)]}
                        accounts={accounts}
                        categories={categories}
                        onFieldChange={onFieldChange}
                        onToggleIgnore={onToggleIgnore}
                        disabled={disabled}
                    />
                ))}
            </div>
        </div>
    )
}

// ── Página principal ─────────────────────────────────────────────────────────────

export default function ImportReviewPage() {
    usePageTitle('Revisión de importación')

    const params = useParams()
    const batchId = params.batchId as string
    const router = useRouter()

    const { detail, loading, error, fetchDetail, updateRow, confirmImport } = useImportBatchDetail(batchId)
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { success, error: toastError } = useToast()

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [dirtyRows, setDirtyRows] = useState<Record<string, Partial<ImportParsedData>>>({})
    const [confirming, setConfirming] = useState(false)
    const [applying, setApplying] = useState(false)
    const [focusRowId, setFocusRowId] = useState<string | null>(null)

    useEffect(() => {
        fetchDetail()
    }, [fetchDetail])

    const isDirty = Object.keys(dirtyRows).length > 0
    const isDisabled = applying || confirming

    // Scroll al foco tras cambio de tipo
    useEffect(() => {
        if (!focusRowId) return
        const timer = setTimeout(() => {
            const el = document.getElementById(`row-${focusRowId}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 80)
        const clearTimer = setTimeout(() => setFocusRowId(null), 2200)
        return () => {
            clearTimeout(timer)
            clearTimeout(clearTimer)
        }
    }, [focusRowId])

    const filteredRows = useMemo(() => {
        if (!detail) return []
        if (statusFilter === 'all') return detail.rows
        if (statusFilter === 'invalid') {
            return detail.rows.filter((row) => row.status === 'invalid' || row.status === 'incomplete')
        }
        return detail.rows.filter((row) => row.status === statusFilter)
    }, [detail, statusFilter])

    // Agrupar por tipo efectivo (incluyendo cambios locales pendientes)
    const groupedRows = useMemo(() => {
        const groups: Record<string, IImportRow[]> = {}

        for (const row of filteredRows) {
            const dirtyType = dirtyRows[String(row._id)]?.type
            const rawType = dirtyType ?? (row.reviewedData as ImportParsedData | undefined)?.type ?? (row.parsedData as ImportParsedData | undefined)?.type
            const effectiveType = normalizeImportTransactionType(rawType as string | undefined) ?? 'unknown'

            if (!groups[effectiveType]) groups[effectiveType] = []
            groups[effectiveType].push(row)
        }

        const ordered = TYPE_ORDER
            .filter((t) => groups[t]?.length > 0)
            .map((t) => ({ type: t, rows: groups[t] }))

        if (groups['unknown']?.length) {
            ordered.push({ type: 'unknown', rows: groups['unknown'] })
        }

        return ordered
    }, [filteredRows, dirtyRows])

    // Contadores para el bottom bar
    const { blockingCount, pendingCount, importableCount } = useMemo(() => {
        if (!detail) return { blockingCount: 0, pendingCount: 0, importableCount: 0 }
        const rows = detail.rows
        return {
            blockingCount: rows.filter((r) => (r.status === 'invalid' || r.status === 'incomplete') && !r.ignored).length,
            pendingCount: 0,
            importableCount: rows.filter(
                (r) => !r.ignored && ['ok', 'possible_duplicate'].includes(r.status) && r.status !== 'imported'
            ).length,
        }
    }, [detail])

    const handleFieldChange = useCallback((rowId: string, updates: Partial<ImportParsedData>) => {
        setDirtyRows((prev) => ({
            ...prev,
            [rowId]: { ...(prev[rowId] ?? {}), ...updates },
        }))
        if ('type' in updates) {
            setFocusRowId(rowId)
        }
    }, [])

    const handleToggleIgnore = useCallback(
        async (row: IImportRow) => {
            try {
                await updateRow(String(row._id), { ignored: !row.ignored })
            } catch (err) {
                toastError(err instanceof Error ? err.message : 'Error al actualizar')
            }
        },
        [updateRow, toastError]
    )

    const handleApplyChanges = useCallback(async () => {
        if (!detail || !isDirty) return
        setApplying(true)

        try {
            const entries = Object.entries(dirtyRows)
            await Promise.all(
                entries.map(([rowId, dirty]) => {
                    const row = detail.rows.find((r) => String(r._id) === rowId)
                    if (!row) return Promise.resolve()
                    // Enviar la data efectiva completa (no solo el diff)
                    const fullData = getEffectiveData(row, dirty)
                    return updateRow(rowId, { reviewedData: fullData })
                })
            )
            setDirtyRows({})
            success('Cambios aplicados.')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al aplicar cambios')
        } finally {
            setApplying(false)
        }
    }, [detail, dirtyRows, isDirty, updateRow, success, toastError])

    const handleConfirm = useCallback(async () => {
        setConfirming(true)
        try {
            const result = await confirmImport()
            success(`${result.imported} transacciones importadas correctamente.`)
            router.push('/transactions')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al confirmar importación')
        } finally {
            setConfirming(false)
        }
    }, [confirmImport, router, success, toastError])

    const handleMainAction = () => {
        if (isDirty) {
            handleApplyChanges()
        } else {
            handleConfirm()
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <Spinner className="w-6 h-6" />
            </div>
        )
    }

    if (error || !detail) {
        return (
            <div className="px-4 md:px-6 pt-6">
                <p className="text-sm text-destructive">{error ?? 'Importación no encontrada'}</p>
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push('/transactions/import')}
                >
                    Volver
                </Button>
            </div>
        )
    }

    const { batch } = detail
    const summary = batch.summary
    const isConfirmed = batch.status === 'confirmed'

    const filterChips = (
        [
            { value: 'all' as StatusFilter, label: 'Todas', count: summary.total, color: '#0284c7' },
            { value: 'ok' as StatusFilter, label: 'Listas', count: summary.valid, color: '#16a34a' },
            { value: 'invalid' as StatusFilter, label: 'Con error', count: summary.invalid + summary.incomplete, color: '#dc2626' },
            { value: 'possible_duplicate' as StatusFilter, label: 'Revisar', count: summary.possibleDuplicate, color: '#7c3aed' },
            { value: 'ignored' as StatusFilter, label: 'Ignoradas', count: summary.ignored, color: '#6b7280' },
        ] as const
    ).filter((item) => item.value === 'all' || item.count > 0)

    return (
        <div className="flex flex-col min-h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 md:px-6 py-3 flex-shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/transactions/import')}
                    className="gap-1.5"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Importar
                </Button>
            </div>

            <motion.div
                className="flex-1 px-4 md:px-6 pb-28"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Título */}
                <div className="mb-4">
                    <h1 className="text-xl font-semibold">Revisión de importación</h1>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{batch.fileName}</p>
                </div>

                {/* Banners de estado */}
                {blockingCount > 0 && !isConfirmed && (
                    <div
                        className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
                        style={{
                            background: 'rgba(220,38,38,0.08)',
                            color: '#dc2626',
                            border: '1px solid rgba(220,38,38,0.2)',
                        }}
                    >
                        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-medium">
                                {blockingCount === 1
                                    ? '1 fila tiene errores que bloquean la importación'
                                    : `${blockingCount} filas tienen errores que bloquean la importación`}
                            </p>
                            <p className="text-xs opacity-80">
                                Corregí o ignorá las filas con datos incompatibles antes de confirmar.
                            </p>
                        </div>
                    </div>
                )}

                {pendingCount > 0 && !isConfirmed && (
                    <div
                        className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
                        style={{
                            background: 'rgba(217,119,6,0.10)',
                            color: '#b45309',
                            border: '1px solid rgba(217,119,6,0.18)',
                        }}
                    >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-medium">
                                {pendingCount === 1
                                    ? '1 fila todavía necesita revisión'
                                    : `${pendingCount} filas todavía necesitan revisión`}
                            </p>
                            <p className="text-xs opacity-80">
                                Completá los campos obligatorios antes de importar.
                            </p>
                        </div>
                    </div>
                )}

                {isDirty && !isConfirmed && (
                    <div
                        className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
                        style={{
                            background: 'rgba(2,132,199,0.08)',
                            color: '#0284c7',
                            border: '1px solid rgba(2,132,199,0.18)',
                        }}
                    >
                        <Save className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-medium">
                                {Object.keys(dirtyRows).length === 1
                                    ? '1 fila con cambios pendientes de aplicar'
                                    : `${Object.keys(dirtyRows).length} filas con cambios pendientes de aplicar`}
                            </p>
                            <p className="text-xs opacity-80">
                                Usá <strong>Aplicar cambios</strong> para guardar y validar los cambios antes de confirmar.
                            </p>
                        </div>
                    </div>
                )}

                {isConfirmed && (
                    <div
                        className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
                        style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a' }}
                    >
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>Importación confirmada. Se crearon {summary.imported} transacciones.</span>
                    </div>
                )}

                {/* Filtros por estado */}
                <div className="flex gap-2 flex-wrap mb-6">
                    {filterChips.map((filter) => {
                        const active = statusFilter === filter.value
                        return (
                            <Button
                                key={filter.value}
                                type="button"
                                onClick={() => setStatusFilter(filter.value)}
                                variant={active ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 rounded-lg px-3 text-xs font-medium transition-colors"
                                style={{
                                    background: active ? filter.color : 'var(--secondary)',
                                    color: active ? '#fff' : filter.color,
                                    border: `1px solid ${active ? filter.color : 'var(--border)'}`,
                                }}
                            >
                                {filter.label}
                                <span className="ml-1.5 opacity-80">{filter.count}</span>
                            </Button>
                        )
                    })}
                </div>

                {/* Filas agrupadas por tipo */}
                {groupedRows.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                        No hay filas con este estado.
                    </div>
                ) : (
                    groupedRows.map(({ type, rows: groupRows }) => (
                        <TypeGroupSection
                            key={type}
                            type={type}
                            rows={groupRows}
                            dirtyRows={dirtyRows}
                            accounts={accounts}
                            categories={categories}
                            onFieldChange={handleFieldChange}
                            onToggleIgnore={handleToggleIgnore}
                            disabled={isDisabled}
                            focusRowId={focusRowId}
                        />
                    ))
                )}
            </motion.div>

            {/* Bottom bar */}
            {!isConfirmed && (
                <div
                    className="sticky bottom-0 left-0 right-0 border-t px-4 md:px-6 py-3 flex-shrink-0"
                    style={{
                        borderColor: 'var(--border)',
                        background: 'var(--background)',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
                        {/* Stats */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {isDirty && (
                                <span>
                                    <span className="font-medium" style={{ color: '#0284c7' }}>
                                        {Object.keys(dirtyRows).length}
                                    </span>{' '}
                                    con cambios
                                </span>
                            )}
                            {importableCount > 0 && (
                                <span>
                                    <span className="font-medium" style={{ color: '#16a34a' }}>
                                        {importableCount}
                                    </span>{' '}
                                    para importar
                                </span>
                            )}
                            {pendingCount > 0 && (
                                <span>
                                    <span className="font-medium" style={{ color: '#d97706' }}>
                                        {pendingCount}
                                    </span>{' '}
                                    pendientes
                                </span>
                            )}
                            {blockingCount > 0 && (
                                <span>
                                    <span className="font-medium" style={{ color: '#dc2626' }}>
                                        {blockingCount}
                                    </span>{' '}
                                    con error
                                </span>
                            )}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/transactions/import')}
                                disabled={isDisabled}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleMainAction}
                                disabled={
                                    isDisabled ||
                                    (!isDirty && (blockingCount > 0 || pendingCount > 0 || importableCount === 0))
                                }
                                className="gap-2 min-w-32"
                            >
                                {applying ? (
                                    <>
                                        <Spinner className="w-3.5 h-3.5" />
                                        Aplicando...
                                    </>
                                ) : confirming ? (
                                    <>
                                        <Spinner className="w-3.5 h-3.5" />
                                        Importando...
                                    </>
                                ) : isDirty ? (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        Aplicar cambios
                                    </>
                                ) : (
                                    `Confirmar ${importableCount}`
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
 
