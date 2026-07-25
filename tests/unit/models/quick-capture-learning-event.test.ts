import { describe, expect, it } from 'vitest'

import { QuickCaptureLearningEvent } from '@/lib/models'

describe('QuickCaptureLearningEvent model', () => {
    it('has user-scoped idempotency and a 180-day TTL', () => {
        const indexes = QuickCaptureLearningEvent.schema.indexes()

        expect(indexes).toEqual(expect.arrayContaining([
            [
                { userId: 1, eventId: 1 },
                expect.objectContaining({ unique: true }),
            ],
            [
                { createdAt: 1 },
                expect.objectContaining({
                    expireAfterSeconds: 180 * 24 * 60 * 60,
                }),
            ],
        ]))
    })
})
