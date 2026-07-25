'use client'

import { CircleDollarSign } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { CommitmentAmountSchedule } from '@/components/shared/CommitmentAmountSchedule'
import type { IScheduledCommitment } from '@/types'

interface CommitmentAmountDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    commitment: IScheduledCommitment | null
    onChange: () => void
}

export function CommitmentAmountDialog({
    open,
    onOpenChange,
    commitment,
    onChange,
}: CommitmentAmountDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="flex max-w-xl flex-col overflow-hidden p-0"
            >
                <DialogHeader className="border-b px-5 pb-4 pt-5">
                    <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CircleDollarSign className="size-5" />
                    </div>
                    <DialogTitle>Cambiar monto</DialogTitle>
                    <DialogDescription>
                        {commitment
                            ? `Definí cuánto vale ${commitment.description} y desde cuándo.`
                            : 'Definí el nuevo monto y su fecha efectiva.'}
                    </DialogDescription>
                </DialogHeader>

                {commitment && (
                    <CommitmentAmountSchedule
                        commitmentId={commitment._id.toString()}
                        currency={commitment.currency}
                        currentAmount={
                            commitment.resolvedAmount ?? commitment.amount
                        }
                        currentEffectiveFrom={
                            commitment.resolvedAmountEffectiveFrom ??
                            commitment.startDate
                        }
                        nextDueDate={commitment.nextDueDate}
                        schedule={commitment.amountSchedule ?? []}
                        onChange={onChange}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
