'use client'

import { useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AccountDialog } from '@/components/shared/AccountDialog'
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
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<IAccount | null>(null)

    const handleCreate = () => {
        setSelectedAccount(null)
        setDialogOpen(true)
    }

    const handleEdit = (account: IAccount) => {
        setSelectedAccount(account)
        setDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Desactivar esta cuenta?')) return
        try {
            await deleteAccount(id)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al desactivar cuenta')
        }
    }

    const handleSubmit = async (data: Partial<IAccount>) => {
        try {
            if (selectedAccount) {
                await updateAccount(selectedAccount._id.toString(), data)
            } else {
                await createAccount(data)
            }
            setDialogOpen(false)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al guardar cuenta')
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando cuentas...</div>
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
                    {accounts.map((account) => (
                        <Card key={account._id.toString()}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{account.name}</CardTitle>
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(account)}
                                    >
                                        Editar
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(account._id.toString())}
                                    >
                                        Desactivar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AccountDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                account={selectedAccount}
                onSubmit={handleSubmit}
            />
        </div>
    )
}