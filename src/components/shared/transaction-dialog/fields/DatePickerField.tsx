import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DatePickerFieldProps {
    label?: string
    value: Date | undefined
    error?: string
    showErrors?: boolean
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onChange: (date: Date | undefined) => void
    className?: string
}

export function DatePickerField({
    label = 'Fecha',
    value,
    error,
    showErrors,
    isOpen,
    onOpenChange,
    onChange,
    className = 'w-full space-y-1.5',
}: DatePickerFieldProps) {
    return (
        <div className={className}>
            <Label>{label}</Label>
            <Popover open={isOpen} onOpenChange={onOpenChange}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-start rounded-[1rem] text-left font-medium">
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        {value instanceof Date ? value.toLocaleDateString('es-AR') : 'Selecciona fecha'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={value} onSelect={onChange} />
                </PopoverContent>
            </Popover>
            {showErrors && error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    )
}
