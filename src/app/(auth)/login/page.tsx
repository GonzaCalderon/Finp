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

function getDefaultRoute(): string {
    try {
        const view = localStorage.getItem('finp-default-view') as DefaultView | null
        return (view && DEFAULT_VIEW_ROUTES[view]) ? DEFAULT_VIEW_ROUTES[view] : '/dashboard'
    } catch {
        return '/dashboard'
    }
}

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [showPassword, setShowPassword] = useState(false)
    const [registeredBanner, setRegisteredBanner] = useState(false)
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
        if (searchParams.get('registered') === 'true') {
            setRegisteredBanner(true)
        }
    }, [searchParams])

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

        router.push(getDefaultRoute())
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-3xl font-bold">Finp</CardTitle>
                    <CardDescription>Ingresá a tu cuenta</CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit(onSubmit)} data-testid="login-form">
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@email.com"
                                data-testid="login-email"
                                {...register('email')}
                            />
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
                            <p className="text-sm text-destructive" data-testid="login-error">{errors.root.message}</p>
                        )}
                    </AnimatePresence>

                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="login-submit">
                            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
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
