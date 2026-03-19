'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { CalendarIcon } from 'lucide-react'
import { installmentSchema, type InstallmentFormData } from '@/lib/validations'
import { Spinner } from '@/components/shared/Spinner'
import type { IAccount, ICategory } from '@/types'

interface InstallmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: IAccount[]
  categories: ICategory[]
  onSubmit: (data: InstallmentFormData) => Promise<void>
}

const INSTALLMENT_OPTIONS = [2, 3, 6, 9, 12, 18, 24]

const getMonthOptions = () => {
  const options = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
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
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InstallmentFormData>({
    resolver: zodResolver(installmentSchema),
    defaultValues: {
      currency: 'ARS',
      installmentCount: 3,
      purchaseDate: new Date(),
      firstClosingMonth: getMonthOptions()[1].value,
    },
  })

  const creditCards = accounts.filter((a) => a.type === 'credit_card')
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const monthOptions = getMonthOptions()

  const totalAmount = watch('totalAmount')
  const installmentCount = watch('installmentCount')
  const currency = watch('currency')
  const purchaseDate = watch('purchaseDate')
  const accountId = watch('accountId')
  const categoryId = watch('categoryId')
  const firstClosingMonth = watch('firstClosingMonth')

  const installmentAmount = totalAmount && installmentCount
      ? totalAmount / installmentCount
      : 0

  useEffect(() => {
    if (open) {
      reset({
        currency: 'ARS',
        installmentCount: 3,
        purchaseDate: new Date(),
        firstClosingMonth: getMonthOptions()[1].value,
      })
    }
  }, [open, reset])

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gasto en cuotas</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" placeholder="Ej: Smart TV Samsung" {...register('description')} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
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
                {errors.totalAmount && <p className="text-xs text-destructive">{errors.totalAmount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={(v) => setValue('currency', v as InstallmentFormData['currency'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cuotas</Label>
                <Select
                    value={installmentCount?.toString()}
                    onValueChange={(v) => setValue('installmentCount', parseInt(v))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSTALLMENT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n} cuotas</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor por cuota</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                  {installmentAmount > 0
                      ? new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: currency ?? 'ARS',
                        maximumFractionDigits: 0,
                      }).format(installmentAmount)
                      : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tarjeta</Label>
              {creditCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tenés tarjetas de crédito registradas.</p>
              ) : (
                  <Select value={accountId} onValueChange={(v) => setValue('accountId', v, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Seleccioná tarjeta" /></SelectTrigger>
                    <SelectContent>
                      {creditCards.map((a) => {
                        const acc = a as IAccount & { color?: string }
                        return (
                            <SelectItem key={acc._id.toString()} value={acc._id.toString()}>
                              <div className="flex items-center gap-2">
                                {acc.color && (
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0"
                                         style={{ backgroundColor: acc.color }} />
                                )}
                                {acc.name}
                              </div>
                            </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
              )}
              {errors.accountId && <p className="text-xs text-destructive">{errors.accountId.message}</p>}
            </div>

            {expenseCategories.length > 0 && (
                <div className="space-y-2">
                  <Label>Categoría (opcional)</Label>
                  <Select value={categoryId} onValueChange={(v) => setValue('categoryId', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccioná categoría" /></SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((c) => (
                          <SelectItem key={c._id.toString()} value={c._id.toString()}>
                            <div className="flex items-center gap-2">
                              {c.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />}
                              {c.name}
                            </div>
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
            )}

            <div className="space-y-2">
              <Label>Fecha de compra</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {purchaseDate ? purchaseDate.toLocaleDateString('es-AR') : 'Seleccioná fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                      mode="single"
                      selected={purchaseDate}
                      onSelect={(d) => d && setValue('purchaseDate', d)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Mes de primera cuota</Label>
              <Select value={firstClosingMonth} onValueChange={(v) => setValue('firstClosingMonth', v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Seleccioná mes" /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.firstClosingMonth && <p className="text-xs text-destructive">{errors.firstClosingMonth.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">Comercio (opcional)</Label>
              <Input id="merchant" placeholder="Ej: Frávega" {...register('merchant')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Input id="notes" placeholder="Notas adicionales" {...register('notes')} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || creditCards.length === 0}>
                {isSubmitting ? (
                    <span className="flex items-center gap-2"><Spinner />Guardando...</span>
                ) : 'Registrar compra'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
  )
}