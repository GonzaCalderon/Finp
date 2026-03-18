'use client'

import { useState, useEffect } from 'react'
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
import type { IAccount, ICategory } from '@/types'

interface InstallmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: IAccount[]
  categories: ICategory[]
  onSubmit: (data: Record<string, unknown>) => Promise<void>
}

const INSTALLMENT_OPTIONS = [2, 3, 6, 9, 12, 18, 24]

// Genera opciones de mes/año: mes actual + 5 meses adelante
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
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [installmentCount, setInstallmentCount] = useState('3')
  const [currency, setCurrency] = useState('ARS')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date())
  const [firstClosingMonth, setFirstClosingMonth] = useState('')
  const [merchant, setMerchant] = useState('')
  const [notes, setNotes] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const creditCards = accounts.filter((a) => a.type === 'credit_card')
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const monthOptions = getMonthOptions()

  const installmentAmount = totalAmount && installmentCount
    ? parseFloat(totalAmount) / parseInt(installmentCount)
    : 0

  useEffect(() => {
    if (!open) {
      setDescription('')
      setTotalAmount('')
      setInstallmentCount('3')
      setCurrency('ARS')
      setAccountId('')
      setCategoryId('')
      setPurchaseDate(new Date())
      setFirstClosingMonth('')
      setMerchant('')
      setNotes('')
    }
  }, [open])

  // Setear primer mes de cierre por defecto al próximo mes
  useEffect(() => {
    if (monthOptions.length > 1) {
      setFirstClosingMonth(monthOptions[1].value)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId) return
    setLoading(true)
    try {
      await onSubmit({
        description,
        totalAmount: parseFloat(totalAmount),
        installmentCount: parseInt(installmentCount),
        currency,
        accountId,
        categoryId: categoryId || undefined,
        purchaseDate: purchaseDate.toISOString(),
        firstClosingMonth,
        merchant: merchant || undefined,
        notes: notes || undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gasto en cuotas</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Ej: Smart TV Samsung"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Monto total</Label>
              <Input
                id="totalAmount"
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Select value={installmentCount} onValueChange={setInstallmentCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLMENT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} cuotas
                    </SelectItem>
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
                      currency,
                      maximumFractionDigits: 0,
                    }).format(installmentAmount)
                  : '—'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tarjeta</Label>
            {creditCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tenés tarjetas de crédito registradas.
              </p>
            ) : (
              <Select value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {creditCards.map((a) => (
                    <SelectItem key={a._id.toString()} value={a._id.toString()}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {expenseCategories.length > 0 && (
            <div className="space-y-2">
              <Label>Categoría (opcional)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná categoría" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c._id.toString()} value={c._id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Fecha de compra</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {purchaseDate.toLocaleDateString('es-AR')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={purchaseDate}
                  onSelect={(d) => {
                    if (d) {
                      setPurchaseDate(d)
                      setCalendarOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Mes de primera cuota</Label>
            <Select value={firstClosingMonth} onValueChange={setFirstClosingMonth} required>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná mes" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="merchant">Comercio (opcional)</Label>
            <Input
              id="merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Ej: Frávega"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || creditCards.length === 0}>
              {loading ? 'Guardando...' : 'Registrar compra'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}