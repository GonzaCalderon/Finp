import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Category } from '@/lib/models'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const categories = await Category.find({
            userId: session.user.id,
            isArchived: false,
        }).sort({ sortOrder: 1, name: 1 })

        return NextResponse.json({ categories })
    } catch (error) {
        console.error('Error al obtener categorías:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { name, type, icon, color } = body

        if (!name || !type) {
            return NextResponse.json(
                { error: 'Nombre y tipo son requeridos' },
                { status: 400 }
            )
        }

        await connectDB()

        const lastCategory = await Category.findOne({
            userId: session.user.id,
            type,
        }).sort({ sortOrder: -1 })

        const sortOrder = lastCategory ? lastCategory.sortOrder + 1 : 0

        const category = await Category.create({
            userId: session.user.id,
            name,
            type,
            icon,
            color,
            isDefault: false,
            isArchived: false,
            sortOrder,
        })

        return NextResponse.json({ category }, { status: 201 })
    } catch (error) {
        console.error('Error al crear categoría:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}