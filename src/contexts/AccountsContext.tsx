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
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import { apiJson } from '@/lib/client/auth-client'
import {
    ACCOUNT_INVALIDATION_TAGS,
    invalidateData,
} from '@/lib/client/data-sync'

type AccountsContextValue = {
    accounts: IAccount[]
    loading: boolean
    error: string | null
    fetchAccounts: (options?: { silent?: boolean }) => Promise<void>
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

    const fetchAccounts = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) {
                setLoading(true)
            }
            setError(null)

            const data = await apiJson<{ accounts?: IAccount[] }>('/api/accounts')
            setAccounts(data.accounts ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar cuentas')
        } finally {
            if (!options?.silent) {
                setLoading(false)
            }
        }
    }, [])

    const createAccount = useCallback(async (body: Partial<IAccount>) => {
        const data = await apiJson<{ account: IAccount }>('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        const newAccount = data.account as IAccount
        const newDefaultPaymentMethods = newAccount.defaultPaymentMethods ?? []

        setAccounts((prev) => {
            const exists = prev.some(
                (account) => account._id.toString() === newAccount._id.toString()
            )

            if (exists) return prev
            const nextAccounts = prev.map((account) => {
                if (newDefaultPaymentMethods.length === 0) return account
                return {
                    ...account,
                    defaultPaymentMethods: (account.defaultPaymentMethods ?? []).filter(
                        (method) => !newDefaultPaymentMethods.includes(method)
                    ),
                }
            })
            return [...nextAccounts, newAccount]
        })

        invalidateData(ACCOUNT_INVALIDATION_TAGS)
        return newAccount
    }, [])

    const updateAccount = useCallback(
        async (id: string, body: Partial<IAccount>) => {
            const data = await apiJson<{ account: IAccount }>(`/api/accounts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const updatedAccount = data.account as IAccount
            const updatedDefaultPaymentMethods = updatedAccount.defaultPaymentMethods ?? []

            setAccounts((prev) =>
                prev.map((account) => {
                    if (account._id.toString() === id) return updatedAccount

                    if (updatedDefaultPaymentMethods.length === 0) return account

                    return {
                        ...account,
                        defaultPaymentMethods: (account.defaultPaymentMethods ?? []).filter(
                            (method) => !updatedDefaultPaymentMethods.includes(method)
                        ),
                    }
                })
            )

            invalidateData(ACCOUNT_INVALIDATION_TAGS)
            return updatedAccount
        },
        []
    )

    const deleteAccount = useCallback(async (id: string) => {
        await apiJson(`/api/accounts/${id}`, {
            method: 'DELETE',
        })

        setAccounts((prev) =>
            prev.filter((account) => account._id.toString() !== id)
        )
        invalidateData(ACCOUNT_INVALIDATION_TAGS)
    }, [])

    useDataInvalidation(['accounts'], () => {
        void fetchAccounts({ silent: true })
    })

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
