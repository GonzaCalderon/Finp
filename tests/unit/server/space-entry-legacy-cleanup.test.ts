import { describe, expect, it } from 'vitest'

import {
    parseSpaceEntryLegacyCleanupArguments,
    SPACE_ENTRY_RETIRED_FIELDS,
} from '@/lib/server/space-entry-legacy-cleanup'

describe('space entry legacy cleanup', () => {
    it('usa E2E y dry-run como valores seguros por defecto', () => {
        expect(parseSpaceEntryLegacyCleanupArguments([])).toEqual({
            env: 'test',
            apply: false,
            cutover: false,
            help: false,
        })
        expect(SPACE_ENTRY_RETIRED_FIELDS).toEqual([
            'linkedTransactionId',
            'confirmationRequired',
            'confirmedByUserId',
            'confirmedAt',
            'rejectedAt',
        ])
    })

    it('exige una puerta explícita para limpiar development', () => {
        expect(() => parseSpaceEntryLegacyCleanupArguments(['--env', 'development']))
            .toThrow('confirm-database')
        expect(() => parseSpaceEntryLegacyCleanupArguments([
            '--env', 'development', '--confirm-database', 'finm',
        ])).toThrow('--cutover')
        expect(parseSpaceEntryLegacyCleanupArguments([
            '--env', 'development', '--confirm-database', 'finm', '--cutover', '--apply',
        ])).toMatchObject({ env: 'development', confirmDatabase: 'finm', cutover: true, apply: true })
    })
})
