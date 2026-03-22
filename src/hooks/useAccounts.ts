import { useAccountsContext } from '@/contexts/AccountsContext'

export function useAccounts() {
    return useAccountsContext()
}