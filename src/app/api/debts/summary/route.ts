import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Debt } from '@/lib/models'
import { buildDebtSummary } from '@/lib/utils/debt'
import { DEBT_STATUSES } from '@/lib/constants'
import type { IDebt } from '@/types/debt'

export async function GET() {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        await connectDB()

        const debts = await Debt.find({
            userId: session.user.id,
            status: { $in: [DEBT_STATUSES.ACTIVE, DEBT_STATUSES.PARTIALLY_PAID] },
        })

        const summary = buildDebtSummary(debts as IDebt[])

        return NextResponse.json({ summary })
    } catch (error) {
        console.error('Error al obtener resumen de deudas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
