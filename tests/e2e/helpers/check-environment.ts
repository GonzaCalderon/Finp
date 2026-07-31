import { resolveE2EEnvironment } from './environment'

try {
    const environment = resolveE2EEnvironment()
    console.log(`✅ Entorno E2E aislado: base ${environment.databaseName}`)
    console.log('   No se abrió ninguna conexión ni se escribieron datos.')
} catch (error) {
    const message = error instanceof Error ? error.message : 'Configuración E2E inválida.'
    console.error(`❌ ${message}`)
    process.exit(1)
}
