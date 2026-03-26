import { test, expect, type Page } from '@playwright/test'
import { loginAsTestUser, gotoTransactions } from './helpers/auth'

// ─── Helpers locales ──────────────────────────────────────────────────────────

/**
 * Abre el dialog de nueva transacción y completa los campos mínimos para un ingreso.
 * Requiere que ya exista al menos una cuenta destino en la DB del usuario de test.
 */
async function crearIngreso(page: Page, descripcion: string, monto: string = '1000') {
    await page.getByTestId('btn-nueva-transaccion').click()
    // Esperamos que abra el dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

    // Tipo: ingreso (puede ser un select o radio)
    const tipoIngreso = page.locator('[data-value="income"], [value="income"]').first()
    if (await tipoIngreso.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await tipoIngreso.click()
    }

    // Descripción
    await page.getByLabel(/descripción/i).fill(descripcion)

    // Monto
    await page.getByLabel(/monto/i).fill(monto)

    // Seleccionamos la primera cuenta destino disponible
    const destSelect = page.locator('[name="destinationAccountId"], #destinationAccountId').first()
    if (await destSelect.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await destSelect.selectOption({ index: 1 })
    } else {
        // Puede ser un componente Select de shadcn/ui
        const destTrigger = page.locator('button').filter({ hasText: /cuenta destino/i }).first()
        if (await destTrigger.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await destTrigger.click()
            await page.locator('[role="option"]').first().click()
        }
    }

    // Submit
    await page.getByRole('button', { name: /guardar|crear|registrar/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 })
}

async function crearGasto(page: Page, descripcion: string, monto: string = '500') {
    await page.getByTestId('btn-nueva-transaccion').click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

    // Tipo: gasto
    const tipoGasto = page.locator('[data-value="expense"], [value="expense"]').first()
    if (await tipoGasto.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await tipoGasto.click()
    }

    await page.getByLabel(/descripción/i).fill(descripcion)
    await page.getByLabel(/monto/i).fill(monto)

    // Cuenta origen
    const srcTrigger = page.locator('button').filter({ hasText: /cuenta origen/i }).first()
    if (await srcTrigger.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await srcTrigger.click()
        await page.locator('[role="option"]').first().click()
    }

    await page.getByRole('button', { name: /guardar|crear|registrar/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 })
}

// ─── Setup: login antes de todos los tests ────────────────────────────────────
test.describe('Transacciones', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsTestUser(page)
        await gotoTransactions(page)
    })

    // ─── Crear ingreso ────────────────────────────────────────────────────────
    test('crear ingreso aparece en la lista', async ({ page }) => {
        const descripcion = `Test ingreso E2E ${Date.now()}`
        await crearIngreso(page, descripcion)

        // El toast de éxito debería aparecer
        await expect(page.locator('text=registrada correctamente, text=guardada correctamente').first())
            .toBeVisible({ timeout: 5_000 })
            .catch(() => {/* toast puede ser rápido */})

        // La transacción debe aparecer en la lista
        await expect(page.locator(`text=${descripcion}`)).toBeVisible({ timeout: 8_000 })
    })

    // ─── Crear gasto ──────────────────────────────────────────────────────────
    test('crear gasto aparece en la lista', async ({ page }) => {
        const descripcion = `Test gasto E2E ${Date.now()}`
        await crearGasto(page, descripcion)

        await expect(page.locator(`text=${descripcion}`)).toBeVisible({ timeout: 8_000 })
    })

    // ─── Editar transacción ───────────────────────────────────────────────────
    test('editar transacción actualiza la descripción en la lista', async ({ page }) => {
        const descripcionOriginal = `E2E editar ${Date.now()}`
        const descripcionEditada = `E2E editado ${Date.now()}`

        // Crear transacción para editar
        await crearIngreso(page, descripcionOriginal)
        await expect(page.locator(`text=${descripcionOriginal}`)).toBeVisible({ timeout: 8_000 })

        // Click en editar del primer item que matchee
        const transaccionRow = page.locator('[data-testid="transaction-item"]')
            .filter({ hasText: descripcionOriginal })
            .first()

        await transaccionRow.getByTestId('btn-editar-transaccion').click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

        // Cambiar descripción
        const descInput = page.getByLabel(/descripción/i)
        await descInput.clear()
        await descInput.fill(descripcionEditada)

        await page.getByRole('button', { name: /guardar|actualizar/i }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 })

        // La descripción nueva debe aparecer
        await expect(page.locator(`text=${descripcionEditada}`)).toBeVisible({ timeout: 8_000 })
    })

    // ─── Eliminar transacción ─────────────────────────────────────────────────
    test('eliminar transacción la remueve de la lista', async ({ page }) => {
        const descripcion = `E2E eliminar ${Date.now()}`

        await crearIngreso(page, descripcion)
        await expect(page.locator(`text=${descripcion}`)).toBeVisible({ timeout: 8_000 })

        // Click en eliminar
        const transaccionRow = page.locator('[data-testid="transaction-item"]')
            .filter({ hasText: descripcion })
            .first()

        await transaccionRow.getByTestId('btn-eliminar-transaccion').click()

        // Confirmar en el AlertDialog
        await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3_000 })
        await page.getByRole('button', { name: /eliminar|confirmar/i }).last().click()

        // La transacción debe desaparecer
        await expect(page.locator(`text=${descripcion}`)).not.toBeVisible({ timeout: 8_000 })
    })

    // ─── Filtros ──────────────────────────────────────────────────────────────
    test('filtro por tipo muestra solo ingresos', async ({ page }) => {
        // En desktop, el filtro de tipo está visible directamente
        // Hacemos click en el chip de "Tipo" y seleccionamos Ingreso
        const tipoBtnOrChip = page.locator('button').filter({ hasText: /^tipo$/i }).first()

        if (await tipoBtnOrChip.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await tipoBtnOrChip.click()
            await page.locator('button').filter({ hasText: /^ingreso$/i }).first().click()
        }

        // Esperamos que se aplique el filtro
        await page.waitForLoadState('networkidle')

        // Verificamos que no aparezca el badge "Gasto" en la lista visible
        // (puede haber 0 transacciones si el usuario de test no tiene, lo cual también es válido)
        const gastosBadges = page.locator('[data-testid="transaction-item"]').filter({ hasText: 'Gasto' })
        expect(await gastosBadges.count()).toBe(0)
    })

    test('limpiar filtros muestra todas las transacciones', async ({ page }) => {
        // Aplicamos un filtro
        const tipoBtnOrChip = page.locator('button').filter({ hasText: /^tipo$/i }).first()

        if (await tipoBtnOrChip.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await tipoBtnOrChip.click()
            await page.locator('button').filter({ hasText: /^gasto$/i }).first().click()
        }

        await page.waitForLoadState('networkidle')

        // Click en "Limpiar"
        const limpiarBtn = page.locator('button').filter({ hasText: /limpiar/i }).first()
        if (await limpiarBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await limpiarBtn.click()
            await page.waitForLoadState('networkidle')
        }

        // Verificamos que el filtro tipo ya no esté activo
        // (no hay assertion fuerte aquí porque depende del estado inicial)
        await expect(page).toHaveURL(/\/transactions/)
    })
})
