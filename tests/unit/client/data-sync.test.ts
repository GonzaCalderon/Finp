import { describe, expect, it } from 'vitest'
import { COMMITMENT_INVALIDATION_TAGS } from '@/lib/client/data-sync'

describe('commitment invalidation tags', () => {
    it('refreshes every view affected by an applied commitment', () => {
        expect(COMMITMENT_INVALIDATION_TAGS).toEqual(
            expect.arrayContaining([
                'commitments',
                'dashboard',
                'projection',
                'transactions',
                'accounts',
                'account-detail',
            ])
        )
    })
})
