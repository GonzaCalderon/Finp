import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { parse as parseEnv } from 'dotenv'

// Carga .env.test.local sin tocar process.env — solo para pasarle al webServer
function loadTestEnv(): Record<string, string> {
    try {
        return parseEnv(readFileSync(resolve(__dirname, '.env.test.local')))
    } catch {
        return {}
    }
}

const testEnv = loadTestEnv()

// Puerto dedicado para E2E — no colisiona con el dev server del día a día (3000)
const E2E_PORT = 3001
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${E2E_PORT}`

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
        {
            name: 'mobile-chromium',
            use: { ...devices['Pixel 7'] },
        },
    ],

    // Levanta un servidor dedicado para E2E en el puerto 3001, con las
    // variables de .env.test.local inyectadas explícitamente.
    // De esta forma los tests siempre apuntan a la DB de test sin importar
    // qué DB tenga configurada el dev server que pueda estar corriendo en 3000.
    webServer: process.env.CI
        ? undefined
        : {
              command: `npm run dev -- --port ${E2E_PORT}`,
              url: BASE_URL,
              reuseExistingServer: true,
              timeout: 120_000,
              env: {
                  MONGODB_URI: testEnv.MONGODB_URI ?? '',
                  NEXTAUTH_SECRET: testEnv.NEXTAUTH_SECRET ?? '',
                  NEXTAUTH_URL: `http://localhost:${E2E_PORT}`,
              },
          },
})
