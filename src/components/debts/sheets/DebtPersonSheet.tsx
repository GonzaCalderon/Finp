'use client'

import { useMemo } from 'react'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { DebtRelationPanel } from '@/components/debts/panels/DebtRelationPanel'
import { buildDebtRelationships } from '@/lib/utils/debts-ui'
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
    const rel = useMemo(() => {
        return buildDebtRelationships(debts, [], {})[0] ?? null
    }, [debts])

    if (!person && !rel) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full p-0 sm:max-w-lg" showCloseButton>
                <SheetHeader className="sr-only">
                    <SheetTitle>{rel?.name ?? person?.counterpartyNameSnapshot ?? 'Detalle de deuda'}</SheetTitle>
                    <SheetDescription>Detalle de deudas con esta persona</SheetDescription>
                </SheetHeader>
                {rel ? (
                    <DebtRelationPanel
                        rel={rel}
                        hidden={hidden}
                        onViewDebt={onViewDebt}
                        onPay={onPay}
                        onCollect={onCollect}
                        onNewDebt={onNewDebt}
                    />
                ) : null}
            </SheetContent>
        </Sheet>
    )
}
