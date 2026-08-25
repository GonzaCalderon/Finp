import mongoose from 'mongoose'

import { ServiceError } from '@/lib/server/errors'

export function isSpaceV2WriteEnabled() {
    return mongoose.connection.readyState === 1 && mongoose.connection.name === 'finp-e2e'
}

/**
 * El modelo v2 permanece cerrado fuera de la base E2E dedicada hasta que exista
 * una decisión explícita de backfill/cutover. No se habilita por NODE_ENV ni por
 * una variable booleana fácil de activar accidentalmente.
 */
export function assertSpaceV2WriteEnabled() {
    if (!isSpaceV2WriteEnabled()) {
        throw new ServiceError(
            503,
            'SPACE_V2_WRITE_DISABLED',
            'Las escrituras financieras v2 sólo están habilitadas en el entorno E2E aislado.'
        )
    }
}
