import { ServiceError } from '@/lib/server/errors'

/**
 * Frontera temporal de compatibilidad. Toda escritura legacy debe cruzarla
 * después de que el handler haya despachado explícitamente el contrato v2.
 */
export function enterLegacySpaceWriteFacade(target: {
    contractVersion?: number
    migration?: { state?: string }
} | null) {
    if (!target) {
        throw new ServiceError(404, 'SPACE_LEGACY_TARGET_NOT_FOUND', 'El recurso no existe.')
    }
    if (target.contractVersion === 2) {
        throw new ServiceError(
            409,
            'SPACE_V2_LEGACY_FALLBACK_BLOCKED',
            'Un recurso financiero v2 no puede usar el camino de escritura legacy.'
        )
    }
    if (target.migration?.state === 'blocked') {
        throw new ServiceError(
            409,
            'SPACE_MIGRATION_READ_ONLY',
            'Este Espacio está disponible sólo para consulta hasta completar su revisión.'
        )
    }
}
