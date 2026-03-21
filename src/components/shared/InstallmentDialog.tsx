'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon } from 'lucide-react'

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

import {
  installmentSchema,
  type InstallmentFormInput,
  type InstallmentFormData,
} from '@/lib/validations'
import type { IAccount, ICategory } from '@/types'

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

  for (let i = 0; i < 12; i++) {
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

export function InstallmentDialog({
                                    open,
                                    onOpenChange,
                                    accounts,
                                    categories,
                                    onSubmit,
                                  }: InstallmentDialogProps) {
  const monthOptions = useMemo(() => getMonthOptions(), [])
  const creditCards = accounts.filter((a) => a.type === 'credit_card')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
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
      firstClosingMonth: monthOptions[0]?.value ?? '',
      merchant: '',
      notes: '',
    },
  })

  const totalAmount = watch('totalAmount') as number | undefined
  const installmentCount = watch('installmentCount') as number | undefined
  const currency = watch('currency') as InstallmentFormData['currency']
  const purchaseDate = watch('purchaseDate') as Date | undefined
  const accountId = watch('accountId') as string | undefined
  const categoryId = watch('categoryId') as string | undefined
  const firstClosingMonth = watch('firstClosingMonth') as string | undefined

  const installmentAmount =
      totalAmount && installmentCount ? totalAmount / installmentCount : 0

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
      firstClosingMonth: monthOptions[0]?.value ?? '',
      merchant: '',
      notes: '',
    })
  }, [open, reset, monthOptions])

  const handleFormSubmit = async (data: InstallmentFormData) => {
    await onSubmit(data)
  }

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar compra en cuotas</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                  id="description"
                  placeholder="Ej: Heladera, notebook, vuelo"
                  autoFocus
                  {...register('description')}
              />
              {errors.description && (
                  <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Monto total</Label>
                <Input
                    id="totalAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    {...register('totalAmount', { valueAsNumber: true })}
                />
                {errors.totalAmount && (
                    <p className="text-xs text-destructive">{errors.totalAmount.message}</p>
                )}
              </div>

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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                {errors.currency && (
                    <p className="text-xs text-destructive">{errors.currency.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cantidad de cuotas</Label>
              <Select
                  value={installmentCount?.toString() ?? ''}
                  onValueChange={(value) =>
                      setValue('installmentCount', Number(value), {
                        shouldValidate: true,
                      })
                  }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná cuotas" />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLMENT_OPTIONS.map((count) => (
                      <SelectItem key={count} value={count.toString()}>
                        {count} cuotas
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.installmentCount && (
                  <p className="text-xs text-destructive">{errors.installmentCount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Valor estimado por cuota</Label>
              <div className="h-10 px-3 rounded-md border flex items-center text-sm bg-muted/30">
                {installmentAmount > 0
                    ? new Intl.NumberFormat('es-AR', {
                      style: 'currency',
                      currency: currency ?? 'ARS',
                      maximumFractionDigits: 0,
                    }).format(installmentAmount)
                    : '—'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tarjeta</Label>
              <Select
                  value={accountId ?? ''}
                  onValueChange={(value) =>
                      setValue('accountId', value, { shouldValidate: true })
                  }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {creditCards.map((account) => (
                      <SelectItem
                          key={account._id.toString()}
                          value={account._id.toString()}
                      >
                        {account.name} · {account.currency}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId && (
                  <p className="text-xs text-destructive">{errors.accountId.message}</p>
              )}
            </div>

            {expenseCategories.length > 0 && (
                <div className="space-y-2">
                  <Label>Categoría (opcional)</Label>
                  <Select
                      value={categoryId ?? ''}
                      onValueChange={(value) =>
                          setValue('categoryId', value || undefined, {
                            shouldValidate: true,
                          })
                      }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                          <SelectItem
                              key={category._id.toString()}
                              value={category._id.toString()}
                          >
                            <div className="flex items-center gap-2">
                              {category.color && (
                                  <div
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: category.color }}
                                  />
                              )}
                              {category.name}
                            </div>
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                      <p className="text-xs text-destructive">{errors.categoryId.message}</p>
                  )}
                </div>
            )}

            <div className="space-y-2">
              <Label>Fecha de compra</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {purchaseDate instanceof Date
                        ? purchaseDate.toLocaleDateString('es-AR')
                        : 'Seleccioná fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                      mode="single"
                      selected={purchaseDate instanceof Date ? purchaseDate : undefined}
                      onSelect={(date) =>
                          date &&
                          setValue('purchaseDate', date, {
                            shouldValidate: true,
                          })
                      }
                  />
                </PopoverContent>
              </Popover>
              {errors.purchaseDate && (
                  <p className="text-xs text-destructive">{errors.purchaseDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Mes de primera cuota</Label>
              <Select
                  value={firstClosingMonth ?? ''}
                  onValueChange={(value) =>
                      setValue('firstClosingMonth', value, {
                        shouldValidate: true,
                      })
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
              {errors.firstClosingMonth && (
                  <p className="text-xs text-destructive">{errors.firstClosingMonth.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">Comercio (opcional)</Label>
              <Input
                  id="merchant"
                  placeholder="Ej: Frávega"
                  {...register('merchant')}
              />
              {errors.merchant && (
                  <p className="text-xs text-destructive">{errors.merchant.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Input
                  id="notes"
                  placeholder="Notas adicionales"
                  {...register('notes')}
              />
              {errors.notes && (
                  <p className="text-xs text-destructive">{errors.notes.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                    <span className="flex items-center gap-2">
                                    <Spinner /> Guardando...
                                </span>
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