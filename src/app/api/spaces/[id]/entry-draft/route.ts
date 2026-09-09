import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import {
    discardSpaceEntryDraftV2,
    getActiveSpaceEntryDraftV2,
    saveSpaceEntryDraftV2,
} from '@/lib/server/space-entry-draft-service-v2'
import {
    discardSpaceEntryDraftSchema,
    saveSpaceEntryDraftSchema,
} from '@/lib/validations/space-entry-draft'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        await connectDB()
        const draft = await getActiveSpaceEntryDraftV2({
            actorUserId: session.user.id,
            spaceId: id,
        })
        return NextResponse.json({ data: draft })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo recuperar el borrador.')
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const parsed = saveSpaceEntryDraftSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Datos de borrador inválidos',
                code: 'SPACE_DRAFT_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        await connectDB()
        const draft = await saveSpaceEntryDraftV2({
            actorUserId: session.user.id,
            spaceId: id,
            ...parsed.data,
        })
        return NextResponse.json({ data: draft })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo guardar el borrador.')
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const parsed = discardSpaceEntryDraftSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({
                error: 'La identidad del borrador no es válida.',
                code: 'SPACE_DRAFT_INVALID',
                failureState: 'not_started',
                retryable: false,
            }, { status: 400 })
        }
        await connectDB()
        const draft = await discardSpaceEntryDraftV2({
            actorUserId: session.user.id,
            spaceId: id,
            ...parsed.data,
        })
        return NextResponse.json({ data: draft })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo descartar el borrador.')
    }
}
