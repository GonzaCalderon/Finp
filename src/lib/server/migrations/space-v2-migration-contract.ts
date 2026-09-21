import type { SpaceAuditSeverity } from '@/lib/server/audits/space-legacy-audit-contract'

export const SPACE_V2_MIGRATION_VERSION = '2.0.0' as const

export type MigrationDisposition = 'automatic' | 'review' | 'manual'
export type MigrationIssueState = 'planned' | 'applied' | 'requires_review' | 'resolved'
export type SpaceMigrationState = 'legacy' | 'blocked' | 'ready' | 'migrated'

export type MigrationResolutionAction =
    | 'detach_preserve_personal_transaction'
    | 'relink_same_user_exact_entry'
    | 'retain_legacy_quarantine'
    | 'exclude_space_from_cutover'

export interface MigrationIssue {
    fingerprint: string
    code: string
    severity: SpaceAuditSeverity
    disposition: MigrationDisposition
    state: MigrationIssueState
    spaceId?: string
    collection: string
    recordIds: string[]
    relatedIds: string[]
    targetInvariant: string
    proposedResolution?: MigrationResolutionAction
}

export interface MigrationPlan {
    schemaVersion: '1.0.0'
    migrationVersion: typeof SPACE_V2_MIGRATION_VERSION
    runId: string
    sourceEnvironment: 'development' | 'rehearsal'
    sourceDatabaseFingerprint: string
    auditFingerprint: string
    createdAt: string
    sourceCommit: string
    spacesAudited: number
    counts: {
        findings: number
        criticalOrHigh: number
        automatic: number
        review: number
        manual: number
        advisory: number
        blocking: number
    }
    issues: MigrationIssue[]
}

export interface MigrationResolution {
    issueFingerprint: string
    action: MigrationResolutionAction
    justification: string
    approvedBy: string
    approvedAt: string
    auditFingerprint: string
}

export interface MigrationResolutionManifest {
    schemaVersion: '1.0.0'
    runId: string
    auditFingerprint: string
    resolutions: MigrationResolution[]
}

export interface MigrationRun {
    runId: string
    migrationVersion: typeof SPACE_V2_MIGRATION_VERSION
    sourceFingerprint: string
    auditFingerprint: string
    planFingerprint: string
    manifestFingerprint: string
    cloneFingerprint: string
    preApplyFingerprint?: string
    preApplyPersonalLedgerFingerprint?: string
    sourceCommit: string
    targetDatabaseName: string
    /** `false` sólo en el cutover in-place autorizado por la decisión 0011. */
    rehearsal: boolean
    status: 'planned' | 'cloned' | 'applying' | 'applied' | 'verified' | 'rolled_back' | 'failed'
    startedAt: Date
    finishedAt?: Date
    counts: {
        spacesPlanned: number
        spacesMigrated: number
        spacesBlocked: number
        documentsBackedUp: number
        documentsInserted: number
        documentsUpdated: number
    }
    errorCode?: string
}

export interface MigrationVerificationResult {
    runId: string
    valid: boolean
    sourceFingerprintMatches: boolean
    replayProducesChanges: boolean
    unresolvedManualIssues: number
    /** Resoluciones aprobadas cuyo efecto no está presente en la base. */
    unappliedResolutions: number
    unapprovedCriticalOrHigh: number
    spaces: Array<{
        spaceId: string
        state: SpaceMigrationState
        balancesMatch: boolean
        debtsMatch: boolean
        personalLedgerUnchanged: boolean
        crossUserLinks: number
    }>
    elapsedMs: number
}
