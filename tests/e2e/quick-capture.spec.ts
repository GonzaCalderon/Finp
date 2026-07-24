import { expect, test } from '@playwright/test'

import { loginAsTestUser } from './helpers/auth'

test.describe('Captura rápida', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/transaction-rules', async (route) => {
            if (route.request().method() !== 'GET') {
                await route.continue()
                return
            }
            const response = await route.fetch()
            const payload = await response.json()
            await route.fulfill({
                response,
                json: {
                    ...payload,
                    rules: [{
                        _id: 'e2e-rule-verduleria',
                        userId: 'e2e-user',
                        name: 'Verdulería',
                        isActive: true,
                        priority: 999,
                        appliesTo: 'expense',
                        field: 'description',
                        condition: 'contains',
                        value: 'Verdulería',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    }, ...(payload.rules ?? [])],
                },
            })
        })
        await loginAsTestUser(page)
        await page.waitForTimeout(1_800)
    })

    test('interpreta una captura y mantiene el diálogo usable en desktop y mobile', async ({
        page,
    }, testInfo) => {
        if (testInfo.project.name === 'mobile-chromium') {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Captura rápida' }).click()
        } else {
            await page.keyboard.press('q')
        }

        const dialog = page.getByRole('dialog').filter({ hasText: 'Captura rápida' })
        await expect(dialog).toBeVisible()
        await dialog.getByLabel('Describí el movimiento').fill('Café 1500 ayer mp')

        await expect(dialog).toContainText('1.500')
        await expect(dialog).toContainText('Ayer')
        if (testInfo.project.name === 'mobile-chromium') {
            await expect(dialog.getByText('Resumen', { exact: true }).first()).toBeVisible()
            await dialog.getByRole('button', {
                name: /Ajustar tipo, moneda, fecha, cuenta o categoría/,
            }).click()
        } else {
            await expect(dialog.getByText(/Vas a registrar/)).toBeVisible()
        }
        await expect(dialog.getByRole('radio', { name: /ARS/ })).toBeChecked()
        await expect(dialog.getByRole('radio', { name: /USD/ })).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Completar detalles' })).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Registrar', exact: true })).toBeVisible()

        const layout = await dialog.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            return {
                documentFits: document.documentElement.scrollWidth <= window.innerWidth,
                dialogFits:
                    rect.left >= 0 &&
                    rect.right <= window.innerWidth &&
                    rect.height <= window.innerHeight,
            }
        })
        expect(layout).toEqual({ documentFits: true, dialogFits: true })
    })

    test('muestra el autocompletado inline y refleja los campos resueltos por reglas', async ({
        page,
    }, testInfo) => {
        if (testInfo.project.name === 'mobile-chromium') {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Captura rápida' }).click()
        } else {
            await page.keyboard.press('q')
        }

        const dialog = page.getByRole('dialog').filter({ hasText: 'Captura rápida' })
        const input = dialog.getByLabel('Describí el movimiento')
        await input.fill('Verdu')

        await expect(
            dialog.getByTestId('quick-capture-inline-completion')
        ).toHaveText('lería')
        await expect(dialog).toContainText(/Enter.*Espacio.*completar/)

        await input.press('Enter')
        await expect(input).toHaveValue('Verdulería')

        await input.fill('Verdu')
        await input.press('Space')
        await expect(input).toHaveValue('Verdulería ')
        await input.press('Space')
        await expect(input).toHaveValue('Verdu ')
        await expect(
            dialog.getByTestId('quick-capture-inline-completion')
        ).toHaveCount(0)

        await input.fill('Verdu')
        await input.evaluate((element) => {
            const textarea = element as HTMLTextAreaElement
            const valueSetter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                'value'
            )?.set
            valueSetter?.call(textarea, 'Verdu ')
            textarea.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                data: ' ',
                inputType: 'insertText',
            }))
        })
        await expect(input).toHaveValue('Verdulería ')

        const categoriesResponse = await page.request.get(
            '/api/categories?includeHidden=true'
        )
        expect(categoriesResponse.ok()).toBe(true)
        const categoriesPayload = await categoriesResponse.json()
        const category = categoriesPayload.categories.find(
            (item: { type: string; isArchived?: boolean }) =>
                item.type === 'expense' && !item.isArchived
        )
        expect(category).toBeTruthy()

        await page.route('**/api/transactions/preview', async (route) => {
            const body = route.request().postDataJSON()
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                json: {
                    valid: true,
                    normalized: {
                        ...body,
                        categoryId: category._id,
                        merchant: 'Verdulería del barrio',
                    },
                    category: {
                        id: category._id,
                        name: category.name,
                        color: category.color,
                    },
                    appliedRule: {
                        id: 'e2e-rule-verduleria',
                        name: 'Verdulería',
                    },
                    issues: [],
                },
            })
        })

        await input.fill('Verdulería 1500')
        const ruleBadges = dialog.getByText('Regla: Verdulería')
        await expect(
            testInfo.project.name === 'mobile-chromium'
                ? ruleBadges.first()
                : ruleBadges.last()
        ).toBeVisible()
        await expect(dialog).toContainText(category.name)

        if (testInfo.project.name === 'mobile-chromium') {
            await dialog.getByRole('button', {
                name: /Ajustar tipo, moneda, fecha, cuenta o categoría/,
            }).click()
        }

        await expect(dialog.getByRole('combobox', { name: 'Categoría' }))
            .toContainText(category.name)
        await expect(dialog.getByLabel('Comercio'))
            .toHaveValue('Verdulería del barrio')
    })

    test('explica y permite descartar una personalización aprendida', async ({
        page,
    }, testInfo) => {
        const categoriesResponse = await page.request.get(
            '/api/categories?includeHidden=true'
        )
        expect(categoriesResponse.ok()).toBe(true)
        const categoriesPayload = await categoriesResponse.json()
        const category = categoriesPayload.categories.find(
            (item: { type: string; isArchived?: boolean }) =>
                item.type === 'expense' && !item.isArchived
        )
        expect(category).toBeTruthy()

        await page.route('**/api/quick-capture/context', async (route) => {
            const response = await route.fetch()
            const payload = await response.json()
            await route.fulfill({
                response,
                json: {
                    ...payload,
                    learning: {
                        profile: {
                            enabled: true,
                            introSeenAt: new Date().toISOString(),
                        },
                        metrics: {
                            captures: 5,
                            confirmed: 5,
                            abandoned: 0,
                            suggestionsShown: 1,
                            suggestionsAccepted: 1,
                            corrections: 0,
                            reversions: 0,
                            acceptanceRate: 1,
                            correctionRate: 0,
                            activePatterns: 1,
                        },
                        patterns: [{
                            key: 'a'.repeat(64),
                            triggerKind: 'token',
                            triggerTerm: 'verduleria',
                            triggerLabel: 'Verdulería',
                            transactionType: 'expense',
                            currency: 'ARS',
                            targetType: 'category',
                            targetId: category._id,
                            targetLabel: category.name,
                            targetColor: category.color,
                            occurrences: 5,
                            total: 5,
                            consistency: 1,
                            confidence: 0.95,
                            lead: 5,
                            acceptedCount: 0,
                            dismissedCount: 0,
                            revertedCount: 0,
                            correctedCount: 0,
                            lastSeenAt: new Date().toISOString(),
                            autoApply: true,
                            status: 'active',
                            reason: `Usaste Verdulería con ${category.name} en 5 de 5 movimientos similares.`,
                            canConvertToRule: false,
                        }],
                    },
                },
            })
        })

        if (testInfo.project.name === 'mobile-chromium') {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Captura rápida' }).click()
        } else {
            await page.keyboard.press('q')
        }

        const dialog = page.getByRole('dialog').filter({ hasText: 'Captura rápida' })
        const input = dialog.getByLabel('Describí el movimiento')
        await input.fill('Verdulería 1500')

        await expect(dialog.getByText('Personalizada')).toBeVisible()
        await expect(dialog).toContainText(
            `Usaste Verdulería con ${category.name} en 5 de 5 movimientos similares.`
        )
        await dialog.getByRole('button', {
            name: `No usar ${category.name} esta vez`,
        }).click()
        await expect(dialog.getByText('Personalizada')).toHaveCount(0)
    })
})
