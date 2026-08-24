import type { IndexDirection, IndexSpecification } from 'mongodb'

export interface SpaceV2IndexDefinition {
    collection: string
    keys: IndexSpecification
    options: {
        name: string
        unique?: boolean
        partialFilterExpression?: Record<string, unknown>
    }
    purpose: string
}

export const SPACE_V2_INDEXES: readonly SpaceV2IndexDefinition[] = [
    {
        collection: 'spaceoperations',
        keys: { actorUserId: 1, spaceId: 1, type: 1, idempotencyKeyHash: 1 },
        options: {
            name: 'v2_unique_space_operation_intent',
            unique: true,
            partialFilterExpression: { contractVersion: 2 },
        },
        purpose: 'exactly-once por actor, Espacio, tipo e intención',
    },
    {
        collection: 'spaceoperations',
        keys: { spaceId: 1, createdAt: -1 },
        options: { name: 'v2_space_operation_history' },
        purpose: 'historial técnico acotado de operaciones',
    },
    {
        collection: 'spaceentrypersonalimpacts',
        keys: { userId: 1, entryId: 1 },
        options: {
            name: 'v2_unique_personal_impact_per_user_entry',
            unique: true,
            partialFilterExpression: { contractVersion: 2 },
        },
        purpose: 'un único impacto mutable por usuario y movimiento',
    },
    {
        collection: 'spaceentrypersonalimpacts',
        keys: { spaceId: 1, status: 1, updatedAt: -1 },
        options: {
            name: 'v2_space_personal_impact_status',
            partialFilterExpression: { contractVersion: 2 },
        },
        purpose: 'pendientes y revisiones por Espacio',
    },
    {
        collection: 'transactions',
        keys: { userId: 1, spaceEntryId: 1 },
        options: {
            name: 'v2_unique_transaction_per_user_entry',
            unique: true,
            partialFilterExpression: { spaceContractVersion: 2 },
        },
        purpose: 'una transacción personal v2 por usuario y origen compartido',
    },
    {
        collection: 'transactions',
        keys: { spaceImpactId: 1 },
        options: {
            name: 'v2_unique_transaction_per_personal_impact',
            unique: true,
            partialFilterExpression: { spaceContractVersion: 2 },
        },
        purpose: 'vínculo personal exacto y privado',
    },
    {
        collection: 'spaceentries',
        keys: { spaceId: 1, contractVersion: 1, status: 1, dateKey: -1 },
        options: {
            name: 'v2_space_entry_ledger',
            partialFilterExpression: { contractVersion: 2 },
        },
        purpose: 'ledger v2 por día financiero',
    },
    {
        collection: 'debts',
        keys: { userId: 1, spaceId: 1, originMode: 1, status: 1 },
        options: {
            name: 'v2_space_debt_materialization',
            partialFilterExpression: { contractVersion: 2 },
        },
        purpose: 'saldo materializado por usuario, Espacio y modo',
    },
    {
        collection: 'debtmovements',
        keys: { spaceOperationId: 1, debtId: 1, type: 1 },
        options: {
            name: 'v2_unique_debt_movement_per_operation',
            unique: true,
            partialFilterExpression: { spaceOperationId: { $type: 'objectId' } },
        },
        purpose: 'historia de deuda sin duplicar una operación',
    },
    {
        collection: 'spaceactivityevents',
        keys: { operationId: 1, type: 1, entityId: 1 },
        options: {
            name: 'v2_unique_activity_per_operation_entity',
            unique: true,
            partialFilterExpression: { operationId: { $type: 'objectId' } },
        },
        purpose: 'actividad auditable idempotente',
    },
] satisfies ReadonlyArray<{
    collection: string
    keys: Record<string, IndexDirection>
    options: SpaceV2IndexDefinition['options']
    purpose: string
}>

export type SpaceV2IndexEnvironment = 'test' | 'development'

export interface SpaceV2IndexCliOptions {
    env: SpaceV2IndexEnvironment
    apply: boolean
    confirmDatabase?: string
    help: boolean
}

function takeValue(args: string[], index: number, option: string) {
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Falta el valor de ${option}.`)
    return value
}

export function parseSpaceV2IndexCliArguments(args: string[]): SpaceV2IndexCliOptions {
    const options: SpaceV2IndexCliOptions = { env: 'test', apply: false, help: false }
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index]
        if (argument === '--help' || argument === '-h') {
            options.help = true
        } else if (argument === '--apply') {
            options.apply = true
        } else if (argument === '--env') {
            const value = takeValue(args, index, argument)
            if (value !== 'test' && value !== 'development') {
                throw new Error('--env sólo admite test o development.')
            }
            options.env = value
            index += 1
        } else if (argument === '--confirm-database') {
            options.confirmDatabase = takeValue(args, index, argument)
            index += 1
        } else {
            throw new Error(`Opción desconocida: ${argument}.`)
        }
    }
    if (options.env === 'development' && !options.confirmDatabase && !options.help) {
        throw new Error('Development exige --confirm-database con el nombre exacto de la base.')
    }
    if (options.env === 'test' && options.confirmDatabase) {
        throw new Error('--confirm-database sólo corresponde a development.')
    }
    if (options.env === 'development' && options.apply) {
        throw new Error('Los índices v2 sólo pueden aplicarse en el entorno E2E aislado.')
    }
    return options
}
