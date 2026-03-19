'use client'

import { useState, useRef, useEffect } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Label } from '@/components/ui/label'

interface ColorPickerProps {
    value: string
    onChange: (color: string) => void
    label?: string
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div className="space-y-2">
            {label && <Label>{label}</Label>}
            <div className="relative" ref={ref}>
                <button
                    type="button"
                    onClick={() => setOpen((p) => !p)}
                    className="flex items-center gap-3 h-10 px-3 rounded-md border border-input bg-background hover:bg-muted transition-colors w-full"
                >
                    <div
                        className="w-5 h-5 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: value || '#e5e7eb' }}
                    />
                    <span className="text-sm text-muted-foreground">
            {value ? value.toUpperCase() : 'Elegir color'}
          </span>
                </button>

                {open && (
                    <div className="absolute top-full mt-2 left-0 z-50 rounded-xl border bg-background shadow-lg p-3 space-y-3">
                        <HexColorPicker color={value || '#6366f1'} onChange={onChange} />
                        <div className="flex items-center gap-2">
                            <div
                                className="w-8 h-8 rounded-md border shrink-0"
                                style={{ backgroundColor: value || '#e5e7eb' }}
                            />
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder="#6366f1"
                                className="flex-1 h-8 px-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                maxLength={7}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}