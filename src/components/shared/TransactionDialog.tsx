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
import type { ITransaction, IAccount, ICategory } from '@/types'

interface TransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: ITransaction | null
    accounts: IAccount[]
    categories: ICategory[]
    onSubmit: (data: Partial<ITransaction>) => Promise<void>
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    transfer: 'Transferencia',
    credit_card_payment: 'Pago de tarjeta',
    debt_payment: 'Pago de deuda',
    adjustment: 'Ajuste',
}

export function TransactionDialog({
                                      open,
                                      onOpenChange,
                                      transaction,
                                      accounts,
                                      categories,
                                      onSubmit,
                                  }: TransactionDialogProps) {
    const [type, setType] = useState('expense')
    const [amount, setAmount] = useState('')
    const [currency, setCurrency] = useState('ARS')
    const [date, setDate] = useState<Date>(new Date())
    const [description, setDescription] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [sourceAccountId, setSourceAccountId] = useState('')
    const [destinationAccountId, setDestinationAccountId] = useState('')
    const [notes, setNotes] = useState('')
    const [merchant, setMerchant] = useState('')
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const filteredCategories = categories.filter((c) => {
        if (type === 'income') return c.type === 'income'
        if (type === 'expense') return c.type === 'expense'
        return false
    })

    useEffect(() => {
        if (transaction) {
            setType(transaction.type)
            setAmount(transaction.amount.toString())
            setCurrency(transaction.currency)
            setDate(new Date(transaction.date))
            setDescription(transaction.description)
            setCategoryId(transaction.categoryId?.toString() ?? '')
            setSourceAccountId(transaction.sourceAccountId?.toString() ?? '')
            setDestinationAccountId(transaction.destinationAccountId?.toString() ?? '')
            setNotes(transaction.notes ?? '')
            setMerchant(transaction.merchant ?? '')
        } else {
            setType('expense')
            setAmount('')
            setCurrency('ARS')
            setDate(new Date())
            setDescription('')
            setCategoryId('')
            setSourceAccountId('')
            setDestinationAccountId('')
            setNotes('')
            setMerchant('')
        }
    }, [transaction, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSubmit({
                type: type as ITransaction['type'],
                amount: parseFloat(amount),
                currency: currency as ITransaction['currency'],
                date,
                description,
                categoryId: categoryId ? (categoryId as unknown as ITransaction['categoryId']) : undefined,
                sourceAccountId: sourceAccountId ? (sourceAccountId as unknown as ITransaction['sourceAccountId']) : undefined,
                destinationAccountId: destinationAccountId ? (destinationAccountId as unknown as ITransaction['destinationAccountId']) : undefined,
                notes: notes || undefined,
                merchant: merchant || undefined,
            })
        } finally {
            setLoading(false)
        }
    }

    const showSource = ['expense', 'transfer', 'credit_card_payment', 'debt_payment', 'adjustment'].includes(type)
    const showDestination = ['income', 'transfer', 'credit_card_payment', 'debt_payment'].includes(type)
    const showCategory = ['income', 'expense'].includes(type)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {transaction ? 'Editar transacción' : 'Nueva transacción'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto</Label>
                            <Input
                                id="amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
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

                    <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date.toLocaleDateString('es-AR')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={(d) => {
                                        if (d) {
                                            setDate(d)
                                            setCalendarOpen(false)
                                        }
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            placeholder="Ej: Supermercado Dia"
                        />
                    </div>

                    {showCategory && filteredCategories.length > 0 && (
                        <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredCategories.map((c) => (
                                        <SelectItem key={c._id.toString()} value={c._id.toString()}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {showSource && (
                        <div className="space-y-2">
                            <Label>Cuenta origen</Label>
                            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a._id.toString()} value={a._id.toString()}>
                                            {a.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {showDestination && (
                        <div className="space-y-2">
                            <Label>Cuenta destino</Label>
                            <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a._id.toString()} value={a._id.toString()}>
                                            {a.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="merchant">Comercio (opcional)</Label>
                        <Input
                            id="merchant"
                            value={merchant}
                            onChange={(e) => setMerchant(e.target.value)}
                            placeholder="Ej: Carrefour"
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
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : transaction ? 'Guardar cambios' : 'Crear transacción'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}