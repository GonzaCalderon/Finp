import { describe, expect, it } from 'vitest'
import { buildNavInsightsFromSignals } from '@/lib/server/nav-insights'

describe('buildNavInsightsFromSignals', () => {
    it('prioriza needs_review y pendientes por encima del fallback', () => {
        const insights = buildNavInsightsFromSignals({
            needsReviewCount: 1,
            pendingActionsCount: 2,
            activeDebtsCount: 3,
        })

        expect(insights[0]).toMatchObject({
            id: 'needs-review',
            type: 'pending',
            priority: 10,
            count: 1,
        })
        expect(insights.map((insight) => insight.id)).not.toContain('all-clear')
    })

    it('devuelve un fallback liviano si no hay senales', () => {
        const insights = buildNavInsightsFromSignals({})

        expect(insights).toEqual([
            expect.objectContaining({
                id: 'all-clear',
                type: 'empty',
                href: '/dashboard',
                tone: 'green',
            }),
        ])
    })

    it('no expone ids internos ni userId en los insights', () => {
        const [insight] = buildNavInsightsFromSignals({
            pendingNotificationsCount: 1,
        })

        expect(Object.keys(insight)).not.toEqual(expect.arrayContaining(['_id', 'userId', 'recipientUserId']))
    })
})
