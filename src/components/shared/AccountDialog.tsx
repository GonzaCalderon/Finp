'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { ColorPicker } from '@/components/shared/ColorPicker'
import {accountSchema, type AccountFormData, AccountFormInput} from '@/lib/validations'
import type { IAccount } from '@/types'
import { Spinner } from '@/components/shared/Spinner'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
    getAccountCurrencyLabel,
    getDefaultPaymentMethodLabel,
    getSupportedDefaultPaymentMethodsForAccountType,
    normalizeDefaultPaymentMethods,
    normalizeSupportedCurrencies,
} from '@/lib/utils/accounts'

interface AccountDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    account: IAccount | null
    onSubmit: (data: AccountFormData) => Promise<void>
}

type CurrencyCapabilityOption = 'ARS' | 'USD' | 'ARS_USD'

function getCurrencyCapabilityValue(supportedCurrencies?: string[]): CurrencyCapabilityOption {
    const normalized = normalizeSupportedCurrencies(supportedCurrencies as ('ARS' | 'USD')[] | undefined)
    if (normalized.length > 1) return 'ARS_USD'
    return normalized[0]
}

function getSupportedCurrenciesFromCapability(value: CurrencyCapabilityOption): ('ARS' | 'USD')[] {
    if (value === 'USD') return ['USD']
    if (value === 'ARS_USD') return ['ARS', 'USD']
    return ['ARS']
}

export function AccountDialog({ open, onOpenChange, account, onSubmit }: AccountDialogProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting, submitCount },
    } = useForm<AccountFormInput>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            color: '#6366f1',
            initialBalance: 0,
            initialBalances: {
                ARS: 0,
                USD: 0,
            },
            type: undefined,
            currency: 'ARS',
            supportedCurrencies: ['ARS'],
            defaultPaymentMethods: [],
            allowNegativeBalance: true,
        },
    })

    const scrollRef = useRef<HTMLFormElement>(null)
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

    const type = watch('type')
    const supportedCurrencies = watch('supportedCurrencies')
    const defaultPaymentMethods = watch('defaultPaymentMethods')
    const initialBalances = watch('initialBalances')
    const currency = watch('currency')
    const color = watch('color') ?? '#6366f1'
    const allowNegativeBalance = watch('allowNegativeBalance') ?? true
    const isCreditCard = type === 'credit_card'
    const isDualCurrency = (supportedCurrencies?.length ?? 0) > 1
    const availableDefaultPaymentMethods = getSupportedDefaultPaymentMethodsForAccountType(type)
    const primaryDefaultPaymentMethod = availableDefaultPaymentMethods[0]
    const currencyCapability = isCreditCard
        ? 'ARS_USD'
        : getCurrencyCapabilityValue(supportedCurrencies as string[] | undefined)

    useEffect(() => {
        if (open) {
            if (account) {
                const normalizedSupportedCurrencies = normalizeSupportedCurrencies(
                    account.supportedCurrencies,
                    account.currency,
                    account.type
                )
                reset({
                    name: account.name,
                    type: account.type,
                    currency: normalizedSupportedCurrencies[0],
                    supportedCurrencies: normalizedSupportedCurrencies,
                    defaultPaymentMethods: normalizeDefaultPaymentMethods(
                        account.defaultPaymentMethods,
                        account.type
                    ),
                    institution: account.institution ?? '',
                    initialBalance: account.initialBalance ?? 0,
                    initialBalances: {
                        ARS: account.initialBalances?.ARS ?? (account.currency === 'ARS' ? account.initialBalance ?? 0 : 0),
                        USD: account.initialBalances?.USD ?? (account.currency === 'USD' ? account.initialBalance ?? 0 : 0),
                    },
                    color: (account as IAccount & { color?: string }).color ?? '#6366f1',
                    allowNegativeBalance: (account as IAccount & { allowNegativeBalance?: boolean }).allowNegativeBalance ?? true,
                    creditCardConfig: account.creditCardConfig,
                })
            } else {
                reset({
                    color: '#6366f1',
                    initialBalance: 0,
                    initialBalances: {
                        ARS: 0,
                        USD: 0,
                    },
                    currency: 'ARS',
                    supportedCurrencies: ['ARS'],
                    defaultPaymentMethods: [],
                    allowNegativeBalance: true,
                })
            }
        }
    }, [open, account, reset])

    useEffect(() => {
        if (!type) return

        if (type === 'credit_card') {
            const currentSupportedCurrencies = supportedCurrencies ?? []
            const hasCreditCardCurrencies =
                currentSupportedCurrencies.length === 2 &&
                currentSupportedCurrencies.includes('ARS') &&
                currentSupportedCurrencies.includes('USD')

            if (!hasCreditCardCurrencies) {
                setValue('supportedCurrencies', ['ARS', 'USD'], { shouldValidate: true })
            }

            if (currency !== 'ARS') {
                setValue('currency', 'ARS', { shouldValidate: true })
            }
        } else if (!supportedCurrencies || supportedCurrencies.length === 0) {
            setValue('supportedCurrencies', ['ARS'], { shouldValidate: true })
            if (currency !== 'ARS') {
                setValue('currency', 'ARS', { shouldValidate: true })
            }
        }

        const normalizedDefaultPaymentMethods = normalizeDefaultPaymentMethods(defaultPaymentMethods, type)
        const currentDefaultPaymentMethods = defaultPaymentMethods ?? []

        if (normalizedDefaultPaymentMethods.join('|') !== currentDefaultPaymentMethods.join('|')) {
            setValue(
                'defaultPaymentMethods',
                normalizedDefaultPaymentMethods,
                { shouldValidate: true }
            )
        }
    }, [currency, defaultPaymentMethods, type, supportedCurrencies, setValue])

    const handleCurrencyCapabilityChange = (value: CurrencyCapabilityOption) => {
        const nextSupportedCurrencies = getSupportedCurrenciesFromCapability(value)
        setValue('supportedCurrencies', nextSupportedCurrencies, { shouldValidate: true, shouldDirty: true })
        setValue('currency', nextSupportedCurrencies[0], { shouldValidate: true, shouldDirty: true })
        setValue('initialBalance', initialBalances?.[nextSupportedCurrencies[0]] ?? 0, {
            shouldValidate: true,
            shouldDirty: true,
        })
    }

    const isDefaultForPrimaryMethod = primaryDefaultPaymentMethod
        ? (defaultPaymentMethods ?? []).includes(primaryDefaultPaymentMethod)
        : false

    const handleDefaultPaymentMethodToggle = (checked: boolean) => {
        if (!primaryDefaultPaymentMethod) return
        setValue('defaultPaymentMethods', checked ? [primaryDefaultPaymentMethod] : [], {
            shouldValidate: true,
            shouldDirty: true,
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" className="max-w-md p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>{account ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
                </DialogHeader>

                <form
                    ref={scrollRef}
                    onSubmit={handleSubmit((data) => onSubmit(data as AccountFormData))}
                    className="flex max-h-[100dvh] flex-col sm:max-h-[85vh]"
                >
                    <div className="overflow-y-auto px-5 py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input id="name" autoFocus placeholder="Ej: Cuenta corriente" {...register('name')} />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={type}
                                onValueChange={(v) => setValue('type', v as AccountFormData['type'], { shouldValidate: true })}>
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
                        {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Monedas disponibles</Label>
                        <Select
                            value={currencyCapability}
                            onValueChange={(v) => handleCurrencyCapabilityChange(v as CurrencyCapabilityOption)}
                            disabled={isCreditCard}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná monedas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ARS">ARS</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="ARS_USD">ARS y USD</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {isCreditCard
                                ? 'Las tarjetas de crédito operan en ARS y USD.'
                                : `Esta cuenta acepta movimientos en ${getAccountCurrencyLabel({
                                    type: type ?? 'bank',
                                    currency: currency ?? 'ARS',
                                    supportedCurrencies: supportedCurrencies as ('ARS' | 'USD')[] | undefined,
                                })}.`}
                        </p>
                        {errors.supportedCurrencies && (
                            <p className="text-xs text-destructive">{errors.supportedCurrencies.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="institution">Entidad (opcional)</Label>
                        <Input id="institution" placeholder="Ej: Galicia, Mercado Pago" {...register('institution')} />
                    </div>

                    {primaryDefaultPaymentMethod && (
                        <div
                            className="flex items-center justify-between rounded-lg p-3"
                            style={{ background: 'var(--secondary)', border: '0.5px solid var(--border)' }}
                        >
                            <div className="pr-4">
                                <p className="text-sm font-medium">
                                    {getDefaultPaymentMethodLabel(primaryDefaultPaymentMethod)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Se preselecciona al registrar movimientos con {primaryDefaultPaymentMethod === 'cash'
                                        ? 'efectivo'
                                        : primaryDefaultPaymentMethod === 'credit_card'
                                            ? 'tarjeta'
                                            : 'débito'}.
                                </p>
                            </div>
                            <Switch
                                checked={isDefaultForPrimaryMethod}
                                onCheckedChange={handleDefaultPaymentMethodToggle}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Saldos iniciales</Label>
                        {isDualCurrency ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="initialBalanceARS" className="text-xs text-muted-foreground">ARS</Label>
                                    <Input
                                        id="initialBalanceARS"
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="0"
                                        {...register('initialBalances.ARS', { valueAsNumber: true })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="initialBalanceUSD" className="text-xs text-muted-foreground">USD</Label>
                                    <Input
                                        id="initialBalanceUSD"
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="0"
                                        {...register('initialBalances.USD', { valueAsNumber: true })}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label
                                    htmlFor="initialBalance"
                                    className="text-xs text-muted-foreground"
                                >
                                    {supportedCurrencies?.[0] ?? 'ARS'}
                                </Label>
                                <Input
                                    id="initialBalance"
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={initialBalances?.[supportedCurrencies?.[0] ?? 'ARS'] ?? 0}
                                    onChange={(event) => {
                                        const value = event.target.value === '' ? 0 : Number(event.target.value)
                                        const currency = supportedCurrencies?.[0] ?? 'ARS'
                                        setValue(
                                            'initialBalances',
                                            {
                                                ARS: currency === 'ARS' ? value : 0,
                                                USD: currency === 'USD' ? value : 0,
                                            },
                                            { shouldValidate: true, shouldDirty: true }
                                        )
                                        setValue('initialBalance', value, {
                                            shouldValidate: true,
                                            shouldDirty: true,
                                        })
                                    }}
                                />
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {isDualCurrency
                                ? 'Definí por separado el saldo con el que arranca la cuenta en cada moneda.'
                                : 'Usamos este saldo como punto de partida para la moneda de la cuenta.'}
                        </p>
                        {errors.initialBalance && (
                            <p className="text-xs text-destructive">{errors.initialBalance.message}</p>
                        )}
                    </div>

                    <ColorPicker
                        label="Color de la cuenta"
                        value={color}
                        onChange={(c) => setValue('color', c)}
                    />

                    {/* Saldo negativo */}
                    <div
                        className="flex items-center justify-between rounded-lg p-3"
                        style={{ background: 'var(--secondary)', border: '0.5px solid var(--border)' }}
                    >
                        <div>
                            <p className="text-sm font-medium">Permitir saldo negativo</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {allowNegativeBalance
                                    ? 'Se puede gastar más de lo disponible'
                                    : 'No se puede gastar más de lo disponible'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setValue('allowNegativeBalance', !allowNegativeBalance)}
                            className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
                            style={{ background: allowNegativeBalance ? 'var(--sky)' : 'var(--border)' }}
                        >
                            <span
                                className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 mt-0.5"
                                style={{ transform: allowNegativeBalance ? 'translateX(22px)' : 'translateX(2px)' }}
                            />
                        </button>
                    </div>

                    {type === 'credit_card' && (
                        <div className="space-y-4 rounded-md border p-4">
                            <p className="text-sm font-medium">Configuración de tarjeta</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="closingDay">Día de cierre</Label>
                                    <Input id="closingDay" type="number" inputMode="numeric" min="1" max="31" placeholder="Ej: 20"
                                           {...register('creditCardConfig.closingDay', { valueAsNumber: true })} />
                                    {errors.creditCardConfig?.closingDay && (
                                        <p className="text-xs text-destructive">{errors.creditCardConfig.closingDay.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dueDay">Día de vencimiento</Label>
                                    <Input id="dueDay" type="number" inputMode="numeric" min="1" max="31" placeholder="Ej: 10"
                                           {...register('creditCardConfig.dueDay', { valueAsNumber: true })} />
                                    {errors.creditCardConfig?.dueDay && (
                                        <p className="text-xs text-destructive">{errors.creditCardConfig.dueDay.message}</p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="creditLimit">Límite de crédito (opcional)</Label>
                                <Input id="creditLimit" type="number" inputMode="decimal" placeholder="Ej: 500000"
                                       {...register('creditCardConfig.creditLimit', { valueAsNumber: true })} />
                            </div>
                        </div>
                    )}
                    </div>

                    <div
                        className="sticky bottom-0 border-t bg-background px-5 py-4 safe-area-pb flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <span className="flex items-center gap-2"><Spinner /> Guardando...</span>
                            ) : account ? 'Guardar cambios' : 'Crear cuenta'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
