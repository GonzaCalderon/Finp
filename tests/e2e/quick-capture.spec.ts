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
        await expect(input).toHaveValue('Verdulería ')

        await input.fill('Verdu')
        await input.press('Space')
        await expect(input).toHaveValue('Verdulería ')
        await input.press('Space')
        await expect(input).toHaveValue('Verdu ')
        await expect(
            dialog.getByTestId('quick-capture-inline-completion')
        ).toHaveCount(0)

        await input.fill('Verdu')
        await expect(
            dialog.getByTestId('quick-capture-inline-completion')
        ).toHaveText('lería')
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

        const accountsResponse = await page.request.get('/api/accounts')
        expect(accountsResponse.ok()).toBe(true)
        const accountsPayload = await accountsResponse.json()
        const simpleAccounts = accountsPayload.accounts.filter(
            (item: { type: string; isActive?: boolean }) =>
                ['bank', 'cash', 'wallet', 'savings'].includes(item.type) &&
                item.isActive !== false
        )
        const account = simpleAccounts.find(
            (item: { name: string }) => {
                const firstWord = item.name.trim().split(/\s+/)[0]
                if (firstWord.length < 5) return false
                const prefix = firstWord.slice(0, 4).toLocaleLowerCase('es-AR')
                return simpleAccounts.filter(
                    (candidate: { name: string }) =>
                        candidate.name
                            .toLocaleLowerCase('es-AR')
                            .startsWith(prefix)
                ).length === 1
            }
        )
        expect(account).toBeTruthy()
        const accountPrefix = account.name.trim().split(/\s+/)[0].slice(0, 4)

        await input.fill(`Café 1500 ${accountPrefix}`)
        await expect(
            dialog.getByTestId('quick-capture-inline-completion')
        ).toHaveText(account.name.slice(accountPrefix.length))
        await input.press('Enter')
        await expect(input).toHaveValue(`Café 1500 ${account.name} `)

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

        const contextResponse = await page.request.get('/api/quick-capture/context')
        expect(contextResponse.ok()).toBe(true)
        const contextPayload = await contextResponse.json()

        await page.route('**/api/quick-capture/context', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                json: {
                    ...contextPayload,
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

    test('deriva un compromiso nuevo con el borrador precargado', async ({ page }, testInfo) => {
        if (testInfo.project.name === 'mobile-chromium') {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Captura rápida' }).click()
        } else {
            await page.keyboard.press('q')
        }

        const dialog = page.getByRole('dialog').filter({ hasText: 'Captura rápida' })
        await dialog
            .getByLabel('Describí el movimiento')
            .fill('Internet 45000 el 12 de cada mes')

        const orientation = dialog.getByTestId('capture-orientation')
        await expect(orientation).toBeVisible()
        await expect(orientation).toHaveAttribute('data-intent', 'create_commitment')
        await expect(orientation).toContainText('compromiso mensual')
        await expect(orientation).toContainText('día 12')

        // Registrar el gasto simple debe seguir siendo una alternativa válida.
        await expect(
            orientation.getByRole('button', { name: 'Registrar sólo este gasto' })
        ).toBeVisible()

        await orientation.getByRole('button', { name: 'Configurar compromiso' }).click()

        // Derivó a la página dedicada con un identificador opaco. Los datos
        // financieros permanecen en sessionStorage y no viajan en la URL.
        await page.waitForURL(/\/commitments/)
        const destination = new URL(page.url())
        expect(destination.searchParams.get('draft')).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        )
        expect([...destination.searchParams.keys()]).toEqual(['draft'])

        const commitmentDialog = page
            .getByRole('dialog')
            .filter({ hasText: 'Nuevo compromiso' })
        await expect(commitmentDialog).toBeVisible()
        await expect(commitmentDialog).toContainText('Finp completó')
        await expect(commitmentDialog.getByLabel('Descripción')).toHaveValue('Internet')
        await commitmentDialog.getByRole('button', { name: 'Continuar' }).click()
        await expect(
            commitmentDialog.getByRole('button', { name: 'Día 12' })
        ).toBeVisible()
        await expect(commitmentDialog).not.toContainText('Preparado para automatización')
    })

    test('ofrece aplicar un compromiso pendiente y permite registrar aparte', async ({
        page,
    }, testInfo) => {
        // El compromiso pendiente se inyecta en el contexto: el test verifica la
        // orientación, no la creación de datos.
        await page.route('**/api/quick-capture/context', async (route) => {
            const response = await route.fetch()
            const payload = await response.json()
            await route.fulfill({
                response,
                json: {
                    ...payload,
                    currentPeriod: '2026-07',
                    commitments: [
                        {
                            commitmentId: 'e2e-commitment-alquiler',
                            description: 'Alquiler',
                            normalizedDescription: 'alquiler',
                            aliases: [],
                            period: '2026-07',
                            currency: 'ARS',
                            resolvedAmount: 650_000,
                            amountPolicy: 'fixed',
                            state: 'ready',
                        },
                    ],
                    dismissedSuggestions: [],
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
        await dialog.getByLabel('Describí el movimiento').fill('Alquiler 675000')

        const orientation = dialog.getByTestId('capture-orientation')
        await expect(orientation).toBeVisible()
        await expect(orientation).toHaveAttribute('data-intent', 'apply_commitment')
        await expect(orientation).toContainText('Alquiler')
        // Anuncia el importe que se va a aplicar, no el previsto por la plantilla.
        await expect(orientation).toContainText('675.000')
        await expect(orientation).toContainText('650.000')

        // "Registrar aparte" silencia la propuesta sin perder el texto escrito.
        await orientation.getByRole('button', { name: 'Registrar aparte' }).click()
        await expect(orientation).toHaveCount(0)
        await expect(dialog.getByLabel('Describí el movimiento')).toHaveValue('Alquiler 675000')
        await page.unrouteAll({ behavior: 'ignoreErrors' })
    })

    test('la ayuda "¿Qué puedo escribir?" se abre, escribe un ejemplo y no rompe el layout', async ({
        page,
    }, testInfo) => {
        if (testInfo.project.name === 'mobile-chromium') {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Captura rápida' }).click()
        } else {
            await page.keyboard.press('q')
        }

        const dialog = page.getByRole('dialog').filter({ hasText: 'Captura rápida' })
        await dialog.getByTestId('capture-help-toggle').click()

        const help = dialog.getByTestId('capture-help-panel')
        await expect(help).toBeVisible()
        await expect(help).toContainText('Registrar un gasto o ingreso')
        await expect(help).toContainText('Preparar un compromiso mensual')

        const layout = await dialog.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            return {
                documentFits: document.documentElement.scrollWidth <= window.innerWidth,
                dialogFits: rect.left >= 0 && rect.right <= window.innerWidth,
            }
        })
        expect(layout).toEqual({ documentFits: true, dialogFits: true })

        // Los ejemplos son accionables: tocarlos escribe la frase.
        await help.getByRole('button', { name: 'Café 1500 ayer mp' }).click()
        await expect(help).toHaveCount(0)
        await expect(dialog.getByLabel('Describí el movimiento')).toHaveValue('Café 1500 ayer mp')
    })
})
