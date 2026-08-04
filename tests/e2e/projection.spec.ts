import { expect, test, type APIResponse, type Page } from '@playwright/test'
import { TEST_USER } from './helpers/auth'
import {
    deriveProjectionSmokeEmail,
    PROJECTION_SMOKE_IDS,
    PROJECTION_SMOKE_NAMES,
} from './helpers/projection-smoke'

type ProjectionPayload = {
    ownerId?: string
    projection: Array<{
        month: string
        items: Array<{
            description: string
            kind: 'commitment' | 'card_single' | 'card_installment' | 'hypothetical'
            currency: 'ARS' | 'USD'
            amount: number
        }>
        totals: {
            commitments: { ars: number; usd: number }
            cardSingle: { ars: number; usd: number }
            cardInstallments: { ars: number; usd: number }
            hypothetical: { ars: number; usd: number }
            total: { ars: number; usd: number }
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
    if (await button.getAttribute('aria-expanded') !== 'true') {
        await button.click()
    }
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    const id = await button.getAttribute('aria-controls')
    expect(id).toBeTruthy()
    return parent.locator(`#${id}`)
}

async function openScenarioItem(page: Page, groupName: RegExp, description: string) {
    const period = page.locator('article').first()
    let container = await openGroup(period, groupName)

    for (let depth = 0; depth < 3; depth += 1) {
        const descriptionNode = container.getByText(description, { exact: true })
        if (await descriptionNode.isVisible().catch(() => false)) {
            const row = descriptionNode.locator('xpath=ancestor::div[.//button[contains(., "Simular este gasto")]][1]')
            await row.getByRole('button', { name: 'Simular este gasto' }).click()
            return
        }
        const nextGroup = container.locator('button[aria-expanded="false"]').first()
        await expect(nextGroup).toBeVisible()
        const id = await nextGroup.getAttribute('aria-controls')
        expect(id).toBeTruthy()
        const stableGroup = container.locator(`button[aria-controls="${id}"]`)
        await nextGroup.click()
        await expect(stableGroup).toHaveAttribute('aria-expanded', 'true')
        container = container.locator(`#${id}`)
    }

    throw new Error(`No se pudo abrir el gasto proyectado ${description}`)
}

async function waitForScenarioPreview(page: Page, action: () => Promise<void>) {
    const [response] = await Promise.all([
        page.waitForResponse((candidate) =>
            candidate.url().endsWith('/api/projection/scenarios/preview') &&
            candidate.request().method() === 'POST'
        ),
        action(),
    ])
    expect(response.ok(), await response.text()).toBe(true)
    return response.json() as Promise<{
        base: ProjectionPayload & { currentPeriod: string }
        scenario: ProjectionPayload & { currentPeriod: string }
        comparison: { changeCount: number; horizon: { base: { ars: number; usd: number }; scenario: { ars: number; usd: number } } }
        warnings: Array<{ code: string }>
    }>
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

    test('simula, rebasa y descarta cambios sin escribir datos financieros', async ({ page }, testInfo) => {
        test.setTimeout(90_000)
        const baseBefore = await json<ProjectionPayload>(
            await page.request.get('/api/projection?mode=monthly&months=6')
        )
        const realCommitmentBefore = baseBefore.projection[0].items.find(
            (item) => item.description === PROJECTION_SMOKE_NAMES.commitment
        )
        expect(realCommitmentBefore?.amount).toBe(70_000)

        await waitForScenarioPreview(page, () => page.getByRole('button', { name: '¿Qué pasa si gasto…?' }).click())
        await expect(page.getByText('Vista de prueba activa')).toBeVisible()
        await page.getByRole('button', { name: 'Cancelar' }).click()

        await openScenarioItem(page, /Compromisos/, PROJECTION_SMOKE_NAMES.commitment)
        const amount = page.getByLabel('Monto por ocurrencia (ARS)')
        await amount.fill('80000')
        await page.getByLabel('Aplicar').click()
        await page.getByRole('option', { name: 'Desde este período' }).click()
        await waitForScenarioPreview(page, () => page.getByRole('button', { name: 'Actualizar la prueba' }).click())

        await openScenarioItem(page, /Compromisos/, PROJECTION_SMOKE_NAMES.commitment)
        await page.getByLabel('Qué querés simular').click()
        await page.getByRole('option', { name: 'Mover a otro período' }).click()
        await page.getByLabel('Período de destino').click()
        await page.getByRole('option').first().click()
        await waitForScenarioPreview(page, () => page.getByRole('button', { name: 'Actualizar la prueba' }).click())

        await openScenarioItem(page, /TC · un pago/, PROJECTION_SMOKE_NAMES.singlePlan)
        await page.getByLabel('Qué querés simular').click()
        await page.getByRole('option', { name: 'Omitir gasto' }).click()
        await waitForScenarioPreview(page, () => page.getByRole('button', { name: 'Actualizar la prueba' }).click())

        const addButtonName = testInfo.project.name === 'mobile-chromium' ? 'Sumar gasto' : 'Sumar un gasto'
        await page.getByRole('button', { name: addButtonName, exact: true }).click()
        await page.getByLabel('Descripción').fill('E2E compromiso semanal')
        await page.getByLabel('Monto por vez').fill('2500')
        await page.getByLabel('¿Cada cuánto?').click()
        await page.getByRole('option', { name: 'Todas las semanas' }).click()
        await waitForScenarioPreview(page, () => page.getByRole('button', { name: 'Sumar a la prueba' }).click())

        await page.getByRole('button', { name: addButtonName, exact: true }).click()
        await page.getByRole('tab', { name: /TC · cuotas/ }).click()
        await page.getByLabel('Descripción').fill('E2E compra en cuotas USD')
        await page.getByLabel('Monto total de la compra').fill('120')
        await page.getByRole('radiogroup', { name: 'Moneda' }).getByRole('radio', { name: /USD/ }).click()
        await page.getByLabel('Tarjeta').click()
        await page.getByRole('option', { name: PROJECTION_SMOKE_NAMES.creditCard }).click()
        const lastPreview = await waitForScenarioPreview(page, () => page.getByRole('button', { name: 'Sumar a la prueba' }).click())

        expect(lastPreview.comparison.changeCount).toBe(5)
        expect(lastPreview.comparison.horizon.scenario.ars).not.toBe(lastPreview.comparison.horizon.base.ars)
        expect(lastPreview.comparison.horizon.scenario.usd).toBeGreaterThan(lastPreview.comparison.horizon.base.usd)
        expect(lastPreview.scenario.projection.flatMap((period) => period.items)).toEqual(expect.arrayContaining([
            expect.objectContaining({ description: 'E2E compromiso semanal', kind: 'commitment', currency: 'ARS' }),
            expect.objectContaining({ description: 'E2E compra en cuotas USD', kind: 'card_installment', currency: 'USD' }),
        ]))
        expect(page.url()).not.toMatch(/80000|2500|compromiso|scenario=/i)

        expect(baseBefore.ownerId).toBeTruthy()
        const storedDraft = await page.evaluate((ownerId) => {
            const value = JSON.parse(sessionStorage.getItem(`finp:projection-scenario:v2:${ownerId}`) ?? 'null') as {
                changes?: unknown[]
                expiresAt?: string
            } | null
            if (!value) return null
            return {
                changeCount: value?.changes?.length ?? 0,
                unexpired: value?.expiresAt ? Date.parse(value.expiresAt) > Date.now() : false,
            }
        }, baseBefore.ownerId as string)
        expect(storedDraft).toEqual({ changeCount: 5, unexpired: true })

        await waitForScenarioPreview(page, async () => { await page.reload() })
        await expect(page.getByText('Vista de prueba activa')).toBeVisible()
        await expect(page.getByRole('button', { name: /simulados \(5\)/i }).first()).toBeVisible()

        try {
            const update = await page.request.patch(`/api/commitments/${PROJECTION_SMOKE_IDS.commitment}`, {
                data: { amount: 71_000 },
            })
            expect(update.ok(), await update.text()).toBe(true)
            const rebased = await waitForScenarioPreview(page, async () => { await page.reload() })
            const baseCommitment = rebased.base.projection[0].items.find(
                (item) => item.description === PROJECTION_SMOKE_NAMES.commitment
            )
            expect(baseCommitment?.amount).toBe(71_000)
            expect(rebased.comparison.changeCount).toBe(5)
        } finally {
            const restore = await page.request.patch(`/api/commitments/${PROJECTION_SMOKE_IDS.commitment}`, {
                data: { amount: 70_000 },
            })
            expect(restore.ok(), await restore.text()).toBe(true)
        }

        const restoredPreview = await waitForScenarioPreview(page, async () => { await page.reload() })
        expect(restoredPreview.base.projection[0].items.find(
            (item) => item.description === PROJECTION_SMOKE_NAMES.commitment
        )?.amount).toBe(70_000)

        const changesButton = page.getByRole('button', { name: /simulados \(5\)/i }).first()
        await changesButton.click()
        await page.getByRole('button', { name: 'Descartar todo' }).click()
        await expect(page.getByText('¿Descartar todos los gastos simulados?')).toBeVisible()
        await page.getByRole('button', { name: 'Descartar simulación' }).click()
        await expect(page.getByText('Vista de prueba activa')).toHaveCount(0)

        expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('finp:projection-scenario:')))).toEqual([])
        const baseAfter = await json<ProjectionPayload>(
            await page.request.get('/api/projection?mode=monthly&months=6')
        )
        expect(baseAfter.projection[0].items.find(
            (item) => item.description === PROJECTION_SMOKE_NAMES.commitment
        )?.amount).toBe(70_000)
        expect(baseAfter.projection[0].items.find(
            (item) => item.description === PROJECTION_SMOKE_NAMES.singlePlan
        )?.amount).toBe(120_000)
        expect(baseAfter.projection[0].items.find(
            (item) => item.description === PROJECTION_SMOKE_NAMES.installmentPlan
        )?.amount).toBe(30)
        expect(baseAfter.projection[0].items.find(
            (item) => item.description === PROJECTION_SMOKE_NAMES.historicalSingle
        )?.amount).toBe(15)
        expect(baseAfter.projection.flatMap((period) => period.items).some((item) => item.kind === 'hypothetical')).toBe(false)
    })
})
