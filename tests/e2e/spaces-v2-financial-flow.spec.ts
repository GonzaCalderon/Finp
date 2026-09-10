import { expect, test } from '@playwright/test'

import { loginAsTestUser } from './helpers/auth'
import { SPACE_V2_E2E } from './helpers/spaces-v2'

test.describe('Espacios v2 — recorrido financiero', () => {
    test('crea desde inicio con contrato v2 y registra la tarjeta como un pago', async ({ page }, testInfo) => {
        testInfo.setTimeout(60_000)
        const description = `Tarjeta desde inicio ${testInfo.project.name}`
        await loginAsTestUser(page)
        await page.goto('/spaces')

        await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
        await page.locator('[data-fab-action="space-action"]:visible').click()
        const picker = page.getByRole('dialog', { name: 'Elegir espacio' })
        await expect(picker).toBeVisible()
        await picker.getByRole('button', { name: new RegExp(SPACE_V2_E2E.name) }).click()

        const dialog = page.getByRole('dialog', { name: 'Nuevo gasto' })
        await expect(dialog.getByTestId('space-entry-draft-save-status')).toContainText(/Se guardará automáticamente|Guardado de forma privada/, { timeout: 15_000 })
        await dialog.locator('#entry-amount').fill('80,01')
        await dialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago').fill(description)
        await dialog.getByRole('button', { name: 'Continuar' }).click()
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await dialog.getByText('Solo registrar en el espacio', { exact: true }).click()
        await page.getByRole('option', { name: /^Tarjeta E2E Tarjeta de crédito/ }).click()
        await expect(dialog.getByText(/consumo en un pago por/)).toBeVisible()
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        const responsePromise = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft/publish`)
        )
        const saveButton = dialog.getByRole('button', { name: 'Guardar y agregar a Mi Finp' })
        await expect(saveButton).toBeEnabled()
        await saveButton.click()
        const response = await responsePromise
        const responseBody = await response.text()
        expect(response.status(), responseBody).toBe(201)
        await expect(dialog).not.toBeVisible()

        const detail = await page.request.get(`/api/spaces/${SPACE_V2_E2E.spaceId}`)
        const body = await detail.json() as {
            data: {
                movements: {
                    items: Array<{
                        title: string
                        originalMoney?: { minorUnits: string; scale: number }
                        currentUserImpact?: { transactionId?: string }
                    }>
                }
            }
        }
        const entry = body.data.movements.items.find((item) => item.title === description)
        expect(entry).toMatchObject({ originalMoney: { minorUnits: '8001', scale: 2 } })
        expect(entry?.currentUserImpact?.transactionId).toBeTruthy()

        const transactionResponse = await page.request.get(
            `/api/transactions/${entry!.currentUserImpact!.transactionId}`
        )
        expect(transactionResponse.ok()).toBe(true)
        const transactionBody = await transactionResponse.json() as {
            transaction: { type: string; amount: number; installmentPlanId?: unknown }
        }
        expect(transactionBody.transaction).toMatchObject({
            type: 'credit_card_expense',
            amount: 80.01,
        })
        expect(transactionBody.transaction.installmentPlanId).toBeUndefined()
    })

    test('revisa el impacto exacto y crea el gasto también en Mi Finp', async ({ page }, testInfo) => {
        const description = `Cena compartida ${testInfo.project.name}`
        await loginAsTestUser(page)
        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)
        await expect(page.getByRole('heading', { name: SPACE_V2_E2E.name })).toBeVisible()

        const directCreate = page.getByRole('button', { name: /nuevo movimiento/i }).first()
        if (await directCreate.isVisible()) {
            await directCreate.click()
        } else {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Agregar movimiento' }).click()
        }
        const dialog = page.getByRole('dialog', { name: 'Nuevo gasto' })
        await expect(dialog.getByTestId('space-entry-draft-save-status')).toContainText(/Se guardará automáticamente|Guardado de forma privada/, { timeout: 15_000 })
        await expect(dialog.getByLabel('Pasos del gasto')).toContainText('Datos')
        await dialog.locator('#entry-amount').fill('1000')
        await dialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago').fill(description)
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await expect(dialog.getByLabel('Pasos del gasto')).toContainText('Reparto')
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await expect(dialog.getByLabel('Pasos del gasto')).toContainText('Extras')
        await dialog.getByText('Solo registrar en el espacio', { exact: true }).click()
        await page.getByRole('option', { name: /^Efectivo Efectivo/ }).click()
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await expect(dialog.getByText('Qué cambia al confirmar')).toBeVisible()
        await expect(dialog.getByText('Total', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Tu parte', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Impacto real de cuenta', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Gasto operacional', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Adelanto recuperable', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Cambio en deuda', { exact: true })).toBeVisible()

        const responsePromise = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft/publish`)
        )
        await dialog.getByRole('button', { name: 'Guardar y agregar a Mi Finp' }).click()
        const response = await responsePromise
        expect(response.status(), await response.text()).toBe(201)
        await expect(dialog).not.toBeVisible()

        const detail = await page.request.get(`/api/spaces/${SPACE_V2_E2E.spaceId}`)
        expect(detail.ok()).toBe(true)
        const body = await detail.json() as {
            data: { movements: { items: Array<{ title: string; currentUserImpact?: { status: string } }> } }
        }
        expect(body.data.movements.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                title: description,
                currentUserImpact: expect.objectContaining({ status: 'linked' }),
            }),
        ]))
    })

    test('persiste, reanuda y descarta el borrador privado', async ({ page }, testInfo) => {
        const description = `Borrador privado ${testInfo.project.name}`
        await loginAsTestUser(page)
        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)

        const directCreate = page.getByRole('button', { name: /nuevo movimiento/i }).first()
        if (await directCreate.isVisible()) {
            await directCreate.click()
        } else {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Agregar movimiento' }).click()
        }

        const dialog = page.getByRole('dialog', { name: 'Nuevo gasto' })
        await expect(dialog.getByTestId('space-entry-draft-save-status')).toContainText(/Se guardará automáticamente|Guardado de forma privada/, { timeout: 15_000 })
        const saveResponse = page.waitForResponse((response) =>
            response.request().method() === 'PUT' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft`) &&
            response.status() === 200
        )
        await dialog.locator('#entry-amount').fill('345,67')
        await dialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago').fill(description)
        await saveResponse
        await expect(dialog.getByTestId('space-entry-draft-save-status')).toContainText('Guardado de forma privada')
        await dialog.getByRole('button', { name: 'Cancelar' }).click()
        await expect(dialog).not.toBeVisible()

        await page.getByRole('button', { name: 'Movimientos' }).first().click()
        const draftCard = page.getByTestId('space-entry-draft-card')
        await expect(draftCard).toContainText('Borrador privado')
        await expect(draftCard).toContainText(description)

        await page.reload()
        await page.getByRole('button', { name: 'Movimientos' }).first().click()
        await expect(page.getByTestId('space-entry-draft-card')).toContainText(description)
        await page.getByRole('button', { name: 'Continuar borrador' }).click()
        await expect(dialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago')).toHaveValue(description)
        await expect(dialog.locator('#entry-amount')).toHaveValue('345,67')

        await dialog.getByRole('button', { name: 'Descartar borrador' }).click()
        const discardResponse = page.waitForResponse((response) =>
            response.request().method() === 'DELETE' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft`)
        )
        await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click()
        expect((await discardResponse).status()).toBe(200)
        await expect(dialog).not.toBeVisible()
        await expect(page.getByTestId('space-entry-draft-card')).toHaveCount(0)
    })

    test('prepara, recupera y publica un adjunto privado con el borrador', async ({ page }, testInfo) => {
        testInfo.setTimeout(60_000)
        const description = `Adjunto recuperable ${testInfo.project.name}`
        await loginAsTestUser(page)
        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)
        const draftLoad = page.waitForResponse((response) =>
            response.request().method() === 'GET' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft`)
        )
        const directCreate = page.getByRole('button', { name: /nuevo movimiento/i }).first()
        if (await directCreate.isVisible()) await directCreate.click()
        else {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Agregar movimiento' }).click()
        }
        const dialog = page.getByRole('dialog', { name: 'Nuevo gasto' })
        expect((await draftLoad).status()).toBe(200)
        await dialog.locator('#entry-amount').fill('91,25')
        await dialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago').fill(description)
        await dialog.getByRole('button', { name: 'Continuar' }).click()
        await dialog.getByRole('button', { name: 'Continuar' }).click()
        await expect(dialog.getByTestId('space-entry-draft-save-status'))
            .toContainText('Guardado de forma privada', { timeout: 15_000 })

        await page.route('**/entry-draft/attachments', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1_000))
            await route.continue()
        })
        const uploadResponse = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft/attachments`)
        )
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
        await dialog.getByLabel('Elegir comprobantes').setInputFiles({
            name: 'ticket-e2e.png',
            mimeType: 'image/png',
            buffer: png,
        })
        await expect(dialog.getByTestId('space-draft-attachment-blocker')).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Continuar' })).toBeDisabled()
        expect((await uploadResponse).status()).toBe(201)
        await page.unroute('**/entry-draft/attachments')
        await expect(dialog.getByText('ticket-e2e.png', { exact: true })).toBeVisible()
        await expect(dialog.getByText(/ · Listo$/)).toBeVisible()

        await dialog.getByRole('button', { name: 'Cancelar' }).click()
        await page.getByRole('button', { name: 'Movimientos' }).first().click()
        await page.getByRole('button', { name: 'Continuar borrador' }).click()
        await expect(dialog.getByText('ticket-e2e.png', { exact: true })).toBeVisible()
        await expect(dialog.getByText(/ · Listo$/)).toBeVisible()

        await dialog.getByRole('button', { name: 'Continuar' }).click()

        const publishResponse = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft/publish`)
        )
        await dialog.getByRole('button', { name: /^Guardar;/ }).click()
        expect((await publishResponse).status()).toBe(201)
        await expect(dialog).not.toBeVisible()

        const detail = await page.request.get(`/api/spaces/${SPACE_V2_E2E.spaceId}`)
        const body = await detail.json() as {
            data: { movements: { items: Array<{ id: string; title: string; attachments?: Array<{ id: string }> }> } }
        }
        const entry = body.data.movements.items.find((item) => item.title === description)
        expect(entry?.attachments).toHaveLength(1)
        const attachmentId = entry?.attachments?.[0]?.id
        expect(attachmentId).toBeTruthy()
        const download = await page.request.get(
            `/api/spaces/${SPACE_V2_E2E.spaceId}/entries/${entry!.id}/attachments/${attachmentId}`
        )
        expect(download.status()).toBe(200)
        expect(download.headers()['x-content-type-options']).toBe('nosniff')
    })

    test('explica el total multimoneda, filtra USD y revisa una liquidación ARS+USD', async ({ page }) => {
        await loginAsTestUser(page)
        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)

        await expect(page.getByText(/Cotizaciones de referencia/).first()).toBeVisible()
        const compositionTrigger = page.getByRole('button', { name: /Incluye USD/i }).first()
        await expect(compositionTrigger).toBeVisible()
        await compositionTrigger.click()
        await expect(page.getByText('Composición del total')).toBeVisible()
        await expect(page.getByText(/1 USD = 1300 ARS/)).toBeVisible()

        const viewMovementButtons = page.getByRole('button', { name: /Ver movimientos/i })
        await viewMovementButtons.last().click()
        await expect(page.getByText('Hotel en USD')).toBeVisible()
        await expect(page.getByText('Moneda original')).toBeVisible()
        await expect(page.getByText('Moneda pagada')).toBeVisible()
        await expect(page.getByText('Moneda de deuda')).toBeVisible()

        await page.getByRole('button', { name: 'Balance' }).first().click()
        await page.getByRole('button', { name: 'Registrar pago' }).click()
        const dialog = page.getByRole('dialog', { name: 'Liquidar saldo por moneda' })
        await expect(dialog.getByText('Deuda en ARS')).toBeVisible()
        await expect(dialog.getByText('Deuda en USD')).toBeVisible()

        await dialog.getByLabel('Monto efectivamente pagado').first().fill('100')
        await dialog.getByRole('button', { name: /Agregar tramo/i }).click()
        const amountInputs = dialog.getByLabel('Monto efectivamente pagado')
        await amountInputs.nth(1).fill('1')
        await dialog.getByRole('combobox', { name: 'Moneda' }).nth(1).click()
        await page.getByRole('option', { name: /USD/ }).click()
        await dialog.getByRole('button', { name: 'Cambiar cotización' }).click()
        await dialog.getByLabel('Cotización manual USD/ARS').fill('1300')

        await expect(dialog.getByText(/Tramo en ARS → deuda en ARS/)).toBeVisible()
        await expect(dialog.getByText(/Tramo en USD → deuda en USD/)).toBeVisible()
        await expect(dialog.getByText(/diferencia de cambio queda trazada/i)).toBeVisible()

        const responsePromise = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/settlements`)
        )
        await dialog.getByRole('button', { name: 'Confirmar liquidación' }).click()
        expect((await responsePromise).status()).toBe(201)
        await expect(dialog).not.toBeVisible()
    })

    test('un fallo al cargar el saldo de la liquidación se explica y se recupera con reintento', async ({ page }) => {
        await loginAsTestUser(page)
        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)

        let attempts = 0
        await page.route(`**/api/spaces/${SPACE_V2_E2E.spaceId}/debts`, async (route) => {
            attempts += 1
            if (attempts === 1) {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Error interno del servidor' }),
                })
                return
            }
            await route.fetch().then((response) => route.fulfill({ response }))
        })

        await page.getByRole('button', { name: 'Balance' }).first().click()
        await page.getByRole('button', { name: 'Registrar pago' }).click()
        const dialog = page.getByRole('dialog', { name: 'Liquidar saldo por moneda' })

        // El fallo de lectura se anuncia como alerta, no como "sin componentes",
        // y recibe el foco sin que nadie tenga que buscarlo.
        const alert = dialog.getByRole('alert')
        await expect(alert).toContainText('No pudimos cargar el saldo')
        await expect(alert).toBeFocused()

        await alert.getByRole('button', { name: 'Reintentar' }).click()
        await expect(dialog.getByText('Deuda en ARS')).toBeVisible()
        await expect(dialog.getByText('No pudimos cargar el saldo')).toHaveCount(0)
        expect(attempts).toBe(2)

        await page.unrouteAll({ behavior: 'ignoreErrors' })
    })

    test('vincular una transacción existente y elegir una cuenta personal son excluyentes', async ({ page }, testInfo) => {
        testInfo.setTimeout(60_000)
        const description = `Exclusividad de vínculo ${testInfo.project.name}`
        await loginAsTestUser(page)
        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)

        const directCreate = page.getByRole('button', { name: /nuevo movimiento/i }).first()
        if (await directCreate.isVisible()) {
            await directCreate.click()
        } else {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Agregar movimiento' }).click()
        }
        const dialog = page.getByRole('dialog', { name: 'Nuevo gasto' })
        await expect(dialog.getByTestId('space-entry-draft-save-status')).toContainText(/Se guardará automáticamente|Guardado de forma privada/, { timeout: 15_000 })
        await dialog.locator('#entry-amount').fill('500')
        await dialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago').fill(description)
        await dialog.getByRole('button', { name: 'Continuar' }).click()
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await expect(dialog.getByRole('combobox', { name: 'Cuenta o tarjeta' })).toBeVisible()

        const advancedLinkToggle = dialog.getByRole('button', { name: 'Vincular una transacción existente (avanzado)' })
        await advancedLinkToggle.click()
        await expect(dialog.getByText('Transacción compatible')).toBeVisible()
        await expect(dialog.getByRole('combobox', { name: 'Transacción compatible' })).toBeVisible()

        // Elegir una cuenta personal debe descartar el vínculo avanzado: no pueden
        // coexistir linkedTransactionId y personalAccountId en el mismo movimiento.
        await dialog.getByText('Solo registrar en el espacio', { exact: true }).click()
        await page.getByRole('option', { name: /^Efectivo Efectivo/ }).click()
        await expect(dialog.getByText('Transacción compatible')).not.toBeVisible()
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        const responsePromise = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft/publish`)
        )
        await dialog.getByRole('button', { name: 'Guardar y agregar a Mi Finp' }).click()
        const response = await responsePromise
        expect(response.status(), await response.text()).toBe(201)
        await expect(dialog).not.toBeVisible()

        const detail = await page.request.get(`/api/spaces/${SPACE_V2_E2E.spaceId}`)
        const body = await detail.json() as {
            data: { movements: { items: Array<{ title: string; currentUserImpact?: { transactionId?: string } }> } }
        }
        const entry = body.data.movements.items.find((item) => item.title === description)
        expect(entry?.currentUserImpact?.transactionId).toBeTruthy()
    })

    test('muestra la misma revisión financiera al editar un movimiento existente', async ({ page }, testInfo) => {
        testInfo.setTimeout(60_000)
        // Se crea el movimiento en el propio test en lugar de reutilizar un
        // fixture fijo: el listado de Movimientos sólo trae los últimos 50 por
        // fecha, y un fixture antiguo puede quedar fuera de esa página a
        // medida que se acumulan movimientos nuevos en la base de E2E.
        const description = `Editar con revisión ${testInfo.project.name}`
        await loginAsTestUser(page)
        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)
        await expect(page.getByRole('heading', { name: SPACE_V2_E2E.name })).toBeVisible()

        const directCreate = page.getByRole('button', { name: /nuevo movimiento/i }).first()
        if (await directCreate.isVisible()) {
            await directCreate.click()
        } else {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Agregar movimiento' }).click()
        }
        const createDialog = page.getByRole('dialog', { name: 'Nuevo gasto' })
        await expect(createDialog.getByTestId('space-entry-draft-save-status')).toContainText(/Se guardará automáticamente|Guardado de forma privada/, { timeout: 15_000 })
        await createDialog.locator('#entry-amount').fill('10000')
        await createDialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago').fill(description)
        await createDialog.getByRole('button', { name: 'Continuar' }).click()
        await createDialog.getByRole('button', { name: 'Continuar' }).click()
        await createDialog.getByRole('button', { name: 'Continuar' }).click()
        const createSaveButton = createDialog.getByRole('button', {
            name: /^Guardar( en Espacios| y agregar a Mi Finp|; decidir Mi Finp después)/,
        })
        await expect(createSaveButton).toBeEnabled()
        const createResponsePromise = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entry-draft/publish`)
        )
        await createSaveButton.click()
        const createResponse = await createResponsePromise
        expect(createResponse.status(), await createResponse.text()).toBe(201)
        await expect(createDialog).not.toBeVisible()

        await page.getByRole('button', { name: 'Movimientos' }).first().click()
        await page.getByRole('button', { name: new RegExp(description) }).first().click()

        const detailSheet = page.getByRole('dialog', { name: new RegExp(description) })
        await expect(detailSheet).toBeVisible()
        await detailSheet.getByRole('button', { name: 'Editar', exact: true }).click()

        const dialog = page.getByRole('dialog', { name: 'Editar movimiento' })
        await expect(dialog).toBeVisible()
        await expect(dialog.getByText('Qué cambia al confirmar')).toBeVisible()
        await expect(
            dialog.getByText('Completá monto, pagador y reparto para calcular la revisión.')
        ).not.toBeVisible()
        await expect(dialog.getByText('Total', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Tu parte', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Impacto real de cuenta', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Gasto operacional', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Adelanto recuperable', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Cambio en deuda', { exact: true })).toBeVisible()

        const saveButton = dialog.getByRole('button', { name: 'Guardar cambios' })
        await expect(saveButton).toBeEnabled()
        await page.route(`**/api/spaces/${SPACE_V2_E2E.spaceId}/entries/preview`, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 500))
            await route.continue()
        })
        const refreshedPreview = page.waitForRequest((request) =>
            request.method() === 'POST' &&
            request.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entries/preview`)
        )
        await dialog.locator('#entry-amount').fill('10001')
        await refreshedPreview
        await expect(saveButton).toBeDisabled()
        await expect(saveButton).toBeEnabled({ timeout: 10_000 })
        await page.unroute(`**/api/spaces/${SPACE_V2_E2E.spaceId}/entries/preview`)

        await dialog.getByRole('button', { name: 'Cancelar' }).click()
        await expect(dialog).not.toBeVisible()
    })

    test('mueve el foco al primer error al intentar avanzar un paso incompleto', async ({ page }, testInfo) => {
        testInfo.setTimeout(60_000)
        await loginAsTestUser(page)
        await page.goto(`/spaces/${SPACE_V2_E2E.spaceId}`)

        const directCreate = page.getByRole('button', { name: /nuevo movimiento/i }).first()
        if (await directCreate.isVisible()) {
            await directCreate.click()
        } else {
            await page.getByRole('button', { name: 'Abrir acciones rapidas' }).click()
            await page.getByRole('button', { name: 'Agregar movimiento' }).click()
        }
        const dialog = page.getByRole('dialog', { name: 'Nuevo gasto' })
        await expect(dialog.getByTestId('space-entry-draft-save-status')).toContainText(/Se guardará automáticamente|Guardado de forma privada/, { timeout: 15_000 })

        // Los campos deben exponer un nombre accesible real (no sólo un label
        // visual sin asociar), calculado por el propio navegador.
        await expect(dialog.getByRole('textbox', { name: 'Descripción' })).toBeVisible()
        await expect(dialog.getByRole('combobox', { name: 'Pagó' })).toBeVisible()

        // Sin monto ni descripción: "Continuar" debe rechazar el paso y llevar
        // el foco al primer error, no sólo mostrarlo visualmente.
        await dialog.getByRole('button', { name: 'Continuar' }).click()
        await expect(dialog.locator('.text-destructive').first()).toBeFocused()

        await dialog.getByRole('button', { name: 'Cancelar' }).click()
        await expect(dialog).not.toBeVisible()
    })
})
