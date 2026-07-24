import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { resetQuickCaptureLearning } from '@/lib/server/quick-capture-learning'

export async function DELETE() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        await connectDB()
        const profile = await resetQuickCaptureLearning(session.user.id)
        return NextResponse.json({ profile })
    } catch (error) {
        console.error('Error al reiniciar aprendizaje de captura:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
