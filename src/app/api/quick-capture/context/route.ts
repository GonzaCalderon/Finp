import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { QuickCaptureAlias } from '@/lib/models'
import {
    buildQuickCaptureFrequents,
    getQuickCaptureHistoryRows,
    serializeQuickCaptureAliases,
} from '@/lib/server/quick-capture'
import { getQuickCaptureLearningContext } from '@/lib/server/quick-capture-learning'
import type { QuickCaptureContextResponse } from '@/types'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()
        const historyRows = getQuickCaptureHistoryRows(session.user.id)
        const [aliasDocuments, frequents, learning] = await Promise.all([
            QuickCaptureAlias.find({ userId: session.user.id })
                .sort({ lastUsedAt: -1, updatedAt: -1 })
                .lean(),
            historyRows.then(buildQuickCaptureFrequents),
            getQuickCaptureLearningContext(session.user.id, {
                historyRows,
            }).catch((error) => {
                console.error(
                    'No se pudo cargar el aprendizaje personalizado:',
                    error
                )
                return undefined
            }),
        ])
        const aliases = await serializeQuickCaptureAliases(
            session.user.id,
            aliasDocuments
        )
        const response: QuickCaptureContextResponse = {
            aliases,
            frequents,
            learning,
        }

        return NextResponse.json(response, {
            headers: { 'Cache-Control': 'private, no-store' },
        })
    } catch (error) {
        console.error('Error al cargar contexto de captura rapida:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
