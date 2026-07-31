import { expect, test, type APIResponse, type Page } from '@playwright/test'
import { TEST_USER } from './helpers/auth'
import {
    deriveProjectionSmokeEmail,
    PROJECTION_SMOKE_NAMES,
} from './helpers/projection-smoke'

type ProjectionPayload = {
    projection: Array<{
        month: string
        items: Array<{
            description: string
            kind: 'commitment' | 'card_single' | 'card_installment'
            currency: 'ARS' | 'USD'
            amount: number
        }>
        totals: {
            commitments: { ars: number; usd: number }
            cardSingle: { ars: number; usd: number }
            cardInstallments: { ars: number; usd: number }
        }
    }>
}

async function json<T>(response: APIResponse): Promise<T> {
    expect(response.ok(), await response.text()).toBe(true)
    return response.json() as Promise<T>
}

async function loginAsProjectionUser(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email').fill(deriveProjectionSmokeEmail(TEST_USER.email))
    await page.getByTestId('login-password').fill(TEST_USER.password)
    await page.getByTestId('login-submit').click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })

    const response = await page.request.patch('/api/preferences', {
        data: {
            projectionGrouping: 'type',
            projectionMode: 'monthly',
            projectionMonths: 6,
            projectionChartCurrency: 'ARS',
        },
    })
    expect(response.ok()).toBe(true)
    await page.evaluate(() => {
        localStorage.setItem('finp-projection-grouping', 'type')
        localStorage.setItem('finp-projection-mode', 'monthly')
        localStorage.setItem('finp-projection-months', '6')
        localStorage.setItem('finp-projection-chart-currency', 'ARS')
        localStorage.setItem('finp-hide-amounts', 'false')
    })
}

async function openGroup(parent: ReturnType<Page['locator']>, name: RegExp) {
    const button = parent.getByRole('button', { name }).first()
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    const id = await button.getAttribute('aria-controls')
    expect(id).toBeTruthy()
    return parent.locator(`#${id}`)
}

test.describe('Proyeccion operativa', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsProjectionUser(page)
        await page.goto('/projection')
        await expect(page.getByRole('heading', { name: 'Proyección', exact: true })).toBeVisible()
    })

    test('consolida seis meses, separa ARS/USD y navega desde el detalle', async ({ page }) => {
        const payload = await json<ProjectionPayload>(
            await page.request.get('/api/projection?mode=monthly&months=6')
        )
        expect(payload.projection).toHaveLength(6)
        const current = payload.projection[0]

        expect(current.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                description: PROJECTION_SMOKE_NAMES.commitment,
                kind: 'commitment',
                amount: 70_000,
                currency: 'ARS',
            }),
            expect.objectContaining({
                description: PROJECTION_SMOKE_NAMES.singlePlan,
                kind: 'card_single',
                amount: 120_000,
                currency: 'ARS',
            }),
            expect.objectContaining({
                description: PROJECTION_SMOKE_NAMES.historicalSingle,
                kind: 'card_single',
                amount: 15,
                currency: 'USD',
            }),
            expect.objectContaining({
                description: PROJECTION_SMOKE_NAMES.installmentPlan,
                kind: 'card_installment',
                amount: 30,
                currency: 'USD',
            }),
        ]))
        expect(current.totals).toMatchObject({
            commitments: { ars: 70_000, usd: 0 },
            cardSingle: { ars: 120_000, usd: 15 },
            cardInstallments: { ars: 0, usd: 30 },
        })

        await expect(page.getByText('TC · un pago', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('TC · cuotas', { exact: true }).first()).toBeVisible()
        const period = page.locator('article').first()
        const singleGroup = await openGroup(period, /TC · un pago/)
        const cardGroup = await openGroup(singleGroup, new RegExp(PROJECTION_SMOKE_NAMES.creditCard))
        const categoryButton = cardGroup.locator('button[aria-expanded="false"]').first()
        await categoryButton.click()

        await expect(cardGroup.getByText(PROJECTION_SMOKE_NAMES.singlePlan, { exact: true })).toBeVisible()
        await expect(cardGroup.getByText(PROJECTION_SMOKE_NAMES.historicalSingle, { exact: true })).toBeVisible()
        const cardLink = cardGroup.getByRole('link', { name: 'Ver en Tarjetas' }).last()
        await cardLink.click()
        await expect(page).toHaveURL(/\/transactions\/credit-card\?/)
        expect(page.url()).toContain('installmentFilter=single')
        expect(page.url()).not.toMatch(/120000|70000|amount=/)
        await expect(page.getByText(PROJECTION_SMOKE_NAMES.singlePlan, { exact: true }).first()).toBeVisible()
        await expect(page.getByText(PROJECTION_SMOKE_NAMES.installmentPlan, { exact: true })).toHaveCount(0)
    })

    test('persiste agrupacion, horizonte y moneda; respeta privacidad y responsive', async ({ page }, testInfo) => {
        const [, groupingResponse] = await Promise.all([
            page.getByRole('button', { name: 'Por tarjeta' }).click(),
            page.waitForResponse((response) =>
                response.url().endsWith('/api/preferences') && response.request().method() === 'PATCH'
            ),
        ])
        expect(groupingResponse.request().postDataJSON()).toEqual({ projectionGrouping: 'card' })
        await page.getByLabel('Horizonte de proyección').click()
        await Promise.all([
            page.waitForResponse((response) =>
                response.url().endsWith('/api/preferences') && response.request().method() === 'PATCH'
            ),
            page.getByRole('option', { name: '3 meses' }).click(),
        ])
        const chartCurrency = page.getByRole('radiogroup', { name: 'Moneda del gráfico' })
        await Promise.all([
            page.waitForResponse((response) =>
                response.url().endsWith('/api/preferences') && response.request().method() === 'PATCH'
            ),
            chartCurrency.getByRole('radio', { name: /USD/ }).click(),
        ])

        expect(await page.evaluate(() => localStorage.getItem('finp-projection-grouping'))).toBe('card')
        const savedPreferences = await json<{ preferences: { projectionGrouping: string } }>(
            await page.request.get('/api/preferences')
        )
        expect(savedPreferences.preferences.projectionGrouping).toBe('card')

        await page.reload()
        const preferencesAfterReload = await json<{ preferences: { projectionGrouping: string } }>(
            await page.request.get('/api/preferences')
        )
        expect(preferencesAfterReload.preferences.projectionGrouping).toBe('card')
        expect(await page.evaluate(() => localStorage.getItem('finp-projection-grouping'))).toBe('card')
        await expect(page.getByRole('button', { name: 'Por tarjeta' })).toHaveAttribute('aria-pressed', 'true')
        await expect(page.getByLabel('Horizonte de proyección')).toContainText('3 meses')
        await expect(
            page.getByRole('radiogroup', { name: 'Moneda del gráfico' }).getByRole('radio', { name: /USD/ })
        ).toHaveAttribute('aria-checked', 'true')

        if (testInfo.project.name === 'mobile-chromium') {
            await page.getByRole('button', { name: 'Abrir mas' }).click()
            await page.getByRole('dialog', { name: 'Mas navegacion' })
                .getByRole('button', { name: 'Ocultar montos' })
                .click()
        } else {
            await page.getByRole('button', { name: 'Ocultar montos' }).click()
        }
        await expect(page.getByText('••••').first()).toBeVisible()

        await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
        await page.evaluate(() => localStorage.setItem('theme', 'dark'))
        await page.reload()
        await expect(page.locator('html')).toHaveClass(/dark/)
        const hasHorizontalOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth
        )
        expect(hasHorizontalOverflow).toBe(false)
    })
})
