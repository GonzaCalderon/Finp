'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'
import type { IAccount } from '@/types'

type AccountsContextValue = {
    accounts: IAccount[]
    loading: boolean
    error: string | null
    fetchAccounts: () => Promise<void>
    createAccount: (body: Partial<IAccount>) => Promise<IAccount>
    updateAccount: (id: string, body: Partial<IAccount>) => Promise<IAccount>
    deleteAccount: (id: string) => Promise<void>
}

const AccountsContext = createContext<AccountsContextValue | undefined>(
    undefined
)

export function AccountsProvider({
                                     children,
                                 }: {
    children: React.ReactNode
}) {
    const [accounts, setAccounts] = useState<IAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const res = await fetch('/api/accounts')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Error al cargar cuentas')
            }

            setAccounts(data.accounts ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar cuentas')
        } finally {
            setLoading(false)
        }
    }, [])

    const createAccount = useCallback(async (body: Partial<IAccount>) => {
        const res = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.error || 'Error al crear cuenta')
        }

        const newAccount = data.account as IAccount

        setAccounts((prev) => {
            const exists = prev.some(
                (account) => account._id.toString() === newAccount._id.toString()
            )

            if (exists) return prev
            return [...prev, newAccount]
        })

        return newAccount
    }, [])

    const updateAccount = useCallback(
        async (id: string, body: Partial<IAccount>) => {
            const res = await fetch(`/api/accounts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Error al actualizar cuenta')
            }

            const updatedAccount = data.account as IAccount

            setAccounts((prev) =>
                prev.map((account) =>
                    account._id.toString() === id ? updatedAccount : account
                )
            )

            return updatedAccount
        },
        []
    )

    const deleteAccount = useCallback(async (id: string) => {
        const res = await fetch(`/api/accounts/${id}`, {
            method: 'DELETE',
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.error || 'Error al eliminar cuenta')
        }

        setAccounts((prev) =>
            prev.filter((account) => account._id.toString() !== id)
        )
    }, [])

    useEffect(() => {
        void fetchAccounts()
    }, [fetchAccounts])

    const value = useMemo<AccountsContextValue>(
        () => ({
            accounts,
            loading,
            error,
            fetchAccounts,
            createAccount,
            updateAccount,
            deleteAccount,
        }),
        [accounts, loading, error, fetchAccounts, createAccount, updateAccount, deleteAccount]
    )

    return (
        <AccountsContext.Provider value={value}>
            {children}
        </AccountsContext.Provider>
    )
}

export function useAccountsContext() {
    const context = useContext(AccountsContext)

    if (!context) {
        throw new Error('useAccountsContext debe usarse dentro de un AccountsProvider')
    }

    return context
}