'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react'

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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { Spinner } from '@/components/shared/Spinner'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import {
  installmentSchema,
  type InstallmentFormInput,
  type InstallmentFormData,
} from '@/lib/validations'
import type { IAccount, ICategory } from '@/types'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'

interface InstallmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: IAccount[]
  categories: ICategory[]
  onSubmit: (data: InstallmentFormData) => Promise<void>
}

const INSTALLMENT_OPTIONS = [2, 3, 6, 9, 12, 18, 24]

function getMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    })
    options.push({ value, label })
  }

  return options
}

function getInstallmentPlanMonths(firstClosingMonth: string, count: number): Date[] {
  if (!firstClosingMonth || count <= 0) return []
  const [year, month] = firstClosingMonth.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => new Date(year, month - 1 + i, 1))
}

function formatPlanMonths(months: Date[]): string {
  if (months.length === 0) return ''

  const first = months[0]
  const last = months[months.length - 1]
  const firstYear = first.getFullYear()
  const lastYear = last.getFullYear()

  if (months.length <= 4) {
    // Show all abbreviated: "abr · may · jun 2026"
    const names = months.map((d) =>
      d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
    )
    const yearSuffix = firstYear === lastYear ? ` ${firstYear}` : ''
    if (firstYear !== lastYear) {
      return months
        .map((d) => d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', ''))
        .join(' · ')
    }
    return `${names.join(' · ')}${yearSuffix}`
  }

  // Show range: "abr 2026 → sep 2027"
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', '')
  return `${fmt(first)} → ${fmt(last)}`
}

export function InstallmentDialog({
  open,
  onOpenChange,
  accounts,
  categories,
  onSubmit,
}: InstallmentDialogProps) {
  const monthOptions = useMemo(() => getMonthOptions(), [])
  const creditCards = accounts.filter((account) => account.type === 'credit_card')
  const expenseCategories = categories.filter((category) => category.type === 'expense')
  const [showMoreOptions, setShowMoreOptions] = useState(false)

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<InstallmentFormInput, unknown, InstallmentFormData>({
    resolver: zodResolver(installmentSchema),
    defaultValues: {
      description: '',
      totalAmount: 0,
      currency: 'ARS',
      installmentCount: 3,
      accountId: '',
      categoryId: undefined,
      purchaseDate: new Date(),
      firstClosingMonth: '',
      merchant: '',
      notes: '',
    },
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

  const watchedValues = watch()

  const totalAmount =
    typeof watchedValues.totalAmount === 'number' ? watchedValues.totalAmount : 0

  const installmentCount =
    typeof watchedValues.installmentCount === 'number' ? watchedValues.installmentCount : 3

  const currency: InstallmentFormInput['currency'] =
    watchedValues.currency === 'USD' ? 'USD' : 'ARS'

  const purchaseDate =
    watchedValues.purchaseDate instanceof Date ? watchedValues.purchaseDate : undefined

  const accountId =
    typeof watchedValues.accountId === 'string' ? watchedValues.accountId : ''

  const categoryId =
    typeof watchedValues.categoryId === 'string' ? watchedValues.categoryId : ''

  const firstClosingMonth =
    typeof watchedValues.firstClosingMonth === 'string' ? watchedValues.firstClosingMonth : ''

  const description =
    typeof watchedValues.description === 'string' ? watchedValues.description : ''

  const merchant =
    typeof watchedValues.merchant === 'string' ? watchedValues.merchant : ''

  const notes = typeof watchedValues.notes === 'string' ? watchedValues.notes : ''

  const installmentAmount =
    totalAmount > 0 && installmentCount > 0 ? totalAmount / installmentCount : 0

  const planMonths = useMemo(
    () => getInstallmentPlanMonths(firstClosingMonth, installmentCount),
    [firstClosingMonth, installmentCount]
  )

  const planMonthsLabel = useMemo(() => formatPlanMonths(planMonths), [planMonths])

  const hasMoreOptionsErrors = !!(errors.purchaseDate || errors.merchant || errors.notes)

  useEffect(() => {
    if (!open) return

    reset({
      description: '',
      totalAmount: 0,
      currency: 'ARS',
      installmentCount: 3,
      accountId: '',
      categoryId: undefined,
      purchaseDate: new Date(),
      firstClosingMonth: '',
      merchant: '',
      notes: '',
    })
    setShowMoreOptions(false)
  }, [open, reset])

  const handleFormSubmit = async (data: InstallmentFormData) => {
    await onSubmit(data)
  }

  const handlePurchaseDateSelect = (date: Date | undefined) => {
    if (!date) return
    setValue('purchaseDate', date, { shouldValidate: true })

    // Auto-sugerir mes de primera cuota si no fue elegido aún
    if (!firstClosingMonth) {
      const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
      const value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
      if (monthOptions.some((m) => m.value === value)) {
        setValue('firstClosingMonth', value, { shouldValidate: true })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle>Registrar compra en cuotas</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex max-h-[85vh] flex-col">
          <div ref={scrollRef} className="overflow-y-auto px-5 py-4 space-y-5">
            {/* Monto total */}
            <FormattedAmountInput
              id="totalAmount"
              label="Monto total"
              value={totalAmount}
              currency={currency}
              autoFocus
              error={errors.totalAmount?.message}
              onValueChangeAction={(nextAmount) =>
                setValue('totalAmount', nextAmount, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />

            {/* Moneda + Primera cuota */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select
                  value={currency}
                  onValueChange={(value) =>
                    setValue('currency', value as InstallmentFormInput['currency'], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                {errors.currency ? (
                  <p className="text-sm text-destructive">{errors.currency.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Primera cuota</Label>
                <Select
                  value={firstClosingMonth}
                  onValueChange={(value) =>
                    setValue('firstClosingMonth', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.firstClosingMonth ? (
                  <p className="text-sm text-destructive">{errors.firstClosingMonth.message}</p>
                ) : null}
              </div>
            </div>

            {/* Cuotas + Tarjeta */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cuotas</Label>
                <Select
                  value={String(installmentCount)}
                  onValueChange={(value) =>
                    setValue('installmentCount', Number(value), { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cuotas" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTALLMENT_OPTIONS.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count} cuotas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.installmentCount ? (
                  <p className="text-sm text-destructive">{errors.installmentCount.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Tarjeta</Label>
                <Select
                  value={accountId}
                  onValueChange={(value) =>
                    setValue('accountId', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná" />
                  </SelectTrigger>
                  <SelectContent>
                    {creditCards.map((account) => (
                      <SelectItem key={account._id.toString()} value={account._id.toString()}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.accountId ? (
                  <p className="text-sm text-destructive">{errors.accountId.message}</p>
                ) : null}
              </div>
            </div>

            {/* Plan de cuotas */}
            <div
              className="rounded-xl border p-3"
              style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
            >
              <p className="text-xs text-muted-foreground mb-1">Plan de cuotas</p>
              <p className="text-base font-semibold">
                {installmentAmount > 0
                  ? `${installmentCount} × ${new Intl.NumberFormat('es-AR', {
                      style: 'currency',
                      currency,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }).format(installmentAmount)}`
                  : '—'}
              </p>
              {planMonthsLabel ? (
                <p className="text-xs text-muted-foreground mt-0.5">{planMonthsLabel}</p>
              ) : null}
            </div>

            {/* Descripción (requerida) */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) =>
                  setValue('description', e.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder="Ej: Notebook Samsung, Heladera nueva…"
              />
              {errors.description ? (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              ) : null}
            </div>

            {/* Categoría */}
            {expenseCategories.length > 0 && (
              <div className="space-y-2">
                <Label>Categoría (opcional)</Label>
                <div className="flex flex-wrap gap-2">
                  {expenseCategories.map((category) => {
                    const selected = categoryId === category._id.toString()
                    return (
                      <button
                        key={category._id.toString()}
                        type="button"
                        onClick={() =>
                          setValue('categoryId', category._id.toString(), {
                            shouldValidate: true,
                          })
                        }
                        className="rounded-full border px-3 py-2 text-xs font-medium transition-colors"
                        style={{
                          background: selected
                            ? category.color || 'var(--sky)'
                            : 'rgba(239, 68, 68, 0.10)',
                          color: selected ? '#fff' : '#DC2626',
                          borderColor: selected
                            ? category.color || 'var(--sky)'
                            : 'rgba(239, 68, 68, 0.22)',
                        }}
                      >
                        {category.name}
                      </button>
                    )
                  })}
                </div>
                {errors.categoryId ? (
                  <p className="text-sm text-destructive">{errors.categoryId.message}</p>
                ) : null}
              </div>
            )}

            {/* Más opciones: fecha, comercio, notas */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMoreOptions((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: hasMoreOptionsErrors ? 'var(--destructive)' : 'var(--border)' }}
              >
                <span className="flex items-center gap-2">
                  Más opciones
                  {hasMoreOptionsErrors && !showMoreOptions && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-destructive" />
                  )}
                </span>
                {showMoreOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showMoreOptions && (
                <div
                  className="space-y-4 rounded-xl border p-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="space-y-2">
                    <Label>Fecha de compra</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {purchaseDate instanceof Date
                            ? purchaseDate.toLocaleDateString('es-AR')
                            : 'Seleccioná fecha'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={purchaseDate}
                          onSelect={handlePurchaseDateSelect}
                        />
                      </PopoverContent>
                    </Popover>
                    {errors.purchaseDate ? (
                      <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="merchant">Comercio (opcional)</Label>
                    <Input
                      id="merchant"
                      value={merchant}
                      onChange={(e) =>
                        setValue('merchant', e.target.value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    />
                    {errors.merchant ? (
                      <p className="text-sm text-destructive">{errors.merchant.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas (opcional)</Label>
                    <Input
                      id="notes"
                      value={notes}
                      onChange={(e) =>
                        setValue('notes', e.target.value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    />
                    {errors.notes ? (
                      <p className="text-sm text-destructive">{errors.notes.message}</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className="border-t px-5 py-4 flex gap-2 sticky bottom-0 bg-background"
            style={{ borderColor: 'var(--border)' }}
          >
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2" />
                  Guardando...
                </>
              ) : (
                'Registrar compra'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
