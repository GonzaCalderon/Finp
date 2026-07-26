'use client'

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { DebtRelationPanel } from '@/components/debts/panels/DebtRelationPanel'
import type { DebtRelationship } from '@/lib/utils/debts-ui'
import type { IDebt } from '@/types/debt'

interface DebtRelationSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    rel: DebtRelationship | null
    hidden?: boolean
    highlightedDebtId?: string | null
    onViewDebt: (debt: IDebt) => void
    onPay: (debt: IDebt) => void
    onCollect: (debt: IDebt) => void
    onNewDebt: (prefillName: string) => void
}

export function DebtRelationSheet({
    open,
    onOpenChange,
    rel,
    hidden,
    highlightedDebtId,
    onViewDebt,
    onPay,
    onCollect,
    onNewDebt,
}: DebtRelationSheetProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[90dvh] rounded-t-2xl p-0" showCloseButton>
                <SheetHeader className="sr-only">
                    <SheetTitle>{rel?.name ?? 'Detalle de deuda'}</SheetTitle>
                    <SheetDescription>Detalle de relación de deuda</SheetDescription>
                </SheetHeader>
                {rel ? (
                    <DebtRelationPanel
                        rel={rel}
                        hidden={hidden}
                        highlightedDebtId={highlightedDebtId}
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
