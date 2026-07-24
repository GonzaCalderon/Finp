import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getQuickCaptureLearningContext } from '@/lib/server/quick-capture-learning'
import { normalizeQuickCaptureTerm } from '@/lib/utils/quick-capture'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        await connectDB()
        const learning = await getQuickCaptureLearningContext(session.user.id, {
            includeForgotten: true,
            includeWhenDisabled: true,
            limit: 200,
        })
        const { searchParams } = new URL(request.url)
        const query = normalizeQuickCaptureTerm(searchParams.get('query') ?? '')
        const status = searchParams.get('status')
        const patterns = learning.patterns.filter((pattern) => {
            if (
                (status === 'active' || status === 'forgotten') &&
                pattern.status !== status
            ) {
                return false
            }
            if (!query) return true
            return normalizeQuickCaptureTerm([
                pattern.triggerLabel,
                pattern.targetLabel,
            ].join(' ')).includes(query)
        })
        return NextResponse.json(
            {
                patterns,
                profile: learning.profile,
                metrics: learning.metrics,
            },
            { headers: { 'Cache-Control': 'private, no-store' } }
        )
    } catch (error) {
        console.error('Error al listar patrones de captura:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
