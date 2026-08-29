import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SpaceMigrationNotice } from '@/components/spaces/detail/SpaceMigrationNotice'

describe('SpaceMigrationNotice', () => {
    it('explica el bloqueo sin exponer detalles internos ni totales parciales', () => {
        render(<SpaceMigrationNotice status={{
            readMode: 'legacy_incompatible',
            migration: { state: 'blocked', readOnly: true, reason: 'manual_review_required' },
        }} />)
        const notice = screen.getByRole('status')
        expect(notice).toHaveTextContent('necesita una revisión antes de migrar')
        expect(notice).toHaveTextContent('totales quedan pausados')
        expect(notice).not.toHaveTextContent(/runId|fingerprint|manifest/i)
    })

    it('no ocupa espacio cuando el Espacio puede operar', () => {
        const { container } = render(<SpaceMigrationNotice status={{
            readMode: 'full',
            migration: { state: 'migrated', readOnly: false, reason: 'migration_verified' },
        }} />)
        expect(container).toBeEmptyDOMElement()
    })
})
