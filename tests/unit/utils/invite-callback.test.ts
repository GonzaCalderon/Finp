import { describe, expect, it } from 'vitest'
import {
    isSafeInviteCallbackUrl,
    normalizeSafeInviteCallbackUrl,
} from '@/lib/utils/invite-callback'

describe('invite callback safety', () => {
    it('acepta solo callbacks relativos de invitación', () => {
        expect(isSafeInviteCallbackUrl('/spaces/invite/abcdefghijklmnopqrstuvwxyz')).toBe(true)
        expect(normalizeSafeInviteCallbackUrl('/spaces/invite/abcdefghijklmnopqrstuvwxyz?x=1')).toBe(
            '/spaces/invite/abcdefghijklmnopqrstuvwxyz?x=1'
        )
    })

    it('rechaza rutas externas o que no vienen de invitación', () => {
        expect(isSafeInviteCallbackUrl('https://evil.test/spaces/invite/abcdefghijklmnopqrstuvwxyz')).toBe(false)
        expect(isSafeInviteCallbackUrl('//evil.test/spaces/invite/abcdefghijklmnopqrstuvwxyz')).toBe(false)
        expect(isSafeInviteCallbackUrl('/dashboard')).toBe(false)
        expect(isSafeInviteCallbackUrl('/spaces/invite/short')).toBe(false)
    })
})
