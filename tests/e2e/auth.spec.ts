import { test, expect } from '@playwright/test'
import { TEST_USER, loginAsTestUser } from './helpers/auth'

// ─── Login ────────────────────────────────────────────────────────────────────
test.describe('Login', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
    })

    test('muestra el formulario de login', async ({ page }) => {
        await expect(page.getByTestId('login-email')).toBeVisible()
        await expect(page.getByTestId('login-password')).toBeVisible()
        await expect(page.getByTestId('login-submit')).toBeVisible()
    })

    test('login correcto redirige al dashboard', async ({ page }) => {
        await page.getByTestId('login-email').fill(TEST_USER.email)
        await page.getByTestId('login-password').fill(TEST_USER.password)
        await page.getByTestId('login-submit').click()

        await page.waitForURL('**/dashboard', { timeout: 10_000 })
        expect(page.url()).toContain('/dashboard')
    })

    test('login con contraseña incorrecta muestra error', async ({ page }) => {
        await page.getByTestId('login-email').fill(TEST_USER.email)
        await page.getByTestId('login-password').fill('contraseña-incorrecta')
        await page.getByTestId('login-submit').click()

        await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 5_000 })
        // Verificamos que seguimos en la página de login
        expect(page.url()).toContain('/login')
    })

    test('login con email inválido muestra error de validación', async ({ page }) => {
        await page.getByTestId('login-email').fill('no-es-email')
        await page.getByTestId('login-password').fill('MiClave123')
        await page.getByTestId('login-submit').click()

        // El formulario con zod debería mostrar error de validación sin hacer request
        await expect(page.locator('text=Email inválido')).toBeVisible({ timeout: 3_000 })
    })

    test('login con campos vacíos muestra errores de validación', async ({ page }) => {
        await page.getByTestId('login-submit').click()
        // Esperamos que aparezcan errores (el schema requiere ambos campos)
        await expect(page.locator('text=requerido').first()).toBeVisible({ timeout: 3_000 })
    })
})

// ─── Logout ───────────────────────────────────────────────────────────────────
test.describe('Logout', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsTestUser(page)
    })

    test('usuario autenticado puede hacer logout', async ({ page }) => {
        // Buscamos el trigger de logout en el navbar — el texto puede variar, buscamos por rol
        // La navegación tiene un botón de logout o un menú de usuario
        // Navegamos directo a la URL de logout de NextAuth como fallback robusto
        await page.goto('/api/auth/signout')
        // NextAuth muestra una página de confirmación
        const signOutBtn = page.locator('button[type="submit"]')
        if (await signOutBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await signOutBtn.click()
        }

        // Tras el logout debería redirigir a login
        await page.waitForURL('**/login', { timeout: 8_000 })
        expect(page.url()).toContain('/login')
    })

    test('usuario sin sesión es redirigido al login al intentar acceder al dashboard', async ({ page }) => {
        // Abrimos nueva página sin sesión
        const context = page.context()
        const newPage = await context.newPage()
        await newPage.context().clearCookies()

        await newPage.goto('/dashboard')
        await newPage.waitForURL('**/login', { timeout: 8_000 })
        expect(newPage.url()).toContain('/login')

        await newPage.close()
    })
})
