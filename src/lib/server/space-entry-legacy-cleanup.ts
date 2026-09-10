export type SpaceEntryLegacyCleanupEnvironment = 'test' | 'development'

export interface SpaceEntryLegacyCleanupCliOptions {
    env: SpaceEntryLegacyCleanupEnvironment
    apply: boolean
    cutover: boolean
    confirmDatabase?: string
    help: boolean
}

export const SPACE_ENTRY_RETIRED_FIELDS = [
    'linkedTransactionId',
    'confirmationRequired',
    'confirmedByUserId',
    'confirmedAt',
    'rejectedAt',
] as const

export function parseSpaceEntryLegacyCleanupArguments(
    args: string[]
): SpaceEntryLegacyCleanupCliOptions {
    const options: SpaceEntryLegacyCleanupCliOptions = {
        env: 'test',
        apply: false,
        cutover: false,
        help: false,
    }

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index]
        if (argument === '--help' || argument === '-h') options.help = true
        else if (argument === '--apply') options.apply = true
        else if (argument === '--cutover') options.cutover = true
        else if (argument === '--env') {
            const value = args[index + 1]
            if (value !== 'test' && value !== 'development') {
                throw new Error('--env sólo admite test o development.')
            }
            options.env = value
            index += 1
        } else if (argument === '--confirm-database') {
            const value = args[index + 1]
            if (!value || value.startsWith('--')) {
                throw new Error('Falta el nombre para --confirm-database.')
            }
            options.confirmDatabase = value
            index += 1
        } else {
            throw new Error(`Opción desconocida: ${argument}.`)
        }
    }

    if (options.env === 'development' && !options.help) {
        if (!options.confirmDatabase) {
            throw new Error('Development exige --confirm-database con el nombre exacto de la base.')
        }
        if (!options.cutover) {
            throw new Error('Development exige --cutover para limpiar campos retirados.')
        }
    }
    if (options.env === 'test' && (options.confirmDatabase || options.cutover)) {
        throw new Error('--confirm-database y --cutover sólo corresponden a development.')
    }
    return options
}
