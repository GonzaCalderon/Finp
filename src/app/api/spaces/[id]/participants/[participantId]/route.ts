import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Space } from '@/lib/models'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { ServiceError } from '@/lib/server/errors'
import {
    changeSpaceParticipantRoleV2,
    respondSpaceInviteV2,
    setSpaceParticipantActiveV2,
    transferSpaceOwnershipV2,
} from '@/lib/server/space-management-service-v2'

const participantPatchV2Schema = z.discriminatedUnion('intent', [
    z.object({
        intent: z.literal('invite_response'),
        expectedParticipantRevision: z.number().int().nonnegative(),
        inviteStatus: z.enum(['accepted', 'declined']),
    }).strict(),
    z.object({
        intent: z.literal('role'),
        expectedParticipantRevision: z.number().int().nonnegative(),
        role: z.enum(['owner', 'admin', 'participant']),
    }).strict(),
    z.object({
        intent: z.literal('active'),
        expectedParticipantRevision: z.number().int().nonnegative(),
        isActive: z.boolean(),
    }).strict(),
    z.object({
        intent: z.literal('ownership'),
        expectedSpaceRevision: z.number().int().nonnegative(),
        expectedActorParticipantRevision: z.number().int().nonnegative(),
        expectedTargetParticipantRevision: z.number().int().nonnegative(),
    }).strict(),
])

type Params = Promise<{ id: string; participantId: string }>

async function assertV2Space(id: string) {
    const contract = await Space.findById(id, { contractVersion: 1 }).lean<{ contractVersion?: number } | null>()
    if (!contract) throw new ServiceError(404, 'SPACE_NOT_FOUND', 'Espacio no encontrado.')
    if (contract.contractVersion !== 2) {
        throw new ServiceError(409, 'SPACE_LEGACY_WRITE_RETIRED', 'Este Espacio requiere migración antes de modificar participantes.')
    }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id, participantId } = await params
        const body: unknown = await request.json()
        await connectDB()
        await assertV2Space(id)
        const parsed = participantPatchV2Schema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({
                error: 'La mutación del participante no es válida.',
                code: 'SPACE_PARTICIPANT_MUTATION_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        const idempotencyKey = requireIdempotencyKey(request)
        const data = parsed.data
        const execution = data.intent === 'invite_response'
            ? await respondSpaceInviteV2({ actorUserId: session.user.id, spaceId: id, participantId, idempotencyKey, ...data })
            : data.intent === 'role'
                ? await changeSpaceParticipantRoleV2({ actorUserId: session.user.id, spaceId: id, participantId, idempotencyKey, ...data })
                : data.intent === 'active'
                    ? await setSpaceParticipantActiveV2({ actorUserId: session.user.id, spaceId: id, participantId, idempotencyKey, ...data })
                    : await transferSpaceOwnershipV2({
                        actorUserId: session.user.id,
                        spaceId: id,
                        targetParticipantId: participantId,
                        idempotencyKey,
                        ...data,
                    })
        return NextResponse.json(toSpaceMutationResult<unknown>(execution))
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo actualizar el participante.')
    }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id, participantId } = await params
        const revisionHeader = request.headers.get('Expected-Revision')
        const expectedParticipantRevision = Number(revisionHeader)
        if (!revisionHeader || !Number.isInteger(expectedParticipantRevision) || expectedParticipantRevision < 0) {
            return NextResponse.json({
                error: 'La operación requiere Expected-Revision.',
                code: 'EXPECTED_REVISION_REQUIRED',
                failureState: 'not_started',
                retryable: false,
            }, { status: 400 })
        }
        await connectDB()
        await assertV2Space(id)
        const execution = await setSpaceParticipantActiveV2({
            actorUserId: session.user.id,
            spaceId: id,
            participantId,
            idempotencyKey: requireIdempotencyKey(request),
            expectedParticipantRevision,
            isActive: false,
        })
        return NextResponse.json(toSpaceMutationResult(execution))
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo desactivar el participante.')
    }
}
