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
import type { IScheduledCommitment, ICategory } from '@/types'

interface CommitmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    commitment: IScheduledCommitment | null
    categories: ICategory[]
    onSubmit: (data: Partial<IScheduledCommitment>) => Promise<void>
}

export function CommitmentDialog({
                                     open,
                                     onOpenChange,
                                     commitment,
                                     categories,
                                     onSubmit,
                                 }: CommitmentDialogProps) {
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [currency, setCurrency] = useState('ARS')
    const [recurrence, setRecurrence] = useState('monthly')
    const [dayOfMonth, setDayOfMonth] = useState('')
    const [applyMode, setApplyMode] = useState('manual')
    const [categoryId, setCategoryId] = useState('')
    const [loading, setLoading] = useState(false)

    const expenseCategories = categories.filter((c) => c.type === 'expense')

    useEffect(() => {
        if (commitment) {
            setDescription(commitment.description)
            setAmount(commitment.amount.toString())
            setCurrency(commitment.currency)
            setRecurrence(commitment.recurrence)
            setDayOfMonth(commitment.dayOfMonth?.toString() ?? '')
            setApplyMode(commitment.applyMode)
            setCategoryId(commitment.categoryId?.toString() ?? '')
        } else {
            setDescription('')
            setAmount('')
            setCurrency('ARS')
            setRecurrence('monthly')
            setDayOfMonth('')
            setApplyMode('manual')
            setCategoryId('')
        }
    }, [commitment, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSubmit({
                description,
                amount: parseFloat(amount),
                currency: currency as IScheduledCommitment['currency'],
                recurrence: recurrence as IScheduledCommitment['recurrence'],
                dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : undefined,
                applyMode: applyMode as IScheduledCommitment['applyMode'],
                categoryId: categoryId ? (categoryId as unknown as IScheduledCommitment['categoryId']) : undefined,
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {commitment ? 'Editar compromiso' : 'Nuevo compromiso'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            placeholder="Ej: Alquiler"
                        />
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Recurrencia</Label>
                            <Select value={recurrence} onValueChange={setRecurrence}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Mensual</SelectItem>
                                    <SelectItem value="weekly">Semanal</SelectItem>
                                    <SelectItem value="once">Una vez</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {recurrence === 'monthly' && (
                            <div className="space-y-2">
                                <Label htmlFor="dayOfMonth">Día del mes</Label>
                                <Input
                                    id="dayOfMonth"
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={dayOfMonth}
                                    onChange={(e) => setDayOfMonth(e.target.value)}
                                    placeholder="Ej: 10"
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Modo de aplicación</Label>
                        <Select value={applyMode} onValueChange={setApplyMode}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="auto_month_start">Automático al inicio del mes</SelectItem>
                            </SelectContent>
                        </Select>
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

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : commitment ? 'Guardar cambios' : 'Crear compromiso'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}