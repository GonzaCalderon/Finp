'use client'

import { useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AccountDialog } from '@/components/shared/AccountDialog'
import { AccountDetailSheet } from '@/components/shared/AccountDetailSheet'
import type { AccountFormData } from '@/lib/validations'
import type { IAccount } from '@/types'

type AccountWithColor = IAccount & { color?: string }

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    bank: 'Banco',
    cash: 'Efectivo',
    wallet: 'Billetera virtual',
    credit_card: 'Tarjeta de crédito',
    debt: 'Deuda',
    savings: 'Ahorro',
}

export default function AccountsPage() {
    const { accounts, loading, error, createAccount, updateAccount, deleteAccount } = useAccounts()
    const { success, error: toastError } = useToast()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<IAccount | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [detailAccountId, setDetailAccountId] = useState<string | null>(null)

    const handleCreate = () => {
        setSelectedAccount(null)
        setDialogOpen(true)
    }

    const handleEdit = (account: IAccount, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedAccount(account)
        setDialogOpen(true)
    }

    const handleCardClick = (account: IAccount) => {
        setDetailAccountId(account._id.toString())
        setDetailOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        try {
            await deleteAccount(deleteId)
            success('Cuenta desactivada correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al desactivar cuenta')
        } finally {
            setDeleteId(null)
        }
    }

    const handleSubmit = async (data: AccountFormData) => {
        try {
            if (selectedAccount) {
                await updateAccount(selectedAccount._id.toString(), data)
                success('Cuenta actualizada correctamente')
            } else {
                await createAccount(data)
                success('Cuenta creada correctamente')
            }
            setDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar cuenta')
        }
    }

    if (loading) return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-36" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-36 w-full rounded-xl" />
                ))}
            </div>
        </div>
    )

    if (error) return <div className="p-8 text-center text-destructive">{error}</div>

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Cuentas</h1>
                <Button onClick={handleCreate}>+ Nueva cuenta</Button>
            </div>

            {accounts.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No tenés cuentas todavía. Creá tu primera cuenta.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {accounts.map((account) => {
                        const acc = account as AccountWithColor
                        return (
                            <Card
                                key={acc._id.toString()}
                                className="cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => handleCardClick(acc)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            {acc.color && (
                                                <div
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: acc.color }}
                                                />
                                            )}
                                            <CardTitle className="text-base">{acc.name}</CardTitle>
                                        </div>
                                        <Badge variant="outline" className="text-xs w-fit">
                                            {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">{acc.currency}</span>
                                        {acc.institution && (
                                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{acc.institution}</span>
                                        )}
                                    </div>
                                    {(acc as AccountWithColor & { balance?: number }).balance !== undefined && (
                                        <p className={`text-lg font-bold ${
                                            ((acc as AccountWithColor & { balance?: number }).balance ?? 0) < 0
                                                ? 'text-red-600'
                                                : 'text-foreground'
                                        }`}>
                                            {new Intl.NumberFormat('es-AR', {
                                                style: 'currency',
                                                currency: acc.currency,
                                                maximumFractionDigits: 0,
                                            }).format((acc as AccountWithColor & { balance?: number }).balance ?? 0)}
                                        </p>
                                    )}
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={(e) => handleEdit(acc, e)}>
                                            Editar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setDeleteId(acc._id.toString())
                                            }}
                                        >
                                            Desactivar
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <AccountDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                account={selectedAccount}
                onSubmit={handleSubmit}
            />

            <AccountDetailSheet
                open={detailOpen}
                onOpenChange={setDetailOpen}
                accountId={detailAccountId}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desactivar esta cuenta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            La cuenta dejará de aparecer pero el historial se conserva.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>
                            Desactivar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}