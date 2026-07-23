import { Label } from '@/components/ui/label'
import { CurrencyPillSelector } from '@/components/shared/CurrencyPillSelector'
import type { TransactionFormInput } from '@/lib/validations'

type CurrencyOption = TransactionFormInput['currency']

interface CurrencyToggleButtonsProps {
    label?: string
    value: CurrencyOption
    allowed: CurrencyOption[]
    onChange: (currency: CurrencyOption) => void
}

export function CurrencyToggleButtons({ label = 'Moneda', value, allowed, onChange }: CurrencyToggleButtonsProps) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <CurrencyPillSelector
                value={value}
                options={allowed.length > 0 ? allowed : [value]}
                readOnly={allowed.length <= 1}
                onValueChange={onChange}
            />
        </div>
    )
}
