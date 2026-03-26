import { test, expect, type Page } from '@playwright/test'
import { loginAsTestUser, gotoTransactions } from './helpers/auth'

// ─── Helpers locales ──────────────────────────────────────────────────────────

/**
 * Expande la sección "Más opciones" del dialog si no está abierta,
 * y llena el campo Descripción.
 */
async function llenarDescripcion(page: Page, descripcion: string) {
    const descInput = page.getByLabel(/descripción/i)
    const visible = await descInput.isVisible({ timeout: 500 }).catch(() => false)
    if (!visible) {
        await page.getByRole('button', { name: /más opciones/i }).click()
        await expect(descInput).toBeVisible({ timeout: 3_000 })
    }
    await descInput.fill(descripcion)
}

/**
 * Abre el dialog de nueva transacción y completa los campos para un ingreso.
 * Selecciona la primera categoría de ingresos disponible y la primera cuenta destino.
 */
async function crearIngreso(page: Page, descripcion: string, monto: string = '1000') {
    await page.getByTestId('btn-nueva-transaccion').click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

    // Tipo: Ingreso (botón en el grid de tipos)
    await page.getByRole('dialog').getByRole('button', { name: 'Ingreso' }).click()

    // Monto
    await page.getByLabel('Monto').fill(monto)

    // Categoría: primera pill de ingresos disponible
    const categoria = page.getByRole('dialog').locator('button').filter({ hasText: /sueldo|otros ingresos|freelance|alquileres/i }).first()
    await categoria.click()

    // Cuenta destino (shadcn Select — tiene placeholder "Seleccioná cuenta destino")
    await page.getByRole('dialog').getByText('Seleccioná cuenta destino').click()
    await page.locator('[role="option"]').first().click()

    // Descripción (dentro de "Más opciones")
    await llenarDescripcion(page, descripcion)

    // Submit
    await page.getByRole('button', { name: 'Crear transacción' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 })
}

/**
 * Abre el dialog de nueva transacción y completa los campos para un gasto.
 * Selecciona la primera categoría de gastos disponible y la primera cuenta origen.
 */
async function crearGasto(page: Page, descripcion: string, monto: string = '500') {
    await page.getByTestId('btn-nueva-transaccion').click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

    // Tipo: Gasto — exact:true para no matchear "Otros gastos"
    await page.getByRole('dialog').getByRole('button', { name: 'Gasto', exact: true }).click()

    // Monto
    await page.getByLabel('Monto').fill(monto)

    // Categoría: primera pill de gastos disponible
    const categoria = page.getByRole('dialog').locator('button').filter({ hasText: /supermercado|otros gastos|transporte/i }).first()
    await categoria.click()

    // Cuenta origen (shadcn Select — tiene placeholder "Seleccioná cuenta origen")
    await page.getByRole('dialog').getByText('Seleccioná cuenta origen').click()
    await page.locator('[role="option"]').first().click()

    // Descripción (dentro de "Más opciones")
    await llenarDescripcion(page, descripcion)

    // Submit
    await page.getByRole('button', { name: 'Crear transacción' }).click()
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

        // La descripción debe aparecer en el item de la lista
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

        // Click en editar del item que matchea la descripción
        const transaccionRow = page.locator('[data-testid="transaction-item"]')
            .filter({ hasText: descripcionOriginal })
            .first()

        // .last() apunta al botón del layout desktop (el visible a 1280px)
        await transaccionRow.getByTestId('btn-editar-transaccion').last().click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

        // Cambiar descripción (puede estar en "Más opciones")
        await llenarDescripcion(page, descripcionEditada)

        await page.getByRole('button', { name: /guardar cambios/i }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 })

        // La descripción nueva debe aparecer en la lista
        await expect(page.locator(`text=${descripcionEditada}`)).toBeVisible({ timeout: 8_000 })
    })

    // ─── Eliminar transacción ─────────────────────────────────────────────────
    test('eliminar transacción la remueve de la lista', async ({ page }) => {
        const descripcion = `E2E eliminar ${Date.now()}`

        await crearIngreso(page, descripcion)
        await expect(page.locator(`text=${descripcion}`)).toBeVisible({ timeout: 8_000 })

        // Click en eliminar del item correcto
        const transaccionRow = page.locator('[data-testid="transaction-item"]')
            .filter({ hasText: descripcion })
            .first()

        await transaccionRow.getByTestId('btn-eliminar-transaccion').last().click()

        // Confirmar en el AlertDialog
        await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3_000 })
        await page.getByRole('button', { name: /eliminar|confirmar/i }).last().click()

        // La transacción debe desaparecer
        await expect(page.locator(`text=${descripcion}`)).not.toBeVisible({ timeout: 8_000 })
    })

    // ─── Filtros ──────────────────────────────────────────────────────────────
    test('filtro por tipo muestra solo ingresos', async ({ page }) => {
        const tipoBtnOrChip = page.locator('button').filter({ hasText: /^tipo$/i }).first()

        if (await tipoBtnOrChip.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await tipoBtnOrChip.click()
            await page.locator('button').filter({ hasText: /^ingreso$/i }).first().click()
        }

        await page.waitForLoadState('networkidle')

        // No debe haber items con badge "Gasto"
        const gastosBadges = page.locator('[data-testid="transaction-item"]').filter({ hasText: 'Gasto' })
        expect(await gastosBadges.count()).toBe(0)
    })

    test('limpiar filtros muestra todas las transacciones', async ({ page }) => {
        const tipoBtnOrChip = page.locator('button').filter({ hasText: /^tipo$/i }).first()

        if (await tipoBtnOrChip.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await tipoBtnOrChip.click()
            await page.locator('button').filter({ hasText: /^gasto$/i }).first().click()
        }

        await page.waitForLoadState('networkidle')

        const limpiarBtn = page.locator('button').filter({ hasText: /limpiar/i }).first()
        if (await limpiarBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await limpiarBtn.click()
            await page.waitForLoadState('networkidle')
        }

        await expect(page).toHaveURL(/\/transactions/)
    })
})
