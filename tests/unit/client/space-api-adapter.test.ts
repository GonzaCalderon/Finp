import { describe, expect, it } from 'vitest'

import {
    clientDateToDateKey,
    dateKeyToClientDate,
} from '@/lib/client/space-api-adapter'
import {
    formatDateInput,
    normalizeDialogDate,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'

describe('adaptador de fecha civil de Espacios', () => {
    it('conserva el mismo día al convertir entre Date local y dateKey', () => {
        const localDate = new Date(2026, 2, 1, 0, 30, 0)

        expect(clientDateToDateKey(localDate)).toBe('2026-03-01')
        expect(clientDateToDateKey(dateKeyToClientDate('2026-03-01'))).toBe('2026-03-01')
        expect(formatDateInput(dateKeyToClientDate('2026-03-01'))).toBe('2026-03-01')
        expect(clientDateToDateKey(normalizeDialogDate('2026-03-01')!)).toBe('2026-03-01')
    })
})
