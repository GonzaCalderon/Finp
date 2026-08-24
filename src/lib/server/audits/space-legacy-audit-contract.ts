export const SPACE_LEGACY_AUDIT_SCHEMA_VERSION = '1.0.0'

export const SPACE_AUDIT_SEVERITIES = [
    'critical',
    'high',
    'medium',
    'info',
] as const

export type SpaceAuditSeverity = (typeof SPACE_AUDIT_SEVERITIES)[number]
export type AuditDocument = Record<string, unknown> & { _id?: unknown }

export interface SpaceAuditFinding {
    code: string
    severity: SpaceAuditSeverity
    collection: string
    recordIds: string[]
    relatedIds: string[]
    targetInvariant: string
    evidence: Record<string, string | number | boolean | null>
}

export interface SpaceAuditBundle {
    space: AuditDocument
    participants: AuditDocument[]
    entries: AuditDocument[]
    impacts: AuditDocument[]
    transactions: AuditDocument[]
    debts: AuditDocument[]
    debtMovements: AuditDocument[]
    notifications: AuditDocument[]
    activityEvents: AuditDocument[]
    users: AuditDocument[]
    accounts: AuditDocument[]
}

export interface SpaceAuditGlobalOrphan {
    collection: string
    recordId: string
    relatedId?: string
    relation: string
}

export interface SpaceAuditResult {
    schemaVersion: string
    findings: SpaceAuditFinding[]
    countsBySeverity: Record<SpaceAuditSeverity, number>
    countsByCode: Record<string, number>
    migrationReadiness: {
        spacesAudited: number
        findings: number
        critical: number
        high: number
        readyForAutomaticMigration: boolean
    }
}
