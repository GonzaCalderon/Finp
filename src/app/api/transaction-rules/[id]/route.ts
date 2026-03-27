import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { TransactionRule } from '@/lib/models'
import { RULE_APPLIES_TO, RULE_FIELDS, RULE_CONDITIONS } from '@/lib/constants'

const patchSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    priority: z.number().int().min(0).max(9999).optional(),
    appliesTo: z
        .enum([RULE_APPLIES_TO.EXPENSE, RULE_APPLIES_TO.INCOME, RULE_APPLIES_TO.ANY])
        .optional(),
    field: z.enum([RULE_FIELDS.DESCRIPTION, RULE_FIELDS.MERCHANT]).optional(),
    condition: z
        .enum([RULE_CONDITIONS.CONTAINS, RULE_CONDITIONS.EQUALS, RULE_CONDITIONS.STARTS_WITH])
        .optional(),
    value: z.string().min(1).max(200).optional(),
    categoryId: z.string().nullable().optional(),
    setType: z.enum(['expense', 'income']).nullable().optional(),
    normalizeMerchant: z.string().max(200).nullable().optional(),
})

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params
        const body = await request.json()
        const parsed = patchSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const rule = await TransactionRule.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: parsed.data },
            { new: true }
        ).populate('categoryId', 'name color type')

        if (!rule) {
            return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ rule })
    } catch (error) {
        console.error('Error al actualizar regla:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params

        await connectDB()

        const rule = await TransactionRule.findOneAndDelete({
            _id: id,
            userId: session.user.id,
        })

        if (!rule) {
            return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al eliminar regla:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
