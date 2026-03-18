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
import type { IAccount } from '@/types'

interface AccountDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    account: IAccount | null
    onSubmit: (data: Partial<IAccount>) => Promise<void>
}

export function AccountDialog({ open, onOpenChange, account, onSubmit }: AccountDialogProps) {
    const [name, setName] = useState('')
    const [type, setType] = useState('')
    const [currency, setCurrency] = useState('')
    const [institution, setInstitution] = useState('')
    const [initialBalance, setInitialBalance] = useState('0')
    const [closingDay, setClosingDay] = useState('')
    const [dueDay, setDueDay] = useState('')
    const [creditLimit, setCreditLimit] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (account) {
            setName(account.name)
            setType(account.type)
            setCurrency(account.currency)
            setInstitution(account.institution ?? '')
            setInitialBalance(account.initialBalance?.toString() ?? '0')
            setClosingDay(account.creditCardConfig?.closingDay?.toString() ?? '')
            setDueDay(account.creditCardConfig?.dueDay?.toString() ?? '')
            setCreditLimit(account.creditCardConfig?.creditLimit?.toString() ?? '')
        } else {
            setName('')
            setType('')
            setCurrency('')
            setInstitution('')
            setInitialBalance('0')
            setClosingDay('')
            setDueDay('')
            setCreditLimit('')
        }
    }, [account, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const data: Partial<IAccount> = {
            name,
            type: type as IAccount['type'],
            currency: currency as IAccount['currency'],
            institution: institution || undefined,
            initialBalance: parseFloat(initialBalance) || 0,
        }

        if (type === 'credit_card') {
            data.creditCardConfig = {
                closingDay: parseInt(closingDay),
                dueDay: parseInt(dueDay),
                creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
            }
        }

        try {
            await onSubmit(data)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{account ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="Ej: Cuenta corriente"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={type} onValueChange={setType} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná un tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bank">Banco</SelectItem>
                                <SelectItem value="cash">Efectivo</SelectItem>
                                <SelectItem value="wallet">Billetera virtual</SelectItem>
                                <SelectItem value="credit_card">Tarjeta de crédito</SelectItem>
                                <SelectItem value="debt">Deuda</SelectItem>
                                <SelectItem value="savings">Ahorro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select value={currency} onValueChange={setCurrency} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná moneda" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ARS">ARS - Peso argentino</SelectItem>
                                <SelectItem value="USD">USD - Dólar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="institution">Entidad (opcional)</Label>
                        <Input
                            id="institution"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            placeholder="Ej: Galicia, Mercado Pago"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="initialBalance">Saldo inicial</Label>
                        <Input
                            id="initialBalance"
                            type="number"
                            value={initialBalance}
                            onChange={(e) => setInitialBalance(e.target.value)}
                            placeholder="0"
                        />
                    </div>

                    {type === 'credit_card' && (
                        <div className="space-y-4 rounded-md border p-4">
                            <p className="text-sm font-medium">Configuración de tarjeta</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="closingDay">Día de cierre</Label>
                                    <Input
                                        id="closingDay"
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={closingDay}
                                        onChange={(e) => setClosingDay(e.target.value)}
                                        required
                                        placeholder="Ej: 20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dueDay">Día de vencimiento</Label>
                                    <Input
                                        id="dueDay"
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={dueDay}
                                        onChange={(e) => setDueDay(e.target.value)}
                                        required
                                        placeholder="Ej: 10"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="creditLimit">Límite de crédito (opcional)</Label>
                                <Input
                                    id="creditLimit"
                                    type="number"
                                    value={creditLimit}
                                    onChange={(e) => setCreditLimit(e.target.value)}
                                    placeholder="Ej: 500000"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : account ? 'Guardar cambios' : 'Crear cuenta'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}