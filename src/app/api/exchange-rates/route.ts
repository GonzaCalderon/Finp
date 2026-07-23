import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import {
    parseDolarApiQuotes,
    type ExchangeRatesResponse,
} from '@/lib/utils/exchange-rates'

const DOLAR_API_URL = 'https://dolarapi.com/v1/dolares'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const response = await fetch(DOLAR_API_URL, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 15 * 60 },
            signal: AbortSignal.timeout(5_000),
        })

        if (!response.ok) {
            throw new Error(`DolarAPI respondio ${response.status}`)
        }

        const quotes = parseDolarApiQuotes(await response.json())
        if (quotes.length === 0) {
            throw new Error('DolarAPI no devolvio cotizaciones validas')
        }

        const payload: ExchangeRatesResponse = {
            quotes,
            source: 'dolarapi.com',
            fetchedAt: new Date().toISOString(),
        }

        return NextResponse.json(payload, {
            headers: { 'Cache-Control': 'private, max-age=300' },
        })
    } catch (error) {
        console.error('Error al consultar cotizaciones:', error)
        return NextResponse.json(
            { error: 'No pudimos actualizar la cotizacion. Podes ingresarla manualmente.' },
            { status: 502 }
        )
    }
}
