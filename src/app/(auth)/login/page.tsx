'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'

export default function LoginPage() {
    const router = useRouter()

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginFormData) => {
        const result = await signIn('credentials', {
            email: data.email,
            password: data.password,
            redirect: false,
        })

        if (result?.error) {
            setError('root', { message: 'Email o contraseña incorrectos' })
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

                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@email.com"
                                {...register('email')}
                            />
                            {errors.email && (
                                <p className="text-xs text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                {...register('password')}
                            />
                            {errors.password && (
                                <p className="text-xs text-destructive">{errors.password.message}</p>
                            )}
                        </div>

                        {errors.root && (
                            <p className="text-sm text-destructive">{errors.root.message}</p>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
                        </Button>
                        <p className="text-center text-sm text-muted-foreground">
                            ¿No tenés cuenta?{' '}
                            <Link href="/register" className="text-primary hover:underline">
                                Registrate
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}