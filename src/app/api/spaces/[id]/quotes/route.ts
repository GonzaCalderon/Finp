import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space, SpaceParticipant } from '@/lib/models'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import {
    getSpaceReferenceQuotes,
    resolveSpaceReferenceQuote,
} from '@/lib/server/space-quote-service'
import { extractId } from '@/lib/utils/spaces'
import type { ISpace, ISpaceParticipant } from '@/types'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        await connectDB()
        const [space, participant] = await Promise.all([
            Space.findById(id).lean<ISpace | null>(),
            SpaceParticipant.findOne({ spaceId: id, userId: session.user.id })
                .lean<ISpaceParticipant | null>(),
        ])
        if (!space || !participant || extractId(participant.userId) !== session.user.id) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }
        const requestedPairs = new URL(request.url).searchParams.get('pairs')
            ?.split(',')
            .map((pair) => pair.split(':').map((currency) => currency.trim().toUpperCase()))
            .filter((pair): pair is [string, string] => pair.length === 2) ?? []
        if (requestedPairs.length > 20 || requestedPairs.some(([source, target]) =>
            source === target || !space.currencies.includes(source) || !space.currencies.includes(target)
        )) {
            return NextResponse.json({ error: 'Los pares solicitados no son válidos.' }, { status: 400 })
        }
        const data = requestedPairs.length
            ? {
                reportingCurrency: space.reportingCurrency,
                fetchedAt: new Date().toISOString(),
                quotes: (await Promise.all(requestedPairs.map(([sourceCurrency, targetCurrency]) =>
                    resolveSpaceReferenceQuote({ sourceCurrency, targetCurrency })
                ))).flatMap((quote) => quote ? [quote] : []),
            }
            : await getSpaceReferenceQuotes({
                currencies: space.currencies,
                reportingCurrency: space.reportingCurrency,
            })
        return NextResponse.json({ data }, {
            headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=840' },
        })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No pudimos actualizar las cotizaciones de referencia.')
    }
}
