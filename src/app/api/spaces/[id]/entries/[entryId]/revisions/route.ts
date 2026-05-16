import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry } from '@/lib/models'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import type { ISpaceEntry } from '@/types'

type Params = Promise<{ id: string; entryId: string }>

export async function GET(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId } = await params

        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id })
            .select('previousVersions editCount editedAt editedByUserId')
            .lean<Pick<ISpaceEntry, '_id' | 'previousVersions' | 'editCount' | 'editedAt' | 'editedByUserId'> | null>()

        if (!entry) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        return NextResponse.json({
            revisions: entry.previousVersions ?? [],
            editCount: entry.editCount ?? 0,
            editedAt: entry.editedAt,
        })
    } catch (error) {
        console.error('Error al obtener revisiones:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
