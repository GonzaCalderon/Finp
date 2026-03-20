import { useEffect } from 'react'

export function usePageTitle(title: string) {
    useEffect(() => {
        document.title = `${title} | Finp`
        return () => {
            document.title = 'Finp'
        }
    }, [title])
}