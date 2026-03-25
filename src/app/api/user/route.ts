import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const user = await User.findOne(
            { email: session.user.email.toLowerCase() },
            { passwordHash: 0 }
        )

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ user })
    } catch (error) {
        console.error('Error al obtener usuario:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json() as { displayName?: string }
        const { displayName } = body

        if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
        }

        if (displayName.trim().length > 60) {
            return NextResponse.json({ error: 'El nombre no puede tener más de 60 caracteres' }, { status: 400 })
        }

        await connectDB()

        const user = await User.findOneAndUpdate(
            { email: session.user.email.toLowerCase() },
            { displayName: displayName.trim() },
            { new: true, select: '-passwordHash' }
        )

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ user })
    } catch (error) {
        console.error('Error al actualizar usuario:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
