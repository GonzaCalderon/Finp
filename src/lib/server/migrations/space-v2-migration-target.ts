import { parseMongoDatabaseTarget, isProductionLikeDatabaseName } from '@/lib/server/mongo-database-target'

const REHEARSAL_MARKER = /(^|[-_])e2e[-_]migration([-_]|$)/i

export function isSpaceMigrationRehearsalDatabaseName(databaseName: string) {
    return !isProductionLikeDatabaseName(databaseName) && REHEARSAL_MARKER.test(databaseName)
}

export function replaceMongoDatabaseName(uri: string, databaseName: string) {
    const target = parseMongoDatabaseTarget(uri, 'URI base de ensayo')
    if (!isSpaceMigrationRehearsalDatabaseName(databaseName)) {
        throw new Error('El destino debe ser una base nueva con marcador e2e-migration.')
    }
    const schemeSeparator = uri.indexOf('://')
    const pathSeparator = uri.indexOf('/', schemeSeparator + 3)
    if (pathSeparator < 0) throw new Error('La URI base no selecciona una base explícita.')
    const suffixStart = uri.slice(pathSeparator + 1).search(/[?#]/)
    const suffix = suffixStart >= 0 ? uri.slice(pathSeparator + 1 + suffixStart) : ''
    const result = `${uri.slice(0, pathSeparator + 1)}${encodeURIComponent(databaseName)}${suffix}`
    const replaced = parseMongoDatabaseTarget(result, 'URI de ensayo')
    if (replaced.server !== target.server || replaced.databaseName !== databaseName) {
        throw new Error('No se pudo construir el destino aislado solicitado.')
    }
    return result
}

/**
 * Cutover autorizado por la decisión 0011: la transformación ocurre in-place
 * sobre la misma base de development, de modo que fuente y destino deben ser
 * idénticos. La barrera del ensayo no se relaja; ésta es una segunda puerta que
 * sólo se abre con el modo explícito y con el nombre confirmado dos veces.
 */
export function assertSpaceCutoverTarget(input: {
    sourceUri: string
    sourceDatabaseName: string
    targetDatabaseName: string
}) {
    const source = parseMongoDatabaseTarget(input.sourceUri, 'Base de cutover')
    if (source.databaseName !== input.sourceDatabaseName) {
        throw new Error('La confirmación de la base no coincide con la URI.')
    }
    if (input.targetDatabaseName !== input.sourceDatabaseName) {
        throw new Error('El cutover es in-place: el destino debe ser la misma base confirmada.')
    }
    if (isProductionLikeDatabaseName(source.databaseName)) {
        throw new Error('El cutover rechaza una base con nombre productivo.')
    }
    return { source, target: source }
}

export function assertSpaceMigrationTargets(input: {
    sourceUri: string
    sourceDatabaseName: string
    targetUri: string
    targetDatabaseName: string
}) {
    const source = parseMongoDatabaseTarget(input.sourceUri, 'Fuente de development')
    const target = parseMongoDatabaseTarget(input.targetUri, 'Destino de ensayo')
    if (source.databaseName !== input.sourceDatabaseName) {
        throw new Error('La confirmación de la base fuente no coincide con la URI.')
    }
    if (target.databaseName !== input.targetDatabaseName) {
        throw new Error('La confirmación de la base destino no coincide con la URI.')
    }
    if (!isSpaceMigrationRehearsalDatabaseName(target.databaseName)) {
        throw new Error('El destino no tiene el marcador e2e-migration requerido.')
    }
    if (source.server === target.server && source.databaseName === target.databaseName) {
        throw new Error('La fuente y el destino de migración no pueden coincidir.')
    }
    if (isProductionLikeDatabaseName(source.databaseName)) {
        throw new Error('La etapa actual rechaza una fuente con nombre productivo.')
    }
    return { source, target }
}
