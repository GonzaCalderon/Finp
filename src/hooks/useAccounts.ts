import { useState, useEffect } from 'react'
import type { IAccount } from '@/types'

export function useAccounts() {
    const [accounts, setAccounts] = useState<IAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAccounts = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/accounts')
            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            setAccounts(data.accounts)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar cuentas')
        } finally {
            setLoading(false)
        }
    }

    const createAccount = async (body: Partial<IAccount>) => {
        const res = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchAccounts()
        return data.account
    }

    const updateAccount = async (id: string, body: Partial<IAccount>) => {
        const res = await fetch(`/api/accounts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchAccounts()
        return data.account
    }

    const deleteAccount = async (id: string) => {
        const res = await fetch(`/api/accounts/${id}`, {
            method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchAccounts()
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    return {
        accounts,
        loading,
        error,
        fetchAccounts,
        createAccount,
        updateAccount,
        deleteAccount,
    }
}