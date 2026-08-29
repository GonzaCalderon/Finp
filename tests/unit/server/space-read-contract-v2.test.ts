import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'

import {
    normalizeSpaceReadRecord,
    normalizeSpaceMovementLimit,
    parseSpaceMovementCursor,
} from '@/lib/server/space-read-service-v2'
import type { ISpace } from '@/types'
import { getSpaceMigrationPublicStatus } from '@/lib/server/migrations/space-v2-migration-public'

describe('paginación pública de movimientos de Espacios', () => {
    it('usa 50 por defecto y limita a 100', () => {
        expect(normalizeSpaceMovementLimit()).toBe(50)
        expect(normalizeSpaceMovementLimit('75')).toBe(75)
        expect(normalizeSpaceMovementLimit(1000)).toBe(100)
        expect(() => normalizeSpaceMovementLimit('0')).toThrow('límite')
    })

    it('decodifica un cursor dateKey + _id y rechaza datos ambiguos', () => {
        const id = new Types.ObjectId().toString()
        const cursor = Buffer.from(JSON.stringify({ dateKey: '2026-08-24', id })).toString('base64url')
        expect(parseSpaceMovementCursor(cursor)).toEqual({ dateKey: '2026-08-24', id })
        expect(() => parseSpaceMovementCursor(Buffer.from('{}').toString('base64url'))).toThrow('cursor')
    })
})

describe('coexistencia pública durante la migración', () => {
    it('normaliza las monedas faltantes de un documento legacy antes de exponerlo', () => {
        const legacy = {
            reportingCurrency: 'ARS',
            currencies: undefined,
            defaultSplitMode: undefined,
        } as unknown as ISpace
        expect(normalizeSpaceReadRecord(legacy)).toMatchObject({
            reportingCurrency: 'ARS',
            currencies: ['ARS'],
            defaultSplitMode: 'equal',
        })
    })

    it('sólo expone estado y motivo seguro para un Espacio bloqueado', () => {
        const status = getSpaceMigrationPublicStatus({
            contractVersion: undefined,
            migration: {
                state: 'blocked',
                runId: 'interno-no-publicable',
                sourceFingerprint: 'fingerprint-no-publicable',
                reason: 'verification_failed',
            },
        }, 'full')
        expect(status).toEqual({
            state: 'blocked',
            readOnly: true,
            reason: 'manual_review_required',
        })
        expect(JSON.stringify(status)).not.toContain('interno-no-publicable')
        expect(JSON.stringify(status)).not.toContain('fingerprint-no-publicable')
    })

    it('distingue legacy todavía operativo de v2 verificado', () => {
        expect(getSpaceMigrationPublicStatus({ contractVersion: undefined }, 'full'))
            .toEqual({ state: 'legacy', readOnly: false, reason: 'legacy_not_migrated' })
        expect(getSpaceMigrationPublicStatus({
            contractVersion: 2,
            migration: {
                state: 'migrated',
                runId: 'run',
                sourceFingerprint: 'fingerprint',
                reason: 'migration_verified',
            },
        }, 'full')).toEqual({ state: 'migrated', readOnly: false, reason: 'migration_verified' })
    })
})
