'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DebtsPageHeader({ onNew }: { onNew: () => void }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                    Deudas
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Controlá lo que debés y lo que te deben sin mezclarlo con tus gastos.
                </p>
            </div>
            <Button onClick={onNew} size="sm" className="hidden md:inline-flex">
                <Plus className="h-3.5 w-3.5" />
                Nueva deuda
            </Button>
            <Button onClick={onNew} size="icon-sm" className="md:hidden" aria-label="Nueva deuda">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    )
}
