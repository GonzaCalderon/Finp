import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Category } from '@/lib/models'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()

        await connectDB()

        const category = await Category.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: body },
            { new: true }
        )

        if (!category) {
            return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ category })
    } catch (error) {
        console.error('Error al actualizar categoría:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        await connectDB()

        // Soft delete — archivamos en vez de borrar para no romper historial
        const category = await Category.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: { isArchived: true } },
            { new: true }
        )

        if (!category) {
            return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ message: 'Categoría archivada correctamente' })
    } catch (error) {
        console.error('Error al archivar categoría:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}