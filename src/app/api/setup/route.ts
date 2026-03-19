import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Category } from '@/lib/models'
import { DEFAULT_CATEGORIES } from '@/lib/constants/defaultCategories'

export async function POST() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        // Verificar si ya tiene categorías
        const existing = await Category.countDocuments({ userId: session.user.id })
        if (existing > 0) {
            return NextResponse.json({
                message: `Ya tenés ${existing} categorías, no se crearon duplicados`,
            })
        }

        await Category.insertMany(
            DEFAULT_CATEGORIES.map((cat) => ({
                ...cat,
                userId: session.user.id,
                isDefault: true,
                isArchived: false,
            }))
        )

        return NextResponse.json({
            message: `${DEFAULT_CATEGORIES.length} categorías creadas correctamente`,
        })
    } catch (error) {
        console.error('Error en setup:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}