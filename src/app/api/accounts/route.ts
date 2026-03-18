import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account } from '@/lib/models'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const accounts = await Account.find({
            userId: session.user.id,
            isActive: true,
        }).sort({ createdAt: -1 })

        return NextResponse.json({ accounts })
    } catch (error) {
        console.error('Error al obtener cuentas:', error)
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
        const { name, type, currency, institution, description, initialBalance, creditCardConfig, debtConfig, includeInNetWorth } = body

        if (!name || !type || !currency) {
            return NextResponse.json(
                { error: 'Nombre, tipo y moneda son requeridos' },
                { status: 400 }
            )
        }

        await connectDB()

        const account = await Account.create({
            userId: session.user.id,
            name,
            type,
            currency,
            institution,
            description,
            initialBalance: initialBalance ?? 0,
            includeInNetWorth: includeInNetWorth ?? true,
            creditCardConfig: type === 'credit_card' ? creditCardConfig : undefined,
            debtConfig: type === 'debt' ? debtConfig : undefined,
            isActive: true,
        })

        return NextResponse.json({ account }, { status: 201 })
    } catch (error) {
        console.error('Error al crear cuenta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}