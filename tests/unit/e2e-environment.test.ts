import { describe, expect, it } from 'vitest'

import {
    assertE2EBaseUrl,
    assertE2EDatabaseIsolation,
} from '../e2e/helpers/environment'

describe('assertE2EDatabaseIsolation', () => {
    it('acepta una base local con nombre E2E explícito', () => {
        expect(
            assertE2EDatabaseIsolation({
                testMongoUri: 'mongodb://localhost:27017/finp-e2e',
                expectedDatabaseName: 'finp-e2e',
                developmentMongoUri: 'mongodb://localhost:27017/finp',
            })
        ).toEqual({ databaseName: 'finp-e2e' })
    })

    it('acepta una base remota de test distinta de desarrollo', () => {
        expect(
            assertE2EDatabaseIsolation({
                testMongoUri:
                    'mongodb+srv://e2e-user:secret@test.example/finp-test?retryWrites=true',
                expectedDatabaseName: 'finp-test',
                developmentMongoUri:
                    'mongodb+srv://dev-user:secret@test.example/finp-dev-data',
            })
        ).toEqual({ databaseName: 'finp-test' })
    })

    it('rechaza una confirmación que no coincide con la ruta', () => {
        expect(() =>
            assertE2EDatabaseIsolation({
                testMongoUri: 'mongodb://localhost:27017/finp-test',
                expectedDatabaseName: 'finp-e2e',
            })
        ).toThrow('E2E_DATABASE_NAME no coincide')
    })

    it.each(['finp', 'finm', 'production', 'dev'])(
        'rechaza el nombre riesgoso %s aunque se confirme',
        (databaseName) => {
            expect(() =>
                assertE2EDatabaseIsolation({
                    testMongoUri: `mongodb://localhost:27017/${databaseName}`,
                    expectedDatabaseName: databaseName,
                })
            ).toThrow('nombre exclusivo')
        }
    )

    it('rechaza nombres sin un marcador inequívoco de pruebas', () => {
        expect(() =>
            assertE2EDatabaseIsolation({
                testMongoUri: 'mongodb://localhost:27017/finp-sandbox',
                expectedDatabaseName: 'finp-sandbox',
            })
        ).toThrow('nombre exclusivo')
    })

    it('rechaza el mismo servidor y base que desarrollo aunque cambien las credenciales', () => {
        expect(() =>
            assertE2EDatabaseIsolation({
                testMongoUri: 'mongodb://test-user:test-secret@db.example/finp-e2e',
                expectedDatabaseName: 'finp-e2e',
                developmentMongoUri:
                    'mongodb://dev-user:dev-secret@db.example/finp-e2e?appName=Finp',
            })
        ).toThrow('coincide con la base configurada para desarrollo')
    })

    it('no incluye credenciales en los errores', () => {
        expect(() =>
            assertE2EDatabaseIsolation({
                testMongoUri:
                    'mongodb://sensitive-user:sensitive-password@db.example/finp',
                expectedDatabaseName: 'finp',
            })
        ).toThrowError(
            expect.not.stringContaining('sensitive-password')
        )
    })
})

describe('assertE2EBaseUrl', () => {
    it.each([
        'http://localhost:3001',
        'http://127.0.0.1:3001',
    ])('acepta el servidor E2E dedicado %s', (value) => {
        expect(assertE2EBaseUrl(value)).toBe(value)
    })

    it('rechaza el puerto de desarrollo', () => {
        expect(() => assertE2EBaseUrl('http://localhost:3000')).toThrow(
            'servidor E2E dedicado'
        )
    })
})
