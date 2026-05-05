'use client'

import { HexColorPicker } from 'react-colorful'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ColorPickerProps {
    value: string
    onChange: (color: string) => void
    label?: string
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
    return (
        <div className="space-y-2">
            {label && <Label>{label}</Label>}
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="flex h-10 w-full items-center gap-3 rounded-md border border-input bg-background px-3 transition-colors hover:bg-muted"
                    >
                        <div
                            className="h-5 w-5 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: value || '#e5e7eb' }}
                        />
                        <span className="text-sm text-muted-foreground">
                            {value ? value.toUpperCase() : 'Elegir color'}
                        </span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto space-y-3 p-3" align="start">
                    <HexColorPicker color={value || '#6366f1'} onChange={onChange} />
                    <div className="flex items-center gap-2">
                        <div
                            className="h-8 w-8 shrink-0 rounded-md border"
                            style={{ backgroundColor: value || '#e5e7eb' }}
                        />
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="#6366f1"
                            className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            maxLength={7}
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
