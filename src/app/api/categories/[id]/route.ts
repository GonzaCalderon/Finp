import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Category, Transaction, ScheduledCommitment } from '@/lib/models'

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

        const existingCategory = await Category.findOne({ _id: id, userId: session.user.id })
        if (!existingCategory) {
            return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
        }

        if (existingCategory.isVirtual || existingCategory.hiddenFromSettings) {
            return NextResponse.json(
                { error: 'Esta categoría automática no se edita desde Configuración.' },
                { status: 400 }
            )
        }

        const category = await Category.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            {
                $set: {
                    name: body.name,
                    type: body.type,
                    icon: body.icon,
                    color: body.color,
                    sortOrder: body.sortOrder,
                    isArchived: body.isArchived,
                },
            },
            { new: true }
        )

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
        const body = await request.json()
        const { migrateTo } = body

        await connectDB()

        const category = await Category.findOne({ _id: id, userId: session.user.id })
        if (!category) {
            return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
        }

        if (category.isVirtual || category.hiddenFromSettings) {
            return NextResponse.json(
                { error: 'Esta categoría automática no se elimina desde Configuración.' },
                { status: 400 }
            )
        }

        if (migrateTo) {
            await Transaction.updateMany(
                { userId: session.user.id, categoryId: id },
                { $set: { categoryId: migrateTo } }
            )
            await ScheduledCommitment.updateMany(
                { userId: session.user.id, categoryId: id },
                { $set: { categoryId: migrateTo } }
            )
        } else {
            await Transaction.updateMany(
                { userId: session.user.id, categoryId: id },
                { $unset: { categoryId: '' } }
            )
            await ScheduledCommitment.updateMany(
                { userId: session.user.id, categoryId: id },
                { $unset: { categoryId: '' } }
            )
        }

        await Category.deleteOne({ _id: id, userId: session.user.id })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error al eliminar categoría:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
