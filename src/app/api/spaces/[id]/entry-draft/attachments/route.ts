import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { spaceApiErrorResponse } from '@/lib/server/space-api-contract'
import { prepareSpaceEntryDraftAttachment } from '@/lib/server/space-entry-draft-attachment-service'
import { mutateSpaceEntryDraftAttachmentSchema } from '@/lib/validations/space-entry-draft'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id } = await params
        const formData = await request.formData()
        const parsed = mutateSpaceEntryDraftAttachmentSchema.safeParse({
            draftId: formData.get('draftId'),
            expectedRevision: formData.get('expectedRevision'),
            idempotencyKey: formData.get('idempotencyKey'),
        })
        const file = formData.get('file')
        if (!parsed.success || !(file instanceof File)) {
            return NextResponse.json(
                { error: 'El archivo o la identidad del borrador no son válidos.', code: 'INVALID_ATTACHMENT' },
                { status: 400 }
            )
        }
        await connectDB()
        const result = await prepareSpaceEntryDraftAttachment({
            actorUserId: session.user.id,
            spaceId: id,
            file,
            ...parsed.data,
        })
        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo preparar el archivo.', 'INTERNAL_ERROR')
    }
}
