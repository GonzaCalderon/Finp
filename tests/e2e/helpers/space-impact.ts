export const SPACE_IMPACT_ACCOUNT_NAME = 'Efectivo'

export const SPACE_IMPACT_FIXTURES = {
    chromium: {
        spaceId: '730000000000000000000001',
        participantId: '730000000000000000000002',
        normalEntryId: '730000000000000000000003',
        normalImpactId: '730000000000000000000004',
        normalTransactionId: '730000000000000000000005',
        orphanEntryId: '730000000000000000000006',
        orphanTransactionId: '730000000000000000000007',
        spaceName: 'Espacio E2E desktop',
        normalDescription: 'Impacto normal E2E desktop',
        orphanDescription: 'Impacto huerfano E2E desktop',
    },
    'mobile-chromium': {
        spaceId: '740000000000000000000001',
        participantId: '740000000000000000000002',
        normalEntryId: '740000000000000000000003',
        normalImpactId: '740000000000000000000004',
        normalTransactionId: '740000000000000000000005',
        orphanEntryId: '740000000000000000000006',
        orphanTransactionId: '740000000000000000000007',
        spaceName: 'Espacio E2E mobile',
        normalDescription: 'Impacto normal E2E mobile',
        orphanDescription: 'Impacto huerfano E2E mobile',
    },
    audit: {
        spaceId: '750000000000000000000001',
        participantId: '750000000000000000000002',
        normalEntryId: '750000000000000000000003',
        normalImpactId: '750000000000000000000004',
        normalTransactionId: '750000000000000000000005',
        orphanEntryId: '750000000000000000000006',
        orphanTransactionId: '750000000000000000000007',
        spaceName: 'Espacio E2E auditoría',
        normalDescription: 'Impacto normal E2E auditoría',
        orphanDescription: 'Impacto huerfano E2E auditoría persistente',
    },
} as const

export function getSpaceImpactFixture(projectName: string) {
    if (projectName === 'mobile-chromium') {
        return SPACE_IMPACT_FIXTURES['mobile-chromium']
    }
    return SPACE_IMPACT_FIXTURES.chromium
}
