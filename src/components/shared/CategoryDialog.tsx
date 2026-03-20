'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { categorySchema, type CategoryFormData } from '@/lib/validations'
import type { ICategory } from '@/types'
import {Spinner} from "@/components/shared/Spinner";

interface CategoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    category: ICategory | null
    onSubmit: (data: CategoryFormData) => Promise<void>
}

export function CategoryDialog({ open, onOpenChange, category, onSubmit }: CategoryDialogProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        defaultValues: { color: '#6366f1' },
    })

    const color = watch('color') ?? '#6366f1'
    const type = watch('type')

    useEffect(() => {
        if (open) {
            if (category) {
                reset({
                    name: category.name,
                    type: category.type,
                    color: category.color ?? '#6366f1',
                })
            } else {
                reset({ color: '#6366f1' })
            }
        }
    }, [open, category, reset])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input id="name" placeholder="Ej: Supermercado" {...register('name')} autoFocus />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={type} onValueChange={(v) => setValue('type', v as CategoryFormData['type'], { shouldValidate: true })}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná un tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="income">Ingreso</SelectItem>
                                <SelectItem value="expense">Gasto</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
                    </div>

                    <ColorPicker label="Color" value={color} onChange={(c) => setValue('color', c)} />

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>


                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
      <Spinner /> Guardando...
    </span>
                            ) : category ? 'Guardar cambios' : 'Crear cuenta'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}