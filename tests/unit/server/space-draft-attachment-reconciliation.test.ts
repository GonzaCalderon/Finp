import { describe, expect, it } from 'vitest'

import { parseDraftAttachmentReconciliationArguments } from '@/lib/server/space-entry-draft-attachment-reconciliation'

describe('space draft attachment reconciliation cli', () => {
    it('es dry-run acotado por defecto', () => {
        expect(parseDraftAttachmentReconciliationArguments([])).toEqual({
            apply: false,
            limit: 50,
            help: false,
        })
    })

    it('valida filtro, lote y opciones desconocidas', () => {
        const draftId = '507f1f77bcf86cd799439011'
        expect(parseDraftAttachmentReconciliationArguments(['--apply', '--draft', draftId, '--limit', '20']))
            .toEqual({ apply: true, draftId, limit: 20, help: false })
        expect(() => parseDraftAttachmentReconciliationArguments(['--limit', '201'])).toThrow('entre 1 y 200')
        expect(() => parseDraftAttachmentReconciliationArguments(['--wat'])).toThrow('desconocida')
    })
})
