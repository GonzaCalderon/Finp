'use client'

import { useRouter } from 'next/navigation'
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
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth'

export default function RegisterPage() {
    const router = useRouter()

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
            body: JSON.stringify(data),
        })

        const json = await res.json()

        if (!res.ok) {
            setError('root', { message: json.error || 'Error al registrarse' })
            return
        }

        router.push('/login?registered=true')
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-3xl font-bold">Finp</CardTitle>
                    <CardDescription>Creá tu cuenta</CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Nombre</Label>
                            <Input
                                id="displayName"
                                type="text"
                                placeholder="Tu nombre"
                                {...register('displayName')}
                            />
                            {errors.displayName && (
                                <p className="text-xs text-destructive">{errors.displayName.message}</p>
                            )}
                        </div>

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
                            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
                        </div>

                        {errors.root && (
                            <p className="text-sm text-destructive">{errors.root.message}</p>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
                        </Button>
                        <p className="text-center text-sm text-muted-foreground">
                            ¿Ya tenés cuenta?{' '}
                            <Link href="/login" className="text-primary hover:underline">
                                Ingresá
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}