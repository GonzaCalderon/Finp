import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Category } from '@/lib/models'
import { DEFAULT_CATEGORIES } from '@/lib/constants/defaultCategories'

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { names } = body as { names: string[] }

        if (!names?.length) {
            return NextResponse.json({ error: 'No se especificaron categorías' }, { status: 400 })
        }

        await connectDB()

        const existingCategories = await Category.find({
            userId: session.user.id,
            isArchived: false,
        })
        const existingNames = new Set(existingCategories.map((c) => c.name))

        const toCreate = DEFAULT_CATEGORIES.filter(
            (c) => names.includes(c.name) && !existingNames.has(c.name)
        )

        if (toCreate.length === 0) {
            return NextResponse.json({ created: 0 })
        }

        await Category.insertMany(
            toCreate.map((c) => ({
                userId: session.user.id,
                name: c.name,
                type: c.type,
                color: c.color,
                sortOrder: 'sortOrder' in c ? c.sortOrder : 99,
                isDefault: true,
                isArchived: false,
            }))
        )

        return NextResponse.json({ created: toCreate.length })
    } catch (error) {
        console.error('Error al agregar categorías predeterminadas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const existingCategories = await Category.find({
            userId: session.user.id,
            isArchived: false,
        })
        const existingNames = new Set(existingCategories.map((c) => c.name))

        const missing = DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name))
        const existing = DEFAULT_CATEGORIES.filter((c) => existingNames.has(c.name))

        return NextResponse.json({ missing, existing })
    } catch (error) {
        console.error('Error al obtener categorías predeterminadas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}