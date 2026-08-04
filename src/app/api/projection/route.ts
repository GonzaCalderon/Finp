import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getProjectionForUser } from '@/lib/server/projection'

export const dynamic = 'force-dynamic'

const integerQuery = z.string().regex(/^\d+$/).transform(Number)
const projectionQuerySchema = z.object({
    mode: z.enum(['monthly', 'annual']).default('monthly'),
    year: integerQuery.pipe(z.number().int().min(2000).max(2100)).optional(),
    months: integerQuery.pipe(z.number().int().min(1).max(24)).optional(),
}).strict().superRefine((query, context) => {
    if (query.mode === 'annual' && query.months !== undefined) {
        context.addIssue({
            code: 'custom',
            path: ['months'],
            message: 'months solo aplica al modo mensual',
        })
    }
    if (query.mode === 'monthly' && query.year !== undefined) {
        context.addIssue({
            code: 'custom',
            path: ['year'],
            message: 'year solo aplica al modo anual',
        })
    }
})

const PRIVATE_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
            )
        }

        const { searchParams } = new URL(request.url)
        const parsed = projectionQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Parámetros de proyección inválidos', details: parsed.error.flatten() },
                { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
            )
        }

        await connectDB()

        const { projection, currentPeriod } = await getProjectionForUser(session.user.id, {
            mode: parsed.data.mode,
            year: parsed.data.year,
            monthCount: parsed.data.months,
        })

        return NextResponse.json(
            { projection, currentPeriod, ownerId: session.user.id },
            { headers: PRIVATE_NO_STORE_HEADERS }
        )
    } catch (error) {
        console.error('Error en proyección:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
        )
    }
}
