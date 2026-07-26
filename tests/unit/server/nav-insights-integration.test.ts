import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Cobertura de `getNavInsightsForUser`: período, aislamiento y señales.
 *
 * El motor puro vive en `nav-insights.test.ts`. Acá se verifica la orquestación,
 * que es donde estaban los riesgos reales: consultar meses calendario en vez del
 * período financiero del usuario, y perder el filtro por usuario en una de las
 * doce consultas.
 *
 * Los modelos se sustituyen; las reglas de período y de compromisos se ejecutan
 * de verdad, porque son las que definen el resultado esperado.
 */

const mocks = vi.hoisted(() => ({
    User: { findById: vi.fn() },
    Category: { findById: vi.fn() },
    Transaction: { aggregate: vi.fn() },
    SpaceEntryPersonalImpact: { countDocuments: vi.fn() },
    Notification: { countDocuments: vi.fn() },
    Debt: { countDocuments: vi.fn() },
    SpaceActivityEvent: { countDocuments: vi.fn() },
    ImportBatch: { countDocuments: vi.fn() },
    CommitmentApplication: { distinct: vi.fn() },
    ScheduledCommitment: { find: vi.fn() },
}))

vi.mock('@/lib/models', () => mocks)

const { getNavInsightsForUser } = await import('@/lib/server/nav-insights')
const { getCurrentFinancialPeriod, parseFinancialPeriod, shiftFinancialPeriod } = await import(
    '@/lib/utils/period'
)

const USER_ID = '64b7f9c2e4b0a1d2c3e4f5a6'
const NOW = new Date(2026, 6, 20, 12, 0, 0)

type CommitmentRow = {
    description: string
    dayOfMonth?: number
    recurrence: string
    startDate: Date
    endDate?: Date
    reminderLeadDays?: number
    isActive: boolean
}

function commitmentChain(rows: CommitmentRow[]) {
    const lean = vi.fn().mockResolvedValue(rows)
    const select = vi.fn(() => ({ lean }))
    return { sort: vi.fn(() => ({ select })) }
}

/** Enruta las cinco agregaciones por la forma de su pipeline. */
function aggregateByShape(overrides: {
    duplicates?: number
    topCategoryByStart?: Map<number, { _id: string; amount: number }>
    cardTotalByStart?: Map<number, number>
}) {
    return vi.fn(async (pipeline: Array<Record<string, unknown>>) => {
        const match = pipeline[0].$match as { date?: { $gte?: Date } }
        const group = pipeline.find((stage) => '$group' in stage)?.$group as
            | { _id: unknown }
            | undefined
        const startMs = match.date?.$gte?.getTime() ?? 0

        if (pipeline.some((stage) => '$count' in stage)) {
            const count = overrides.duplicates ?? 0
            return count > 0 ? [{ count }] : []
        }

        if (group?._id === '$categoryId') {
            const top = overrides.topCategoryByStart?.get(startMs)
            return top ? [top] : []
        }

        if (group?._id === null) {
            const total = overrides.cardTotalByStart?.get(startMs)
            return total ? [{ total }] : []
        }

        return []
    })
}

/** Todas las consultas del servicio, con el filtro que recibió cada una. */
function everyQueryFilter() {
    return [
        ...mocks.SpaceEntryPersonalImpact.countDocuments.mock.calls,
        ...mocks.Notification.countDocuments.mock.calls,
        ...mocks.Debt.countDocuments.mock.calls,
        ...mocks.SpaceActivityEvent.countDocuments.mock.calls,
        ...mocks.ImportBatch.countDocuments.mock.calls,
        ...mocks.CommitmentApplication.distinct.mock.calls.map(([, filter]) => [filter]),
        ...mocks.ScheduledCommitment.find.mock.calls,
        ...mocks.Transaction.aggregate.mock.calls.map(([pipeline]) => [
            (pipeline as Array<Record<string, unknown>>)[0].$match,
        ]),
    ].map(([filter]) => filter as Record<string, unknown>)
}

function setMonthStartDay(monthStartDay: number) {
    mocks.User.findById.mockResolvedValue({ preferences: { monthStartDay } })
}

describe('getNavInsightsForUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(NOW)

        setMonthStartDay(1)
        mocks.SpaceEntryPersonalImpact.countDocuments.mockResolvedValue(0)
        mocks.Notification.countDocuments.mockResolvedValue(0)
        mocks.Debt.countDocuments.mockResolvedValue(0)
        mocks.SpaceActivityEvent.countDocuments.mockResolvedValue(0)
        mocks.ImportBatch.countDocuments.mockResolvedValue(0)
        mocks.CommitmentApplication.distinct.mockResolvedValue([])
        mocks.ScheduledCommitment.find.mockReturnValue(commitmentChain([]))
        mocks.Transaction.aggregate.mockImplementation(aggregateByShape({}))
        mocks.Category.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('período', () => {
        it.each([1, 15, 28])(
            'consulta el período financiero del usuario con monthStartDay %i',
            async (monthStartDay) => {
                setMonthStartDay(monthStartDay)

                await getNavInsightsForUser(USER_ID)

                const period = getCurrentFinancialPeriod(NOW, monthStartDay)
                const current = parseFinancialPeriod(period, monthStartDay)
                const previous = parseFinancialPeriod(
                    shiftFinancialPeriod(period, -1),
                    monthStartDay
                )

                const ranges = mocks.Transaction.aggregate.mock.calls
                    .map(([pipeline]) => (pipeline[0].$match as { date?: { $gte?: Date; $lt?: Date } }).date)
                    .filter((date): date is { $gte: Date; $lt: Date } => Boolean(date?.$lt))

                // El período financiero, no el mes calendario: era la discrepancia
                // con el resto de la app cuando monthStartDay != 1.
                expect(ranges).toEqual(
                    expect.arrayContaining([
                        { $gte: current.start, $lt: current.end },
                        { $gte: previous.start, $lt: previous.end },
                    ])
                )
                expect(mocks.CommitmentApplication.distinct.mock.calls[0][1]).toMatchObject({
                    period,
                })
            }
        )

        it('usa el rango semiabierto: un compromiso que arranca en `end` es del período siguiente', async () => {
            setMonthStartDay(1)

            await getNavInsightsForUser(USER_ID)

            const period = getCurrentFinancialPeriod(NOW, 1)
            const { start, end } = parseFinancialPeriod(period, 1)
            const filter = mocks.ScheduledCommitment.find.mock.calls[0][0]

            expect(filter.startDate).toEqual({ $lt: end })
            expect(filter.$or).toEqual([
                { endDate: { $exists: false } },
                { endDate: { $gte: start } },
            ])
        })

        it('cae en monthStartDay 1 si el usuario no tiene preferencia', async () => {
            mocks.User.findById.mockResolvedValue(null)

            await getNavInsightsForUser(USER_ID)

            const { start } = parseFinancialPeriod(getCurrentFinancialPeriod(NOW, 1), 1)
            const dates = mocks.Transaction.aggregate.mock.calls
                .map(([pipeline]) => (pipeline[0].$match as { date?: { $gte?: Date } }).date?.$gte)
                .filter(Boolean)

            expect(dates).toContainEqual(start)
        })
    })

    describe('aislamiento', () => {
        it('filtra por el usuario autenticado en todas las consultas', async () => {
            await getNavInsightsForUser(USER_ID)

            const filters = everyQueryFilter()
            // 7 conteos + 1 distinct + 1 find + 5 agregaciones. Si el servicio suma
            // una consulta, este número falla y obliga a declarar su dueño acá.
            expect(filters).toHaveLength(14)

            for (const filter of filters) {
                const owner =
                    filter.userId ?? filter.recipientUserId ?? filter.visibleToUserIds
                expect(owner, `filtro sin dueño: ${JSON.stringify(filter)}`).toBeDefined()
                expect(String(owner)).toBe(USER_ID)
            }
        })

        it('no lee la actividad de espacios ya leída por el usuario', async () => {
            await getNavInsightsForUser(USER_ID)

            const [filter] = mocks.SpaceActivityEvent.countDocuments.mock.calls[0]
            expect(String(filter.visibleToUserIds)).toBe(USER_ID)
            expect(String(filter.readByUserIds.$ne)).toBe(USER_ID)
        })

        it('no expone identificadores internos en la respuesta', async () => {
            mocks.Debt.countDocuments.mockResolvedValue(2)

            const { insights } = await getNavInsightsForUser(USER_ID)

            const serialized = JSON.stringify(insights)
            expect(serialized).not.toContain(USER_ID)
            expect(serialized).not.toContain('_id')
        })
    })

    describe('señales', () => {
        it('traduce cada conteo en su insight', async () => {
            mocks.SpaceEntryPersonalImpact.countDocuments
                .mockResolvedValueOnce(1)
                .mockResolvedValueOnce(2)
            mocks.Notification.countDocuments.mockResolvedValue(3)
            mocks.Debt.countDocuments.mockResolvedValue(4)
            mocks.SpaceActivityEvent.countDocuments.mockResolvedValue(5)
            mocks.ImportBatch.countDocuments.mockResolvedValue(6)

            const { insights } = await getNavInsightsForUser(USER_ID)
            const byId = new Map(insights.map((insight) => [insight.id, insight]))

            expect(byId.get('needs-review')?.count).toBe(1)
            expect(byId.get('pending-actions')?.count).toBe(2)
            expect(byId.get('pending-notifications')?.count).toBe(3)
            expect(byId.get('active-debts')?.count).toBe(4)
            expect(byId.get('spaces-activity')?.count).toBe(5)
            expect(byId.get('draft-imports')?.count).toBe(6)
            expect(byId.has('all-clear')).toBe(false)
        })

        it('distingue notificaciones pendientes de no leídas', async () => {
            // El servicio consulta primero pendientes y después no leídas. Si se
            // invierten, un aviso sin acción se anuncia como pendiente.
            mocks.Notification.countDocuments
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(2)

            const { insights } = await getNavInsightsForUser(USER_ID)
            const ids = insights.map((insight) => insight.id)

            expect(ids).toContain('unread-notifications')
            expect(ids).not.toContain('pending-notifications')

            const [pendingFilter] = mocks.Notification.countDocuments.mock.calls[0]
            const [unreadFilter] = mocks.Notification.countDocuments.mock.calls[1]
            expect(pendingFilter.actionStatus).toBe('pending')
            expect(unreadFilter.status).toBe('unread')
        })

        it('devuelve el fallback cuando no hay ninguna señal', async () => {
            const { insights, generatedAt } = await getNavInsightsForUser(USER_ID)

            expect(insights.map((insight) => insight.id)).toEqual(['all-clear'])
            expect(new Date(generatedAt).toISOString()).toBe(generatedAt)
        })

        it('excluye los compromisos ya aplicados en el período', async () => {
            mocks.CommitmentApplication.distinct.mockResolvedValue(['commitment-1'])

            await getNavInsightsForUser(USER_ID)

            const [, filter] = mocks.CommitmentApplication.distinct.mock.calls[0]
            // Una aplicación revertida no excluye: sólo cuenta `registered`.
            expect(filter.status).toBe('registered')
            expect(mocks.ScheduledCommitment.find.mock.calls[0][0]._id).toEqual({
                $nin: ['commitment-1'],
            })
        })

        it('descarta compromisos finalizados aunque la consulta los devuelva', async () => {
            mocks.ScheduledCommitment.find.mockReturnValue(
                commitmentChain([
                    {
                        description: 'Gimnasio',
                        dayOfMonth: 5,
                        recurrence: 'monthly',
                        startDate: new Date(2026, 0, 5),
                        endDate: new Date(2026, 2, 5),
                        isActive: true,
                    },
                ])
            )

            const { insights } = await getNavInsightsForUser(USER_ID)

            expect(insights.map((insight) => insight.id)).toEqual(['all-clear'])
        })

        it('prioriza el compromiso vencido y cuenta los pendientes', async () => {
            mocks.ScheduledCommitment.find.mockReturnValue(
                commitmentChain([
                    {
                        description: 'Alquiler',
                        dayOfMonth: 5,
                        recurrence: 'monthly',
                        startDate: new Date(2026, 0, 5),
                        reminderLeadDays: 2,
                        isActive: true,
                    },
                    {
                        description: 'Internet',
                        dayOfMonth: 28,
                        recurrence: 'monthly',
                        startDate: new Date(2026, 0, 28),
                        isActive: true,
                    },
                ])
            )

            const { insights } = await getNavInsightsForUser(USER_ID)
            const commitment = insights.find((insight) => insight.id === 'next-commitment')

            expect(commitment).toMatchObject({ title: 'Compromiso vencido', priority: 15 })
            expect(commitment?.description).toContain('Alquiler')
            expect(commitment?.count).toBe(2)
        })

        it('informa la tendencia de tarjeta comparando período actual y anterior', async () => {
            const period = getCurrentFinancialPeriod(NOW, 1)
            const current = parseFinancialPeriod(period, 1)
            const previous = parseFinancialPeriod(shiftFinancialPeriod(period, -1), 1)

            mocks.Transaction.aggregate.mockImplementation(
                aggregateByShape({
                    cardTotalByStart: new Map([
                        [current.start.getTime(), 150_000],
                        [previous.start.getTime(), 100_000],
                    ]),
                })
            )

            const { insights } = await getNavInsightsForUser(USER_ID)

            expect(insights.find((insight) => insight.id === 'credit-card-trend')).toMatchObject({
                description: 'Tus gastos con TC subieron 50%.',
                tone: 'amber',
            })
        })

        it('resuelve el nombre de la categoría más fuerte del período', async () => {
            const current = parseFinancialPeriod(getCurrentFinancialPeriod(NOW, 1), 1)
            mocks.Transaction.aggregate.mockImplementation(
                aggregateByShape({
                    topCategoryByStart: new Map([
                        [current.start.getTime(), { _id: 'category-1', amount: 90_000 }],
                    ]),
                })
            )
            mocks.Category.findById.mockReturnValue({
                lean: vi.fn().mockResolvedValue({ name: 'Supermercado' }),
            })

            const { insights } = await getNavInsightsForUser(USER_ID)

            expect(insights.find((insight) => insight.id === 'top-current-category')).toMatchObject({
                description: 'Supermercado lidera tus gastos.',
            })
        })

        it('omite la categoría si ya no existe en vez de mostrar un hueco', async () => {
            const current = parseFinancialPeriod(getCurrentFinancialPeriod(NOW, 1), 1)
            mocks.Transaction.aggregate.mockImplementation(
                aggregateByShape({
                    topCategoryByStart: new Map([
                        [current.start.getTime(), { _id: 'category-borrada', amount: 90_000 }],
                    ]),
                })
            )

            const { insights } = await getNavInsightsForUser(USER_ID)

            expect(insights.map((insight) => insight.id)).toEqual(['all-clear'])
        })

        it('cuenta duplicados recientes como pendiente', async () => {
            mocks.Transaction.aggregate.mockImplementation(aggregateByShape({ duplicates: 3 }))

            const { insights } = await getNavInsightsForUser(USER_ID)

            expect(insights.find((insight) => insight.id === 'possible-duplicates')).toMatchObject({
                count: 3,
            })
        })
    })
})
