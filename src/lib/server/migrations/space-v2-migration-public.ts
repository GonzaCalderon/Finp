import type { ISpace, SpaceDetailDto } from '@/types'

export function getSpaceMigrationPublicStatus(
    space: Pick<ISpace, 'contractVersion' | 'migration'>,
    readMode: SpaceDetailDto['readMode']
): SpaceDetailDto['migration'] {
    if (space.contractVersion === 2 && space.migration?.state === 'migrated') {
        return { state: 'migrated', readOnly: false, reason: 'migration_verified' }
    }
    if (space.migration?.state === 'blocked' || readMode === 'legacy_incompatible') {
        return { state: 'blocked', readOnly: true, reason: 'manual_review_required' }
    }
    if (space.migration?.state === 'ready') return { state: 'ready', readOnly: false }
    return { state: 'legacy', readOnly: false, reason: 'legacy_not_migrated' }
}
