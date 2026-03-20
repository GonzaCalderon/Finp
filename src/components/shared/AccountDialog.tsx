'use client'

import {useEffect} from 'react'
import {useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
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
import {ColorPicker} from '@/components/shared/ColorPicker'
import {accountSchema, type AccountFormData} from '@/lib/validations'
import type {IAccount} from '@/types'
import {Spinner} from "@/components/shared/Spinner";

interface AccountDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    account: IAccount | null
    onSubmit: (data: AccountFormData) => Promise<void>
}

export function AccountDialog({open, onOpenChange, account, onSubmit}: AccountDialogProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: {errors, isSubmitting},
    } = useForm<AccountFormData>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            color: '#6366f1',
            initialBalance: 0,
            type: undefined,
            currency: undefined,
        },
    })

    const type = watch('type')
    const color = watch('color') ?? '#6366f1'

    useEffect(() => {
        if (open) {
            if (account) {
                reset({
                    name: account.name,
                    type: account.type,
                    currency: account.currency,
                    institution: account.institution ?? '',
                    initialBalance: account.initialBalance ?? 0,
                    color: (account as IAccount & { color?: string }).color ?? '#6366f1',
                    creditCardConfig: account.creditCardConfig,
                })
            } else {
                reset({
                    color: '#6366f1',
                    initialBalance: 0,
                })
            }
        }
    }, [open, account, reset])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{account ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input id="name" autoFocus placeholder="Ej: Cuenta corriente" {...register('name')} />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={type}
                                onValueChange={(v) => setValue('type', v as AccountFormData['type'], {shouldValidate: true})}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná un tipo"/>
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
                        {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select value={watch('currency')}
                                onValueChange={(v) => setValue('currency', v as AccountFormData['currency'], {shouldValidate: true})}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná moneda"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ARS">ARS - Peso argentino</SelectItem>
                                <SelectItem value="USD">USD - Dólar</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="institution">Entidad (opcional)</Label>
                        <Input id="institution" placeholder="Ej: Galicia, Mercado Pago" {...register('institution')} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="initialBalance">Saldo inicial</Label>
                        <Input id="initialBalance" type="number" placeholder="0" {...register('initialBalance')} />
                        {errors.initialBalance &&
                            <p className="text-xs text-destructive">{errors.initialBalance.message}</p>}
                    </div>

                    <ColorPicker
                        label="Color de la cuenta"
                        value={color}
                        onChange={(c) => setValue('color', c)}
                    />

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
                                        placeholder="Ej: 20"
                                        {...register('creditCardConfig.closingDay')}
                                    />
                                    {errors.creditCardConfig?.closingDay && (
                                        <p className="text-xs text-destructive">{errors.creditCardConfig.closingDay.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dueDay">Día de vencimiento</Label>
                                    <Input
                                        id="dueDay"
                                        type="number"
                                        min="1"
                                        max="31"
                                        placeholder="Ej: 10"
                                        {...register('creditCardConfig.dueDay')}
                                    />
                                    {errors.creditCardConfig?.dueDay && (
                                        <p className="text-xs text-destructive">{errors.creditCardConfig.dueDay.message}</p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="creditLimit">Límite de crédito (opcional)</Label>
                                <Input
                                    id="creditLimit"
                                    type="number"
                                    placeholder="Ej: 500000"
                                    {...register('creditCardConfig.creditLimit')}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>

                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
      <Spinner/> Guardando...
    </span>
                            ) : account ? 'Guardar cambios' : 'Crear cuenta'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}