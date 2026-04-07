import { Label } from '@/components/ui/label'
import type { TransactionFormInput } from '@/lib/validations'
import { SURFACE } from '../shared-ui'

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
            {allowed.length > 1 ? (
                <div className="grid grid-cols-2 gap-2">
                    {allowed.map((currency) => {
                        const selected = value === currency
                        return (
                            <button
                                key={currency}
                                type="button"
                                className="h-10 rounded-[1rem] border px-3 text-sm font-medium transition-colors"
                                style={{
                                    borderColor: selected ? SURFACE.selected.borderColor : SURFACE.inner.borderColor,
                                    background: selected ? SURFACE.selected.background : 'transparent',
                                }}
                                onClick={() => onChange(currency)}
                            >
                                {currency}
                            </button>
                        )
                    })}
                </div>
            ) : (
                <div
                    className="flex h-10 items-center rounded-[1rem] border px-3 text-sm font-medium"
                    style={SURFACE.inner}
                >
                    {allowed[0] ?? value}
                </div>
            )}
        </div>
    )
}
