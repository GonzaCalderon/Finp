'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth'
import { staggerContainer, staggerItem } from '@/lib/utils/animations'

export default function RegisterPage() {
    const router = useRouter()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    })

    const onSubmit = async (data: RegisterFormData) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: data.email,
                password: data.password,
                displayName: data.displayName,
            }),
        })

        const json = (await res.json()) as { error?: string }

        if (!res.ok) {
            if (res.status === 409) {
                setError('email', {
                    message: 'Ya existe una cuenta con este email',
                })
            } else {
                setError('root', {
                    message: json.error ?? 'Ocurrió un error al crear la cuenta. Intentá de nuevo.',
                })
            }
            return
        }

        router.push('/login?registered=true')
    }

    return (
        <motion.div
            className="w-full space-y-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
        >
            {/* Header */}
            <motion.div variants={staggerItem} className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Creá tu cuenta
                </h1>
                <p className="text-sm text-muted-foreground">
                    Es gratis y solo lleva un minuto
                </p>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="space-y-5">
                    {/* Full name */}
                    <motion.div variants={staggerItem} className="space-y-1.5">
                        <Label htmlFor="displayName" className="text-sm font-medium">
                            Nombre completo
                        </Label>
                        <Input
                            id="displayName"
                            type="text"
                            autoComplete="name"
                            autoFocus
                            placeholder="Ana García"
                            className="h-11 text-base"
                            aria-invalid={!!errors.displayName}
                            {...register('displayName')}
                        />
                        <AnimatePresence>
                            {errors.displayName && (
                                <motion.p
                                    key="name-error"
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-xs text-destructive"
                                >
                                    {errors.displayName.message}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Email */}
                    <motion.div variants={staggerItem} className="space-y-1.5">
                        <Label htmlFor="email" className="text-sm font-medium">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="tu@email.com"
                            className="h-11 text-base"
                            aria-invalid={!!errors.email}
                            {...register('email')}
                        />
                        <AnimatePresence>
                            {errors.email && (
                                <motion.p
                                    key="email-error"
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-xs text-destructive"
                                >
                                    {errors.email.message}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Password */}
                    <motion.div variants={staggerItem} className="space-y-1.5">
                        <Label htmlFor="password" className="text-sm font-medium">
                            Contraseña
                        </Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="h-11 text-base pr-10"
                                aria-invalid={!!errors.password}
                                {...register('password')}
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                            >
                                {showPassword ? (
                                    <EyeOff className="size-4" />
                                ) : (
                                    <Eye className="size-4" />
                                )}
                            </button>
                        </div>
                        <AnimatePresence>
                            {errors.password ? (
                                <motion.p
                                    key="password-error"
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-xs text-destructive"
                                >
                                    {errors.password.message}
                                </motion.p>
                            ) : (
                                <motion.p
                                    key="password-hint"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-xs text-muted-foreground"
                                >
                                    Mínimo 8 caracteres, con letras y números
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Confirm password */}
                    <motion.div variants={staggerItem} className="space-y-1.5">
                        <Label htmlFor="confirmPassword" className="text-sm font-medium">
                            Confirmar contraseña
                        </Label>
                        <div className="relative">
                            <Input
                                id="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="h-11 text-base pr-10"
                                aria-invalid={!!errors.confirmPassword}
                                {...register('confirmPassword')}
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                onClick={() => setShowConfirmPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                            >
                                {showConfirmPassword ? (
                                    <EyeOff className="size-4" />
                                ) : (
                                    <Eye className="size-4" />
                                )}
                            </button>
                        </div>
                        <AnimatePresence>
                            {errors.confirmPassword && (
                                <motion.p
                                    key="confirm-error"
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-xs text-destructive"
                                >
                                    {errors.confirmPassword.message}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Root/server error */}
                    <AnimatePresence>
                        {errors.root && (
                            <motion.div
                                key="root-error"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.18 }}
                                className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
                            >
                                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                                <p className="text-sm text-destructive">
                                    {errors.root.message}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.div variants={staggerItem}>
                        <Button
                            type="submit"
                            className="w-full h-11 text-base font-medium"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Creando cuenta...
                                </>
                            ) : (
                                'Crear cuenta'
                            )}
                        </Button>
                    </motion.div>
                </div>
            </form>

            {/* Footer link */}
            <motion.p
                variants={staggerItem}
                className="text-center text-sm text-muted-foreground pb-4"
            >
                ¿Ya tenés cuenta?{' '}
                <Link
                    href="/login"
                    className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
                >
                    Ingresá
                </Link>
            </motion.p>
        </motion.div>
    )
}
