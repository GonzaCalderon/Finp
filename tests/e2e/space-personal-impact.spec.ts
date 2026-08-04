import { expect, test, type Page } from '@playwright/test'
import { gotoTransactions, loginAsTestUser } from './helpers/auth'
import {
    getSpaceImpactFixture,
    SPACE_IMPACT_ACCOUNT_NAME,
} from './helpers/space-impact'

async function getCashBalance(page: Page) {
    const response = await page.request.get('/api/accounts')
    expect(response.ok()).toBe(true)
    const body = await response.json() as {
        accounts: Array<{
            name: string
            balancesByCurrency?: { ARS?: number }
        }>
    }
    const account = body.accounts.find((item) => item.name === SPACE_IMPACT_ACCOUNT_NAME)
    expect(account).toBeTruthy()
    return account?.balancesByCurrency?.ARS ?? 0
}

async function removeCard(page: Page, description: string) {
    const card = page.getByTestId('transaction-item').filter({ hasText: description }).first()
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Quitar de mi Finp', exact: true }).click()

    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText(
        'El movimiento seguirá vigente en el espacio y el balance del grupo no cambia.'
    )
    await confirmation.getByRole('button', { name: 'Quitar de mi Finp', exact: true }).click()
    await expect(card).not.toBeVisible({ timeout: 10_000 })
}

test.describe('Impacto personal de Espacios', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsTestUser(page)
        await gotoTransactions(page)
    })

    test('desvincula el impacto normal, actualiza saldo y conserva el SpaceEntry', async ({ page }, testInfo) => {
        const fixture = getSpaceImpactFixture(testInfo.project.name)
        const balanceBefore = await getCashBalance(page)
        const responsePromise = page.waitForResponse((response) =>
            response.request().method() === 'DELETE' &&
            response.url().includes(`/entries/${fixture.normalEntryId}/personal-impact`) &&
            response.url().includes(`transactionId=${fixture.normalTransactionId}`)
        )

        await removeCard(page, fixture.normalDescription)
        const response = await responsePromise
        expect(response.status()).toBe(200)
        await expect(response.json()).resolves.toEqual({
            ok: true,
            deletedTransaction: true,
            orphanTransactionDeleted: false,
        })
        await expect.poll(() => getCashBalance(page)).toBe(balanceBefore + 7_000)

        const impactResponse = await page.request.get(
            `/api/spaces/${fixture.spaceId}/entries/${fixture.normalEntryId}/personal-impact`
        )
        expect(impactResponse.ok()).toBe(true)
        await expect(impactResponse.json()).resolves.toMatchObject({ impact: null })

        const entriesResponse = await page.request.get(`/api/spaces/${fixture.spaceId}/entries`)
        expect(entriesResponse.ok()).toBe(true)
        const entriesBody = await entriesResponse.json() as {
            entries: Array<{ _id: string }>
        }
        expect(entriesBody.entries.some(
            (entry) => entry._id.toString() === fixture.normalEntryId
        )).toBe(true)

        const retry = await page.request.delete(
            `/api/spaces/${fixture.spaceId}/entries/${fixture.normalEntryId}/personal-impact?transactionId=${fixture.normalTransactionId}`
        )
        expect(retry.status()).toBe(200)
        await expect(retry.json()).resolves.toEqual({
            ok: true,
            deletedTransaction: false,
            orphanTransactionDeleted: false,
        })
    })

    test('elimina individualmente una transaccion huerfana y revierte su saldo', async ({ page }, testInfo) => {
        const fixture = getSpaceImpactFixture(testInfo.project.name)
        const balanceBefore = await getCashBalance(page)
        const responsePromise = page.waitForResponse((response) =>
            response.request().method() === 'DELETE' &&
            response.url().includes(`/entries/${fixture.orphanEntryId}/personal-impact`) &&
            response.url().includes(`transactionId=${fixture.orphanTransactionId}`)
        )

        await removeCard(page, fixture.orphanDescription)
        const response = await responsePromise
        expect(response.status()).toBe(200)
        await expect(response.json()).resolves.toEqual({
            ok: true,
            deletedTransaction: true,
            orphanTransactionDeleted: true,
        })
        await expect.poll(() => getCashBalance(page)).toBe(balanceBefore + 9_000)

        const retry = await page.request.delete(
            `/api/spaces/${fixture.spaceId}/entries/${fixture.orphanEntryId}/personal-impact?transactionId=${fixture.orphanTransactionId}`
        )
        expect(retry.status()).toBe(200)
        await expect(retry.json()).resolves.toEqual({
            ok: true,
            deletedTransaction: false,
            orphanTransactionDeleted: false,
        })
    })
})
