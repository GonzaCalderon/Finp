import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'path'

// URL base para E2E — en CI se sobreescribe con la env variable
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,       // Sequencial para evitar colisiones en la DB de test
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,                 // Un worker mientras los tests comparten DB
    reporter: process.env.CI ? 'github' : 'html',

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
    ],

    // Levanta el servidor de Next.js automáticamente si no está corriendo
    // Solo en modo local (en CI se asume que el server ya corre)
    webServer: process.env.CI
        ? undefined
        : {
              command: 'npm run dev',
              url: BASE_URL,
              reuseExistingServer: true,
              timeout: 120_000,
          },
})
