import { defineConfig, devices } from '@playwright/test'
import { resolveE2EEnvironment } from './tests/e2e/helpers/environment'

// Puerto dedicado para E2E — no colisiona con el dev server del día a día (3000)
const E2E_PORT = 3001
const e2eEnvironment = resolveE2EEnvironment()
const testEnv = e2eEnvironment.variables
const useProductionBuild =
    process.env.CI === 'true' ||
    process.env.CI === '1' ||
    process.env.E2E_USE_PRODUCTION_BUILD === 'true'
const BASE_URL = process.env.CI
    ? testEnv.PLAYWRIGHT_BASE_URL ?? `http://localhost:${E2E_PORT}`
    : `http://localhost:${E2E_PORT}`

process.env.TEST_USER_EMAIL = testEnv.TEST_USER_EMAIL
process.env.TEST_USER_PASSWORD = testEnv.TEST_USER_PASSWORD

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,       // Sequencial para evitar colisiones en la DB de test
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,                 // Un worker mientras los tests comparten DB
    reporter: process.env.CI
        ? [
              ['github'],
              ['html', { open: 'never' }],
          ]
        : 'html',

    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        // Viewport desktop por defecto
        viewport: { width: 1280, height: 720 },
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-chromium',
            use: { ...devices['Pixel 7'] },
        },
    ],

    // Levanta un servidor dedicado para E2E en el puerto 3001, con las
    // variables de .env.test.local inyectadas explícitamente.
    // De esta forma los tests siempre apuntan a la DB de test sin importar
    // qué DB tenga configurada el dev server que pueda estar corriendo en 3000.
    webServer: {
        command: useProductionBuild
            ? `npm run start -- --port ${E2E_PORT}`
            : `npm run dev -- --port ${E2E_PORT}`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
            MONGODB_URI: testEnv.MONGODB_URI,
            NEXTAUTH_SECRET: testEnv.NEXTAUTH_SECRET,
            NEXTAUTH_URL: `http://localhost:${E2E_PORT}`,
            // Auth.js exige confianza explícita al ejecutar el build con next start.
            // assertE2EBaseUrl restringe este host al puerto local exclusivo de E2E.
            AUTH_TRUST_HOST: 'true',
        },
    },
})
