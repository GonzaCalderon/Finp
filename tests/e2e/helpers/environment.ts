import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse as parseEnv } from 'dotenv'

type EnvironmentSource = Record<string, string | undefined>

interface MongoDatabaseTarget {
    databaseName: string
    server: string
}

export interface E2EEnvironment {
    databaseName: string
    variables: {
        MONGODB_URI: string
        E2E_DATABASE_NAME: string
        NEXTAUTH_SECRET: string
        TEST_USER_EMAIL: string
        TEST_USER_PASSWORD: string
        PLAYWRIGHT_BASE_URL?: string
    }
}

interface ResolveE2EEnvironmentOptions {
    cwd?: string
    isCI?: boolean
    processEnv?: EnvironmentSource
}

const UNSAFE_DATABASE_NAMES = new Set([
    'admin',
    'config',
    'dev',
    'development',
    'finm',
    'finp',
    'local',
    'prod',
    'production',
])

const E2E_DATABASE_MARKER = /(^|[-_])(ci|e2e|test)([-_]|$)/i
const E2E_APP_ORIGINS = new Set([
    'http://localhost:3001',
    'http://127.0.0.1:3001',
])

function loadEnvironmentFile(path: string): Record<string, string> {
    try {
        return parseEnv(readFileSync(path))
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code === 'ENOENT') return {}
        throw new Error(`No se pudo leer ${path}.`)
    }
}

function requireVariable(source: EnvironmentSource, key: string): string {
    const value = source[key]?.trim()
    if (!value) {
        throw new Error(`Falta ${key} en el entorno E2E.`)
    }
    return value
}

function parseMongoDatabaseTarget(uri: string, label: string): MongoDatabaseTarget {
    const schemeMatch = uri.match(/^(mongodb(?:\+srv)?):\/\//i)
    if (!schemeMatch) {
        throw new Error(`${label} no es una URI de MongoDB válida.`)
    }

    const withoutScheme = uri.slice(schemeMatch[0].length)
    const pathSeparator = withoutScheme.indexOf('/')
    if (pathSeparator < 0) {
        throw new Error(`${label} debe seleccionar una base explícita en la ruta.`)
    }

    const authority = withoutScheme.slice(0, pathSeparator)
    const server = (authority.includes('@')
        ? authority.slice(authority.lastIndexOf('@') + 1)
        : authority
    ).toLowerCase()
    const encodedDatabaseName = withoutScheme
        .slice(pathSeparator + 1)
        .split(/[/?#]/, 1)[0]

    let databaseName: string
    try {
        databaseName = decodeURIComponent(encodedDatabaseName).trim()
    } catch {
        throw new Error(`${label} contiene un nombre de base inválido.`)
    }

    if (!server || !databaseName) {
        throw new Error(`${label} debe seleccionar servidor y base explícitos.`)
    }

    return {
        databaseName,
        server: `${schemeMatch[1].toLowerCase()}://${server}`,
    }
}

export function assertE2EDatabaseIsolation(input: {
    testMongoUri: string
    expectedDatabaseName: string
    developmentMongoUri?: string
}): { databaseName: string } {
    const testTarget = parseMongoDatabaseTarget(input.testMongoUri, 'MONGODB_URI')
    const expectedDatabaseName = input.expectedDatabaseName.trim()

    if (!expectedDatabaseName) {
        throw new Error('Falta E2E_DATABASE_NAME en el entorno E2E.')
    }
    if (testTarget.databaseName !== expectedDatabaseName) {
        throw new Error(
            'E2E_DATABASE_NAME no coincide con la base seleccionada por MONGODB_URI.'
        )
    }

    const normalizedName = testTarget.databaseName.toLowerCase()
    if (
        UNSAFE_DATABASE_NAMES.has(normalizedName) ||
        !E2E_DATABASE_MARKER.test(testTarget.databaseName)
    ) {
        throw new Error(
            'La base E2E debe tener un nombre exclusivo con marcador "e2e", "test" o "ci".'
        )
    }

    if (input.developmentMongoUri) {
        const developmentTarget = parseMongoDatabaseTarget(
            input.developmentMongoUri,
            'MONGODB_URI de desarrollo'
        )
        if (
            developmentTarget.server === testTarget.server &&
            developmentTarget.databaseName === testTarget.databaseName
        ) {
            throw new Error('La base E2E coincide con la base configurada para desarrollo.')
        }
    }

    return { databaseName: testTarget.databaseName }
}

export function assertE2EBaseUrl(value?: string): string | undefined {
    if (!value) return undefined

    let parsed: URL
    try {
        parsed = new URL(value)
    } catch {
        throw new Error('PLAYWRIGHT_BASE_URL no es una URL válida.')
    }

    if (
        !E2E_APP_ORIGINS.has(parsed.origin) ||
        parsed.pathname !== '/' ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash
    ) {
        throw new Error(
            'PLAYWRIGHT_BASE_URL debe apuntar al servidor E2E dedicado en http://localhost:3001.'
        )
    }

    return parsed.origin
}

export function resolveE2EEnvironment(
    options: ResolveE2EEnvironmentOptions = {}
): E2EEnvironment {
    const cwd = options.cwd ?? process.cwd()
    const processEnv = options.processEnv ?? process.env
    const isCI =
        options.isCI ??
        (processEnv.CI === 'true' || processEnv.CI === '1')
    const testFileEnvironment = loadEnvironmentFile(resolve(cwd, '.env.test.local'))
    const source: EnvironmentSource = isCI ? processEnv : testFileEnvironment
    const developmentEnvironment = isCI
        ? {}
        : loadEnvironmentFile(resolve(cwd, '.env.local'))

    const variables = {
        MONGODB_URI: requireVariable(source, 'MONGODB_URI'),
        E2E_DATABASE_NAME: requireVariable(source, 'E2E_DATABASE_NAME'),
        NEXTAUTH_SECRET: requireVariable(source, 'NEXTAUTH_SECRET'),
        TEST_USER_EMAIL: requireVariable(source, 'TEST_USER_EMAIL'),
        TEST_USER_PASSWORD: requireVariable(source, 'TEST_USER_PASSWORD'),
        PLAYWRIGHT_BASE_URL: assertE2EBaseUrl(
            source.PLAYWRIGHT_BASE_URL?.trim() || undefined
        ),
    }
    const target = assertE2EDatabaseIsolation({
        testMongoUri: variables.MONGODB_URI,
        expectedDatabaseName: variables.E2E_DATABASE_NAME,
        developmentMongoUri: developmentEnvironment.MONGODB_URI,
    })

    return {
        databaseName: target.databaseName,
        variables,
    }
}
