import { describe, expect, it } from 'vitest'

import {
    resolveQuickCapturePatternEligibility,
    sanitizeQuickCaptureLearningEvent,
    sanitizeQuickCaptureLearningTerms,
    scoreQuickCaptureLearningPattern,
} from '@/lib/utils/quick-capture-learning'

describe('quick capture learning privacy and scoring', () => {
    it('keeps only bounded normalized terms and drops financial tokens', () => {
        expect(sanitizeQuickCaptureLearningTerms([
            'Café 1500 ayer MP',
            'Verdulería!!!',
        ])).toEqual(['cafe', 'verduleria'])
    })

    it('does not preserve raw capture text, amount or date in an event', () => {
        const event = sanitizeQuickCaptureLearningEvent({
            eventId: 'event-1',
            sessionId: 'session-1',
            type: 'suggestion_accepted',
            inputTerms: ['Café 1500 ayer'],
            merchantTerm: 'Café Martínez',
            targetValue: 'Delivery y restaurantes',
            durationMs: 1_000.4,
        })

        expect(event.inputTerms).toEqual(['cafe'])
        expect(event.merchantTerm).toBe('cafe martinez')
        expect(event.targetValue).toBe('delivery restaurantes')
        expect(event.durationMs).toBe(1000)
        expect(event).not.toHaveProperty('text')
        expect(event).not.toHaveProperty('amount')
        expect(event).not.toHaveProperty('date')
    })

    it('makes consistent evidence visible at three confirmations', () => {
        const scored = scoreQuickCaptureLearningPattern({
            occurrences: 3,
            total: 3,
            daysSinceLastSeen: 0,
            acceptedCount: 0,
            dismissedCount: 0,
            revertedCount: 0,
            correctedCount: 0,
        })

        expect(resolveQuickCapturePatternEligibility({
            occurrences: 3,
            consistency: scored.consistency,
            confidence: scored.confidence,
            lead: 3,
            recentNegativeCount: 0,
        })).toEqual({ visible: true, autoApply: false })
    })

    it('auto-applies only high evidence without recent negative feedback', () => {
        const scored = scoreQuickCaptureLearningPattern({
            occurrences: 5,
            total: 5,
            daysSinceLastSeen: 0,
            acceptedCount: 1,
            dismissedCount: 0,
            revertedCount: 0,
            correctedCount: 0,
        })

        expect(resolveQuickCapturePatternEligibility({
            occurrences: 5,
            consistency: scored.consistency,
            confidence: scored.confidence,
            lead: 5,
            recentNegativeCount: 0,
        }).autoApply).toBe(true)
        expect(resolveQuickCapturePatternEligibility({
            occurrences: 5,
            consistency: scored.consistency,
            confidence: scored.confidence,
            lead: 5,
            recentNegativeCount: 1,
        }).autoApply).toBe(true)
        expect(resolveQuickCapturePatternEligibility({
            occurrences: 5,
            consistency: scored.consistency,
            confidence: scored.confidence,
            lead: 5,
            recentNegativeCount: 2,
        }).autoApply).toBe(false)
    })

    it('penalizes reversions more than acceptances reward', () => {
        const accepted = scoreQuickCaptureLearningPattern({
            occurrences: 5,
            total: 5,
            daysSinceLastSeen: 0,
            acceptedCount: 1,
            dismissedCount: 0,
            revertedCount: 0,
            correctedCount: 0,
        })
        const reverted = scoreQuickCaptureLearningPattern({
            occurrences: 5,
            total: 5,
            daysSinceLastSeen: 0,
            acceptedCount: 1,
            dismissedCount: 0,
            revertedCount: 1,
            correctedCount: 0,
        })

        expect(reverted.confidence).toBeLessThan(accepted.confidence)
    })
})
