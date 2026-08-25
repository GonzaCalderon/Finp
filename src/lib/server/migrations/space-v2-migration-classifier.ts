import type { SpaceAuditFinding, SpaceAuditResult } from '@/lib/server/audits/space-legacy-audit-contract'
import {
    SPACE_V2_MIGRATION_VERSION,
    type MigrationDisposition,
    type MigrationIssue,
    type MigrationPlan,
    type MigrationResolutionAction,
} from '@/lib/server/migrations/space-v2-migration-contract'
import {
    combineMigrationFingerprints,
    migrationFingerprint,
} from '@/lib/server/migrations/space-v2-migration-fingerprint'

const AUTOMATIC_CODES = new Set([
    'SPACE_DEBT_BALANCE_DRIFT',
    'SPACE_DEBT_MATERIALIZATION_MISSING',
    'SPACE_ENTRY_VOID_STATE_CONFLICT',
    'SPACE_PAYER_ZERO_SHARE_ACTION_MISCLASSIFIED',
    'SPACE_PENDING_ACTION_MISSING',
    'SPACE_SETTLEMENT_DOUBLE_APPLIED',
    'SPACE_ENTRY_ACTIVITY_MISSING',
    'SPACE_ENTRY_DATE_KEY_MISSING',
    'SPACE_TIMEZONE_MISSING',
    'SPACE_ENTRY_LEGACY_SHARED_STATE',
])

const REVIEW_CODES = new Set([
    'SPACE_ENTRY_GLOBAL_PERSONAL_LINK',
    'SPACE_PERSONAL_IMPACT_AMOUNT_SEMANTICS_LEGACY',
    'SPACE_PERSONAL_IMPACT_DUPLICATE',
    'SPACE_PERSONAL_IMPACT_TRANSACTION_MISSING',
    'SPACE_PERSONAL_TRANSACTION_ORPHAN',
    'SPACE_PERSONAL_IMPACT_STATE_TIMESTAMP_INVALID',
])

const MANUAL_ACTIONS: Record<string, MigrationResolutionAction> = {
    SPACE_PERSONAL_TRANSACTION_CROSS_USER_OR_ENTRY: 'detach_preserve_personal_transaction',
    SPACE_GLOBAL_ORPHAN: 'retain_legacy_quarantine',
}

export function classifySpaceMigrationFinding(finding: SpaceAuditFinding): {
    disposition: MigrationDisposition
    proposedResolution?: MigrationResolutionAction
} {
    if (AUTOMATIC_CODES.has(finding.code)) return { disposition: 'automatic' }
    if (REVIEW_CODES.has(finding.code)) return { disposition: 'review' }
    if (MANUAL_ACTIONS[finding.code]) {
        return { disposition: 'manual', proposedResolution: MANUAL_ACTIONS[finding.code] }
    }
    if (finding.severity === 'critical' || finding.severity === 'high') {
        return { disposition: 'manual', proposedResolution: 'exclude_space_from_cutover' }
    }
    return { disposition: 'review' }
}

function toIssue(
    finding: SpaceAuditFinding,
    resolveSpaceId: (finding: SpaceAuditFinding) => string | undefined
): MigrationIssue {
    const classification = classifySpaceMigrationFinding(finding)
    return {
        fingerprint: migrationFingerprint({
            code: finding.code,
            severity: finding.severity,
            collection: finding.collection,
            recordIds: [...finding.recordIds].sort(),
            relatedIds: [...finding.relatedIds].sort(),
            targetInvariant: finding.targetInvariant,
        }),
        code: finding.code,
        severity: finding.severity,
        disposition: classification.disposition,
        state: classification.disposition === 'review' ? 'requires_review' : 'planned',
        spaceId: resolveSpaceId(finding),
        collection: finding.collection,
        recordIds: finding.recordIds,
        relatedIds: finding.relatedIds,
        targetInvariant: finding.targetInvariant,
        proposedResolution: classification.proposedResolution,
    }
}

export function buildSpaceV2MigrationPlan(input: {
    runId: string
    audit: SpaceAuditResult
    sourceDatabaseFingerprint: string
    sourceCommit: string
    sourceEnvironment?: 'development' | 'rehearsal'
    createdAt?: Date
    resolveSpaceId?: (finding: SpaceAuditFinding) => string | undefined
}): MigrationPlan {
    const resolveSpaceId = input.resolveSpaceId ?? (() => undefined)
    const issues = input.audit.findings.map((finding) => toIssue(finding, resolveSpaceId))
    const auditFingerprint = combineMigrationFingerprints(issues.map((issue) => issue.fingerprint))
    const criticalOrHigh = issues.filter(
        (issue) => issue.severity === 'critical' || issue.severity === 'high'
    )
    const manual = criticalOrHigh.filter((issue) => issue.disposition === 'manual').length
    const highRiskUnresolved = manual
    return {
        schemaVersion: '1.0.0',
        migrationVersion: SPACE_V2_MIGRATION_VERSION,
        runId: input.runId,
        sourceEnvironment: input.sourceEnvironment ?? 'development',
        sourceDatabaseFingerprint: input.sourceDatabaseFingerprint,
        auditFingerprint,
        createdAt: (input.createdAt ?? new Date()).toISOString(),
        sourceCommit: input.sourceCommit,
        spacesAudited: input.audit.migrationReadiness.spacesAudited,
        counts: {
            findings: issues.length,
            criticalOrHigh: criticalOrHigh.length,
            automatic: criticalOrHigh.filter((issue) => issue.disposition === 'automatic').length,
            review: criticalOrHigh.filter((issue) => issue.disposition === 'review').length,
            manual,
            advisory: issues.length - criticalOrHigh.length,
            blocking: highRiskUnresolved,
        },
        issues,
    }
}

export function buildSafeResolutionTemplate(plan: MigrationPlan) {
    return {
        schemaVersion: '1.0.0' as const,
        runId: plan.runId,
        auditFingerprint: plan.auditFingerprint,
        resolutions: plan.issues
            .filter((issue) => issue.disposition === 'manual' && issue.proposedResolution)
            .map((issue) => ({
                issueFingerprint: issue.fingerprint,
                action: issue.proposedResolution!,
                justification: '',
                approvedBy: '',
                approvedAt: '',
                auditFingerprint: plan.auditFingerprint,
            })),
    }
}
