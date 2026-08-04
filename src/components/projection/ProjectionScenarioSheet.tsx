'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CreditCard, Pencil, ReceiptText, RotateCcw, Trash2 } from 'lucide-react'
import { apiJson } from '@/lib/client/auth-client'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { CategoryPickerField } from '@/components/shared/CategoryPickerField'
import { CommitmentDayPicker } from '@/components/commitments/CommitmentDayPicker'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { MonthPickerField, type MonthOption } from '@/components/shared/MonthPickerField'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getSupportedCurrencies } from '@/lib/utils/accounts'
import type { IAccount, ICategory } from '@/types'
import type {
    ProjectionItem,
    ProjectionPeriod,
    ProjectionScenarioChange,
} from '@/types/projection'

export type ProjectionScenarioSheetIntent =
    | { kind: 'changes' }
    | { kind: 'hypothetical' }
    | { kind: 'existing'; item: ProjectionItem; period: string }

type EditorState =
    | { kind: 'changes' }
    | { kind: 'hypothetical'; change?: Extract<ProjectionScenarioChange, { type: 'hypothetical' }> }
    | {
        kind: 'existing'
        item: ProjectionItem
        period: string
        change?: Exclude<ProjectionScenarioChange, { type: 'hypothetical' }>
    }

function newId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function monthLabel(month: string) {
    const [year, monthNumber] = month.split('-').map(Number)
    return new Date(year, monthNumber - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
    })
}

function ExistingChangeEditor({
    item,
    period,
    change,
    periods,
    onSave,
    onCancel,
}: {
    item: ProjectionItem
    period: string
    change?: Exclude<ProjectionScenarioChange, { type: 'hypothetical' }>
    periods: ProjectionPeriod[]
    onSave: (change: ProjectionScenarioChange) => void
    onCancel: () => void
}) {
    const initialAction = change?.type === 'omit'
        ? 'omit'
        : change?.type === 'adjust' && change.destinationPeriod
            ? 'move'
            : 'adjust'
    const [action, setAction] = useState<'adjust' | 'omit' | 'move'>(initialAction)
    const [scope, setScope] = useState<'occurrence' | 'forward'>(change?.scope ?? 'occurrence')
    const [amount, setAmount] = useState(
        change?.type === 'adjust'
            ? String(change.amount)
            : String(item.amount / Math.max(item.occurrences ?? 1, 1))
    )
    const destinations = periods.filter((entry) => !entry.isPast && entry.month !== period)
    const [destinationPeriod, setDestinationPeriod] = useState(
        change?.type === 'adjust' ? change.destinationPeriod ?? destinations[0]?.month ?? '' : destinations[0]?.month ?? ''
    )
    const numericAmount = Number(amount)
    const canSave = action === 'omit' || (Number.isFinite(numericAmount) && numericAmount > 0 && (action !== 'move' || destinationPeriod))

    function submit(event: React.FormEvent) {
        event.preventDefault()
        if (!canSave || item.source.type === 'hypothetical') return
        const id = change?.id ?? newId()
        const target = {
            sourceType: item.source.type,
            sourceId: item.source.id,
            period,
        }
        if (action === 'omit') {
            onSave({ id, type: 'omit', target, scope })
            return
        }
        onSave({
            id,
            type: 'adjust',
            target,
            scope: action === 'move' ? 'occurrence' : scope,
            amount: numericAmount,
            ...(action === 'move' ? { destinationPeriod } : {}),
        })
    }

    return (
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-2">
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <p className="break-words font-medium">{item.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {monthLabel(period)} · {item.currency} · el monto ingresado es por ocurrencia
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="scenario-action">Qué querés simular</Label>
                    <Select value={action} onValueChange={(value) => setAction(value as typeof action)}>
                        <SelectTrigger id="scenario-action" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="adjust">Cambiar monto</SelectItem>
                            <SelectItem value="omit">Omitir gasto</SelectItem>
                            <SelectItem value="move">Mover a otro período</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {action !== 'omit' && (
                    <div className="space-y-2">
                        <Label htmlFor="scenario-amount">Monto por ocurrencia ({item.currency})</Label>
                        <Input
                            id="scenario-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            aria-invalid={amount !== '' && !(numericAmount > 0)}
                            className="h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                            La moneda del gasto original se conserva. Para probar otra moneda, simulá un gasto nuevo.
                        </p>
                    </div>
                )}

                {action !== 'move' ? (
                    <div className="space-y-2">
                        <Label htmlFor="scenario-scope">Aplicar</Label>
                        <Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
                            <SelectTrigger id="scenario-scope" className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="occurrence">Sólo este período</SelectItem>
                                <SelectItem value="forward">Desde este período</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="scenario-destination">Período de destino</Label>
                        <Select value={destinationPeriod} onValueChange={setDestinationPeriod}>
                            <SelectTrigger id="scenario-destination" className="w-full"><SelectValue placeholder="Elegí un período" /></SelectTrigger>
                            <SelectContent>
                                {destinations.map((entry) => (
                                    <SelectItem key={entry.month} value={entry.month}>{monthLabel(entry.month)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Se mueve una sola ocurrencia dentro del horizonte visible.</p>
                    </div>
                )}
            </div>
            <SheetFooter className="border-t border-border bg-background">
                <Button type="submit" className="min-h-10" disabled={!canSave}>Actualizar la prueba</Button>
                <Button type="button" variant="outline" className="min-h-10" onClick={onCancel}>Cancelar</Button>
            </SheetFooter>
        </form>
    )
}

type SimulatedExpense = Extract<ProjectionScenarioChange, { type: 'hypothetical' }>
type SimulatedExpenseType = SimulatedExpense['expense']['type']
const INSTALLMENT_OPTIONS = [2, 3, 6, 9, 12, 18, 24]

function parseDateValue(value: string): Date {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day, 12)
}

function formatDateValue(date: Date | undefined): string {
    if (!date) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function nextMonth(value: string): string {
    const date = parseDateValue(value)
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function SimulatedExpenseEditor({
    change,
    categories,
    accounts,
    periods,
    currentPeriod,
    onSave,
    onCancel,
}: {
    change?: SimulatedExpense
    categories: ICategory[]
    accounts: IAccount[]
    periods: ProjectionPeriod[]
    currentPeriod: string
    onSave: (change: ProjectionScenarioChange) => void
    onCancel: () => void
}) {
    const initialDate = `${currentPeriod}-01`
    const initialExpenseType = change?.expense.type ?? 'commitment'
    const initialRecurrence = change?.expense.type === 'commitment' ? change.expense.recurrence : undefined
    const initialStart = initialRecurrence?.type === 'once'
        ? initialRecurrence.date
        : initialRecurrence?.startDate ?? initialDate
    const initialEnd = initialRecurrence && initialRecurrence.type !== 'once'
        ? initialRecurrence.endDate ?? ''
        : ''
    const initialCardExpense = change && change.expense.type !== 'commitment'
        ? change.expense
        : undefined
    const initialPurchaseDate = initialCardExpense
        ? initialCardExpense.purchaseDate
        : initialDate
    const monthOptions: MonthOption[] = periods.map((period) => ({
        value: period.month,
        label: monthLabel(period.month),
    }))
    const defaultClosingMonth = monthOptions.find((option) => option.value === nextMonth(initialPurchaseDate))?.value
        ?? monthOptions[0]?.value
        ?? currentPeriod

    const [expenseType, setExpenseType] = useState<SimulatedExpenseType>(initialExpenseType)
    const [description, setDescription] = useState(change?.description ?? '')
    const [amount, setAmount] = useState(change?.amount ?? 0)
    const [currency, setCurrency] = useState<'ARS' | 'USD'>(change?.currency ?? 'ARS')
    const [categoryId, setCategoryId] = useState(change?.categoryId)
    const [categoryQuery, setCategoryQuery] = useState('')
    const [recurrence, setRecurrence] = useState<'once' | 'weekly' | 'monthly'>(initialRecurrence?.type ?? 'once')
    const [startDate, setStartDate] = useState(initialStart)
    const [endDate, setEndDate] = useState(initialEnd)
    const [dayOfMonth, setDayOfMonth] = useState(initialRecurrence?.type === 'monthly' ? initialRecurrence.dayOfMonth : 1)
    const [accountId, setAccountId] = useState(initialCardExpense?.accountId ?? '')
    const [purchaseDate, setPurchaseDate] = useState(initialPurchaseDate)
    const [firstClosingMonth, setFirstClosingMonth] = useState(
        initialCardExpense?.firstClosingMonth ?? defaultClosingMonth
    )
    const [installmentCount, setInstallmentCount] = useState(
        change?.expense.type === 'card_installment' ? change.expense.installmentCount : 3
    )

    const expenseCategories = categories.filter((category) => category.type === 'expense' && !category.isArchived)
    const compatibleCards = accounts.filter((account) => (
        account.type === 'credit_card' &&
        account.isActive !== false &&
        getSupportedCurrencies(account).includes(currency)
    ))
    const minDate = parseDateValue(`${currentPeriod}-01`)
    const maxPeriod = periods.at(-1)?.month ?? currentPeriod
    const [maxYear, maxMonth] = maxPeriod.split('-').map(Number)
    const maxDate = new Date(maxYear, maxMonth, 0, 12)
    const dateIsValid = Boolean(startDate) && (!endDate || endDate >= startDate)
    const cardIsValid = expenseType === 'commitment' || (
        Boolean(accountId) &&
        compatibleCards.some((account) => account._id.toString() === accountId) &&
        Boolean(firstClosingMonth)
    )
    const canSave = description.trim().length > 0 && amount > 0 && (
        expenseType === 'commitment'
            ? dateIsValid && (recurrence !== 'monthly' || (dayOfMonth >= 1 && dayOfMonth <= 31))
            : cardIsValid && (expenseType !== 'card_installment' || installmentCount >= 2)
    )

    function selectExpenseType(nextType: string) {
        const typed = nextType as SimulatedExpenseType
        setExpenseType(typed)
        if (typed !== 'commitment' && !compatibleCards.some((account) => account._id.toString() === accountId)) {
            setAccountId(compatibleCards.length === 1 ? compatibleCards[0]._id.toString() : '')
        }
    }

    function selectCurrency(nextCurrency: 'ARS' | 'USD') {
        setCurrency(nextCurrency)
        const stillCompatible = accounts.some((account) => (
            account._id.toString() === accountId &&
            account.type === 'credit_card' &&
            getSupportedCurrencies(account).includes(nextCurrency)
        ))
        if (!stillCompatible) setAccountId('')
    }

    function submit(event: React.FormEvent) {
        event.preventDefault()
        if (!canSave) return
        const shared = {
            id: change?.id ?? newId(),
            type: 'hypothetical' as const,
            description: description.trim(),
            amount,
            currency,
            ...(categoryId ? { categoryId } : {}),
        }

        if (expenseType === 'commitment') {
            const expense = recurrence === 'once'
                ? { type: 'commitment' as const, recurrence: { type: 'once' as const, date: startDate } }
                : recurrence === 'weekly'
                    ? {
                        type: 'commitment' as const,
                        recurrence: { type: 'weekly' as const, startDate, ...(endDate ? { endDate } : {}) },
                    }
                    : {
                        type: 'commitment' as const,
                        recurrence: {
                            type: 'monthly' as const,
                            dayOfMonth,
                            startDate,
                            ...(endDate ? { endDate } : {}),
                        },
                    }
            onSave({ ...shared, expense })
            return
        }

        onSave({
            ...shared,
            expense: expenseType === 'card_single'
                ? { type: 'card_single', accountId, purchaseDate, firstClosingMonth }
                : { type: 'card_installment', accountId, purchaseDate, firstClosingMonth, installmentCount },
        })
    }

    return (
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <div className="space-y-2">
                    <p className="text-sm font-medium">¿Qué gasto querés probar?</p>
                    <Tabs value={expenseType} onValueChange={selectExpenseType}>
                        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl p-1">
                            <TabsTrigger value="commitment" className="min-h-14 flex-col gap-1 px-1 text-xs">
                                <CalendarClock className="size-4" /> Compromiso
                            </TabsTrigger>
                            <TabsTrigger value="card_single" className="min-h-14 flex-col gap-1 px-1 text-xs">
                                <CreditCard className="size-4" /> TC · un pago
                            </TabsTrigger>
                            <TabsTrigger value="card_installment" className="min-h-14 flex-col gap-1 px-1 text-xs">
                                <ReceiptText className="size-4" /> TC · cuotas
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <p className="text-xs text-muted-foreground">Finp lo mostrará junto a los gastos reales del mismo tipo.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="simulated-expense-description">Descripción</Label>
                    <Input
                        id="simulated-expense-description"
                        maxLength={200}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder={expenseType === 'commitment' ? 'Ej. Gimnasio' : 'Ej. Notebook'}
                        className="h-10"
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
                    <FormattedAmountInput
                        id="simulated-expense-amount"
                        label={expenseType === 'commitment' ? 'Monto por vez' : 'Monto total de la compra'}
                        value={amount}
                        currency={currency}
                        onValueChangeAction={setAmount}
                    />
                    <CurrencySelector
                        value={currency}
                        options={['ARS', 'USD'] as const}
                        onValueChange={selectCurrency}
                    />
                </div>

                {expenseType === 'commitment' ? (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="simulated-expense-recurrence">¿Cada cuánto?</Label>
                            <Select value={recurrence} onValueChange={(value) => setRecurrence(value as typeof recurrence)}>
                                <SelectTrigger id="simulated-expense-recurrence" className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="once">Una vez</SelectItem>
                                    <SelectItem value="weekly">Todas las semanas</SelectItem>
                                    <SelectItem value="monthly">Todos los meses</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {recurrence === 'monthly' ? (
                            <div className="space-y-2">
                                <Label>Día del mes</Label>
                                <CommitmentDayPicker value={dayOfMonth} onChange={setDayOfMonth} />
                            </div>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <DatePickerField
                                label={recurrence === 'once' ? 'Fecha' : 'Primera fecha'}
                                value={startDate ? parseDateValue(startDate) : undefined}
                                minDate={minDate}
                                maxDate={maxDate}
                                onChange={(date) => setStartDate(formatDateValue(date))}
                            />
                            {recurrence !== 'once' ? (
                                <DatePickerField
                                    label="Hasta (opcional)"
                                    value={endDate ? parseDateValue(endDate) : undefined}
                                    minDate={startDate ? parseDateValue(startDate) : minDate}
                                    maxDate={maxDate}
                                    clearable
                                    onChange={(date) => setEndDate(formatDateValue(date))}
                                />
                            ) : null}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="simulated-expense-card">Tarjeta</Label>
                            <Select value={accountId} onValueChange={setAccountId}>
                                <SelectTrigger id="simulated-expense-card" className="w-full">
                                    <SelectValue placeholder="Elegí una tarjeta compatible" />
                                </SelectTrigger>
                                <SelectContent>
                                    {compatibleCards.map((account) => (
                                        <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                            {account.name} · {getSupportedCurrencies(account).join('/')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {compatibleCards.length === 0 ? (
                                <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                                    <AlertTriangle className="size-3.5" /> No tenés una tarjeta activa compatible con {currency}.
                                </p>
                            ) : null}
                        </div>

                        {expenseType === 'card_installment' ? (
                            <div className="space-y-2">
                                <Label htmlFor="simulated-expense-installments">Cuotas</Label>
                                <Select value={String(installmentCount)} onValueChange={(value) => setInstallmentCount(Number(value))}>
                                    <SelectTrigger id="simulated-expense-installments" className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {INSTALLMENT_OPTIONS.map((count) => (
                                            <SelectItem key={count} value={String(count)}>{count} cuotas</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Finp proyectará {installmentCount} cuotas de {new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount / installmentCount || 0)}.
                                </p>
                            </div>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <DatePickerField
                                label="Fecha de compra"
                                value={purchaseDate ? parseDateValue(purchaseDate) : undefined}
                                minDate={minDate}
                                maxDate={maxDate}
                                onChange={(date) => {
                                    const value = formatDateValue(date)
                                    setPurchaseDate(value)
                                    const suggested = value ? nextMonth(value) : ''
                                    if (monthOptions.some((option) => option.value === suggested)) setFirstClosingMonth(suggested)
                                }}
                            />
                            <MonthPickerField
                                label={expenseType === 'card_single' ? 'Impacta en' : 'Primera cuota'}
                                value={firstClosingMonth}
                                options={monthOptions}
                                onValueChange={setFirstClosingMonth}
                            />
                        </div>
                    </>
                )}

                <CategoryPickerField
                    categories={expenseCategories}
                    selectedCategoryId={categoryId}
                    query={categoryQuery}
                    label="Categoría (opcional)"
                    description="Sirve para ubicar el gasto en la misma lectura que tus movimientos reales."
                    collapsedLimit={6}
                    context={categoryId ? (
                        <Button type="button" variant="ghost" size="sm" className="min-h-9 px-2" onClick={() => setCategoryId(undefined)}>
                            Quitar categoría
                        </Button>
                    ) : null}
                    onQueryChange={setCategoryQuery}
                    onSelect={setCategoryId}
                />
            </div>
            <SheetFooter className="border-t border-border bg-background">
                <Button type="submit" className="min-h-10" disabled={!canSave}>Sumar a la prueba</Button>
                <Button type="button" variant="outline" className="min-h-10" onClick={onCancel}>Cancelar</Button>
            </SheetFooter>
        </form>
    )
}

function targetKey(sourceType: string, sourceId: string, period: string) {
    return `${sourceType}|${sourceId}|${period}`
}

function changeLabel(change: ProjectionScenarioChange, itemsByTarget: Map<string, ProjectionItem>) {
    if (change.type === 'hypothetical') return change.description
    return itemsByTarget.get(targetKey(
        change.target.sourceType,
        change.target.sourceId,
        change.target.period
    ))?.description ?? 'Origen no disponible'
}

function changeStateLabel(change: ProjectionScenarioChange) {
    if (change.type === 'hypothetical') return 'Simulado'
    if (change.type === 'omit') return 'Omitido'
    if (change.destinationPeriod) return 'Movido'
    return 'Modificado'
}

export function ProjectionScenarioSheet({
    open,
    onOpenChange,
    intent,
    changes,
    base,
    currentPeriod,
    onSave,
    onRemove,
    onDiscard,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    intent: ProjectionScenarioSheetIntent
    changes: ProjectionScenarioChange[]
    base: ProjectionPeriod[]
    currentPeriod: string
    onSave: (change: ProjectionScenarioChange) => void
    onRemove: (changeId: string) => void
    onDiscard: () => void
}) {
    const isMobile = useMediaQuery('(max-width: 767px)')
    const [editor, setEditor] = useState<EditorState>(intent)
    const [categories, setCategories] = useState<ICategory[]>([])
    const [accounts, setAccounts] = useState<IAccount[]>([])

    useEffect(() => {
        if (!open || editor.kind !== 'hypothetical') return
        const controller = new AbortController()
        void Promise.all([
            apiJson<{ categories?: ICategory[] }>('/api/categories', { signal: controller.signal }),
            apiJson<{ accounts?: IAccount[] }>('/api/accounts', { signal: controller.signal }),
        ])
            .then(([categoryData, accountData]) => {
                setCategories(categoryData.categories ?? [])
                setAccounts(accountData.accounts ?? [])
            })
            .catch(() => {
                setCategories([])
                setAccounts([])
            })
        return () => controller.abort()
    }, [editor.kind, open])

    const title = editor.kind === 'changes'
        ? 'Gastos simulados'
        : editor.kind === 'hypothetical'
            ? editor.change ? 'Editar gasto simulado' : '¿Qué gasto querés probar?'
            : editor.change ? 'Editar gasto simulado' : 'Simular este gasto'
    const description = editor.kind === 'changes'
        ? 'Revisá lo que probaste. Podés editarlo o quitarlo sin tocar tus datos reales.'
        : 'Finp recalcula la Proyección con este gasto, pero no lo registra como real.'

    const editablePeriods = useMemo(() => base.filter((period) => !period.isPast), [base])
    const itemsByTarget = useMemo(() => new Map(base.flatMap((period) => period.items.map((item) => [
        targetKey(item.source.type, item.source.id, period.month),
        item,
    ] as const))), [base])

    function editChange(change: ProjectionScenarioChange) {
        if (change.type === 'hypothetical') {
            setEditor({ kind: 'hypothetical', change })
            return
        }
        const item = itemsByTarget.get(targetKey(
            change.target.sourceType,
            change.target.sourceId,
            change.target.period
        ))
        if (item) setEditor({ kind: 'existing', item, period: change.target.period, change })
    }

    function save(change: ProjectionScenarioChange) {
        onSave(change)
        onOpenChange(false)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side={isMobile ? 'bottom' : 'right'}
                className="h-[90dvh] w-full gap-0 p-0 sm:h-full sm:max-w-lg"
            >
                <SheetHeader className="shrink-0 border-b border-border px-5 py-4 pr-14">
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </SheetHeader>

                {editor.kind === 'changes' ? (
                    <>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                            {changes.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                    Todavía no simulaste gastos. Esta vista coincide con tu Proyección real.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {changes.map((change) => {
                                        const label = changeLabel(change, itemsByTarget)
                                        const missing = change.type !== 'hypothetical' && label === 'Origen no disponible'
                                        return (
                                            <article key={change.id} className="rounded-xl border border-border p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                                                            {changeStateLabel(change)}
                                                        </span>
                                                        <p className="mt-2 break-words font-medium">{label}</p>
                                                        {change.type !== 'hypothetical' && (
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {monthLabel(change.target.period)} · {change.scope === 'forward' ? 'hacia adelante' : 'sólo esta ocurrencia'}
                                                            </p>
                                                        )}
                                                        {missing && (
                                                            <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                                                                <AlertTriangle className="size-3" /> Sin efecto; la base cambió.
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex shrink-0 gap-1">
                                                        <Button type="button" size="icon" variant="ghost" className="min-h-10 min-w-10" aria-label={`Editar ${label}`} disabled={missing} onClick={() => editChange(change)}>
                                                            <Pencil />
                                                        </Button>
                                                        <Button type="button" size="icon" variant="ghost" className="min-h-10 min-w-10" aria-label={`Restaurar ${label}`} onClick={() => onRemove(change.id)}>
                                                            <RotateCcw />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </article>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <SheetFooter className="shrink-0 border-t border-border bg-background">
                            <Button type="button" className="min-h-10" onClick={() => setEditor({ kind: 'hypothetical' })} disabled={changes.length >= 50}>
                                Simular otro gasto
                            </Button>
                            {changes.length > 0 && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="destructive" className="min-h-10">
                                            <Trash2 data-icon="inline-start" /> Descartar todo
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Descartar todos los gastos simulados?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta vista volverá a coincidir con tu Proyección real. Tus compromisos, compras con tarjeta y transacciones no se modifican.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Volver</AlertDialogCancel>
                                                <AlertDialogAction variant="destructive" onClick={onDiscard}>Descartar simulación</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </SheetFooter>
                    </>
                ) : editor.kind === 'existing' ? (
                    <ExistingChangeEditor
                        key={`${editor.item.id}:${editor.change?.id ?? 'new'}`}
                        item={editor.item}
                        period={editor.period}
                        change={editor.change}
                        periods={editablePeriods}
                        onSave={save}
                        onCancel={() => editor.change ? setEditor({ kind: 'changes' }) : onOpenChange(false)}
                    />
                ) : (
                    <SimulatedExpenseEditor
                        key={editor.change?.id ?? 'new'}
                        change={editor.change}
                        categories={categories}
                        accounts={accounts}
                        periods={editablePeriods}
                        currentPeriod={currentPeriod}
                        onSave={save}
                        onCancel={() => editor.change ? setEditor({ kind: 'changes' }) : onOpenChange(false)}
                    />
                )}
            </SheetContent>
        </Sheet>
    )
}
