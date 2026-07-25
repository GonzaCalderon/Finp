import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ScheduledCommitment } from '@/lib/models'
import { normalizeRuleText } from '@/lib/utils/rules'
import { normalizeCommitmentAliases } from '@/lib/server/commitments'
import { commitmentPatchApiSchema } from '@/lib/validations'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        const parsed = commitmentPatchApiSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos del compromiso inválidos',
                    code: 'INVALID_COMMITMENT_DATA',
                    details: parsed.error.issues,
                },
                { status: 400 }
            )
        }

        const data = parsed.data

        // Sólo se escriben los campos efectivamente enviados: antes cinco campos
        // viajaban siempre y `endDate: null` dependía del orden de dos ifs.
        const updateData: Record<string, unknown> = {}

        if (data.description !== undefined) {
            updateData.description = data.description
            updateData.normalizedDescription = normalizeRuleText(data.description)
        }
        if (data.amount !== undefined) updateData.amount = data.amount
        if (data.currency !== undefined) updateData.currency = data.currency
        if (data.recurrence !== undefined) updateData.recurrence = data.recurrence
        // No se habilita un modo automático hasta contar con scheduler,
        // observabilidad y recuperación operativa.
        if (data.applyMode !== undefined) updateData.applyMode = 'manual'
        if (data.amountPolicy !== undefined) updateData.amountPolicy = data.amountPolicy
        if (data.estimationMode !== undefined) updateData.estimationMode = data.estimationMode
        if (data.aliases !== undefined) updateData.aliases = normalizeCommitmentAliases(data.aliases)
        if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null
        if (data.accountId !== undefined) updateData.accountId = data.accountId || null
        if (data.dayOfMonth !== undefined) updateData.dayOfMonth = data.dayOfMonth ?? null
        if (data.startDate !== undefined) updateData.startDate = data.startDate
        if (data.endDate !== undefined) updateData.endDate = data.endDate ?? null
        if (data.reminderLeadDays !== undefined) {
            updateData.reminderLeadDays = data.reminderLeadDays ?? null
        }
        if (data.isActive !== undefined) updateData.isActive = data.isActive

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'No hay cambios para aplicar', code: 'EMPTY_COMMITMENT_PATCH' },
                { status: 400 }
            )
        }

        await connectDB()

        const commitment = await ScheduledCommitment.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: updateData },
            { new: true }
        )

        if (!commitment) {
            return NextResponse.json({ error: 'Compromiso no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ commitment })
    } catch (error) {
        console.error('Error al actualizar compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        await connectDB()

        const commitment = await ScheduledCommitment.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: { isActive: false } },
            { new: true }
        )

        if (!commitment) {
            return NextResponse.json({ error: 'Compromiso no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ message: 'Compromiso desactivado correctamente' })
    } catch (error) {
        console.error('Error al desactivar compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
