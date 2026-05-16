import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { applyCommitmentForUser } from '@/lib/server/commitments'
import { isServiceError } from '@/lib/server/errors'

export async function POST(
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

        const { transaction, application } = await applyCommitmentForUser(session.user.id, id, body)

        return NextResponse.json({ transaction, application }, { status: 201 })
    } catch (error) {
        if (isServiceError(error)) {
            return NextResponse.json(
                { error: error.message, code: error.code, details: error.details },
                { status: error.status }
            )
        }

        console.error('Error al aplicar compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
