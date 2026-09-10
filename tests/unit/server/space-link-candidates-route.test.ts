import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    listLinkCandidatesForNewEntryV2: vi.fn(),
    listLinkCandidatesForImpactV2: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/server/space-link-candidates-v2', () => ({
    listLinkCandidatesForNewEntryV2: mocks.listLinkCandidatesForNewEntryV2,
    listLinkCandidatesForImpactV2: mocks.listLinkCandidatesForImpactV2,
}))

const { POST } = await import('@/app/api/spaces/[id]/link-candidates/route')

const spaceId = '64b000000000000000000001'

function request(body: unknown) {
    return new Request(`https://finp.test/api/spaces/${spaceId}/link-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

function params() {
    return { params: Promise.resolve({ id: spaceId }) }
}

const validPreviewBody = {
    mode: 'preview',
    amount: 1000,
    currency: 'ARS',
    paidByParticipantId: 'participant-1',
    sharedWithParticipantIds: ['participant-1', 'participant-2'],
    splitMode: 'equal',
    dateKey: '2026-09-10',
    timezone: 'America/Argentina/Buenos_Aires',
}

const validImpactBody = {
    mode: 'impact',
    entryId: '64b000000000000000000002',
    impactId: '64b000000000000000000003',
}

describe('POST /api/spaces/[id]/link-candidates', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
    })

    it('exige sesión', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await POST(request(validPreviewBody), params())

        expect(response.status).toBe(401)
        expect(mocks.listLinkCandidatesForNewEntryV2).not.toHaveBeenCalled()
    })

    it('rechaza un cuerpo sin mode válido', async () => {
        const response = await POST(request({ amount: 1000 }), params())

        expect(response.status).toBe(400)
        const body = await response.json()
        expect(body.code).toBe('SPACE_LINK_CANDIDATES_INVALID')
    })

    it('rechaza dateKey con formato inválido en modo preview', async () => {
        const response = await POST(
            request({ ...validPreviewBody, dateKey: '10-09-2026' }),
            params()
        )

        expect(response.status).toBe(400)
    })

    it('despacha el modo preview al servicio de alta con el actor de la sesión', async () => {
        mocks.listLinkCandidatesForNewEntryV2.mockResolvedValue({
            applicable: true,
            requirement: { transactionType: 'expense', currency: 'ARS', amount: 500 },
            candidates: [],
            excluded: { alreadyLinked: 0, amountMismatch: 0, operationalMismatch: 0, accountMismatch: 0 },
        })

        const response = await POST(request(validPreviewBody), params())

        expect(response.status).toBe(200)
        expect(mocks.listLinkCandidatesForNewEntryV2).toHaveBeenCalledWith(
            expect.objectContaining({ actorUserId: 'user-1', spaceId, amount: 1000 })
        )
        expect(mocks.listLinkCandidatesForImpactV2).not.toHaveBeenCalled()
        const body = await response.json()
        expect(body.data.applicable).toBe(true)
    })

    it('despacha el modo impact al servicio de impacto con entryId e impactId', async () => {
        mocks.listLinkCandidatesForImpactV2.mockResolvedValue({
            applicable: true,
            candidates: [],
            excluded: { alreadyLinked: 0, amountMismatch: 0, operationalMismatch: 0, accountMismatch: 0 },
        })

        const response = await POST(request(validImpactBody), params())

        expect(response.status).toBe(200)
        expect(mocks.listLinkCandidatesForImpactV2).toHaveBeenCalledWith({
            actorUserId: 'user-1',
            spaceId,
            entryId: validImpactBody.entryId,
            impactId: validImpactBody.impactId,
        })
        expect(mocks.listLinkCandidatesForNewEntryV2).not.toHaveBeenCalled()
    })

    it('propaga el status y código de un ServiceError del servicio (403 sin capacidad)', async () => {
        const { ServiceError } = await import('@/lib/server/errors')
        mocks.listLinkCandidatesForImpactV2.mockRejectedValue(
            new ServiceError(403, 'SPACE_CAPABILITY_DENIED', 'No podés ver candidatos en este Espacio.')
        )

        const response = await POST(request(validImpactBody), params())

        expect(response.status).toBe(403)
        const body = await response.json()
        expect(body.code).toBe('SPACE_CAPABILITY_DENIED')
    })

    it('propaga 404 cuando el Espacio o el impacto no existen', async () => {
        const { ServiceError } = await import('@/lib/server/errors')
        mocks.listLinkCandidatesForImpactV2.mockRejectedValue(
            new ServiceError(404, 'SPACE_PERSONAL_IMPACT_NOT_FOUND', 'El impacto personal no existe.')
        )

        const response = await POST(request(validImpactBody), params())

        expect(response.status).toBe(404)
    })
})
