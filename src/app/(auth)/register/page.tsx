'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
    const router = useRouter()
    const [displayName, setDisplayName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName, email, password }),
        })

        const data = await res.json()

        if (!res.ok) {
            setError(data.error || 'Error al registrarse')
            setLoading(false)
            return
        }

        router.push('/login?registered=true')
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-3xl font-bold">Finm</CardTitle>
                    <CardDescription>Creá tu cuenta</CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Nombre</Label>
                            <Input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                                placeholder="Tu nombre"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="tu@email.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                minLength={8}
                            />
                            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
                        </div>

                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
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