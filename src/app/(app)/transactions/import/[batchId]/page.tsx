'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Copy,
    CreditCard,
    EyeOff,
    Pencil,
    XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/shared/Spinner'
import { ImportRowEditDialog } from '@/components/shared/ImportRowEditDialog'
import { useImportBatchDetail } from '@/hooks/useImportBatch'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'
import type { IAccount, ICategory, IImportRow, ImportParsedData } from '@/types'
import { IMPORT_TRANSACTION_TYPE_LABELS } from '@/lib/utils/import-transactions'

type StatusFilter = 'all' | 'invalid' | 'incomplete' | 'possible_duplicate' | 'ignored' | 'ok'

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    ok: { label: 'Lista', color: '#16a34a', icon: CheckCircle2 },
    incomplete: { label: 'Pendiente', color: '#d97706', icon: AlertTriangle },
    invalid: { label: 'Error', color: '#dc2626', icon: XCircle },
    possible_duplicate: { label: 'Revisar', color: '#7c3aed', icon: Copy },
    ignored: { label: 'Ignorada', color: '#6b7280', icon: EyeOff },
    imported: { label: 'Importada', color: '#0284c7', icon: CheckCircle2 },
}

function formatAmount(amount: number | undefined, currency: string | undefined) {
    if (amount === undefined || amount === null) return '—'

    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency ?? 'ARS',
        minimumFractionDigits: 0,
    }).format(amount)
}

function getRowData(row: IImportRow): ImportParsedData {
    return { ...(row.parsedData ?? {}), ...(row.reviewedData ?? {}) }
}

function getAccountName(accounts: IAccount[], accountId?: string, fallback?: string) {
    return (
        (accountId ? accounts.find((account) => String(account._id) === accountId)?.name : undefined) ??
        fallback ??
        '—'
    )
}

function getCategoryName(categories: ICategory[], categoryId?: string, fallback?: string) {
    return (
        (categoryId ? categories.find((category) => String(category._id) === categoryId)?.name : undefined) ??
        fallback ??
        'Sin categoría'
    )
}

function getAccountSummary(data: ImportParsedData, accounts: IAccount[]) {
    const sourceName = getAccountName(accounts, data.sourceAccountId, data.accountName)
    const destinationName = getAccountName(
        accounts,
        data.destinationAccountId,
        data.destinationAccountName
    )

    if (data.type === 'income') return destinationName
    if (data.type === 'transfer' || data.type === 'credit_card_payment') {
        return `${sourceName} → ${destinationName}`
    }

    return sourceName
}

function StatusBadge({ status }: { status: string }) {
    const meta = STATUS_META[status] ?? { label: status, color: '#6b7280', icon: AlertTriangle }
    const Icon = meta.icon

    return (
        <span
            className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap"
            style={{ background: `${meta.color}18`, color: meta.color }}
        >
            <Icon className="w-3 h-3 flex-shrink-0" />
            {meta.label}
        </span>
    )
}

function InstallmentBadge({ current, total }: { current?: number; total?: number }) {
    if (!total || total < 2) return null

    return (
        <span
            className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7' }}
        >
            <CreditCard className="w-3 h-3 flex-shrink-0" />
            {current ?? 1}/{total}
        </span>
    )
}

function RowCard({
    row,
    accounts,
    categories,
    onEdit,
    onToggleIgnore,
}: {
    row: IImportRow
    accounts: IAccount[]
    categories: ICategory[]
    onEdit: (row: IImportRow) => void
    onToggleIgnore: (row: IImportRow) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const data = getRowData(row)
    const dateLabel = data.date ? new Date(data.date).toLocaleDateString('es-AR') : '—'
    const amount = formatAmount(data.amount, data.currency)
    const typeLabel = data.type ? IMPORT_TRANSACTION_TYPE_LABELS[data.type] ?? data.type : 'Sin tipo'
    const accountSummary = getAccountSummary(data, accounts)
    const categoryLabel = getCategoryName(categories, data.categoryId, data.categoryName)

    return (
        <motion.div
            layout
            className={cn(
                'rounded-xl border overflow-hidden transition-opacity',
                row.ignored && 'opacity-45'
            )}
            style={{ borderColor: 'var(--border)' }}
        >
            <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setExpanded((value) => !value)}>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">#{row.rowNumber}</span>
                        <StatusBadge status={row.status} />
                        <InstallmentBadge current={data.installmentNumber} total={data.installmentCount} />
                    </div>

                    <p className={cn('text-sm font-medium truncate', row.ignored && 'line-through text-muted-foreground')}>
                        {data.description ?? '—'}
                    </p>

                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                        <span className="text-sm font-semibold text-foreground">{amount}</span>
                        <span>{dateLabel}</span>
                        <span>{typeLabel}</span>
                    </div>

                    <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground truncate">{accountSummary}</p>
                        <p className="text-xs text-muted-foreground truncate">{categoryLabel}</p>
                    </div>

                    {row.errors.length > 0 && !row.ignored && (
                        <p className="text-xs mt-2 font-medium" style={{ color: 'var(--destructive)' }}>
                            ⚠ {row.errors[0]}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                    {row.status !== 'imported' && (
                        <>
                            <Button
                                variant={row.ignored ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onToggleIgnore(row)
                                }}
                            >
                                <EyeOff className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onEdit(row)
                                }}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </Button>
                        </>
                    )}
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                            {row.errors.slice(1).map((error, index) => (
                                <p key={index} className="text-xs font-medium" style={{ color: 'var(--destructive)' }}>
                                    ⚠ {error}
                                </p>
                            ))}

                            {row.warnings.map((warning, index) => (
                                <p key={index} className="text-xs text-muted-foreground">
                                    • {warning}
                                </p>
                            ))}

                            {(data.installmentCount ?? 1) > 1 && (
                                <p className="text-xs text-muted-foreground">
                                    Plan: {data.installmentNumber ?? 1}/{data.installmentCount}
                                    {data.firstClosingMonth ? ` · Primera cuota ${data.firstClosingMonth}` : ''}
                                </p>
                            )}

                            {data.notes && (
                                <p className="text-xs text-muted-foreground">Notas: {data.notes}</p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function ReviewTable({
    rows,
    accounts,
    categories,
    onEdit,
    onToggleIgnore,
}: {
    rows: IImportRow[]
    accounts: IAccount[]
    categories: ICategory[]
    onEdit: (row: IImportRow) => void
    onToggleIgnore: (row: IImportRow) => void
}) {
    return (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-8">#</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-28">Estado</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground min-w-64">Movimiento</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground min-w-52">Cuenta</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground min-w-44">Categoría</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground w-28">Monto</th>
                            <th className="w-24" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const data = getRowData(row)
                            const dateLabel = data.date ? new Date(data.date).toLocaleDateString('es-AR') : '—'
                            const typeLabel = data.type
                                ? IMPORT_TRANSACTION_TYPE_LABELS[data.type] ?? data.type
                                : 'Sin tipo'
                            const accountSummary = getAccountSummary(data, accounts)
                            const categoryLabel = getCategoryName(categories, data.categoryId, data.categoryName)

                            return (
                                <tr
                                    key={String(row._id)}
                                    className={cn('border-b align-top', row.ignored && 'opacity-45')}
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <td className="px-3 py-3 text-xs text-muted-foreground">{row.rowNumber}</td>
                                    <td className="px-3 py-3">
                                        <StatusBadge status={row.status} />
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-medium">{data.description ?? '—'}</p>
                                                <InstallmentBadge
                                                    current={data.installmentNumber}
                                                    total={data.installmentCount}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {typeLabel} · {dateLabel}
                                            </p>
                                            {row.errors.length > 0 && (
                                                <p className="text-xs font-medium" style={{ color: 'var(--destructive)' }}>
                                                    ⚠ {row.errors[0]}
                                                </p>
                                            )}
                                            {row.errors.length === 0 && row.warnings[0] && (
                                                <p className="text-xs text-muted-foreground">{row.warnings[0]}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-muted-foreground">
                                        <div className="space-y-1">
                                            <p>{accountSummary}</p>
                                            {(data.installmentCount ?? 1) > 1 && (
                                                <p>
                                                    {data.installmentNumber ?? 1}/{data.installmentCount}
                                                    {data.firstClosingMonth ? ` · ${data.firstClosingMonth}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-muted-foreground">{categoryLabel}</td>
                                    <td className="px-3 py-3 text-right text-sm font-medium">
                                        {formatAmount(data.amount, data.currency)}
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {row.status !== 'imported' && (
                                                <>
                                                    <Button
                                                        variant={row.ignored ? 'secondary' : 'ghost'}
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => onToggleIgnore(row)}
                                                    >
                                                        <EyeOff className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => onEdit(row)}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

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
    const [editingRow, setEditingRow] = useState<IImportRow | null>(null)
    const [confirming, setConfirming] = useState(false)

    useEffect(() => {
        fetchDetail()
    }, [fetchDetail])

    const filteredRows = useMemo(() => {
        if (!detail) return []
        if (statusFilter === 'all') return detail.rows
        return detail.rows.filter((row) => row.status === statusFilter)
    }, [detail, statusFilter])

    const handleUpdateRow = useCallback(
        async (rowId: string, updates: { reviewedData?: Partial<ImportParsedData>; ignored?: boolean }) => {
            try {
                await updateRow(rowId, updates)
            } catch (error) {
                toastError(error instanceof Error ? error.message : 'Error al actualizar')
                throw error
            }
        },
        [toastError, updateRow]
    )

    const handleToggleIgnore = useCallback(
        async (row: IImportRow) => {
            await handleUpdateRow(String(row._id), { ignored: !row.ignored })
        },
        [handleUpdateRow]
    )

    const handleSaveEdit = useCallback(
        async (rowId: string, updates: { reviewedData?: Partial<ImportParsedData>; ignored?: boolean }) => {
            await handleUpdateRow(rowId, updates)
            success('Fila actualizada')
        },
        [handleUpdateRow, success]
    )

    const handleConfirm = async () => {
        setConfirming(true)
        try {
            const result = await confirmImport()
            success(`${result.imported} transacciones importadas correctamente.`)
            router.push('/transactions')
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'Error al confirmar importación')
        } finally {
            setConfirming(false)
        }
    }

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
                <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/transactions/import')}>
                    Volver
                </Button>
            </div>
        )
    }

    const { batch, rows } = detail
    const summary = batch.summary
    const isConfirmed = batch.status === 'confirmed'

    const importableCount = rows.filter(
        (row) =>
            !row.ignored &&
            [ 'ok', 'possible_duplicate' ].includes(row.status) &&
            row.status !== 'imported'
    ).length
    const blockingCount = rows.filter((row) => row.status === 'invalid' && !row.ignored).length
    const pendingCount = rows.filter((row) => row.status === 'incomplete' && !row.ignored).length

    const filterChips = ([
        { value: 'all' as StatusFilter, label: 'Todas', count: summary.total, color: '#0284c7' },
        { value: 'ok' as StatusFilter, label: 'Listas', count: summary.valid, color: '#16a34a' },
        { value: 'incomplete' as StatusFilter, label: 'Pendientes', count: summary.incomplete, color: '#d97706' },
        { value: 'invalid' as StatusFilter, label: 'Con error', count: summary.invalid, color: '#dc2626' },
        { value: 'possible_duplicate' as StatusFilter, label: 'Revisar', count: summary.possibleDuplicate, color: '#7c3aed' },
        { value: 'ignored' as StatusFilter, label: 'Ignoradas', count: summary.ignored, color: '#6b7280' },
    ]).filter((item) => item.value === 'all' || item.count > 0)

    return (
        <div className="flex flex-col min-h-full">
            <div className="flex items-center gap-3 px-4 md:px-6 py-3 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => router.push('/transactions/import')} className="gap-1.5">
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
                <div className="mb-4">
                    <h1 className="text-xl font-semibold">Revisión de importación</h1>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{batch.fileName}</p>
                </div>

                {blockingCount > 0 && !isConfirmed && (
                    <div
                        className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
                        style={{
                            background: 'rgba(220, 38, 38, 0.08)',
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
                            background: 'rgba(217, 119, 6, 0.10)',
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
                                Completá cuenta, categoría o datos del plan antes de importar.
                            </p>
                        </div>
                    </div>
                )}

                {isConfirmed && (
                    <div
                        className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
                        style={{ background: 'rgba(22, 163, 74, 0.08)', color: '#16a34a' }}
                    >
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>Importación confirmada. Se crearon {summary.imported} transacciones.</span>
                    </div>
                )}

                <div className="flex gap-2 flex-wrap mb-4">
                    {filterChips.map((filter) => {
                        const active = statusFilter === filter.value
                        return (
                            <button
                                key={filter.value}
                                type="button"
                                onClick={() => setStatusFilter(filter.value)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                style={{
                                    background: active ? filter.color : 'var(--secondary)',
                                    color: active ? '#fff' : filter.color,
                                    border: `1px solid ${active ? filter.color : 'var(--border)'}`,
                                }}
                            >
                                {filter.label}
                                <span className="ml-1.5 opacity-80">{filter.count}</span>
                            </button>
                        )
                    })}
                </div>

                {filteredRows.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                        No hay filas con este estado.
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block">
                            <ReviewTable
                                rows={filteredRows}
                                accounts={accounts}
                                categories={categories}
                                onEdit={setEditingRow}
                                onToggleIgnore={handleToggleIgnore}
                            />
                        </div>

                        <div className="md:hidden space-y-2">
                            <AnimatePresence mode="popLayout">
                                {filteredRows.map((row) => (
                                    <RowCard
                                        key={String(row._id)}
                                        row={row}
                                        accounts={accounts}
                                        categories={categories}
                                        onEdit={setEditingRow}
                                        onToggleIgnore={handleToggleIgnore}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </motion.div>

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
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span>
                                <span className="font-medium" style={{ color: '#16a34a' }}>
                                    {importableCount}
                                </span>{' '}
                                para importar
                            </span>
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

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button variant="outline" size="sm" onClick={() => router.push('/transactions/import')}>
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleConfirm}
                                disabled={confirming || blockingCount > 0 || pendingCount > 0 || importableCount === 0}
                                className="gap-2"
                            >
                                {confirming ? (
                                    <>
                                        <Spinner className="w-3.5 h-3.5" />
                                        Importando...
                                    </>
                                ) : (
                                    `Confirmar ${importableCount}`
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ImportRowEditDialog
                row={editingRow}
                open={!!editingRow}
                onOpenChange={(open) => {
                    if (!open) setEditingRow(null)
                }}
                accounts={accounts}
                categories={categories}
                onSave={handleSaveEdit}
            />
        </div>
    )
}
