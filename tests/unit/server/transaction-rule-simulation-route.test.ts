import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    TransactionRule: {
        find: vi.fn(),
    },
    sort: vi.fn(),
    lean: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    TransactionRule: mocks.TransactionRule,
}))

const { POST } = await import('@/app/api/transaction-rules/simulate/route')

function makeRequest(body: unknown) {
    return new Request('https://finp.test/api/transaction-rules/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

function makeExistingRule(overrides: Record<string, unknown> = {}) {
    return {
        _id: { toString: () => 'existing-rule' },
        userId: { toString: () => 'user-1' },
        name: 'Café existente',
        isActive: true,
        priority: 20,
        appliesTo: 'expense',
        field: 'description',
        condition: 'contains',
        value: 'cafe',
        categoryId: { toString: () => 'existing-category' },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        ...overrides,
    }
}

const validBody = {
    rule: {
        name: 'Café nuevo',
        isActive: true,
        priority: 10,
        appliesTo: 'expense',
        field: 'description',
        condition: 'contains',
        value: 'café',
        categoryId: 'candidate-category',
    },
    sample: {
        type: 'expense',
        description: 'PAGO EN CAFÉ ref 123456',
    },
}

describe('POST /api/transaction-rules/simulate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.lean.mockResolvedValue([makeExistingRule()])
        mocks.sort.mockReturnValue({ lean: mocks.lean })
        mocks.TransactionRule.find.mockReturnValue({ sort: mocks.sort })
    })

    it('requires authentication and does not query rules', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await POST(makeRequest(validBody))

        expect(response.status).toBe(401)
        expect(mocks.TransactionRule.find).not.toHaveBeenCalled()
    })

    it('rejects an empty sample', async () => {
        const response = await POST(makeRequest({
            ...validBody,
            sample: { type: 'expense' },
        }))

        expect(response.status).toBe(400)
        expect(mocks.TransactionRule.find).not.toHaveBeenCalled()
    })

    it('returns normalized matches, winner, actions and conflicts without mutations', async () => {
        const response = await POST(makeRequest(validBody))
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(mocks.TransactionRule.find).toHaveBeenCalledWith({
            userId: 'user-1',
        })
        expect(mocks.sort).toHaveBeenCalledWith({
            priority: -1,
            createdAt: -1,
        })
        expect(body.normalizedSample.description).toBe('cafe')
        expect(body.candidateMatches).toBe(true)
        expect(body.matchedRules).toHaveLength(2)
        expect(body.winner).toMatchObject({
            id: 'existing-rule',
            name: 'Café existente',
            isCandidate: false,
            actions: {
                appliedActions: {
                    categoryId: 'existing-category',
                },
            },
        })
        expect(body.conflicts).toEqual([
            expect.objectContaining({
                ruleId: 'existing-rule',
                kind: 'contradictory_actions',
                priorityRelation: 'existing_wins',
            }),
        ])
    })

    it('replaces the edited rule in-memory without duplicating it', async () => {
        mocks.lean.mockResolvedValue([
            makeExistingRule({
                _id: { toString: () => 'rule-being-edited' },
                priority: 10,
            }),
        ])

        const response = await POST(makeRequest({
            ...validBody,
            editingRuleId: 'rule-being-edited',
        }))
        const body = await response.json()

        expect(mocks.TransactionRule.find).toHaveBeenCalledWith({
            userId: 'user-1',
        })
        expect(body.matchedRules).toHaveLength(1)
        expect(body.matchedRules[0].id).toBe('rule-being-edited')
    })
})
