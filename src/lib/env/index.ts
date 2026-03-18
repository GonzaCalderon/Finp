export const env = {
    MONGODB_URI: process.env.MONGODB_URI!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
} as const

// Validación en arranque
const requiredEnvVars = ['MONGODB_URI', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'] as const

for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        throw new Error(`Variable de entorno faltante: ${key}`)
    }
}