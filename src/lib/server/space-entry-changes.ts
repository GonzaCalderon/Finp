import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry } from '@/types'

export interface SpaceEntryMaterialChangeInput {
    amount?: number
    currency?: string
    exchangeRate?: number
    date?: Date | string
    paidByParticipantId?: string
    sharedWithParticipantIds?: string[]
    splitMode?: string
    splitAllocations?: Array<{
        participantId: string
        percentage?: number
        amount?: number
    }>
}

const MATERIAL_FIELD_LABELS: Record<string, string> = {
    amount: 'monto',
    currency: 'moneda',
    exchangeRate: 'cotización',
    date: 'fecha',
    paidByParticipantId: 'pagador',
    sharedWithParticipantIds: 'participantes',
    splitMode: 'modo de división',
    splitAllocations: 'división',
}

export function detectSpaceEntryMaterialChanges(
    old: ISpaceEntry,
    data: SpaceEntryMaterialChangeInput
): { isMaterial: boolean; changedFields: string[]; changedLabels: string[] } {
    const changedFields: string[] = []

    if (data.amount !== undefined && data.amount !== old.amount) changedFields.push('amount')
    if (data.currency !== undefined && data.currency !== old.currency) changedFields.push('currency')
    if (data.exchangeRate !== undefined && data.exchangeRate !== old.exchangeRate) changedFields.push('exchangeRate')
    if (data.date !== undefined && new Date(data.date).getTime() !== new Date(old.date).getTime()) changedFields.push('date')
    if (data.paidByParticipantId !== undefined && data.paidByParticipantId !== extractId(old.paidByParticipantId)) changedFields.push('paidByParticipantId')
    if (data.splitMode !== undefined && data.splitMode !== old.splitMode) changedFields.push('splitMode')

    if (data.sharedWithParticipantIds !== undefined) {
        const oldIds = (old.sharedWithParticipantIds ?? []).map((pid) => extractId(pid) ?? '').sort()
        const newIds = [...data.sharedWithParticipantIds].sort()
        if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) changedFields.push('sharedWithParticipantIds')
    }

    if (data.splitAllocations !== undefined) {
        const sortKey = (allocation: { participantId: string }) => allocation.participantId
        const oldAlloc = JSON.stringify((old.splitAllocations ?? []).map((allocation) => ({
            participantId: extractId(allocation.participantId) ?? '',
            percentage: allocation.percentage,
            amount: allocation.amount,
        })).sort((a, b) => sortKey(a).localeCompare(sortKey(b))))
        const newAlloc = JSON.stringify([...data.splitAllocations].sort((a, b) => a.participantId.localeCompare(b.participantId)))
        if (oldAlloc !== newAlloc) changedFields.push('splitAllocations')
    }

    const changedLabels = changedFields.map((field) => MATERIAL_FIELD_LABELS[field] ?? field)
    return { isMaterial: changedFields.length > 0, changedFields, changedLabels }
}
