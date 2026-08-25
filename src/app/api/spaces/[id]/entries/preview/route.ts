import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import { previewSpaceEntryV2 } from '@/lib/server/space-financial-preview-v2'

const allocationSchema = z.object({
    participantId: z.string().min(1),
    percentage: z.number().finite().nonnegative().optional(),
    amount: z.number().finite().nonnegative().optional(),
}).strict()

const previewSchema = z.object({
    amount: z.number().finite().positive(),
    currency: z.string().min(1).max(12),
    exchangeRate: z.number().finite().positive().optional(),
    paidByParticipantId: z.string().min(1),
    sharedWithParticipantIds: z.array(z.string().min(1)).min(1).max(100),
    splitMode: z.enum(['none', 'equal', 'percentage', 'fixed']),
    splitAllocations: z.array(allocationSchema).max(100).optional(),
    linkedTransactionId: z.string().optional(),
}).strict()

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const parsed = previewSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Los datos del preview no son válidos.',
                code: 'SPACE_PREVIEW_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        await connectDB()
        const preview = await previewSpaceEntryV2({
            actorUserId: session.user.id,
            spaceId: id,
            ...parsed.data,
        })
        return NextResponse.json({ data: preview })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo calcular la revisión financiera.')
    }
}
