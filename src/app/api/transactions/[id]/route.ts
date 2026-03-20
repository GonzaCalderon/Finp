import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction } from '@/lib/models'

export async function GET(
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

        const transaction = await Transaction.findOne({
            _id: id,
            userId: session.user.id,
        })
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency')
            .populate('destinationAccountId', 'name type currency')

        if (!transaction) {
            return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ transaction })
    } catch (error) {
        console.error('Error al obtener transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

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

        // Limpiar campos ObjectId vacíos
        const cleanBody = Object.fromEntries(
            Object.entries(body).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
        )

        await connectDB()

        const transaction = await Transaction.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: cleanBody },
            { new: true }
        )

        if (!transaction) {
            return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ transaction })
    } catch (error) {
        console.error('Error al actualizar transacción:', error)
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

        const transaction = await Transaction.findOneAndDelete({
            _id: id,
            userId: session.user.id,
        })

        if (!transaction) {
            return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ message: 'Transacción eliminada correctamente' })
    } catch (error) {
        console.error('Error al eliminar transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}