export type SpaceMigrationCommand = 'plan' | 'clone' | 'prepare' | 'apply' | 'verify' | 'rollback'

export interface SpaceMigrationCliOptions {
    command: SpaceMigrationCommand
    runId: string
    confirmDatabase: string
    targetDatabase: string
    execute: boolean
    cutover: boolean
    approveSafeDefaults: boolean
    approvedBy?: string
    help: boolean
}

const COMMANDS = new Set<SpaceMigrationCommand>(['plan', 'clone', 'prepare', 'apply', 'verify', 'rollback'])

function takeValue(args: string[], index: number, option: string) {
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Falta el valor de ${option}.`)
    return value
}

export function parseSpaceMigrationCliArguments(args: string[]): SpaceMigrationCliOptions {
    const firstArgument = args[0]
    const command = (firstArgument === '--help' || firstArgument === '-h'
        ? undefined
        : firstArgument) as SpaceMigrationCommand | undefined
    if (command !== undefined && !COMMANDS.has(command)) throw new Error(`Subcomando desconocido: ${command}.`)
    const options: SpaceMigrationCliOptions = {
        command: command ?? 'plan',
        runId: '',
        confirmDatabase: '',
        targetDatabase: '',
        execute: false,
        cutover: false,
        approveSafeDefaults: false,
        help: false,
    }
    for (let index = command ? 1 : 0; index < args.length; index += 1) {
        const argument = args[index]
        if (argument === '--help' || argument === '-h') {
            options.help = true
            continue
        }
        if (argument === '--execute') {
            options.execute = true
            continue
        }
        if (argument === '--approve-safe-defaults') {
            options.approveSafeDefaults = true
            continue
        }
        if (argument === '--cutover') {
            options.cutover = true
            continue
        }
        if (argument === '--run-id') {
            options.runId = takeValue(args, index, argument)
            index += 1
            continue
        }
        if (argument === '--confirm-database') {
            options.confirmDatabase = takeValue(args, index, argument)
            index += 1
            continue
        }
        if (argument === '--target-database') {
            options.targetDatabase = takeValue(args, index, argument)
            index += 1
            continue
        }
        if (argument === '--approved-by') {
            options.approvedBy = takeValue(args, index, argument)
            index += 1
            continue
        }
        throw new Error(`Opción desconocida: ${argument}.`)
    }
    if (options.help) return options
    if (!/^[a-z0-9][a-z0-9_-]{2,80}$/i.test(options.runId)) {
        throw new Error('--run-id es obligatorio y sólo admite letras, números, guion y guion bajo.')
    }
    if (!options.confirmDatabase) throw new Error('--confirm-database es obligatorio para la fuente development.')
    if (!options.targetDatabase) throw new Error('--target-database es obligatorio.')
    if (options.command === 'plan' && options.execute) {
        throw new Error('plan es read-only y no admite --execute.')
    }
    if (options.approveSafeDefaults && !options.approvedBy?.trim()) {
        throw new Error('--approve-safe-defaults exige --approved-by.')
    }
    if (options.cutover && options.targetDatabase !== options.confirmDatabase) {
        throw new Error('El cutover es in-place: --target-database debe repetir el nombre de --confirm-database.')
    }
    if (options.command === 'prepare' && !options.cutover) {
        throw new Error('prepare pertenece al cutover in-place y exige --cutover.')
    }
    if (options.command === 'clone' && options.cutover) {
        throw new Error('El cutover in-place no clona: usá prepare.')
    }
    return options
}
