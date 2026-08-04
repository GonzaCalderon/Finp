import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
    getProjectionScenarioPreviewForUser,
    InvalidScenarioAccountError,
    InvalidScenarioCategoryError,
} from '@/lib/server/projection-scenario'
import { projectionScenarioRequestSchema } from '@/lib/validations/projection-scenario'

export const dynamic = 'force-dynamic'

const PRIVATE_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
            )
        }

        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                { error: 'El cuerpo de la solicitud no es JSON válido' },
                { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
            )
        }

        const parsed = projectionScenarioRequestSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Simulación inválida', details: parsed.error.flatten() },
                { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
            )
        }

        await connectDB()
        const preview = await getProjectionScenarioPreviewForUser(session.user.id, parsed.data)
        return NextResponse.json(preview, { headers: PRIVATE_NO_STORE_HEADERS })
    } catch (error) {
        if (error instanceof InvalidScenarioCategoryError || error instanceof InvalidScenarioAccountError) {
            return NextResponse.json(
                { error: error.message },
                { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
            )
        }
        console.error('Error al previsualizar escenario de proyección:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
        )
    }
}
