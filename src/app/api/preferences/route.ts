import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import type { UserPreferences } from '@/types'

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const user = await User.findOne(
            { email: session.user.email.toLowerCase() },
            { preferences: 1 }
        )

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
        }

        const preferences: UserPreferences = {
            defaultView: user.preferences?.defaultView ?? 'dashboard',
            monthStartDay: user.preferences?.monthStartDay ?? 1,
            defaultAccountId: user.preferences?.defaultAccountId?.toString(),
        }

        return NextResponse.json({ preferences })
    } catch (error) {
        console.error('Error al obtener preferencias:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json() as Partial<UserPreferences>
        const update: Partial<Record<string, unknown>> = {}

        if (body.defaultView !== undefined) {
            const validViews = ['dashboard', 'transactions', 'accounts', 'projection']
            if (!validViews.includes(body.defaultView)) {
                return NextResponse.json({ error: 'Vista inválida' }, { status: 400 })
            }
            update['preferences.defaultView'] = body.defaultView
        }

        if (body.monthStartDay !== undefined) {
            const day = Number(body.monthStartDay)
            if (!Number.isInteger(day) || day < 1 || day > 28) {
                return NextResponse.json({ error: 'Día de inicio inválido (1-28)' }, { status: 400 })
            }
            update['preferences.monthStartDay'] = day
        }

        if ('defaultAccountId' in body) {
            // null or empty string clears the default account
            update['preferences.defaultAccountId'] =
                body.defaultAccountId ? body.defaultAccountId : null
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
        }

        await connectDB()

        const user = await User.findOneAndUpdate(
            { email: session.user.email.toLowerCase() },
            { $set: update },
            { new: true, select: 'preferences' }
        )

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
        }

        const preferences: UserPreferences = {
            defaultView: user.preferences?.defaultView ?? 'dashboard',
            monthStartDay: user.preferences?.monthStartDay ?? 1,
            defaultAccountId: user.preferences?.defaultAccountId?.toString(),
        }

        return NextResponse.json({ preferences })
    } catch (error) {
        console.error('Error al actualizar preferencias:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
