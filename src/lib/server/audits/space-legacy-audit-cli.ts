import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse as parseEnv } from 'dotenv'

import {
    isProductionLikeDatabaseName,
    parseMongoDatabaseTarget,
} from '@/lib/server/mongo-database-target'

export type SpaceAuditEnvironment = 'test' | 'development'
export type SpaceAuditFailOn = 'never' | 'high' | 'critical'

export interface SpaceAuditCliOptions {
    env: SpaceAuditEnvironment
    confirmDatabase?: string
    failOn: SpaceAuditFailOn
    help: boolean
}

export interface DevelopmentAuditTarget {
    uri: string
    databaseName: string
}

const MUTATING_ARGUMENT = /^--(apply|write|fix|migrate|repair|delete|update)(?:$|=)/i

function takeValue(args: string[], index: number, option: string) {
    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
        throw new Error(`Falta el valor de ${option}.`)
    }
    return value
}

export function parseSpaceAuditCliArguments(args: string[]): SpaceAuditCliOptions {
    const options: SpaceAuditCliOptions = {
        env: 'test',
        failOn: 'never',
        help: false,
    }

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index]
        if (MUTATING_ARGUMENT.test(argument)) {
            throw new Error('La auditoría es estrictamente read-only y no admite opciones de escritura.')
        }
        if (argument === '--help' || argument === '-h') {
            options.help = true
            continue
        }
        if (argument === '--env') {
            const value = takeValue(args, index, argument)
            if (value !== 'test' && value !== 'development') {
                throw new Error('--env sólo admite test o development.')
            }
            options.env = value
            index += 1
            continue
        }
        if (argument === '--confirm-database') {
            options.confirmDatabase = takeValue(args, index, argument)
            index += 1
            continue
        }
        if (argument === '--fail-on') {
            const value = takeValue(args, index, argument)
            if (value !== 'never' && value !== 'high' && value !== 'critical') {
                throw new Error('--fail-on sólo admite never, high o critical.')
            }
            options.failOn = value
            index += 1
            continue
        }
        throw new Error(`Opción desconocida: ${argument}.`)
    }

    if (options.env === 'development' && !options.confirmDatabase && !options.help) {
        throw new Error('Development exige --confirm-database con el nombre exacto de la base.')
    }
    if (options.env === 'test' && options.confirmDatabase) {
        throw new Error('--confirm-database sólo corresponde a development.')
    }

    return options
}

export function resolveDevelopmentAuditTarget(input: {
    cwd?: string
    confirmDatabase: string
    processEnv?: Record<string, string | undefined>
}): DevelopmentAuditTarget {
    const processEnvironment = input.processEnv ?? process.env
    if (processEnvironment.CI === 'true' || processEnvironment.CI === '1') {
        throw new Error('La auditoría de development no se ejecuta desde CI.')
    }

    const environmentPath = resolve(input.cwd ?? process.cwd(), '.env.local')
    let environment: Record<string, string>
    try {
        environment = parseEnv(readFileSync(environmentPath))
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error('Falta .env.local para auditar development.')
        }
        throw new Error('No se pudo leer .env.local para auditar development.')
    }

    const uri = environment.MONGODB_URI?.trim()
    if (!uri) throw new Error('Falta MONGODB_URI en .env.local.')
    const target = parseMongoDatabaseTarget(uri, 'MONGODB_URI de desarrollo')
    if (isProductionLikeDatabaseName(target.databaseName)) {
        throw new Error('La auditoría excluye bases de producción y bases reservadas.')
    }
    if (target.databaseName !== input.confirmDatabase.trim()) {
        throw new Error('--confirm-database no coincide con la base seleccionada por .env.local.')
    }

    return { uri, databaseName: target.databaseName }
}

export function shouldFailSpaceAudit(
    failOn: SpaceAuditFailOn,
    counts: { critical: number; high: number }
) {
    if (failOn === 'never') return false
    if (failOn === 'critical') return counts.critical > 0
    return counts.critical > 0 || counts.high > 0
}
