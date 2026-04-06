'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import { staggerContainer, staggerItem, fadeIn } from '@/lib/utils/animations'
import type { DefaultView } from '@/hooks/usePreferences'

const DEFAULT_VIEW_ROUTES: Record<DefaultView, string> = {
    dashboard: '/dashboard',
    transactions: '/transactions',
    accounts: '/accounts',
    projection: '/projection',
}

async function getDefaultRoute(): Promise<string> {
    try {
        const res = await fetch('/api/preferences')
        if (res.ok) {
            const data = await res.json() as { preferences?: { defaultView?: DefaultView } }
            const view = data.preferences?.defaultView
            if (view && DEFAULT_VIEW_ROUTES[view]) return DEFAULT_VIEW_ROUTES[view]
        }
    } catch {
        // fall through to localStorage
    }
    try {
        const view = localStorage.getItem('finp-default-view') as DefaultView | null
        if (view && DEFAULT_VIEW_ROUTES[view]) return DEFAULT_VIEW_ROUTES[view]
    } catch {
        // ignore
    }
    return '/dashboard'
}

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [showPassword, setShowPassword] = useState(false)
    const registeredBanner = searchParams.get('registered') === 'true'
    const sessionExpiredBanner = searchParams.get('reason') === 'session-expired'
    const emailRef = useRef<HTMLInputElement | null>(null)

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    })

    // Register email ref for autofocus
    const { ref: emailFormRef, ...emailRest } = register('email')

    useEffect(() => {
        emailRef.current?.focus()
    }, [])

    const onSubmit = async (data: LoginFormData) => {
        const result = await signIn('credentials', {
            email: data.email,
            password: data.password,
            redirect: false,
        })

        if (result?.error) {
            setError('root', {
                message: 'Email o contraseña incorrectos. Verificá tus datos e intentá de nuevo.',
            })
            return
        }

        router.push(await getDefaultRoute())
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
                    Bienvenido de vuelta
                </h1>
                <p className="text-sm text-muted-foreground">
                    Ingresá a tu cuenta para continuar
                </p>
            </motion.div>

            {/* Success banner */}
            <AnimatePresence>
                {registeredBanner && (
                    <motion.div
                        key="success-banner"
                        initial={fadeIn.initial}
                        animate={fadeIn.animate}
                        exit={fadeIn.exit}
                        transition={fadeIn.transition}
                        className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/50 dark:bg-emerald-950/30"
                    >
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            ¡Cuenta creada! Ya podés iniciar sesión.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {sessionExpiredBanner && (
                    <motion.div
                        key="session-expired-banner"
                        initial={fadeIn.initial}
                        animate={fadeIn.animate}
                        exit={fadeIn.exit}
                        transition={fadeIn.transition}
                        className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30"
                    >
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            Tu sesión venció. Volvé a ingresar para seguir usando Finp.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate data-testid="login-form">
                <div className="space-y-5">
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
                            data-testid="login-email"
                            ref={(el) => {
                                emailFormRef(el)
                                emailRef.current = el
                            }}
                            {...emailRest}
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
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="h-11 text-base pr-10"
                                aria-invalid={!!errors.password}
                                data-testid="login-password"
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
                            {errors.password && (
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
                                data-testid="login-error"
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
                            data-testid="login-submit"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Ingresando...
                                </>
                            ) : (
                                'Ingresar'
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
                ¿No tenés cuenta?{' '}
                <Link
                    href="/register"
                    className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
                >
                    Registrate gratis
                </Link>
            </motion.p>
        </motion.div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    )
}
