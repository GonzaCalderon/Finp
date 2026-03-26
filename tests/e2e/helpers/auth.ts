import { type Page } from '@playwright/test'

// Credenciales del usuario de test — deben existir en la DB antes de correr los E2E
// Ver tests/e2e/helpers/README para instrucciones de setup
export const TEST_USER = {
    email: process.env.TEST_USER_EMAIL ?? 'test@finp.dev',
    password: process.env.TEST_USER_PASSWORD ?? 'TestPass123!',
}

/**
 * Realiza el login completo con el usuario de test.
 * Asume que el servidor está levantado y la URL base configurada.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
    await page.goto('/login')
    await page.getByTestId('login-email').fill(TEST_USER.email)
    await page.getByTestId('login-password').fill(TEST_USER.password)
    await page.getByTestId('login-submit').click()
    // Esperamos a que redirija al dashboard
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
}

/**
 * Navega a la página de transacciones del mes actual.
 */
export async function gotoTransactions(page: Page): Promise<void> {
    await page.goto('/transactions')
    await page.waitForLoadState('networkidle')
}
