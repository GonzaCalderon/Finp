import {
    SPACE_AUDIT_SEVERITIES,
    SPACE_LEGACY_AUDIT_SCHEMA_VERSION,
    type SpaceAuditBundle,
    type SpaceAuditFinding,
    type SpaceAuditGlobalOrphan,
    type SpaceAuditResult,
    type SpaceAuditSeverity,
} from '@/lib/server/audits/space-legacy-audit-contract'
import { groupAuditItemsBy as groupBy } from '@/lib/server/audits/space-legacy-audit-calculations'
import {
    auditEntries,
    auditParticipants,
} from '@/lib/server/audits/space-legacy-audit-core-detectors'
import {
    auditDebts,
    auditImpacts,
    auditTracking,
} from '@/lib/server/audits/space-legacy-audit-related-detectors'

export {
    SPACE_AUDIT_SEVERITIES,
    SPACE_LEGACY_AUDIT_SCHEMA_VERSION,
} from '@/lib/server/audits/space-legacy-audit-contract'
export type {
    AuditDocument,
    SpaceAuditBundle,
    SpaceAuditFinding,
    SpaceAuditGlobalOrphan,
    SpaceAuditResult,
    SpaceAuditSeverity,
} from '@/lib/server/audits/space-legacy-audit-contract'

export function sortSpaceAuditFindings(findings: SpaceAuditFinding[]) {
    const order = new Map(SPACE_AUDIT_SEVERITIES.map((severity, index) => [severity, index]))
    return [...findings].sort((left, right) =>
        (order.get(left.severity) ?? 99) - (order.get(right.severity) ?? 99) ||
        left.code.localeCompare(right.code) ||
        left.collection.localeCompare(right.collection) ||
        left.recordIds.join(':').localeCompare(right.recordIds.join(':'))
    )
}

export function auditSpaceBundle(bundle: SpaceAuditBundle) {
    const findings: SpaceAuditFinding[] = []
    auditParticipants(bundle, findings)
    auditEntries(bundle, findings)
    auditImpacts(bundle, findings)
    auditDebts(bundle, findings)
    auditTracking(bundle, findings)
    return sortSpaceAuditFindings(findings)
}

export function buildSpaceAuditResult(
    findings: SpaceAuditFinding[],
    spacesAudited: number
): SpaceAuditResult {
    const sorted = sortSpaceAuditFindings(findings)
    const countsBySeverity = Object.fromEntries(
        SPACE_AUDIT_SEVERITIES.map((severity) => [
            severity,
            sorted.filter((finding) => finding.severity === severity).length,
        ])
    ) as Record<SpaceAuditSeverity, number>
    const countsByCode = Object.fromEntries(
        Array.from(groupBy(sorted, (finding) => finding.code))
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([code, items]) => [code, items.length])
    )

    return {
        schemaVersion: SPACE_LEGACY_AUDIT_SCHEMA_VERSION,
        findings: sorted,
        countsBySeverity,
        countsByCode,
        migrationReadiness: {
            spacesAudited,
            findings: sorted.length,
            critical: countsBySeverity.critical,
            high: countsBySeverity.high,
            readyForAutomaticMigration:
                countsBySeverity.critical === 0 && countsBySeverity.high === 0,
        },
    }
}

export function findingsFromGlobalOrphans(orphans: SpaceAuditGlobalOrphan[]) {
    return orphans.map<SpaceAuditFinding>((orphan) => ({
        code: 'SPACE_GLOBAL_ORPHAN',
        severity: 'critical',
        collection: orphan.collection,
        recordIds: [orphan.recordId],
        relatedIds: orphan.relatedId ? [orphan.relatedId] : [],
        targetInvariant: `La relación ${orphan.relation} referencia un documento existente.`,
        evidence: { relation: orphan.relation },
    }))
}
