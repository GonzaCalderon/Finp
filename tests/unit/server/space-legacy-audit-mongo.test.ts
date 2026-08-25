// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { runMongoSpaceLegacyAudit } from '@/lib/server/audits/space-legacy-audit-mongo'

describe('adaptador Mongo de auditoría legacy', () => {
    it('sólo invoca primitivas de lectura y exige snapshot', async () => {
        const calls: string[] = []
        const database = {
            collection(name: string) {
                return {
                    async countDocuments() {
                        calls.push(`${name}.countDocuments`)
                        return 0
                    },
                    find() {
                        calls.push(`${name}.find`)
                        return {
                            async toArray() { return [] },
                            async *[Symbol.asyncIterator]() { /* base vacía */ },
                        }
                    },
                    aggregate() {
                        calls.push(`${name}.aggregate`)
                        return { async toArray() { return [] } }
                    },
                }
            },
        }
        const session = { inTransaction: () => true }

        const run = await runMongoSpaceLegacyAudit(database as never, session as never)

        expect(run.snapshotRead).toBe(true)
        expect(run.result.migrationReadiness.spacesAudited).toBe(0)
        expect(calls.length).toBeGreaterThan(0)
        expect(calls.every((call) =>
            call.endsWith('.countDocuments') || call.endsWith('.find') || call.endsWith('.aggregate')
        )).toBe(true)
    })

    it('rechaza una lectura fuera de transacción snapshot', async () => {
        await expect(runMongoSpaceLegacyAudit({} as never, {
            inTransaction: () => false,
        } as never)).rejects.toThrow('snapshot activa')
    })
})
