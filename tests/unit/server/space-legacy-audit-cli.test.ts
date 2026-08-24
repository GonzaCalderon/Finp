// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
    parseSpaceAuditCliArguments,
    resolveDevelopmentAuditTarget,
    shouldFailSpaceAudit,
} from '@/lib/server/audits/space-legacy-audit-cli'
import { parseMongoDatabaseTarget } from '@/lib/server/mongo-database-target'

describe('CLI de auditoría legacy de Espacios', () => {
    it('usa test y no falla por hallazgos de forma predeterminada', () => {
        expect(parseSpaceAuditCliArguments([])).toEqual({
            env: 'test', failOn: 'never', help: false,
        })
    })

    it.each(['--apply', '--write', '--repair', '--delete'])('rechaza %s', (argument) => {
        expect(() => parseSpaceAuditCliArguments([argument])).toThrow('read-only')
    })

    it('exige confirmación exacta para development', () => {
        expect(() => parseSpaceAuditCliArguments(['--env', 'development']))
            .toThrow('--confirm-database')
    })

    it('resuelve development sin exponer credenciales', () => {
        const directory = mkdtempSync(join(tmpdir(), 'finp-space-audit-'))
        writeFileSync(
            join(directory, '.env.local'),
            'MONGODB_URI=mongodb://sensitive-user:sensitive-password@localhost:27017/finp-dev\n'
        )
        const target = resolveDevelopmentAuditTarget({
            cwd: directory,
            confirmDatabase: 'finp-dev',
            processEnv: {},
        })

        expect(target.databaseName).toBe('finp-dev')
        expect(() => resolveDevelopmentAuditTarget({
            cwd: directory,
            confirmDatabase: 'otro',
            processEnv: {},
        })).toThrowError(expect.not.stringContaining('sensitive-password'))
    })

    it('rechaza producción aun con confirmación exacta', () => {
        const directory = mkdtempSync(join(tmpdir(), 'finp-space-audit-'))
        writeFileSync(
            join(directory, '.env.local'),
            'MONGODB_URI=mongodb://localhost:27017/finp-production\n'
        )
        expect(() => resolveDevelopmentAuditTarget({
            cwd: directory,
            confirmDatabase: 'finp-production',
            processEnv: {},
        })).toThrow('excluye bases de producción')
    })

    it('parsea el destino Mongo sin conservar credenciales', () => {
        expect(parseMongoDatabaseTarget(
            'mongodb://user:secret@localhost:27017/finp-test',
            'Mongo'
        )).toEqual({
            databaseName: 'finp-test',
            server: 'mongodb://localhost:27017',
        })
    })

    it('aplica el umbral solicitado', () => {
        expect(shouldFailSpaceAudit('never', { critical: 1, high: 1 })).toBe(false)
        expect(shouldFailSpaceAudit('critical', { critical: 0, high: 3 })).toBe(false)
        expect(shouldFailSpaceAudit('critical', { critical: 1, high: 0 })).toBe(true)
        expect(shouldFailSpaceAudit('high', { critical: 0, high: 1 })).toBe(true)
    })
})
