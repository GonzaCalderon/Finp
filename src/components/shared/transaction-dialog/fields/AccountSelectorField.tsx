import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { getAccountCurrencyLabel } from '@/lib/utils/accounts'
import type { IAccount } from '@/types'

interface AccountSelectorFieldProps {
    label: string
    value: string | undefined
    accounts: IAccount[]
    error?: string
    showErrors?: boolean
    placeholder?: string
    emptyMessage?: string
    triggerClassName?: string
    onChange: (id: string | undefined) => void
}

export function AccountSelectorField({
    label,
    value,
    accounts,
    error,
    showErrors,
    placeholder = 'Selecciona cuenta',
    emptyMessage = 'No hay cuentas disponibles',
    triggerClassName = 'h-10 w-full rounded-[1rem]',
    onChange,
}: AccountSelectorFieldProps) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            {accounts.length === 0 ? (
                <div
                    className="flex h-10 items-center rounded-[1rem] border px-3 text-sm text-muted-foreground"
                    style={{ borderColor: 'var(--border)', background: 'transparent' }}
                >
                    {emptyMessage}
                </div>
            ) : (
                <Select value={value} onValueChange={(v) => onChange(v || undefined)}>
                    <SelectTrigger className={triggerClassName}>
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                        {accounts.map((account) => (
                            <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                {account.name} · {getAccountCurrencyLabel(account)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            {showErrors && error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    )
}
