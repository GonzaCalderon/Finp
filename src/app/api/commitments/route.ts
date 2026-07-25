import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ScheduledCommitment, CommitmentApplication, User } from '@/lib/models'
import { getCurrentFinancialPeriod } from '@/lib/utils/period'
import { normalizeRuleText } from '@/lib/utils/rules'
import { normalizeCommitmentAliases } from '@/lib/server/commitments'
import { resolveCommitmentAmountForPeriod } from '@/lib/server/commitment-amounts'
import { COMMITMENT_APPLICATION_STATUSES } from '@/lib/constants'
import { commitmentApiSchema } from '@/lib/validations'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        // El período debe coincidir con el que valida el apply: si el usuario
        // configuró monthStartDay, el mes calendario no es el período financiero.
        const userDoc = await User.findById(session.user.id, { 'preferences.monthStartDay': 1 })
        const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
        const currentPeriod = getCurrentFinancialPeriod(new Date(), monthStartDay)

        const commitments = await ScheduledCommitment.find({
            userId: session.user.id,
            isActive: true,
        })
            .populate('categoryId', 'name color')
            .populate('accountId', 'name type')
            .sort({ createdAt: -1 })

        // Sólo una aplicación registrada cuenta como aplicada: una revertida dejó
        // el período reabierto y el compromiso vuelve a estar pendiente.
        const applications = await CommitmentApplication.find({
            userId: session.user.id,
            period: currentPeriod,
            status: COMMITMENT_APPLICATION_STATUSES.REGISTERED,
        })

        const applicationByCommitment = new Map(
            applications.map((application) => [application.commitmentId.toString(), application])
        )

        // Historial de importes por compromiso, para estimar los variables.
        const registeredHistory = await CommitmentApplication.find({
            userId: session.user.id,
            status: COMMITMENT_APPLICATION_STATUSES.REGISTERED,
        })
            .sort({ period: -1 })
            .select({ commitmentId: 1, 'snapshot.amount': 1 })
            .lean<Array<{ commitmentId: { toString(): string }; snapshot?: { amount?: number } }>>()

        const amountsByCommitment = new Map<string, number[]>()
        for (const row of registeredHistory) {
            const amount = row.snapshot?.amount
            if (typeof amount !== 'number') continue
            const key = row.commitmentId.toString()
            const list = amountsByCommitment.get(key) ?? []
            if (list.length < 6) list.push(amount)
            amountsByCommitment.set(key, list)
        }

        const commitmentsWithStatus = commitments.map((c) => {
            const id = c._id.toString()
            const application = applicationByCommitment.get(id)

            // El monto vigente lo resuelve un único servicio, para que la UI, el
            // apply y la proyección no puedan discrepar.
            const resolved = resolveCommitmentAmountForPeriod(c, currentPeriod, {
                monthStartDay,
                registeredApplication: application ?? null,
                recentAmounts: amountsByCommitment.get(id) ?? [],
            })

            return {
                ...c.toObject(),
                appliedThisMonth: Boolean(application),
                resolvedAmount: resolved.amount,
                amountSource: resolved.source,
                amountCertainty: resolved.certainty,
            }
        })

        // Se devuelve el período para que la UI aplique exactamente el mismo que
        // se usó para calcular appliedThisMonth y que el apply volverá a validar.
        return NextResponse.json({ commitments: commitmentsWithStatus, currentPeriod })
    } catch (error) {
        console.error('Error al obtener compromisos:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const parsed = commitmentApiSchema.safeParse(await request.json())
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
        const amountPolicy = data.amountPolicy ?? 'fixed'

        await connectDB()

        const commitment = await ScheduledCommitment.create({
            userId: session.user.id,
            description: data.description,
            amount: data.amount,
            currency: data.currency,
            categoryId: data.categoryId || undefined,
            accountId: data.accountId || undefined,
            recurrence: data.recurrence,
            dayOfMonth: data.dayOfMonth || undefined,
            applyMode: data.applyMode ?? 'manual',
            startDate: data.startDate,
            endDate: data.endDate ?? undefined,
            isActive: true,
            amountPolicy,
            estimationMode: data.estimationMode ?? 'template',
            // Tramo inicial de la agenda, para que el monto tenga una fecha
            // efectiva desde el principio y un aumento posterior no reescriba historia.
            amountSchedule:
                amountPolicy === 'fixed' && data.amount > 0
                    ? [
                          {
                              effectiveFrom: data.startDate,
                              amount: data.amount,
                              source: 'initial',
                              createdAt: new Date(),
                          },
                      ]
                    : [],
            normalizedDescription: normalizeRuleText(data.description),
            aliases: normalizeCommitmentAliases(data.aliases),
            createdFrom: data.createdFrom ?? 'web',
        })

        return NextResponse.json({ commitment }, { status: 201 })
    } catch (error) {
        console.error('Error al crear compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}