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
        await dialog.locator('#entry-amount').fill('80,01')
        await dialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago').fill(description)
        await dialog.getByRole('button', { name: 'Continuar' }).click()
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await dialog.getByText('Solo registrar en el espacio', { exact: true }).click()
        await page.getByRole('option', { name: /^Tarjeta E2E Tarjeta de crédito/ }).click()
        await expect(dialog.getByText(/consumo en un pago por/)).toBeVisible()

        const responsePromise = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entries`)
        )
        const saveButton = dialog.getByRole('button', { name: 'Guardar y agregar a Mi Finp' })
        await expect(saveButton).toBeEnabled()
        await saveButton.click()
        const response = await responsePromise
        expect(response.status()).toBe(201)
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
        await expect(dialog.getByLabel('Pasos del gasto')).toContainText('Datos')
        await dialog.locator('#entry-amount').fill('1000')
        await dialog.getByPlaceholder('Ej. Almuerzo equipo en Santiago').fill(description)
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await expect(dialog.getByLabel('Pasos del gasto')).toContainText('Reparto')
        await dialog.getByRole('button', { name: 'Continuar' }).click()

        await expect(dialog.getByText('Qué cambia al confirmar')).toBeVisible()
        await expect(dialog.getByText('Total', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Tu parte', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Impacto real de cuenta', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Gasto operacional', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Adelanto recuperable', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Cambio en deuda', { exact: true })).toBeVisible()

        await dialog.getByText('Solo registrar en el espacio', { exact: true }).click()
        await page.getByRole('option', { name: /^Efectivo Efectivo/ }).click()
        const responsePromise = page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/spaces/${SPACE_V2_E2E.spaceId}/entries`)
        )
        await dialog.getByRole('button', { name: 'Guardar y agregar a Mi Finp' }).click()
        expect((await responsePromise).status()).toBe(201)
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
})
