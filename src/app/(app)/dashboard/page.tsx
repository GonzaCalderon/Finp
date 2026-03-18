import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'

export default async function DashboardPage() {
    const session = await auth()

    if (!session) {
        redirect('/login')
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold">Hola, {session.user.name} 👋</h1>
            <p className="text-muted-foreground">Bienvenido a Finm</p>
            <form
                action={async () => {
                    'use server'
                    await signOut({ redirectTo: '/login' })
                }}
            >
                <Button variant="outline" type="submit">
                    Cerrar sesión
                </Button>
            </form>
        </div>
    )
}