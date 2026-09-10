import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import {
    listLinkCandidatesForImpactV2,
    listLinkCandidatesForNewEntryV2,
} from '@/lib/server/space-link-candidates-v2'

const allocationSchema = z.object({
    participantId: z.string().min(1),
    percentage: z.number().finite().nonnegative().optional(),
    amount: z.number().finite().nonnegative().optional(),
}).strict()

// Subconjunto del esquema de `entries/preview`: los campos de conversión
// (exchangeRate, exchangeRateDecimal, conversionSnapshot) sólo afectan el
// monto de reporte, no el impacto personal que esta ruta evalúa, así que no
// se piden acá.
const previewModeSchema = z.object({
    mode: z.literal('preview'),
    amount: z.number().finite().positive(),
    currency: z.string().min(1).max(12),
    paidByParticipantId: z.string().min(1),
    sharedWithParticipantIds: z.array(z.string().min(1)).min(1).max(100),
    splitMode: z.enum(['none', 'equal', 'percentage', 'fixed']),
    splitAllocations: z.array(allocationSchema).max(100).optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().min(1),
}).strict()

const impactModeSchema = z.object({
    mode: z.literal('impact'),
    entryId: z.string().min(1),
    impactId: z.string().min(1),
}).strict()

const bodySchema = z.discriminatedUnion('mode', [previewModeSchema, impactModeSchema])

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const parsed = bodySchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Los datos de la búsqueda no son válidos.',
                code: 'SPACE_LINK_CANDIDATES_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        await connectDB()
        const result = parsed.data.mode === 'preview'
            ? await listLinkCandidatesForNewEntryV2({
                actorUserId: session.user.id,
                spaceId: id,
                ...parsed.data,
            })
            : await listLinkCandidatesForImpactV2({
                actorUserId: session.user.id,
                spaceId: id,
                entryId: parsed.data.entryId,
                impactId: parsed.data.impactId,
            })
        return NextResponse.json({ data: result })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudieron cargar los candidatos para vincular.')
    }
}
