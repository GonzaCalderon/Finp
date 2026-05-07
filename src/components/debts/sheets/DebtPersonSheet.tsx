'use client'

import { ArrowRight, Plus } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    DebtDirectionBadge,
    DebtSourceBadge,
    DebtStatusBadge,
    DebtAmountInline,
    DebtInitialsAvatar,
    formatDebtAmount,
} from '@/components/debts/DebtsUi'
import type { IDebt } from '@/types/debt'
import type { ConsolidatedDebtByPerson } from '@/lib/utils/debt'

interface DebtPersonSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    person: ConsolidatedDebtByPerson | null
    debts: IDebt[]
    hidden?: boolean
    onViewDebt: (debt: IDebt) => void
    onPay: (debt: IDebt) => void
    onCollect: (debt: IDebt) => void
    onNewDebt: (prefillName: string) => void
}

export function DebtPersonSheet({
    open,
    onOpenChange,
    person,
    debts,
    hidden,
    onViewDebt,
    onPay,
    onCollect,
    onNewDebt,
}: DebtPersonSheetProps) {
    if (!person) return null

    const currencies = new Set([
        ...Object.keys(person.payable),
        ...Object.keys(person.receivable),
    ])

    const spaceDebts = debts.filter((d) => d.sourceType === 'space')
    const manualDebts = debts.filter((d) => d.sourceType === 'manual')

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-y-auto">
                <SheetHeader className="px-6 pt-6 pb-4">
                    <div className="flex items-center gap-3">
                        <DebtInitialsAvatar name={person.counterpartyNameSnapshot} />
                        <div>
                            <SheetTitle className="text-base">{person.counterpartyNameSnapshot}</SheetTitle>
                            <SheetDescription className="text-xs">Detalle de deudas con esta persona</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="px-6 pb-4">
                    <div className="grid gap-1">
                        {Array.from(currencies).map((currency) => {
                            const p = person.payable[currency] ?? 0
                            const r = person.receivable[currency] ?? 0
                            const neto = r - p
                            return (
                                <div key={currency} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Neto {currency}</span>
                                    <DebtAmountInline
                                        amount={Math.abs(neto)}
                                        currency={currency}
                                        hidden={hidden}
                                        style={{ color: neto > 0 ? 'var(--chart-3)' : 'var(--chart-4)' } as React.CSSProperties}
                                    />
                                </div>
                            )
                        })}
                        {Array.from(currencies).map((currency) => {
                            const p = person.payable[currency]
                            const r = person.receivable[currency]
                            return (
                                <div key={`${currency}-detail`} className="text-xs text-muted-foreground">
                                    {p ? `Debo ${hidden ? '••••' : formatDebtAmount(p, currency)}` : ''}
                                    {p && r ? ' · ' : ''}
                                    {r ? `Me deben ${hidden ? '••••' : formatDebtAmount(r, currency)}` : ''}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <Separator />

                <div className="flex-1 px-6 py-4 space-y-4">
                    {spaceDebts.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Espacios</p>
                            <div className="space-y-2">
                                {spaceDebts.map((debt) => (
                                    <DebtRowItem
                                        key={debt._id.toString()}
                                        debt={debt}
                                        hidden={hidden}
                                        onViewDebt={onViewDebt}
                                        onPay={onPay}
                                        onCollect={onCollect}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {manualDebts.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Manuales</p>
                            <div className="space-y-2">
                                {manualDebts.map((debt) => (
                                    <DebtRowItem
                                        key={debt._id.toString()}
                                        debt={debt}
                                        hidden={hidden}
                                        onViewDebt={onViewDebt}
                                        onPay={onPay}
                                        onCollect={onCollect}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {debts.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No hay deudas activas con esta persona.</p>
                    )}
                </div>

                <Separator />

                <div className="px-6 py-4">
                    <Button
                        variant="outline"
                        className="w-full text-sm"
                        onClick={() => {
                            onOpenChange(false)
                            onNewDebt(person.counterpartyNameSnapshot)
                        }}
                    >
                        <Plus size={14} className="mr-1.5" />
                        Nueva deuda con {person.counterpartyNameSnapshot}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function DebtRowItem({
    debt,
    hidden,
    onViewDebt,
    onPay,
    onCollect,
}: {
    debt: IDebt
    hidden?: boolean
    onViewDebt: (debt: IDebt) => void
    onPay: (debt: IDebt) => void
    onCollect: (debt: IDebt) => void
}) {
    const isActionable = debt.status === 'active' || debt.status === 'partially_paid'

    return (
        <div
            className="rounded-lg border p-3 flex flex-col gap-2"
            style={{ borderColor: 'var(--border)' }}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <DebtDirectionBadge direction={debt.direction} />
                    <DebtSourceBadge sourceType={debt.sourceType} />
                    <DebtStatusBadge status={debt.status} />
                </div>
                <DebtAmountInline
                    amount={debt.remainingAmount}
                    currency={debt.currency}
                    hidden={hidden}
                    className="text-sm shrink-0"
                />
            </div>
            {debt.notes && (
                <p className="text-xs text-muted-foreground truncate">{debt.notes}</p>
            )}
            <div className="flex items-center gap-2">
                {isActionable && debt.direction === 'payable' && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() => onPay(debt)}
                    >
                        Pagar
                    </Button>
                )}
                {isActionable && debt.direction === 'receivable' && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() => onCollect(debt)}
                    >
                        Registrar cobro
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 px-2 ml-auto"
                    onClick={() => onViewDebt(debt)}
                >
                    Ver detalle
                    <ArrowRight size={12} className="ml-1" />
                </Button>
            </div>
        </div>
    )
}
