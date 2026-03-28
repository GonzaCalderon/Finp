'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/shared/Spinner'
import type { IImportRow, IAccount, ICategory, ImportParsedData } from '@/types'

const TYPE_OPTIONS = [
    { value: 'expense', label: 'Gasto' },
    { value: 'income', label: 'Ingreso' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'credit_card_payment', label: 'Pago tarjeta' },
]

const CURRENCY_OPTIONS = [
    { value: 'ARS', label: 'ARS' },
    { value: 'USD', label: 'USD' },
]

interface ImportRowEditDialogProps {
    row: IImportRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    accounts: IAccount[]
    categories: ICategory[]
    onSave: (rowId: string, updates: { reviewedData?: Partial<ImportParsedData>; ignored?: boolean }) => Promise<void>
}

export function ImportRowEditDialog({
    row,
    open,
    onOpenChange,
    accounts,
    categories,
    onSave,
}: ImportRowEditDialogProps) {
    const [saving, setSaving] = useState(false)
    const [data, setData] = useState<Partial<ImportParsedData>>({})
    const [ignored, setIgnored] = useState(false)

    const effectiveData: ImportParsedData = {
        ...(row?.parsedData ?? {}),
        ...(row?.reviewedData ?? {}),
    }

    useEffect(() => {
        if (row) {
            setData({
                type: effectiveData.type,
                description: effectiveData.description,
                amount: effectiveData.amount,
                currency: effectiveData.currency,
                categoryId: effectiveData.categoryId,
                categoryName: effectiveData.categoryName,
                sourceAccountId: effectiveData.sourceAccountId,
                accountName: effectiveData.accountName,
                notes: effectiveData.notes,
                date: effectiveData.date,
                cardName: effectiveData.cardName,
                installmentCount: effectiveData.installmentCount,
                installmentNumber: effectiveData.installmentNumber,
            })
            setIgnored(row.ignored)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row])

    if (!row) return null

    const hasInstallments = (effectiveData.installmentCount ?? 0) > 1 || (data.installmentCount ?? 0) > 1
    const hasUnresolvedAccount = (data.accountName ?? effectiveData.accountName) && !data.sourceAccountId

    const expenseCategories = categories.filter((c) => c.type === 'expense')
    const incomeCategories = categories.filter((c) => c.type === 'income')
    const relevantCategories = data.type === 'income' ? incomeCategories : expenseCategories

    const handleSave = async () => {
        if (!row) return
        setSaving(true)
        try {
            await onSave(String(row._id), { reviewedData: data, ignored })
            onOpenChange(false)
        } finally {
            setSaving(false)
        }
    }

    const dateString = data.date
        ? (data.date instanceof Date ? data.date : new Date(data.date)).toLocaleDateString('es-AR')
        : effectiveData.date
        ? new Date(effectiveData.date).toLocaleDateString('es-AR')
        : ''

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>Editar fila {row.rowNumber}</DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto px-5 py-4 space-y-4 max-h-[75vh]">
                    {/* Errores y advertencias */}
                    {row.errors.length > 0 && (
                        <div className="rounded-lg p-3 space-y-1 text-xs"
                            style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}>
                            {row.errors.map((e, i) => (
                                <p key={i}>⚠ {e}</p>
                            ))}
                        </div>
                    )}
                    {hasUnresolvedAccount && !ignored && (
                        <div className="rounded-lg p-3 flex items-start gap-2 text-xs"
                            style={{ background: 'rgba(217,119,6,0.10)', color: '#d97706' }}>
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                                La cuenta <strong>{data.accountName ?? effectiveData.accountName}</strong> no existe en Finp.
                                Asigná una cuenta válida para poder importar esta fila.
                            </span>
                        </div>
                    )}
                    {row.warnings.filter(w => !w.includes('Cuenta')).map((w, i) => (
                        <div key={i} className="rounded-lg px-3 py-2 text-xs text-muted-foreground"
                            style={{ background: 'var(--secondary)' }}>
                            • {w}
                        </div>
                    ))}

                    {/* Ignorar fila */}
                    <div className="flex items-center justify-between rounded-xl border px-4 py-3"
                        style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}>
                        <div>
                            <p className="text-sm font-medium">Ignorar esta fila</p>
                            <p className="text-xs text-muted-foreground">No se importará</p>
                        </div>
                        <Switch checked={ignored} onCheckedChange={setIgnored} />
                    </div>

                    {!ignored && (
                        <>
                            {/* Fecha (solo lectura) */}
                            <div className="space-y-2">
                                <Label>Fecha</Label>
                                <Input value={dateString} disabled className="opacity-60" />
                            </div>

                            {/* Tipo + Moneda */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Tipo</Label>
                                    <Select
                                        value={data.type || '__none__'}
                                        onValueChange={(v) => setData((d) => ({ ...d, type: v === '__none__' ? undefined : v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccioná" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TYPE_OPTIONS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Moneda</Label>
                                    <Select
                                        value={data.currency || '__none__'}
                                        onValueChange={(v) => setData((d) => ({ ...d, currency: v === '__none__' ? undefined : v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccioná" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CURRENCY_OPTIONS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Descripción */}
                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Input
                                    value={data.description ?? ''}
                                    onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
                                />
                            </div>

                            {/* Monto */}
                            <div className="space-y-2">
                                <Label>Monto</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={data.amount ?? ''}
                                    onChange={(e) => setData((d) => ({ ...d, amount: parseFloat(e.target.value) || undefined }))}
                                />
                            </div>

                            {/* Cuenta */}
                            <div className="space-y-2">
                                <Label>Cuenta</Label>
                                <Select
                                    value={data.sourceAccountId || '__none__'}
                                    onValueChange={(v) => setData((d) => ({ ...d, sourceAccountId: v === '__none__' ? undefined : v }))}
                                >
                                    <SelectTrigger className={hasUnresolvedAccount ? 'border-orange-400' : ''}>
                                        <SelectValue placeholder="Seleccioná cuenta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Sin cuenta</SelectItem>
                                        {accounts.map((a) => (
                                            <SelectItem key={String(a._id)} value={String(a._id)}>
                                                {a.name} · {a.currency}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Categoría */}
                            <div className="space-y-2">
                                <Label>Categoría <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                                <Select
                                    value={data.categoryId || '__none__'}
                                    onValueChange={(v) => setData((d) => ({ ...d, categoryId: v === '__none__' ? undefined : v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccioná categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Sin categoría</SelectItem>
                                        {relevantCategories.map((c) => (
                                            <SelectItem key={String(c._id)} value={String(c._id)}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Cuotas (si aplica) */}
                            {hasInstallments && (
                                <div className="rounded-xl border p-4 space-y-3"
                                    style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Cuotas
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-xs">N° de cuota</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={data.installmentNumber ?? ''}
                                                onChange={(e) => setData((d) => ({ ...d, installmentNumber: parseInt(e.target.value) || undefined }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Total cuotas</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={data.installmentCount ?? ''}
                                                onChange={(e) => setData((d) => ({ ...d, installmentCount: parseInt(e.target.value) || undefined }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Tarjeta</Label>
                                        <Select
                                            value={data.sourceAccountId || '__none__'}
                                            onValueChange={(v) => {
                                                const acc = accounts.find(a => String(a._id) === v)
                                                setData((d) => ({
                                                    ...d,
                                                    sourceAccountId: v === '__none__' ? undefined : v,
                                                    cardName: acc?.name,
                                                }))
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccioná tarjeta" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">Sin tarjeta</SelectItem>
                                                {accounts.filter(a => a.type === 'credit_card').map((a) => (
                                                    <SelectItem key={String(a._id)} value={String(a._id)}>
                                                        {a.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {/* Notas */}
                            <div className="space-y-2">
                                <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                                <Input
                                    value={data.notes ?? ''}
                                    onChange={(e) => setData((d) => ({ ...d, notes: e.target.value }))}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="border-t px-5 py-4 flex gap-2" style={{ borderColor: 'var(--border)' }}>
                    <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
                        {saving ? <><Spinner className="mr-2" />Guardando...</> : 'Guardar cambios'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
