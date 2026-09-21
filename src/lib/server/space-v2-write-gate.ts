import mongoose from 'mongoose'

import { ServiceError } from '@/lib/server/errors'

const SPACE_V2_WRITABLE_DATABASES = new Set(['finp-e2e', 'finm'])

export function isSpaceV2WriteEnabled() {
    return (
        mongoose.connection.readyState === 1 &&
        SPACE_V2_WRITABLE_DATABASES.has(mongoose.connection.name)
    )
}

/**
 * La decisión 0011 habilitó v2 en la base de development `finm` después del
 * cutover. E2E conserva su base dedicada y cualquier otro destino, incluida
 * producción, falla cerrado. No se habilita por NODE_ENV ni por una variable
 * booleana fácil de activar accidentalmente.
 */
export function assertSpaceV2WriteEnabled() {
    if (!isSpaceV2WriteEnabled()) {
        throw new ServiceError(
            503,
            'SPACE_V2_WRITE_DISABLED',
            'Las escrituras financieras v2 no están habilitadas en esta base.'
        )
    }
}
