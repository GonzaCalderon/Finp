'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ColorPicker } from '@/components/shared/ColorPicker'
import type { ICategory } from '@/types'

interface CategoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    category: ICategory | null
    onSubmit: (data: Partial<ICategory>) => Promise<void>
}

export function CategoryDialog({ open, onOpenChange, category, onSubmit }: CategoryDialogProps) {
    const [name, setName] = useState('')
    const [type, setType] = useState('')
    const [color, setColor] = useState('#6366f1')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (category) {
            setName(category.name)
            setType(category.type)
            setColor(category.color ?? '#6366f1')
        } else {
            setName('')
            setType('')
            setColor('#6366f1')
        }
    }, [category, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSubmit({
                name,
                type: type as ICategory['type'],
                color,
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>
                        {category ? 'Editar categoría' : 'Nueva categoría'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="Ej: Supermercado"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={type} onValueChange={setType} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná un tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="income">Ingreso</SelectItem>
                                <SelectItem value="expense">Gasto</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <ColorPicker
                        label="Color"
                        value={color}
                        onChange={setColor}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : category ? 'Guardar cambios' : 'Crear categoría'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}