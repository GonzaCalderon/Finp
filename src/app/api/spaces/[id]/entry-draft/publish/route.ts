import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { spaceApiErrorResponse, toSpaceMutationResult } from '@/lib/server/space-api-contract'
import { publishSpaceEntryDraftV2 } from '@/lib/server/space-entry-draft-service-v2'
import { publishSpaceEntryDraftSchema } from '@/lib/validations/space-entry-draft'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const parsed = publishSpaceEntryDraftSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({
                error: 'La revisión del borrador no es válida.',
                code: 'SPACE_DRAFT_INVALID',
                failureState: 'not_started',
                retryable: false,
            }, { status: 400 })
        }
        await connectDB()
        const execution = await publishSpaceEntryDraftV2({
            actorUserId: session.user.id,
            spaceId: id,
            ...parsed.data,
        })
        return NextResponse.json(toSpaceMutationResult(execution), { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo publicar el borrador.')
    }
}
