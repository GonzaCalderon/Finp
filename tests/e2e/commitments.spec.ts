import { expect, test } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

const category = {
    _id: 'e2e-category-restaurants',
    userId: 'e2e-user',
    name: 'Restaurantes y delivery',
    type: 'expense',
    color: '#F97316',
    isDefault: true,
    isArchived: false,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
}

test.describe('Compromisos', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/categories?includeHidden=true', async (route) => {
            await route.fulfill({ json: { categories: [category] } })
        })
        await page.route('**/api/accounts', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({ json: { accounts: [] } })
                return
            }
            await route.continue()
        })
        await page.route('**/api/categories/ranking**', async (route) => {
            await route.fulfill({
                json: {
                    ranking: [
                        {
                            categoryId: category._id,
                            score: 100,
                            reason: 'La usaste en movimientos similares.',
                        },
                    ],
                    signals: {},
                },
            })
        })
        await page.route('**/api/commitments/suggestions', async (route) => {
            await route.fulfill({ json: { suggestions: [] } })
        })

        await loginAsTestUser(page)
    })

    test('crea un compromiso con fechas claras y categoría buscable', async ({
        page,
    }, testInfo) => {
        // En `next dev` este recorrido visita y compila en frío varias rutas y
        // overlays. El límite sigue siendo acotado, pero no confunde ese costo
        // local con un fallo del último botón del formulario.
        test.setTimeout(60_000)

        const dueDate = new Date()
        dueDate.setHours(12, 0, 0, 0)
        dueDate.setDate(dueDate.getDate() + 8)
        const dueDay = dueDate.getDate()
        const reminderDate = new Date(dueDate)
        reminderDate.setDate(reminderDate.getDate() - 5)
        const formatDate = (value: Date) =>
            value.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            })
        let submittedBody: Record<string, unknown> | null = null
        await page.route('**/api/commitments', async (route) => {
            if (route.request().method() === 'POST') {
                submittedBody = route.request().postDataJSON()
                await route.fulfill({
                    status: 201,
                    json: { commitment: { _id: 'created-commitment' } },
                })
                return
            }
            await route.fulfill({
                json: { commitments: [], currentPeriod: '2026-07' },
            })
        })

        await page.goto('/commitments')
        await page.getByRole('button', { name: 'Nuevo compromiso' }).first().click()
        const dialog = page
            .getByRole('dialog')
            .filter({ hasText: 'Nuevo compromiso' })

        await dialog.getByRole('button', { name: 'Continuar' }).click()
        await expect(dialog.getByText('La descripción es requerida')).toBeVisible()
        await dialog.getByLabel('Descripción').fill('Clases de piano')
        await expect(
            dialog.getByText('La descripción es requerida')
        ).toHaveCount(0)
        await dialog.locator('#amount').fill('5000')
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await expect(dialog.getByRole('button', { name: 'Elegí un día' })).toBeVisible()
        await dialog.getByRole('button', { name: 'Elegí un día' }).click()
        await page
            .getByRole('button', { name: `Día ${dueDay} del mes` })
            .click()
        await dialog.getByLabel('Recordatorio').click()
        await page.getByRole('option', { name: '5 días antes' }).click()
        await expect(dialog.getByText(formatDate(dueDate))).toBeVisible()
        await expect(dialog.getByText(formatDate(reminderDate))).toBeVisible()
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await dialog.getByLabel('Buscar categoría').fill('Rest')
        const categoryButton = dialog
            .getByRole('button', { name: 'Restaurantes y delivery' })
        if (testInfo.project.name === 'mobile-chromium') {
            await categoryButton.click()
        } else {
            await categoryButton.focus()
            await page.keyboard.press('Enter')
        }
        await expect(dialog.getByRole('button', { name: 'Crear compromiso' })).toBeVisible()

        const hasHorizontalOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth
        )
        expect(hasHorizontalOverflow).toBe(false)

        const createButton = dialog.getByRole('button', {
            name: 'Crear compromiso',
        })
        if (testInfo.project.name === 'mobile-chromium') {
            await createButton.click()
        } else {
            await createButton.focus()
            await page.keyboard.press('Enter')
        }
        await expect.poll(() => submittedBody).not.toBeNull()
        expect(submittedBody).toMatchObject({
            description: 'Clases de piano',
            dayOfMonth: dueDay,
            reminderLeadDays: 5,
            categoryId: category._id,
        })
    })

    test('ofrece cambiar monto con tres fechas efectivas', async ({ page }) => {
        await page.route('**/api/commitments', async (route) => {
            await route.fulfill({
                json: {
                    currentPeriod: '2026-07',
                    commitments: [
                        {
                            _id: 'commitment-piano',
                            userId: 'e2e-user',
                            description: 'Clases de piano',
                            amount: 20_000,
                            resolvedAmount: 25_000,
                            currency: 'ARS',
                            recurrence: 'monthly',
                            dayOfMonth: 3,
                            startDate: '2026-01-01T00:00:00.000Z',
                            nextDueDate: '2026-08-03T00:00:00.000Z',
                            amountPolicy: 'fixed',
                            amountSchedule: [],
                            estimationMode: 'template',
                            aliases: [],
                            createdFrom: 'web',
                            applyMode: 'manual',
                            isActive: true,
                            appliedThisMonth: false,
                            occursThisPeriod: true,
                            lifecycleStatus: 'active',
                            createdAt: '2026-01-01T00:00:00.000Z',
                            updatedAt: '2026-01-01T00:00:00.000Z',
                        },
                    ],
                },
            })
        })

        await page.goto('/commitments')
        await page
            .getByRole('button', { name: 'Cambiar monto de Clases de piano' })
            .click()
        const dialog = page.getByRole('dialog').filter({ hasText: 'Cambiar monto' })

        await expect(dialog.getByText('$ 25.000')).toBeVisible()
        await dialog.getByRole('button', { name: 'Cambiar monto' }).click()
        await expect(dialog.getByRole('button', { name: /Desde ahora/ })).toBeVisible()
        await expect(
            dialog.getByRole('button', { name: /Próximo vencimiento/ })
        ).toBeVisible()
        await expect(dialog.getByRole('button', { name: /Elegir fecha/ })).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Guardar cambio' })).toBeVisible()
    })
})
