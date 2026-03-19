import { toast } from 'sonner'

export function useToast() {
    const success = (message: string) => toast.success(message)
    const error = (message: string) => toast.error(message)
    const info = (message: string) => toast.info(message)
    const warning = (message: string) => toast.warning(message)

    const confirm = (message: string, onConfirm: () => void) => {
        toast(message, {
            action: {
                label: 'Confirmar',
                onClick: onConfirm,
            },
            cancel: {
                label: 'Cancelar',
                onClick: () => {},
            },
        })
    }

    return { success, error, info, warning, confirm }
}