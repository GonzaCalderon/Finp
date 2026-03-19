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
import type { AccountFormData } from '@/lib/validations'
import type { IAccount } from '@/types'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    bank: 'Banco',
    cash: 'Efectivo',
    wallet: 'Billetera virtual',
    credit_card: 'Tarjeta de crédito',
    debt: 'Deuda',
    savings: 'Ahorro',
}

const CURRENCY_LABELS: Record<string, string> = {
    ARS: '$ ARS',
    USD: 'U$D',
}

export default function AccountsPage() {
    const { accounts, loading, error, createAccount, updateAccount, deleteAccount } = useAccounts()
    const { success, error: toastError } = useToast()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<IAccount | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const handleCreate = () => {
        setSelectedAccount(null)
        setDialogOpen(true)
    }

    const handleEdit = (account: IAccount) => {
        setSelectedAccount(account)
        setDialogOpen(true)
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
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
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
                        const accountWithColor = account as IAccount & { color?: string }
                        return (
                            <Card key={account._id.toString()}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {accountWithColor.color && (
                                                <div
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: accountWithColor.color }}
                                                />
                                            )}
                                            <CardTitle className="text-base">{account.name}</CardTitle>
                                        </div>
                                        <Badge variant="secondary">
                                            {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                                        <span>{CURRENCY_LABELS[account.currency] ?? account.currency}</span>
                                        {account.institution && <span>{account.institution}</span>}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(account)}>
                                            Editar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteId(account._id.toString())}
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