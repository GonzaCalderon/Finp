import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { TransactionRule } from '@/lib/models'
import { RULE_APPLIES_TO, RULE_FIELDS, RULE_CONDITIONS } from '@/lib/constants'

const ruleSchema = z.object({
    name: z.string().min(1).max(100),
    isActive: z.boolean().optional().default(true),
    priority: z.number().int().min(0).max(9999).optional().default(0),
    appliesTo: z.enum([
        RULE_APPLIES_TO.EXPENSE,
        RULE_APPLIES_TO.INCOME,
        RULE_APPLIES_TO.ANY,
    ]),
    field: z.enum([RULE_FIELDS.DESCRIPTION, RULE_FIELDS.MERCHANT]),
    condition: z.enum([
        RULE_CONDITIONS.CONTAINS,
        RULE_CONDITIONS.EQUALS,
        RULE_CONDITIONS.STARTS_WITH,
    ]),
    value: z.string().min(1).max(200),
    categoryId: z.string().optional(),
    setType: z.enum(['expense', 'income']).optional(),
    normalizeMerchant: z.string().max(200).optional(),
})

export async function GET() {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        await connectDB()

        const rules = await TransactionRule.find({ userId: session.user.id })
            .sort({ priority: -1, createdAt: -1 })
            .populate('categoryId', 'name color type')

        return NextResponse.json({ rules })
    } catch (error) {
        console.error('Error al obtener reglas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const parsed = ruleSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de regla inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const rule = await TransactionRule.create({
            userId: session.user.id,
            ...parsed.data,
        })

        const populated = await TransactionRule.findById(rule._id).populate(
            'categoryId',
            'name color type'
        )

        return NextResponse.json({ rule: populated }, { status: 201 })
    } catch (error) {
        console.error('Error al crear regla:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
