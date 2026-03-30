'use client'

import { useEffect, useMemo, useState } from 'react'
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
import {
    getCompatibleDestinationAccounts,
    getCompatibleSourceAccounts,
    getImportAccountFieldLabel,
    getImportCategoryKind,
    getImportDestinationFieldLabel,
    IMPORT_TRANSACTION_TYPE_OPTIONS,
    normalizeImportTransactionType,
    shouldShowFirstClosingMonth,
    typeRequiresDestinationAccount,
    typeRequiresSourceAccount,
    typeSupportsCategory,
} from '@/lib/utils/import-transactions'

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

    const effectiveData = useMemo<ImportParsedData>(
        () => ({
            ...(row?.parsedData ?? {}),
            ...(row?.reviewedData ?? {}),
        }),
        [row]
    )

    useEffect(() => {
        if (!row) return

        setData({
            type: effectiveData.type,
            description: effectiveData.description,
            amount: effectiveData.amount,
            currency: effectiveData.currency,
            categoryId: effectiveData.categoryId,
            categoryName: effectiveData.categoryName,
            sourceAccountId: effectiveData.sourceAccountId,
            destinationAccountId: effectiveData.destinationAccountId,
            accountName: effectiveData.accountName,
            destinationAccountName: effectiveData.destinationAccountName,
            notes: effectiveData.notes,
            date: effectiveData.date,
            cardName: effectiveData.cardName,
            installmentCount: effectiveData.installmentCount,
            installmentNumber: effectiveData.installmentNumber,
            firstClosingMonth: effectiveData.firstClosingMonth,
        })
        setIgnored(row.ignored)
    }, [effectiveData, row])

    const activeType = normalizeImportTransactionType(data.type ?? effectiveData.type)
    const categoryKind = getImportCategoryKind(activeType)
    const compatibleSourceAccounts = useMemo(
        () => getCompatibleSourceAccounts(accounts, activeType),
        [accounts, activeType]
    )
    const compatibleDestinationAccounts = useMemo(
        () => getCompatibleDestinationAccounts(accounts, activeType),
        [accounts, activeType]
    )
    const relevantCategories = useMemo(
        () =>
            categoryKind
                ? categories.filter((category) => category.type === categoryKind)
                : [],
        [categories, categoryKind]
    )

    const hasSourceAccountIssue =
        typeRequiresSourceAccount(activeType) &&
        Boolean(data.accountName ?? effectiveData.accountName) &&
        !(data.sourceAccountId ?? effectiveData.sourceAccountId)
    const hasDestinationAccountIssue =
        typeRequiresDestinationAccount(activeType) &&
        Boolean(data.destinationAccountName ?? effectiveData.destinationAccountName) &&
        !(data.destinationAccountId ?? effectiveData.destinationAccountId)

    const dateString = data.date
        ? (data.date instanceof Date ? data.date : new Date(data.date)).toLocaleDateString('es-AR')
        : effectiveData.date
            ? new Date(effectiveData.date).toLocaleDateString('es-AR')
            : ''

    const showInstallmentFields = activeType === 'credit_card_expense'
    const showFirstClosingMonth = shouldShowFirstClosingMonth({
        ...effectiveData,
        ...data,
        type: activeType,
    })

    const handleTypeChange = (value: string) => {
        setData((current) => {
            const next: Partial<ImportParsedData> = {
                ...current,
                type: value,
            }

            if (!typeSupportsCategory(value)) {
                next.categoryId = undefined
            }

            if (!typeRequiresDestinationAccount(value)) {
                next.destinationAccountId = undefined
                next.destinationAccountName = undefined
            }

            if (value !== 'credit_card_expense') {
                next.installmentCount = undefined
                next.installmentNumber = undefined
                next.firstClosingMonth = undefined
            }

            return next
        })
    }

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

    if (!row) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>Editar fila {row.rowNumber}</DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto px-5 py-4 space-y-4 max-h-[78vh]">
                    {row.errors.length > 0 && (
                        <div
                            className="rounded-lg p-3 space-y-1 text-xs"
                            style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}
                        >
                            {row.errors.map((error, index) => (
                                <p key={index}>⚠ {error}</p>
                            ))}
                        </div>
                    )}

                    {hasSourceAccountIssue && !ignored && (
                        <div
                            className="rounded-lg p-3 flex items-start gap-2 text-xs"
                            style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
                        >
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                                La cuenta <strong>&quot;{data.accountName ?? effectiveData.accountName}&quot;</strong> no existe en Finp.
                                Asigná una cuenta válida para poder importar esta fila.
                            </span>
                        </div>
                    )}

                    {hasDestinationAccountIssue && !ignored && (
                        <div
                            className="rounded-lg p-3 flex items-start gap-2 text-xs"
                            style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
                        >
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                                La cuenta destino <strong>&quot;{data.destinationAccountName ?? effectiveData.destinationAccountName}&quot;</strong> no existe en Finp.
                                Asigná una cuenta válida para poder importar esta fila.
                            </span>
                        </div>
                    )}

                    {row.warnings.map((warning, index) => (
                        <div
                            key={index}
                            className="rounded-lg px-3 py-2 text-xs text-muted-foreground"
                            style={{ background: 'var(--secondary)' }}
                        >
                            • {warning}
                        </div>
                    ))}

                    <div
                        className="flex items-center justify-between rounded-xl border px-4 py-3"
                        style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
                    >
                        <div>
                            <p className="text-sm font-medium">Ignorar esta fila</p>
                            <p className="text-xs text-muted-foreground">No se importará</p>
                        </div>
                        <Switch checked={ignored} onCheckedChange={setIgnored} />
                    </div>

                    {!ignored && (
                        <>
                            <div className="space-y-2">
                                <Label>Fecha</Label>
                                <Input value={dateString} disabled className="opacity-60" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Tipo</Label>
                                    <Select value={activeType || '__none__'} onValueChange={handleTypeChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccioná" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {IMPORT_TRANSACTION_TYPE_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Moneda</Label>
                                    <Select
                                        value={data.currency || '__none__'}
                                        onValueChange={(value) =>
                                            setData((current) => ({
                                                ...current,
                                                currency: value === '__none__' ? undefined : value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccioná" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CURRENCY_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Input
                                    value={data.description ?? ''}
                                    onChange={(event) =>
                                        setData((current) => ({ ...current, description: event.target.value }))
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Monto</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={data.amount ?? ''}
                                    onChange={(event) =>
                                        setData((current) => ({
                                            ...current,
                                            amount:
                                                event.target.value === ''
                                                    ? undefined
                                                    : Number(event.target.value),
                                        }))
                                    }
                                />
                            </div>

                            {typeRequiresSourceAccount(activeType) && (
                                <div className="space-y-2">
                                    <Label>{getImportAccountFieldLabel(activeType)}</Label>
                                    <Select
                                        value={data.sourceAccountId || '__none__'}
                                        onValueChange={(value) => {
                                            const account = accounts.find((item) => String(item._id) === value)

                                            setData((current) => {
                                                const nextType =
                                                    current.type === 'expense' && account?.type === 'credit_card'
                                                        ? 'credit_card_expense'
                                                        : current.type

                                                return {
                                                    ...current,
                                                    type: nextType,
                                                    sourceAccountId: value === '__none__' ? undefined : value,
                                                    accountName: value === '__none__' ? undefined : account?.name,
                                                    cardName:
                                                        account?.type === 'credit_card' ? account.name : current.cardName,
                                                }
                                            })
                                        }}
                                    >
                                        <SelectTrigger className={hasSourceAccountIssue ? 'border-destructive' : ''}>
                                            <SelectValue placeholder="Seleccioná cuenta" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Sin cuenta</SelectItem>
                                            {compatibleSourceAccounts.map((account) => (
                                                <SelectItem key={String(account._id)} value={String(account._id)}>
                                                    {account.name} · {account.currency}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {typeRequiresDestinationAccount(activeType) && (
                                <div className="space-y-2">
                                    <Label>{getImportDestinationFieldLabel(activeType)}</Label>
                                    <Select
                                        value={data.destinationAccountId || '__none__'}
                                        onValueChange={(value) => {
                                            const account = accounts.find((item) => String(item._id) === value)
                                            setData((current) => ({
                                                ...current,
                                                destinationAccountId: value === '__none__' ? undefined : value,
                                                destinationAccountName:
                                                    value === '__none__' ? undefined : account?.name,
                                                cardName:
                                                    activeType === 'credit_card_payment' && account?.type === 'credit_card'
                                                        ? account.name
                                                        : current.cardName,
                                            }))
                                        }}
                                    >
                                        <SelectTrigger className={hasDestinationAccountIssue ? 'border-destructive' : ''}>
                                            <SelectValue placeholder="Seleccioná cuenta destino" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Sin cuenta destino</SelectItem>
                                            {compatibleDestinationAccounts.map((account) => (
                                                <SelectItem key={String(account._id)} value={String(account._id)}>
                                                    {account.name} · {account.currency}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {typeSupportsCategory(activeType) && (
                                <div className="space-y-2">
                                    <Label>Categoría</Label>
                                    <Select
                                        value={data.categoryId || '__none__'}
                                        onValueChange={(value) =>
                                            setData((current) => ({
                                                ...current,
                                                categoryId: value === '__none__' ? undefined : value,
                                                categoryName:
                                                    value === '__none__'
                                                        ? undefined
                                                        : categories.find((category) => String(category._id) === value)?.name,
                                            }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccioná categoría" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Sin categoría</SelectItem>
                                            {relevantCategories.map((category) => (
                                                <SelectItem key={String(category._id)} value={String(category._id)}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {showInstallmentFields && (
                                <div
                                    className="rounded-xl border p-4 space-y-3"
                                    style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
                                >
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Plan de cuotas
                                    </p>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Total cuotas</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={data.installmentCount ?? ''}
                                                onChange={(event) =>
                                                    setData((current) => ({
                                                        ...current,
                                                        installmentCount:
                                                            event.target.value === ''
                                                                ? undefined
                                                                : Number(event.target.value),
                                                    }))
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs">Cuota actual</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={data.installmentNumber ?? ''}
                                                onChange={(event) =>
                                                    setData((current) => ({
                                                        ...current,
                                                        installmentNumber:
                                                            event.target.value === ''
                                                                ? undefined
                                                                : Number(event.target.value),
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    {showFirstClosingMonth && (
                                        <div className="space-y-2">
                                            <Label className="text-xs">Mes de primera cuota</Label>
                                            <Input
                                                type="month"
                                                value={data.firstClosingMonth ?? ''}
                                                onChange={(event) =>
                                                    setData((current) => ({
                                                        ...current,
                                                        firstClosingMonth: event.target.value || undefined,
                                                    }))
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                                <Input
                                    value={data.notes ?? ''}
                                    onChange={(event) =>
                                        setData((current) => ({ ...current, notes: event.target.value }))
                                    }
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
                        {saving ? (
                            <>
                                <Spinner className="mr-2" />
                                Guardando...
                            </>
                        ) : (
                            'Guardar cambios'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
