'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePreferences, type DefaultView } from '@/hooks/usePreferences'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { CategoryDialog } from '@/components/shared/CategoryDialog'
import { fadeIn, fadeInFast, staggerContainer, staggerItem } from '@/lib/utils/animations'
import {
    User,
    Lock,
    Monitor,
    Sun,
    Moon,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Shield,
    Clock,
} from 'lucide-react'
import type { CategoryFormData } from '@/lib/validations'
import type { ICategory } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type DefaultCategoryItem = { name: string; type: string; color: string }

type TabKey = 'cuenta' | 'preferencias' | 'categorias'

// ─── Category sub-components (moved from categories/page.tsx) ─────────────────

function CategoryItem({
    item,
    selected,
    onClick,
    disabled,
}: {
    item: DefaultCategoryItem
    selected: boolean
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <div
            onClick={disabled ? undefined : onClick}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{
                background: selected ? 'var(--sky-light)' : 'transparent',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                borderLeft: selected ? '2px solid var(--sky)' : '2px solid transparent',
            }}
        >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
            <span
                className="text-xs ml-auto"
                style={{ color: item.type === 'income' ? '#10B981' : 'var(--muted-foreground)' }}
            >
                {item.type === 'income' ? 'Ingreso' : 'Gasto'}
            </span>
        </div>
    )
}

function TransferList({
    missing,
    existing,
    onConfirm,
    onClose,
}: {
    missing: DefaultCategoryItem[]
    existing: DefaultCategoryItem[]
    onConfirm: (names: string[]) => Promise<void>
    onClose: () => void
}) {
    const [left, setLeft] = useState<DefaultCategoryItem[]>(missing)
    const [right, setRight] = useState<DefaultCategoryItem[]>(existing)
    const [selectedLeft, setSelectedLeft] = useState<Set<string>>(new Set())
    const [selectedRight, setSelectedRight] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)

    const toggleLeft = (name: string) => {
        setSelectedLeft((prev) => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }

    const toggleRight = (name: string) => {
        const item = right.find((r) => r.name === name)
        if (existing.find((e) => e.name === item?.name)) return
        setSelectedRight((prev) => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }

    const moveToRight = () => {
        const toMove = left.filter((c) => selectedLeft.has(c.name))
        setRight((prev) => [...prev, ...toMove])
        setLeft((prev) => prev.filter((c) => !selectedLeft.has(c.name)))
        setSelectedLeft(new Set())
    }

    const moveToLeft = () => {
        const toMove = right.filter((c) => selectedRight.has(c.name))
        setLeft((prev) => [...prev, ...toMove])
        setRight((prev) => prev.filter((c) => !selectedRight.has(c.name)))
        setSelectedRight(new Set())
    }

    const handleConfirm = async () => {
        const newOnes = right.filter((r) => !existing.find((e) => e.name === r.name))
        if (newOnes.length === 0) { onClose(); return }
        try {
            setSaving(true)
            await onConfirm(newOnes.map((c) => c.name))
            onClose()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Disponibles ({left.length})
                    </p>
                    <div
                        className="rounded-lg overflow-hidden min-h-52 max-h-52 overflow-y-auto"
                        style={{ border: '0.5px solid var(--border)', background: 'var(--muted)' }}
                    >
                        {left.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-4 text-center">Todas agregadas</p>
                        ) : left.map((item) => (
                            <CategoryItem
                                key={item.name}
                                item={item}
                                selected={selectedLeft.has(item.name)}
                                onClick={() => toggleLeft(item.name)}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="w-8 h-8 p-0"
                        onClick={moveToRight} disabled={selectedLeft.size === 0}>
                        <ChevronRight size={14} />
                    </Button>
                    <Button variant="outline" size="sm" className="w-8 h-8 p-0"
                        onClick={moveToLeft} disabled={selectedRight.size === 0}>
                        <ChevronLeft size={14} />
                    </Button>
                </div>

                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        A agregar ({right.filter((r) => !existing.find((e) => e.name === r.name)).length} nuevas)
                    </p>
                    <div
                        className="rounded-lg overflow-hidden min-h-52 max-h-52 overflow-y-auto"
                        style={{ border: '0.5px solid var(--border)', background: 'var(--muted)' }}
                    >
                        {right.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-4 text-center">Ninguna seleccionada</p>
                        ) : right.map((item) => {
                            const isExisting = !!existing.find((e) => e.name === item.name)
                            return (
                                <CategoryItem
                                    key={item.name}
                                    item={item}
                                    selected={selectedRight.has(item.name)}
                                    onClick={() => toggleRight(item.name)}
                                    disabled={isExisting}
                                />
                            )
                        })}
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Las categorías en gris ya existen y no se pueden quitar desde acá.
            </p>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleConfirm} disabled={saving}>
                    {saving ? 'Guardando...' : 'Agregar seleccionadas'}
                </Button>
            </div>
        </div>
    )
}

function DeleteCategoryDialog({
    category,
    categories,
    open,
    onOpenChange,
    onConfirm,
}: {
    category: ICategory | null
    categories: ICategory[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (id: string, migrateTo?: string) => Promise<void>
}) {
    const [migrateTo, setMigrateTo] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [usageCount, setUsageCount] = useState<number | null>(null)

    useEffect(() => {
        if (!open || !category) return
        setMigrateTo('')
        fetch(`/api/categories/${category._id}/usage`)
            .then((r) => r.json())
            .then((d: { count?: number }) => setUsageCount(d.count ?? 0))
            .catch(() => setUsageCount(0))
    }, [open, category])

    if (!category) return null

    const otherCategories = categories.filter(
        (c) => c._id.toString() !== category._id.toString() && c.type === category.type
    )

    const handleConfirm = async () => {
        try {
            setLoading(true)
            await onConfirm(category._id.toString(), migrateTo || undefined)
            onOpenChange(false)
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar &quot;{category.name}&quot;?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {usageCount === null ? (
                            'Calculando uso...'
                        ) : usageCount === 0 ? (
                            'Esta categoría no tiene items asociados.'
                        ) : (
                            `Esta categoría tiene ${usageCount} item${usageCount !== 1 ? 's' : ''} asociado${usageCount !== 1 ? 's' : ''}.`
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {usageCount !== null && usageCount > 0 && (
                    <div className="space-y-2 py-2">
                        <p className="text-sm font-medium">Migrar items a:</p>
                        <Select value={migrateTo} onValueChange={setMigrateTo}>
                            <SelectTrigger>
                                <SelectValue placeholder="Dejar sin categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {otherCategories.map((c) => (
                                    <SelectItem key={c._id.toString()} value={c._id.toString()}>
                                        <div className="flex items-center gap-2">
                                            {c.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />}
                                            {c.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!migrateTo && (
                            <p className="text-xs text-muted-foreground">
                                Si no seleccionás una categoría destino, los items quedarán sin categorizar.
                            </p>
                        )}
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={loading}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {loading ? 'Eliminando...' : 'Eliminar'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

// ─── Section: Cuenta ──────────────────────────────────────────────────────────

function AccountSection() {
    const { success, error: toastError } = useToast()

    const [displayName, setDisplayName] = useState('')
    const [email, setEmail] = useState('')
    const [loadingUser, setLoadingUser] = useState(true)

    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState('')
    const [savingName, setSavingName] = useState(false)

    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [savingPassword, setSavingPassword] = useState(false)

    useEffect(() => {
        fetch('/api/user')
            .then((r) => r.json())
            .then((data: { user?: { displayName?: string; email?: string } }) => {
                setDisplayName(data.user?.displayName ?? '')
                setEmail(data.user?.email ?? '')
            })
            .catch(() => toastError('Error al cargar datos del usuario'))
            .finally(() => setLoadingUser(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleEditName = () => {
        setNameValue(displayName)
        setEditingName(true)
    }

    const handleCancelEditName = () => {
        setEditingName(false)
        setNameValue('')
    }

    const handleSaveName = async () => {
        if (!nameValue.trim()) return
        try {
            setSavingName(true)
            const res = await fetch('/api/user', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: nameValue.trim() }),
            })
            const json = await res.json() as { error?: string }
            if (!res.ok) throw new Error(json.error ?? 'Error al actualizar nombre')
            setDisplayName(nameValue.trim())
            success('Nombre actualizado correctamente')
            setEditingName(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al actualizar nombre')
        } finally {
            setSavingName(false)
        }
    }

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toastError('Todos los campos son requeridos')
            return
        }
        if (newPassword !== confirmPassword) {
            toastError('Las contraseñas nuevas no coinciden')
            return
        }
        if (newPassword.length < 6) {
            toastError('La contraseña nueva debe tener al menos 6 caracteres')
            return
        }
        try {
            setSavingPassword(true)
            const res = await fetch('/api/user/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
            })
            const json = await res.json() as { error?: string }
            if (!res.ok) throw new Error(json.error ?? 'Error al cambiar contraseña')
            success('Contraseña cambiada correctamente')
            setPasswordDialogOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al cambiar contraseña')
        } finally {
            setSavingPassword(false)
        }
    }

    const handlePasswordDialogClose = (open: boolean) => {
        if (!open) {
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        }
        setPasswordDialogOpen(open)
    }

    return (
        <motion.div className="space-y-4" variants={staggerContainer} initial="initial" animate="animate">
            {/* Datos personales */}
            <motion.div
                variants={staggerItem}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <User size={12} />
                        Datos personales
                    </p>
                </div>

                {/* Nombre */}
                <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '0.5px solid var(--border)' }}
                >
                    <div className="flex-1 min-w-0 mr-4">
                        <p className="text-xs text-muted-foreground mb-1">Nombre</p>
                        {editingName ? (
                            <Input
                                value={nameValue}
                                onChange={(e) => setNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleSaveName()
                                    if (e.key === 'Escape') handleCancelEditName()
                                }}
                                className="h-7 text-sm max-w-xs"
                                autoFocus
                            />
                        ) : loadingUser ? (
                            <Skeleton className="h-4 w-32" />
                        ) : (
                            <p className="text-sm font-medium">{displayName || '—'}</p>
                        )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                        {editingName ? (
                            <>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancelEditName}>
                                    Cancelar
                                </Button>
                                <Button size="sm" className="h-7 text-xs" onClick={handleSaveName} disabled={savingName}>
                                    {savingName ? 'Guardando...' : 'Guardar'}
                                </Button>
                            </>
                        ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleEditName}>
                                Editar
                            </Button>
                        )}
                    </div>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">Email</p>
                        {loadingUser
                            ? <Skeleton className="h-4 w-44" />
                            : <p className="text-sm font-medium text-muted-foreground">{email || '—'}</p>
                        }
                    </div>
                    <span
                        className="text-xs px-2 py-0.5 rounded shrink-0"
                        style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                    >
                        Solo lectura
                    </span>
                </div>
            </motion.div>

            {/* Seguridad */}
            <motion.div
                variants={staggerItem}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Lock size={12} />
                        Seguridad
                    </p>
                </div>

                <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '0.5px solid var(--border)' }}
                >
                    <div>
                        <p className="text-sm font-medium">Contraseña</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Cambiá tu contraseña de acceso</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs shrink-0 ml-4"
                        onClick={() => setPasswordDialogOpen(true)}>
                        Cambiar contraseña
                    </Button>
                </div>

                <div className="px-4 py-3 flex items-start gap-2">
                    <Shield size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                        Tus datos están protegidos con encriptación de extremo a extremo. Las contraseñas se almacenan con hash bcrypt y nunca se guardan en texto plano.
                    </p>
                </div>
            </motion.div>

            {/* Sesión */}
            <motion.div
                variants={staggerItem}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={12} />
                        Sesión
                    </p>
                </div>
                <div className="px-4 py-3 flex items-start gap-2">
                    <Clock size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                        Tu sesión expira automáticamente después de 1 hora de inactividad. Si estuviste activo, se renueva cada 30 minutos.
                    </p>
                </div>
            </motion.div>

            {/* Dialog: cambiar contraseña */}
            <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogClose}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Cambiar contraseña</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Contraseña actual</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Nueva contraseña</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleChangePassword()
                                }}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" onClick={() => handlePasswordDialogClose(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleChangePassword} disabled={savingPassword}>
                                {savingPassword ? 'Guardando...' : 'Cambiar contraseña'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}

// ─── Section: Preferencias ────────────────────────────────────────────────────

const DEFAULT_VIEW_OPTIONS: { value: DefaultView; label: string }[] = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'transactions', label: 'Transacciones' },
    { value: 'accounts', label: 'Cuentas' },
    { value: 'projection', label: 'Proyección' },
]

const MONTH_START_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

function PreferencesSection() {
    const { theme, setTheme } = useTheme()
    const {
        preferences,
        setDefaultView,
        setMonthStartDay,
        setOperationalStartDate,
    } = usePreferences()
    const { success } = useToast()

    const handleThemeChange = (value: string) => {
        setTheme(value)
        success('Tema actualizado')
    }

    const handleDefaultViewChange = (value: DefaultView) => {
        setDefaultView(value)
        success('Vista inicial actualizada')
    }

    const handleMonthStartDayChange = (value: string) => {
        setMonthStartDay(parseInt(value, 10))
        success('Día de inicio actualizado')
    }

    const handleOperationalStartDateChange = (value: string) => {
        setOperationalStartDate(value || undefined)
        success('Fecha de inicio operativo actualizada')
    }

    const handleOperationalStartDateClear = () => {
        setOperationalStartDate(undefined)
        success('Fecha de inicio operativo eliminada')
    }

    const themeOptions = [
        { value: 'light', label: 'Claro', icon: Sun },
        { value: 'dark', label: 'Oscuro', icon: Moon },
        { value: 'system', label: 'Sistema', icon: Monitor },
    ]

    return (
        <motion.div className="space-y-4" variants={staggerContainer} initial="initial" animate="animate">
            {/* Apariencia */}
            <motion.div
                variants={staggerItem}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Apariencia</p>
                </div>

                <div className="px-4 py-4">
                    <Label className="text-sm font-medium mb-3 block">Tema</Label>
                    <div className="flex gap-2 flex-wrap">
                        {themeOptions.map(({ value, label, icon: Icon }) => {
                            const isActive = theme === value
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleThemeChange(value)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border"
                                    style={{
                                        background: isActive ? 'var(--sky-light)' : 'transparent',
                                        borderColor: isActive ? 'var(--sky)' : 'var(--border)',
                                        color: isActive ? 'var(--sky-dark)' : 'var(--foreground)',
                                    }}
                                >
                                    <Icon size={14} />
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </motion.div>

            {/* Navegación */}
            <motion.div
                variants={staggerItem}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Navegación</p>
                </div>

                <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '0.5px solid var(--border)' }}
                >
                    <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium">Vista inicial</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Página que se muestra al iniciar sesión</p>
                    </div>
                    <div className="shrink-0 w-44">
                        <Select
                            value={preferences.defaultView}
                            onValueChange={handleDefaultViewChange}
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DEFAULT_VIEW_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '0.5px solid var(--border)' }}
                >
                    <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium">Inicio del mes financiero</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Día de inicio para cálculos mensuales</p>
                    </div>
                    <div className="shrink-0 w-44">
                        <Select
                            value={String(preferences.monthStartDay)}
                            onValueChange={handleMonthStartDayChange}
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MONTH_START_DAYS.map((day) => (
                                    <SelectItem key={day} value={String(day)}>
                                        Día {day}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div
                    className="flex flex-col gap-3 px-4 py-3"
                    style={{ borderTop: '0.5px solid var(--border)' }}
                >
                    <div>
                        <p className="text-sm font-medium">Inicio operativo en Finp</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Finp usará esta fecha como inicio operativo para balances, métricas y deuda activa.
                            Los movimientos anteriores seguirán visibles como historial.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input
                            type="date"
                            value={preferences.operationalStartDate ?? ''}
                            onChange={(event) => handleOperationalStartDateChange(event.target.value)}
                            className="h-9 sm:max-w-xs"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="h-9"
                            onClick={handleOperationalStartDateClear}
                            disabled={!preferences.operationalStartDate}
                        >
                            Limpiar
                        </Button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Section: Categorías ──────────────────────────────────────────────────────

function CategoriesSection() {
    const {
        categories,
        loading,
        error,
        createCategory,
        updateCategory,
        deleteCategory,
        addDefaultCategories,
        fetchMissingDefaults,
    } = useCategories()
    const { success, error: toastError } = useToast()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<ICategory | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<ICategory | null>(null)
    const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false)
    const [defaultsData, setDefaultsData] = useState<{
        missing: DefaultCategoryItem[]
        existing: DefaultCategoryItem[]
    } | null>(null)
    const [loadingDefaults, setLoadingDefaults] = useState(false)

    const incomeCategories = categories.filter((c) => c.type === 'income')
    const expenseCategories = categories.filter((c) => c.type === 'expense')

    const handleCreate = () => { setSelectedCategory(null); setDialogOpen(true) }
    const handleEdit = (category: ICategory) => { setSelectedCategory(category); setDialogOpen(true) }

    const handleDeleteClick = (category: ICategory) => {
        setCategoryToDelete(category)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async (id: string, migrateTo?: string) => {
        try {
            await deleteCategory(id, migrateTo)
            success('Categoría eliminada correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al eliminar categoría')
        }
    }

    const handleOpenDefaults = async () => {
        try {
            setLoadingDefaults(true)
            const data = await fetchMissingDefaults()
            setDefaultsData(data)
            setDefaultsDialogOpen(true)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al cargar categorías predeterminadas')
        } finally {
            setLoadingDefaults(false)
        }
    }

    const handleAddDefaults = async (names: string[]) => {
        const created = await addDefaultCategories(names)
        success(`${created} categoría${created !== 1 ? 's' : ''} agregada${created !== 1 ? 's' : ''} correctamente`)
    }

    const handleSubmit = async (data: CategoryFormData) => {
        try {
            if (selectedCategory) {
                await updateCategory(selectedCategory._id.toString(), data)
                success('Categoría actualizada correctamente')
            } else {
                await createCategory(data)
                success('Categoría creada correctamente')
            }
            setDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar categoría')
        }
    }

    if (loading) return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-8 w-40" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    )

    if (error) return <div className="py-8 text-center text-destructive text-sm">{error}</div>

    const renderList = (list: ICategory[], type: 'income' | 'expense') => (
        list.length === 0 ? (
            <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">Sin categorías</p>
            </div>
        ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate">
                {list.map((category) => (
                    <motion.div
                        key={category._id.toString()}
                        variants={staggerItem}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                        style={{ borderBottom: '0.5px solid var(--border)' }}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: category.color ?? '#e5e7eb' }}
                            />
                            <span className="text-sm font-medium truncate">{category.name}</span>
                            <span
                                className="text-xs px-1.5 py-0.5 rounded shrink-0"
                                style={{
                                    background: type === 'income' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: type === 'income' ? '#10B981' : '#EF4444',
                                }}
                            >
                                {type === 'income' ? 'Ingreso' : 'Gasto'}
                            </span>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                            <Button variant="ghost" size="sm" className="h-7 text-xs"
                                onClick={() => handleEdit(category)}>Editar</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs"
                                style={{ color: 'var(--destructive)' }}
                                onClick={() => handleDeleteClick(category)}>Eliminar</Button>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        )
    )

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {categories.length} categoría{categories.length !== 1 ? 's' : ''} en total
                </p>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleOpenDefaults} disabled={loadingDefaults}>
                        <Sparkles size={14} className="mr-1" />
                        {loadingDefaults ? 'Cargando...' : 'Predeterminadas'}
                    </Button>
                    <Button size="sm" onClick={handleCreate}>+ Nueva categoría</Button>
                </div>
            </div>

            <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingresos</p>
                </div>
                {renderList(incomeCategories, 'income')}

                <div
                    className="px-4 py-3"
                    style={{ borderBottom: '0.5px solid var(--border)', borderTop: '0.5px solid var(--border)' }}
                >
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gastos</p>
                </div>
                {renderList(expenseCategories, 'expense')}
            </div>

            <CategoryDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                category={selectedCategory}
                onSubmit={handleSubmit}
            />

            <DeleteCategoryDialog
                category={categoryToDelete}
                categories={categories}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDeleteConfirm}
            />

            <Dialog open={defaultsDialogOpen} onOpenChange={setDefaultsDialogOpen}>
                <DialogContent className="max-w-2xl" style={{ maxWidth: '42rem' }}>
                    <DialogHeader>
                        <DialogTitle>Categorías predeterminadas</DialogTitle>
                    </DialogHeader>
                    {defaultsData && (
                        <TransferList
                            missing={defaultsData.missing}
                            existing={defaultsData.existing}
                            onConfirm={handleAddDefaults}
                            onClose={() => setDefaultsDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function SettingsContent() {
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState<TabKey>('cuenta')

    usePageTitle('Configuración')

    useEffect(() => {
        const tab = searchParams.get('tab') as TabKey | null
        if (tab && ['cuenta', 'preferencias', 'categorias'].includes(tab)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveTab(tab)
        }
    }, [searchParams])

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'cuenta', label: 'Cuenta' },
        { key: 'preferencias', label: 'Preferencias' },
        { key: 'categorias', label: 'Categorías' },
    ]

    return (
        <motion.div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6" {...fadeIn}>
            <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>

            {/* Tab nav */}
            <div
                className="flex gap-0"
                style={{ borderBottom: '0.5px solid var(--border)' }}
            >
                {tabs.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className="relative px-4 py-2 text-sm font-medium transition-colors"
                        style={{
                            color: activeTab === key ? 'var(--sky)' : 'var(--muted-foreground)',
                        }}
                    >
                        {label}
                        {activeTab === key && (
                            <motion.div
                                layoutId="tab-indicator"
                                className="absolute bottom-0 left-0 right-0 h-0.5"
                                style={{ background: 'var(--sky)', marginBottom: '-0.5px' }}
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} {...fadeInFast}>
                    {activeTab === 'cuenta' && <AccountSection />}
                    {activeTab === 'preferencias' && <PreferencesSection />}
                    {activeTab === 'categorias' && <CategoriesSection />}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    )
}

export default function SettingsPage() {
    return (
        <Suspense>
            <SettingsContent />
        </Suspense>
    )
}
