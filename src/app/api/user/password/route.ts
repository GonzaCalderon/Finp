import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json() as {
            currentPassword?: string
            newPassword?: string
            confirmPassword?: string
        }
        const { currentPassword, newPassword, confirmPassword } = body

        if (!currentPassword || !newPassword || !confirmPassword) {
            return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' }, { status: 400 })
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json({ error: 'Las contraseñas nuevas no coinciden' }, { status: 400 })
        }

        await connectDB()

        const user = await User.findOne({ email: session.user.email.toLowerCase() })
        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
        }

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!isValid) {
            return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })
        }

        const newHash = await bcrypt.hash(newPassword, 10)
        user.passwordHash = newHash
        await user.save()

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al cambiar contraseña:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
