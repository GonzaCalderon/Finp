import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    buildCaptureDraft,
    pruneExpiredCaptureDrafts,
    putCaptureDraft,
    takeCaptureDraft,
} from '@/lib/client/capture-draft'
import {
    CAPTURE_DRAFT_VERSION,
    type CommitmentDraftFields,
} from '@/types/capture-intent'

function draft(overrides: Partial<CommitmentDraftFields> = {}) {
    return buildCaptureDraft<CommitmentDraftFields>({
        intent: 'create_commitment',
        sessionId: 'session-1',
        fields: { description: 'Alquiler', amount: 650_000, currency: 'ARS', ...overrides },
        provenance: { description: 'text', amount: 'text', currency: 'default' },
        confidence: 0.9,
    })
}

describe('buildCaptureDraft', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    it('arma el sobre con versión, id, origen y vencimiento', () => {
        const envelope = draft()

        expect(envelope.version).toBe(CAPTURE_DRAFT_VERSION)
        expect(envelope.draftId).toBeTruthy()
        expect(envelope.intent).toBe('create_commitment')
        expect(envelope.origin).toMatchObject({ surface: 'quick_capture', sessionId: 'session-1' })
        expect(new Date(envelope.expiresAt).getTime()).toBeGreaterThan(Date.now())
    })

    it('conserva la procedencia de cada campo', () => {
        expect(draft().provenance).toEqual({
            description: 'text',
            amount: 'text',
            currency: 'default',
        })
    })

    it('cada sobre tiene un id propio', () => {
        expect(draft().draftId).not.toBe(draft().draftId)
    })
})

describe('putCaptureDraft / takeCaptureDraft', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    it('guarda y recupera el sobre completo', () => {
        const envelope = draft()
        const id = putCaptureDraft(envelope)

        expect(takeCaptureDraft<CommitmentDraftFields>(id)).toEqual(envelope)
    })

    it('el borrador se consume una sola vez', () => {
        const id = putCaptureDraft(draft())

        expect(takeCaptureDraft(id)).not.toBeNull()
        // Volver atrás no debe reabrir el formulario precargado.
        expect(takeCaptureDraft(id)).toBeNull()
    })

    it('no deja los datos financieros en sessionStorage tras consumirlo', () => {
        const id = putCaptureDraft(draft())
        takeCaptureDraft(id)

        expect(sessionStorage.length).toBe(0)
    })

    it('devuelve null con un id inexistente o vacío', () => {
        expect(takeCaptureDraft('no-existe')).toBeNull()
        expect(takeCaptureDraft(null)).toBeNull()
        expect(takeCaptureDraft(undefined)).toBeNull()
        expect(takeCaptureDraft('')).toBeNull()
    })

    it('descarta un sobre vencido', () => {
        const envelope = draft()
        envelope.expiresAt = new Date(Date.now() - 1000).toISOString()
        sessionStorage.setItem(`finp:capture-draft:${envelope.draftId}`, JSON.stringify(envelope))

        expect(takeCaptureDraft(envelope.draftId)).toBeNull()
    })

    it('descarta un sobre de otra versión', () => {
        const envelope = draft()
        const stored = { ...envelope, version: CAPTURE_DRAFT_VERSION + 1 }
        sessionStorage.setItem(`finp:capture-draft:${envelope.draftId}`, JSON.stringify(stored))

        expect(takeCaptureDraft(envelope.draftId)).toBeNull()
    })

    it('descarta un sobre corrupto sin romper', () => {
        sessionStorage.setItem('finp:capture-draft:roto', '{no es json')

        expect(takeCaptureDraft('roto')).toBeNull()
    })

    it('descarta un sobre sin campos', () => {
        const envelope = draft()
        sessionStorage.setItem(
            `finp:capture-draft:${envelope.draftId}`,
            JSON.stringify({ ...envelope, fields: null })
        )

        expect(takeCaptureDraft(envelope.draftId)).toBeNull()
    })
})

describe('pruneExpiredCaptureDrafts', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    it('borra los vencidos y conserva los vigentes', () => {
        const vigente = draft()
        putCaptureDraft(vigente)

        const vencido = draft()
        vencido.expiresAt = new Date(Date.now() - 1000).toISOString()
        sessionStorage.setItem(`finp:capture-draft:${vencido.draftId}`, JSON.stringify(vencido))

        pruneExpiredCaptureDrafts()

        expect(takeCaptureDraft(vigente.draftId)).not.toBeNull()
        expect(sessionStorage.getItem(`finp:capture-draft:${vencido.draftId}`)).toBeNull()
    })

    it('no toca otras claves de la app', () => {
        sessionStorage.setItem('finp-otra-cosa', 'valor')

        pruneExpiredCaptureDrafts()

        expect(sessionStorage.getItem('finp-otra-cosa')).toBe('valor')
    })
})

describe('resguardos de entorno', () => {
    it('no rompe si sessionStorage no está disponible', () => {
        const original = window.sessionStorage
        Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            get() {
                throw new Error('bloqueado')
            },
        })

        const envelope = draft()
        // Devuelve el id igual, así la derivación no se cae: el destino abre vacío.
        expect(() => putCaptureDraft(envelope)).not.toThrow()
        expect(takeCaptureDraft(envelope.draftId)).toBeNull()
        expect(() => pruneExpiredCaptureDrafts()).not.toThrow()

        Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            value: original,
        })
    })
})

describe('privacidad del transporte', () => {
    it('el id no contiene ningún dato del movimiento', () => {
        const opaqueDraftId = '11111111-1111-4111-8111-111111111111'
        const randomUuid = vi
            .spyOn(globalThis.crypto, 'randomUUID')
            .mockReturnValue(opaqueDraftId)

        try {
            const envelope = draft({ description: 'Alquiler secreto', amount: 999_999 })

            // Es lo único que va a viajar en la URL y proviene de una fuente
            // opaca, independiente de los datos financieros del movimiento.
            expect(envelope.draftId).toBe(opaqueDraftId)
            expect(randomUuid).toHaveBeenCalledOnce()
            expect(vi.isMockFunction(putCaptureDraft)).toBe(false)
        } finally {
            randomUuid.mockRestore()
        }
    })
})
