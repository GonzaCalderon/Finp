import {
    COMMITMENT_LIFECYCLE_STATUSES,
    COMMITMENT_REMINDER_STATES,
    type CommitmentLifecycleStatus,
    type CommitmentReminderState,
} from '@/lib/constants'
import { resolveCommitmentReminderDate } from '@/lib/utils/commitment-dates'

type CommitmentLifecycleInput = {
    isActive: boolean
    recurrence?: string
    startDate?: Date | string
    endDate?: Date | string
    dueDate?: Date | string
}

function validDate(value: Date | string | undefined): Date | null {
    if (!value) return null
    const date = value instanceof Date ? new Date(value) : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function startOfLocalDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function resolveCommitmentLifecycleStatus(
    commitment: CommitmentLifecycleInput,
    now = new Date()
): CommitmentLifecycleStatus {
    if (!commitment.isActive) return COMMITMENT_LIFECYCLE_STATUSES.INACTIVE

    const today = startOfLocalDay(now)
    const startDate = validDate(commitment.startDate)
    const endDate = validDate(commitment.endDate)

    if (commitment.recurrence === 'once') {
        const occurrence = validDate(commitment.dueDate) ?? startDate
        if (!occurrence) return COMMITMENT_LIFECYCLE_STATUSES.ACTIVE
        const occurrenceDay = startOfLocalDay(occurrence)
        if (occurrenceDay > today) return COMMITMENT_LIFECYCLE_STATUSES.UPCOMING
        if (occurrenceDay < today) return COMMITMENT_LIFECYCLE_STATUSES.EXPIRED
        return COMMITMENT_LIFECYCLE_STATUSES.ENDING_SOON
    }

    if (startDate && startOfLocalDay(startDate) > today) {
        return COMMITMENT_LIFECYCLE_STATUSES.UPCOMING
    }

    if (endDate) {
        const endDay = startOfLocalDay(endDate)
        if (endDay < today) return COMMITMENT_LIFECYCLE_STATUSES.EXPIRED

        const daysRemaining = Math.ceil(
            (endDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        )
        if (daysRemaining <= 30) return COMMITMENT_LIFECYCLE_STATUSES.ENDING_SOON
    }

    return COMMITMENT_LIFECYCLE_STATUSES.ACTIVE
}

export function resolveCommitmentReminder(args: {
    dueDate: Date
    reminderLeadDays?: number
    applied: boolean
    lifecycleStatus: CommitmentLifecycleStatus
    startDate?: Date | string
    now?: Date
}): { reminderDate?: Date; reminderState?: CommitmentReminderState } {
    if (
        args.reminderLeadDays === undefined ||
        args.applied ||
        (args.lifecycleStatus !== COMMITMENT_LIFECYCLE_STATUSES.ACTIVE &&
            args.lifecycleStatus !== COMMITMENT_LIFECYCLE_STATUSES.ENDING_SOON &&
            args.lifecycleStatus !== COMMITMENT_LIFECYCLE_STATUSES.UPCOMING)
    ) {
        return {}
    }

    const today = startOfLocalDay(args.now ?? new Date())
    const dueDate = startOfLocalDay(args.dueDate)
    const reminderDate = resolveCommitmentReminderDate({
        dueDate,
        reminderLeadDays: args.reminderLeadDays,
        startDate: args.startDate,
    })

    if (today > dueDate) {
        return { reminderDate, reminderState: COMMITMENT_REMINDER_STATES.OVERDUE }
    }
    if (today >= reminderDate) {
        return { reminderDate, reminderState: COMMITMENT_REMINDER_STATES.DUE }
    }
    return { reminderDate, reminderState: COMMITMENT_REMINDER_STATES.UPCOMING }
}
