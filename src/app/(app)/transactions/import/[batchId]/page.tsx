'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Copy,
    EyeOff, Pencil, ChevronDown, ChevronUp, CreditCard, X, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/shared/Spinner'
import { ImportRowEditDialog } from '@/components/shared/ImportRowEditDialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useImportBatchDetail } from '@/hooks/useImportBatch'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'
import type { IImportRow, IAccount, ICategory, ImportParsedData } from '@/types'

type StatusFilter = 'all' | 'invalid' | 'incomplete' | 'possible_duplicate' | 'ignored' | 'ok'

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    ok: { label: 'Listo', color: '#16a34a', icon: CheckCircle2 },
    incomplete: { label: 'Pendiente', color: '#d97706', icon: AlertTriangle },
    invalid: { label: 'Error', color: '#dc2626', icon: XCircle },
    possible_duplicate: { label: 'Revisar', color: '#7c3aed', icon: Copy },
    ignored: { label: 'Ignorada', color: '#6b7280', icon: EyeOff },
    imported: { label: 'Importada', color: '#0284c7', icon: CheckCircle2 },
}

const TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    transfer: 'Transferencia',
    credit_card_payment: 'Pago de tarjeta',
}

const TYPE_OPTIONS = [
    { value: 'expense', label: 'Gasto' },
    { value: 'income', label: 'Ingreso' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'credit_card_payment', label: 'Pago de tarjeta' },
]

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

/** Devuelve las cuentas compatibles según tipo y cuotas.
 *  Reglas:
 *  - cuotas > 1         → solo credit_card (compra financiada)
 *  - cuotas == 1 o sin cuotas + expense → todas (1 pago con tarjeta es válido)
 *  - credit_card_payment → excluye credit_card y debt como origen
 *  - resto              → todas
 */
function getCompatibleAccounts(accounts: IAccount[], type: string | undefined, installmentCount: number | undefined) {
    const count = installmentCount ?? 0
    // Compra en múltiples cuotas financiadas → obligatorio tarjeta
    if (count > 1) return accounts.filter(a => a.type === 'credit_card')
    // Pago de tarjeta / deuda → la cuenta origen no puede ser tarjeta ni deuda
    if (type === 'credit_card_payment')
        return accounts.filter(a => !['credit_card', 'debt'].includes(a.type))
    // Gasto en 1 pago (incluyendo con tarjeta), ingreso, transferencia → todas
    return accounts
}

function accountFieldLabel(type: string | undefined, installmentCount: number | undefined) {
    if ((installmentCount ?? 0) > 1) return 'Tarjeta'
    if (type === 'credit_card_payment') return 'Cuenta origen'
    return 'Cuenta'
}

function formatAmount(amount: number | undefined, currency: string | undefined) {
    if (!amount) return '—'
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency ?? 'ARS',
        minimumFractionDigits: 0,
    }).format(amount)
}

// ─── Mobile card ─────────────────────────────────────────────────────────────

function RowCard({
    row,
    accounts,
    onEdit,
    onToggleIgnore,
}: {
    row: IImportRow
    accounts: IAccount[]
    onEdit: (row: IImportRow) => void
    onToggleIgnore: (row: IImportRow) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const data: ImportParsedData = { ...(row.parsedData ?? {}), ...(row.reviewedData ?? {}) }
    const dateStr = data.date ? new Date(data.date).toLocaleDateString('es-AR') : '—'
    const amount = formatAmount(data.amount, data.currency)
    const hasUnresolvedAccount = data.accountName && !data.sourceAccountId
    const canEdit = row.status !== 'imported'

    return (
        <motion.div
            layout
            className={cn(
                'rounded-xl border overflow-hidden transition-opacity',
                row.ignored && 'opacity-40'
            )}
            style={{ borderColor: 'var(--border)' }}
        >
            <div
                className="flex items-start gap-3 p-3 cursor-pointer"
                onClick={() => setExpanded((p) => !p)}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">#{row.rowNumber}</span>
                        <StatusBadge status={row.status} />
                        <InstallmentBadge current={data.installmentNumber} total={data.installmentCount} />
                    </div>
                    <p className={cn('text-sm font-medium truncate', row.ignored && 'line-through text-muted-foreground')}>
                        {data.description ?? '—'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm font-semibold">{amount}</span>
                        <span className="text-xs text-muted-foreground">{dateStr}</span>
                        {data.type && (
                            <span className="text-xs text-muted-foreground">
                                {TYPE_LABELS[data.type] ?? data.type}
                            </span>
                        )}
                    </div>
                    {hasUnresolvedAccount && !row.ignored && (
                        <div
                            className="mt-1.5 px-2 py-1 rounded-md text-xs flex items-center gap-1.5"
                            style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
                        >
                            <XCircle className="w-3 h-3 flex-shrink-0" />
                            Cuenta <strong>&quot;{data.accountName}&quot;</strong> no existe en Finp — asigná una cuenta para importar
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                    {canEdit && (
                        <>
                            <Button
                                variant={row.ignored ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 w-7 p-0"
                                title={row.ignored ? 'Dejar de ignorar' : 'Ignorar fila'}
                                onClick={(e) => { e.stopPropagation(); onToggleIgnore(row) }}
                            >
                                <EyeOff className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); onEdit(row) }}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </Button>
                        </>
                    )}
                    {expanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
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
                        <div className="px-3 pb-3 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                            {row.errors.map((e, i) => (
                                <p key={i} className="text-xs font-medium" style={{ color: 'var(--destructive)' }}>⚠ {e}</p>
                            ))}
                            {row.warnings.filter(w => !w.includes('Cuenta')).map((w, i) => (
                                <p key={i} className="text-xs text-muted-foreground">• {w}</p>
                            ))}
                            {data.sourceAccountId && (
                                <p className="text-xs text-muted-foreground">
                                    Cuenta: {accounts.find(a => String(a._id) === data.sourceAccountId)?.name ?? data.accountName ?? '—'}
                                </p>
                            )}
                            {data.categoryId && (
                                <p className="text-xs text-muted-foreground">
                                    Categoría: {data.categoryName ?? '—'}
                                </p>
                            )}
                            {!data.categoryId && data.categoryName && (
                                <p className="text-xs" style={{ color: '#d97706' }}>
                                    ⚠ Categoría &quot;{data.categoryName}&quot; no encontrada → Sin categoría
                                </p>
                            )}
                            {data.cardName && (
                                <p className="text-xs text-muted-foreground">Tarjeta: {data.cardName}</p>
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

// ─── Desktop table row — true inline cell editing ─────────────────────────────

function ReviewTableRow({
    row,
    accounts,
    categories,
    onToggleIgnore,
    onSave,
}: {
    row: IImportRow
    accounts: IAccount[]
    categories: ICategory[]
    onToggleIgnore: (row: IImportRow) => void
    onSave: (rowId: string, updates: { reviewedData?: Partial<ImportParsedData>; ignored?: boolean }) => Promise<void>
}) {
    const [editing, setEditing] = useState(false)
    const [editData, setEditData] = useState<Partial<ImportParsedData>>({})
    const [editIgnored, setEditIgnored] = useState(false)
    const [saving, setSaving] = useState(false)

    const effectiveData: ImportParsedData = { ...(row.parsedData ?? {}), ...(row.reviewedData ?? {}) }
    const dateStr = effectiveData.date ? new Date(effectiveData.date).toLocaleDateString('es-AR') : '—'
    const canEdit = row.status !== 'imported'

    const resolvedAccountName = effectiveData.sourceAccountId
        ? (accounts.find(a => String(a._id) === effectiveData.sourceAccountId)?.name ?? effectiveData.accountName)
        : null
    const resolvedCategoryName = effectiveData.categoryId
        ? (categories.find(c => String(c._id) === effectiveData.categoryId)?.name ?? effectiveData.categoryName)
        : null

    const expenseCategories = categories.filter(c => c.type === 'expense')
    const incomeCategories = categories.filter(c => c.type === 'income')
    const relevantCategories = (editData.type ?? effectiveData.type) === 'income' ? incomeCategories : expenseCategories

    const activeType = editData.type ?? effectiveData.type
    const activeInstCount = editData.installmentCount ?? effectiveData.installmentCount
    const compatibleAccounts = getCompatibleAccounts(accounts, activeType, activeInstCount)
    const acctLabel = accountFieldLabel(activeType, activeInstCount)

    const startEdit = () => {
        setEditData({ ...effectiveData })
        setEditIgnored(row.ignored)
        setEditing(true)
    }

    const cancelEdit = () => setEditing(false)

    const saveEdit = async () => {
        setSaving(true)
        try {
            await onSave(String(row._id), { reviewedData: editData, ignored: editIgnored })
            setEditing(false)
        } finally {
            setSaving(false)
        }
    }

    const hasInstallments = (effectiveData.installmentCount ?? 0) > 1
    const rowOpacity = row.ignored && !editing ? 'opacity-40' : ''
    const showInstallmentRow = editing && hasInstallments

    return (
        <>
        <tr
            className={cn(
                'transition-colors',
                rowOpacity,
                editing ? 'bg-primary/5' : 'hover:bg-muted/20',
            )}
            style={{
                borderBottom: showInstallmentRow ? 'none' : '1px solid var(--border)',
                outline: editing ? '2px solid var(--primary)' : 'none',
                outlineOffset: '-2px',
            }}
        >
            {/* # */}
            <td className="px-3 py-2 text-xs text-muted-foreground">
                {row.rowNumber}
            </td>

            {/* Status */}
            <td className="px-3 py-2">
                <StatusBadge status={editing ? (editIgnored ? 'ignored' : row.status) : row.status} />
            </td>

            {/* Description */}
            <td className="px-2 py-1.5 max-w-xs">
                {editing ? (
                    <Input
                        className="h-7 text-xs min-w-[160px]"
                        value={editData.description ?? ''}
                        onChange={e => setEditData(d => ({ ...d, description: e.target.value }))}
                    />
                ) : (
                    <>
                        <div className="flex items-center gap-2 min-w-0">
                            <p className={cn('text-sm font-medium truncate', row.ignored && 'line-through text-muted-foreground')}>
                                {effectiveData.description ?? '—'}
                            </p>
                            <InstallmentBadge current={effectiveData.installmentNumber} total={effectiveData.installmentCount} />
                        </div>
                        {row.errors.length > 0 && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--destructive)' }}>
                                {row.errors[0]}
                            </p>
                        )}
                        {!row.errors.length && row.warnings.filter(w => !w.includes('Cuenta')).length > 0 && (
                            <p className="text-xs mt-0.5 truncate text-muted-foreground">
                                {row.warnings.filter(w => !w.includes('Cuenta'))[0]}
                            </p>
                        )}
                    </>
                )}
            </td>

            {/* Type */}
            <td className="px-2 py-1.5">
                {editing ? (
                    <Select
                        value={editData.type || '__none__'}
                        onValueChange={v => setEditData(d => ({ ...d, type: v === '__none__' ? undefined : v }))}
                    >
                        <SelectTrigger className="h-7 text-xs w-[130px]">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            {TYPE_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {TYPE_LABELS[effectiveData.type ?? ''] ?? effectiveData.type ?? '—'}
                    </span>
                )}
            </td>

            {/* Amount */}
            <td className="px-2 py-1.5 text-right">
                {editing ? (
                    <Input
                        className="h-7 text-xs text-right w-24"
                        type="number"
                        min={0}
                        step="0.01"
                        value={editData.amount ?? ''}
                        onChange={e => setEditData(d => ({ ...d, amount: parseFloat(e.target.value) || undefined }))}
                    />
                ) : (
                    <span className="text-sm font-medium tabular-nums">
                        {formatAmount(effectiveData.amount, effectiveData.currency)}
                    </span>
                )}
            </td>

            {/* Date — always read-only */}
            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                {dateStr}
            </td>

            {/* Account */}
            <td className="px-2 py-1.5">
                {editing ? (
                    <Select
                        value={editData.sourceAccountId || '__none__'}
                        onValueChange={v => {
                            const acc = accounts.find(a => String(a._id) === v)
                            setEditData(d => ({
                                ...d,
                                sourceAccountId: v === '__none__' ? undefined : v,
                                cardName: acc?.type === 'credit_card' ? acc.name : d.cardName,
                            }))
                        }}
                    >
                        <SelectTrigger className={cn(
                            'h-7 text-xs min-w-[140px]',
                            !editData.sourceAccountId && effectiveData.accountName ? 'border-destructive' : ''
                        )}>
                            <SelectValue placeholder={acctLabel} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Sin cuenta</SelectItem>
                            {compatibleAccounts.map(a => (
                                <SelectItem key={String(a._id)} value={String(a._id)}>
                                    {a.name} · {a.currency}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <span className="text-xs" style={{
                        color: !resolvedAccountName && effectiveData.accountName ? '#dc2626' : 'var(--muted-foreground)'
                    }}>
                        {resolvedAccountName
                            ?? (effectiveData.accountName ? `✕ ${effectiveData.accountName}` : '—')}
                    </span>
                )}
            </td>

            {/* Category */}
            <td className="px-2 py-1.5">
                {activeType === 'credit_card_payment' ? (
                    <span className="text-xs text-muted-foreground">—</span>
                ) : editing ? (
                    <Select
                        value={editData.categoryId || '__none__'}
                        onValueChange={v => setEditData(d => ({ ...d, categoryId: v === '__none__' ? undefined : v }))}
                    >
                        <SelectTrigger className="h-7 text-xs min-w-[130px]">
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Sin categoría</SelectItem>
                            {relevantCategories.map(c => (
                                <SelectItem key={String(c._id)} value={String(c._id)}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {resolvedCategoryName ?? (effectiveData.categoryName ? (
                            <span style={{ color: '#d97706' }} title={`"${effectiveData.categoryName}" no encontrada`}>
                                Sin categoría
                            </span>
                        ) : '—')}
                    </span>
                )}
            </td>

            {/* Actions */}
            <td className="px-2 py-1.5">
                {canEdit && (
                    <div className="flex items-center gap-1 justify-end">
                        {editing ? (
                            <>
                                <Button
                                    variant={editIgnored ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    title={editIgnored ? 'Dejar de ignorar' : 'Ignorar fila'}
                                    onClick={() => setEditIgnored(v => !v)}
                                >
                                    <EyeOff className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={saveEdit}
                                    disabled={saving}
                                    title="Guardar"
                                >
                                    {saving
                                        ? <Spinner className="w-3 h-3" />
                                        : <Check className="w-3.5 h-3.5" />
                                    }
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={cancelEdit}
                                    title="Cancelar"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant={row.ignored ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    title={row.ignored ? 'Dejar de ignorar' : 'Ignorar fila'}
                                    onClick={() => onToggleIgnore(row)}
                                >
                                    <EyeOff className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    title="Editar fila"
                                    onClick={startEdit}
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </td>
        </tr>

        {showInstallmentRow && (
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                <td colSpan={9} style={{ padding: 0 }}>
                    <div
                        className="px-4 py-2 flex items-center gap-3 flex-wrap"
                        style={{ borderLeft: '3px solid var(--primary)' }}
                    >
                        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span className="font-medium">Cuotas:</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">N°</span>
                            <Input
                                className="h-6 text-xs w-14 px-2"
                                type="number"
                                min={1}
                                value={editData.installmentNumber ?? ''}
                                onChange={e => setEditData(d => ({ ...d, installmentNumber: parseInt(e.target.value) || undefined }))}
                            />
                            <span className="text-xs text-muted-foreground">de</span>
                            <Input
                                className="h-6 text-xs w-14 px-2"
                                type="number"
                                min={1}
                                value={editData.installmentCount ?? ''}
                                onChange={e => setEditData(d => ({ ...d, installmentCount: parseInt(e.target.value) || undefined }))}
                            />
                            <span className="text-xs text-muted-foreground ml-2">
                                — Tarjeta: columna <em>Cuenta</em> (solo credit_card)
                            </span>
                        </div>
                    </div>
                </td>
            </tr>
        )}
        </>
    )
}

// ─── Desktop table ────────────────────────────────────────────────────────────

function ReviewTable({
    rows,
    accounts,
    categories,
    onToggleIgnore,
    onSave,
}: {
    rows: IImportRow[]
    accounts: IAccount[]
    categories: ICategory[]
    onToggleIgnore: (row: IImportRow) => void
    onSave: (rowId: string, updates: { reviewedData?: Partial<ImportParsedData>; ignored?: boolean }) => Promise<void>
}) {
    return (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-8">#</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-28">Estado</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground min-w-52">Descripción</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-36">Tipo</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground w-28">Monto</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-24">Fecha</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground min-w-40">Cuenta</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground min-w-36">Categoría</th>
                            <th className="w-24" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <ReviewTableRow
                                key={String(row._id)}
                                row={row}
                                accounts={accounts}
                                categories={categories}
                                onToggleIgnore={onToggleIgnore}
                                onSave={onSave}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    const [showNoCategoryDialog, setShowNoCategoryDialog] = useState(false)

    useEffect(() => {
        fetchDetail()
    }, [fetchDetail])

    const filteredRows = useMemo(() => {
        if (!detail) return []
        if (statusFilter === 'all') return detail.rows
        return detail.rows.filter(r => r.status === statusFilter)
    }, [detail, statusFilter])

    const handleUpdateRow = useCallback(async (
        rowId: string,
        updates: { reviewedData?: Partial<ImportParsedData>; ignored?: boolean }
    ) => {
        try {
            await updateRow(rowId, updates)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al actualizar')
            throw err
        }
    }, [updateRow, toastError])

    const handleToggleIgnore = useCallback(async (row: IImportRow) => {
        await handleUpdateRow(String(row._id), { ignored: !row.ignored })
    }, [handleUpdateRow])

    const doConfirm = async () => {
        setConfirming(true)
        try {
            const result = await confirmImport()
            success(`${result.imported} transacciones importadas correctamente.`)
            router.push('/transactions')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al confirmar importación')
        } finally {
            setConfirming(false)
            setShowNoCategoryDialog(false)
        }
    }

    const handleConfirm = () => {
        if (!detail) return
        // Si hay filas importables sin categoría resuelta, pedir confirmación explícita
        const noCatCount = detail.rows.filter(r => {
            if (r.ignored || r.status === 'invalid' || r.status === 'imported') return false
            const d = { ...(r.parsedData ?? {}), ...(r.reviewedData ?? {}) } as Record<string, unknown>
            return d.categoryName && !d.categoryId
        }).length
        if (noCatCount > 0) {
            setShowNoCategoryDialog(true)
        } else {
            doConfirm()
        }
    }

    const handleSaveEdit = useCallback(async (
        rowId: string,
        updates: { reviewedData?: Partial<ImportParsedData>; ignored?: boolean }
    ) => {
        await handleUpdateRow(rowId, updates)
        success('Fila actualizada')
    }, [handleUpdateRow, success])

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
        r => !r.ignored && r.status !== 'invalid' && r.status !== 'ignored' && r.status !== 'imported'
    ).length
    const blockingCount = rows.filter(r => r.status === 'invalid' && !r.ignored).length
    const pendingCount = rows.filter(r => r.status === 'incomplete' && !r.ignored).length

    type FilterChip = { value: StatusFilter; label: string; count: number; color?: string }
    const filterChips: FilterChip[] = ([
        { value: 'all' as StatusFilter, label: 'Todas', count: summary.total, color: '#0284c7' },
        { value: 'ok' as StatusFilter, label: 'Listas', count: summary.valid, color: '#16a34a' },
        { value: 'incomplete' as StatusFilter, label: 'Pendientes', count: summary.incomplete, color: '#d97706' },
        { value: 'invalid' as StatusFilter, label: 'Con error', count: summary.invalid, color: '#dc2626' },
        { value: 'possible_duplicate' as StatusFilter, label: 'Revisar', count: summary.possibleDuplicate, color: '#7c3aed' },
        { value: 'ignored' as StatusFilter, label: 'Ignoradas', count: summary.ignored, color: '#6b7280' },
    ] as FilterChip[]).filter(f => f.value === 'all' || f.count > 0)

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
                        style={{ background: 'rgba(220, 38, 38, 0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}
                    >
                        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-medium">
                                {blockingCount === 1
                                    ? '1 fila tiene errores que bloquean la importación'
                                    : `${blockingCount} filas tienen errores que bloquean la importación`}
                            </p>
                            <p className="text-xs opacity-80">
                                Las filas con <strong>cuenta no asignada</strong> o <strong>datos inválidos</strong> deben corregirse o ignorarse antes de confirmar.
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

                {/* Filter chips */}
                <div className="flex gap-2 flex-wrap mb-4">
                    {filterChips.map(f => {
                        const active = statusFilter === f.value
                        return (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setStatusFilter(f.value)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                style={{
                                    background: active
                                        ? (f.color ?? 'var(--foreground)')
                                        : 'var(--secondary)',
                                    color: active
                                        ? (f.color ? '#fff' : 'var(--background)')
                                        : (f.color ?? 'var(--muted-foreground)'),
                                    border: `1px solid ${active ? (f.color ?? 'var(--foreground)') : 'var(--border)'}`,
                                }}
                            >
                                {f.label}
                                <span className="ml-1.5 opacity-80">{f.count}</span>
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
                        {/* Desktop */}
                        <div className="hidden md:block">
                            <ReviewTable
                                rows={filteredRows}
                                accounts={accounts}
                                categories={categories}
                                onToggleIgnore={handleToggleIgnore}
                                onSave={handleSaveEdit}
                            />
                        </div>

                        {/* Mobile */}
                        <div className="md:hidden space-y-2">
                            <AnimatePresence mode="popLayout">
                                {filteredRows.map(row => (
                                    <RowCard
                                        key={String(row._id)}
                                        row={row}
                                        accounts={accounts}
                                        onEdit={setEditingRow}
                                        onToggleIgnore={handleToggleIgnore}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </motion.div>

            {/* Sticky action bar */}
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
                                <span className="font-medium" style={{ color: '#16a34a' }}>{importableCount}</span>
                                {' '}para importar
                            </span>
                            {pendingCount > 0 && (
                                <span>
                                    <span className="font-medium" style={{ color: '#d97706' }}>{pendingCount}</span>
                                    {' '}pendientes
                                </span>
                            )}
                            {blockingCount > 0 && (
                                <span>
                                    <span className="font-medium" style={{ color: '#dc2626' }}>{blockingCount}</span>
                                    {' '}con error
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/transactions/import')}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleConfirm}
                                disabled={confirming || blockingCount > 0 || importableCount === 0}
                                className="gap-2"
                            >
                                {confirming ? (
                                    <><Spinner className="w-3.5 h-3.5" />Importando...</>
                                ) : (
                                    `Confirmar ${importableCount}`
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dialog edición — mobile only */}
            <ImportRowEditDialog
                row={editingRow}
                open={!!editingRow}
                onOpenChange={open => { if (!open) setEditingRow(null) }}
                accounts={accounts}
                categories={categories}
                onSave={handleSaveEdit}
            />

            {/* Confirmación sin categoría */}
            <AlertDialog open={showNoCategoryDialog} onOpenChange={setShowNoCategoryDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Categorías no reconocidas</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div>
                                {(() => {
                                    const n = detail?.rows.filter(r => {
                                        if (r.ignored || r.status === 'invalid' || r.status === 'imported') return false
                                        const d = { ...(r.parsedData ?? {}), ...(r.reviewedData ?? {}) } as Record<string, unknown>
                                        return d.categoryName && !d.categoryId
                                    }).length ?? 0
                                    return (
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-semibold text-foreground">{n}</span>{' '}
                                            {n === 1 ? 'transacción se importará' : 'transacciones se importarán'} como{' '}
                                            <span className="font-semibold text-foreground">Sin categoría</span>{' '}
                                            porque las categorías del archivo no existen en Finp. Podés volver y asignarlas manualmente, o confirmar e importar igual.
                                        </p>
                                    )
                                })()}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Volver y revisar</AlertDialogCancel>
                        <AlertDialogAction onClick={doConfirm} disabled={confirming}>
                            {confirming ? 'Importando...' : 'Importar igual'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
