import { expect, test } from '@playwright/test'

import { loginAsTestUser } from './helpers/auth'
import { SPACE_MIGRATION_E2E, SPACE_V2_E2E } from './helpers/spaces-v2'

test.describe('Espacios v2 — convivencia durante la migración', () => {
    test('mantiene operativo el Espacio migrado y protege el legacy bloqueado', async ({ page }) => {
        await loginAsTestUser(page)

        const migratedResponse = await page.request.get(`/api/spaces/${SPACE_V2_E2E.spaceId}`)
        expect(migratedResponse.ok()).toBe(true)
        const migratedBody = await migratedResponse.json() as {
            data: { migration: { state: string; readOnly: boolean }; capabilities: string[] }
        }
        expect(migratedBody.data.migration).toEqual({
            state: 'migrated',
            readOnly: false,
            reason: 'migration_verified',
        })
        expect(migratedBody.data.capabilities).toContain('create_entry')

        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)
        await expect(page.getByRole('heading', { name: SPACE_V2_E2E.name })).toBeVisible()
        await expect(page.getByText(/necesita una revisión antes de migrar/i)).toHaveCount(0)

        const blockedResponse = await page.request.get(
            `/api/spaces/${SPACE_MIGRATION_E2E.blockedSpaceId}`
        )
        expect(blockedResponse.ok()).toBe(true)
        const blockedText = await blockedResponse.text()
        const blockedBody = JSON.parse(blockedText) as {
            data: {
                migration: { state: string; readOnly: boolean; reason?: string }
                capabilities: string[]
                summary: unknown
            }
        }
        expect(blockedBody.data.migration).toEqual({
            state: 'blocked',
            readOnly: true,
            reason: 'manual_review_required',
        })
        expect(blockedBody.data.capabilities).toEqual(['view'])
        expect(blockedBody.data.summary).toBeNull()
        expect(blockedText).not.toContain(SPACE_MIGRATION_E2E.runId)
        expect(blockedText).not.toContain(SPACE_MIGRATION_E2E.sourceFingerprint)

        await page.goto(`/spaces/${SPACE_MIGRATION_E2E.blockedSpaceId}`)
        await expect(page.getByRole('heading', { name: SPACE_MIGRATION_E2E.blockedName })).toBeVisible()
        await expect(page.getByText(/necesita una revisión antes de migrar/i)).toBeVisible()
        await expect(page.getByText(/totales quedan pausados/i)).toBeVisible()

        const blockedMutation = await page.request.post(
            `/api/spaces/${SPACE_MIGRATION_E2E.blockedSpaceId}/entries`,
            { data: {} }
        )
        expect(blockedMutation.status()).toBe(409)
        const mutationText = await blockedMutation.text()
        expect(mutationText).toContain('revisión')
        expect(mutationText).not.toContain(SPACE_MIGRATION_E2E.runId)
        expect(mutationText).not.toContain(SPACE_MIGRATION_E2E.sourceFingerprint)
    })
})
