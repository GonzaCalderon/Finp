import { test, expect, type Locator, type Page } from '@playwright/test'
import { loginAsTestUser, gotoTransactions } from './helpers/auth'

async function openTransactionDialog(page: Page) {
    await page.getByTestId('btn-nueva-transaccion').click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
}

async function continueStep(page: Page) {
    await page.getByTestId('transaction-step-next').click()
}

async function submitStep(page: Page, label: RegExp = /guardar|registrar/i) {
    const button = page.getByTestId('transaction-step-submit')
    await expect(button).toHaveText(label, { timeout: 5_000 })
    await button.click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 })
}

async function selectFromTrigger(trigger: Locator) {
    await trigger.click()
    await trigger.page().locator('[role="option"]').first().click()
}

async function llenarDescripcionActual(page: Page, descripcion: string) {
    const dialog = page.getByRole('dialog')
    const visibleMain = dialog.getByLabel(/descripci[oó]n$/i)
    if (await visibleMain.isVisible().catch(() => false)) {
        await visibleMain.fill(descripcion)
        return
    }

    await dialog.getByTestId('transaction-more-options').click()
    await dialog.getByLabel(/descripci[oó]n \(opcional\)/i).fill(descripcion)
}

async function elegirCategoria(dialog: Locator) {
    const categoria = dialog.locator('button').filter({ hasText: /sueldo|otros ingresos|freelance|supermercado|otros gastos|transporte/i }).first()
    await categoria.click()
}

async function crearIngreso(page: Page, descripcion: string, monto: string = '1000') {
    const dialog = page.getByRole('dialog')

    await openTransactionDialog(page)
    await dialog.getByTestId('transaction-type-income').click()
    await continueStep(page)

    await dialog.getByLabel('Monto').fill(monto)
    await continueStep(page)

    await selectFromTrigger(dialog.getByRole('button', { name: /selecciona cuenta destino/i }))
    await continueStep(page)

    await llenarDescripcionActual(page, descripcion)
    await elegirCategoria(dialog)
    await continueStep(page)

    await submitStep(page)
}

async function crearGasto(page: Page, descripcion: string, monto: string = '500') {
    const dialog = page.getByRole('dialog')

    await openTransactionDialog(page)
    await dialog.getByTestId('transaction-type-expense').click()
    await continueStep(page)

    await dialog.getByLabel('Monto').fill(monto)
    await continueStep(page)

    await dialog.getByTestId('transaction-payment-debit').click()
    await selectFromTrigger(dialog.getByRole('button', { name: /^selecciona cuenta$/i }))
    await continueStep(page)

    await llenarDescripcionActual(page, descripcion)
    await elegirCategoria(dialog)
    await continueStep(page)

    await submitStep(page)
}

async function crearGastoTarjetaUnaCuota(page: Page, descripcion: string, monto: string = '1500') {
    const dialog = page.getByRole('dialog')

    await openTransactionDialog(page)
    await dialog.getByTestId('transaction-type-expense').click()
    await continueStep(page)

    await dialog.getByLabel('Monto').fill(monto)
    await continueStep(page)

    await dialog.getByTestId('transaction-payment-credit_card').click()
    await selectFromTrigger(dialog.getByRole('button', { name: /selecciona tarjeta/i }).first())
    await selectFromTrigger(dialog.getByRole('button', { name: /selecciona mes/i }))
    await continueStep(page)

    await llenarDescripcionActual(page, descripcion)
    await elegirCategoria(dialog)
    await continueStep(page)

    await expect(dialog.getByText(/1 cuota · impacta en/i)).toBeVisible({ timeout: 5_000 })
    await submitStep(page, /guardar|registrar/i)
}

test.describe('Transacciones', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsTestUser(page)
        await gotoTransactions(page)
    })

    test('crear ingreso aparece en la lista', async ({ page }) => {
        const descripcion = `Test ingreso E2E ${Date.now()}`
        await crearIngreso(page, descripcion)
        await expect(page.locator(`text=${descripcion}`)).toBeVisible({ timeout: 8_000 })
    })

    test('crear gasto aparece en la lista', async ({ page }) => {
        const descripcion = `Test gasto E2E ${Date.now()}`
        await crearGasto(page, descripcion)
        await expect(page.locator(`text=${descripcion}`)).toBeVisible({ timeout: 8_000 })
    })

    test('crear gasto con tarjeta en 1 cuota mantiene primera cuota', async ({ page }) => {
        const descripcion = `Test tarjeta 1 cuota ${Date.now()}`
        await crearGastoTarjetaUnaCuota(page, descripcion)
        await expect(page.locator(`text=${descripcion}`)).toBeVisible({ timeout: 8_000 })
    })

    test('editar transacción actualiza la descripción en la lista', async ({ page }) => {
        const descripcionOriginal = `E2E editar ${Date.now()}`
        const descripcionEditada = `E2E editado ${Date.now()}`

        await crearIngreso(page, descripcionOriginal)
        await expect(page.locator(`text=${descripcionOriginal}`)).toBeVisible({ timeout: 8_000 })

        const transaccionRow = page.locator('[data-testid="transaction-item"]').filter({ hasText: descripcionOriginal }).first()
        await transaccionRow.getByTestId('btn-editar-transaccion').last().click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

        await continueStep(page)
        await continueStep(page)
        await continueStep(page)
        await llenarDescripcionActual(page, descripcionEditada)
        await continueStep(page)
        await submitStep(page, /guardar cambios/i)

        await expect(page.locator(`text=${descripcionEditada}`)).toBeVisible({ timeout: 8_000 })
    })

    test('tipos secundarios siguen accesibles desde "Más tipos"', async ({ page }) => {
        await openTransactionDialog(page)
        const dialog = page.getByRole('dialog')

        await dialog.getByTestId('transaction-more-types').click()
        await expect(dialog.getByTestId('transaction-type-transfer')).toBeVisible()
        await dialog.getByTestId('transaction-type-transfer').click()
        await continueStep(page)

        await expect(dialog.getByTestId('transaction-step-details')).toBeVisible()
        await page.getByTestId('transaction-step-back').click()
        await page.getByTestId('transaction-step-back').click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
    })
})
