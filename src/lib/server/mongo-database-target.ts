export interface MongoDatabaseTarget {
    databaseName: string
    server: string
}

const PRODUCTION_DATABASE_MARKER = /(^|[-_])(prod|production)([-_]|$)/i

/**
 * Extrae únicamente la identidad técnica del destino. Nunca incluye
 * credenciales en el resultado ni en los mensajes de error.
 */
export function parseMongoDatabaseTarget(
    uri: string,
    label: string
): MongoDatabaseTarget {
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

export function isProductionLikeDatabaseName(databaseName: string) {
    const normalized = databaseName.trim().toLowerCase()
    return (
        normalized === 'admin' ||
        normalized === 'config' ||
        normalized === 'local' ||
        normalized === 'prod' ||
        normalized === 'production' ||
        PRODUCTION_DATABASE_MARKER.test(normalized)
    )
}
