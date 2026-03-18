import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ScheduledCommitment, InstallmentPlan } from '@/lib/models'

const USD_TO_ARS = 1450

function convertToARS(amount: number, currency: string): number {
    return currency === 'USD' ? amount * USD_TO_ARS : amount
}

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const mode = searchParams.get('mode') ?? 'annual' // 'annual' | 'monthly'
        const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
        const monthCount = parseInt(searchParams.get('months') ?? '3')

        await connectDB()
        const userId = session.user.id

        // Generar lista de meses según modo
        const months: string[] = []
        if (mode === 'annual') {
            for (let m = 1; m <= 12; m++) {
                months.push(`${year}-${String(m).padStart(2, '0')}`)
            }
        } else {
            const now = new Date()
            for (let i = 0; i < monthCount; i++) {
                const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
                months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
            }
        }

        const commitments = await ScheduledCommitment.find({
            userId,
            isActive: true,
            recurrence: 'monthly',
        }).populate('categoryId', 'name')

        const installmentPlans = await InstallmentPlan.find({ userId })
            .populate('accountId', 'name type')

        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

        const projection = months.map((month) => {
            const [y, m] = month.split('-').map(Number)
            const monthDate = new Date(y, m - 1, 1)
            const isCurrentMonth = month === currentMonth
            const isPast = month < currentMonth

            // Compromisos del mes
            const monthCommitments = commitments.map((c) => ({
                _id: c._id.toString(),
                description: c.description,
                amount: c.amount,
                currency: c.currency,
                amountARS: convertToARS(c.amount, c.currency),
                dayOfMonth: c.dayOfMonth,
            }))

            const totalCommitmentsARS = monthCommitments.reduce((sum, c) => sum + c.amountARS, 0)

            // Cuotas agrupadas por cuenta (tarjeta)
            const installmentsByAccount: Record<string, {
                accountId: string
                accountName: string
                items: {
                    description: string
                    installmentAmount: number
                    currency: string
                    amountARS: number
                    currentInstallment: number
                    installmentCount: number
                }[]
                totalARS: number
            }> = {}

            installmentPlans.forEach((plan) => {
                const [fy, fm] = plan.firstClosingMonth.split('-').map(Number)
                const firstMonth = new Date(fy, fm - 1, 1)
                const lastMonth = new Date(fy, fm - 1 + plan.installmentCount - 1, 1)

                if (monthDate < firstMonth || monthDate > lastMonth) return

                const currentInstallment =
                    (y - fy) * 12 + (m - fm) + 1

                const account = plan.accountId as { _id: { toString: () => string }; name: string } | null
                const accountId = account?._id?.toString() ?? 'sin-cuenta'
                const accountName = account?.name ?? 'Sin tarjeta'
                const amountARS = convertToARS(plan.installmentAmount, plan.currency)

                if (!installmentsByAccount[accountId]) {
                    installmentsByAccount[accountId] = {
                        accountId,
                        accountName,
                        items: [],
                        totalARS: 0,
                    }
                }

                installmentsByAccount[accountId].items.push({
                    description: plan.description,
                    installmentAmount: plan.installmentAmount,
                    currency: plan.currency,
                    amountARS,
                    currentInstallment,
                    installmentCount: plan.installmentCount,
                })

                installmentsByAccount[accountId].totalARS += amountARS
            })

            const totalInstallmentsARS = Object.values(installmentsByAccount).reduce(
                (sum, a) => sum + a.totalARS,
                0
            )

            return {
                month,
                isCurrentMonth,
                isPast,
                commitments: monthCommitments,
                installmentsByAccount: Object.values(installmentsByAccount),
                totalCommitmentsARS,
                totalInstallmentsARS,
                totalARS: totalCommitmentsARS + totalInstallmentsARS,
            }
        })

        return NextResponse.json({
            projection,
            usdToArs: USD_TO_ARS,
        })
    } catch (error) {
        console.error('Error en proyección:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}