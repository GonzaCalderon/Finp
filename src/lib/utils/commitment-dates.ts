import { parseFinancialPeriod } from '@/lib/utils/period'

export type CommitmentRecurrence = 'monthly' | 'weekly' | 'once'

export interface CommitmentDateInput {
    recurrence: CommitmentRecurrence | string
    startDate?: Date | string
    endDate?: Date | string
    dueDate?: Date | string
    dayOfMonth?: number
}

function validDate(value: Date | string | undefined): Date | null {
    if (!value) return null
    const parsed = value instanceof Date ? new Date(value) : new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return startOfDay(parsed)
}

export function startOfDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function resolveDayInMonth(
    year: number,
    month: number,
    dayOfMonth: number
): Date {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(Math.max(dayOfMonth, 1), lastDay))
}

function isWithinCommitmentRange(
    occurrence: Date,
    startDate: Date | null,
    endDate: Date | null
): boolean {
    if (startDate && occurrence < startDate) return false
    if (endDate && occurrence > endDate) return false
    return true
}

function monthlyOccurrencesBetween(
    input: CommitmentDateInput,
    rangeStart: Date,
    rangeEnd: Date
): Date[] {
    const startDate = validDate(input.startDate)
    const endDate = validDate(input.endDate)
    const dayOfMonth = input.dayOfMonth ?? startDate?.getDate()
    if (!dayOfMonth) return []
    const occurrences: Date[] = []
    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const finalMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)

    while (cursor <= finalMonth) {
        const occurrence = resolveDayInMonth(
            cursor.getFullYear(),
            cursor.getMonth(),
            dayOfMonth
        )
        if (
            occurrence >= rangeStart &&
            occurrence < rangeEnd &&
            isWithinCommitmentRange(occurrence, startDate, endDate)
        ) {
            occurrences.push(occurrence)
        }
        cursor.setMonth(cursor.getMonth() + 1)
    }

    return occurrences
}

function weeklyOccurrencesBetween(
    input: CommitmentDateInput,
    rangeStart: Date,
    rangeEnd: Date
): Date[] {
    const startDate = validDate(input.startDate)
    if (!startDate) return []
    const endDate = validDate(input.endDate)
    const cursor = new Date(startDate)

    if (cursor < rangeStart) {
        const elapsedDays = Math.floor(
            (rangeStart.getTime() - cursor.getTime()) / (24 * 60 * 60 * 1000)
        )
        cursor.setDate(cursor.getDate() + Math.floor(elapsedDays / 7) * 7)
        while (cursor < rangeStart) cursor.setDate(cursor.getDate() + 7)
    }

    const occurrences: Date[] = []
    while (cursor < rangeEnd) {
        if (endDate && cursor > endDate) break
        occurrences.push(new Date(cursor))
        cursor.setDate(cursor.getDate() + 7)
    }
    return occurrences
}

export function resolveCommitmentOccurrencesInRange(
    input: CommitmentDateInput,
    rangeStartValue: Date,
    rangeEndValue: Date
): Date[] {
    const rangeStart = startOfDay(rangeStartValue)
    const rangeEnd = startOfDay(rangeEndValue)
    if (rangeEnd <= rangeStart) return []

    if (input.recurrence === 'monthly') {
        return monthlyOccurrencesBetween(input, rangeStart, rangeEnd)
    }

    if (input.recurrence === 'weekly') {
        return weeklyOccurrencesBetween(input, rangeStart, rangeEnd)
    }

    const occurrence = validDate(input.dueDate) ?? validDate(input.startDate)
    const endDate = validDate(input.endDate)
    if (
        !occurrence ||
        occurrence < rangeStart ||
        occurrence >= rangeEnd ||
        (endDate && occurrence > endDate)
    ) {
        return []
    }
    return [occurrence]
}

export function resolveCommitmentOccurrenceForPeriod(
    input: CommitmentDateInput,
    period: string,
    monthStartDay = 1
): Date | null {
    const { start, end } = parseFinancialPeriod(period, monthStartDay)
    return resolveCommitmentOccurrencesInRange(input, start, end)[0] ?? null
}

export function resolveNextCommitmentOccurrence(
    input: CommitmentDateInput,
    fromValue = new Date()
): Date | null {
    const from = startOfDay(fromValue)
    const startDate = validDate(input.startDate)
    const searchFrom = startDate && startDate > from ? startDate : from

    if (input.recurrence === 'once') {
        const occurrence = validDate(input.dueDate) ?? startDate
        const endDate = validDate(input.endDate)
        if (
            !occurrence ||
            occurrence < searchFrom ||
            (endDate && occurrence > endDate)
        ) {
            return null
        }
        return occurrence
    }

    if (input.recurrence === 'weekly') {
        const rangeEnd = new Date(searchFrom)
        rangeEnd.setFullYear(rangeEnd.getFullYear() + 2)
        return weeklyOccurrencesBetween(input, searchFrom, rangeEnd)[0] ?? null
    }

    const dayOfMonth = input.dayOfMonth ?? startDate?.getDate()
    if (!dayOfMonth) return null
    const endDate = validDate(input.endDate)
    const cursor = new Date(searchFrom.getFullYear(), searchFrom.getMonth(), 1)

    for (let offset = 0; offset < 240; offset += 1) {
        const occurrence = resolveDayInMonth(
            cursor.getFullYear(),
            cursor.getMonth(),
            dayOfMonth
        )
        if (
            occurrence >= searchFrom &&
            isWithinCommitmentRange(occurrence, startDate, endDate)
        ) {
            return occurrence
        }
        if (endDate && cursor > endDate) return null
        cursor.setMonth(cursor.getMonth() + 1)
    }

    return null
}

export function resolveCommitmentReminderDate(args: {
    dueDate: Date
    reminderLeadDays: number
    startDate?: Date | string
}): Date {
    const dueDate = startOfDay(args.dueDate)
    const reminderDate = new Date(dueDate)
    reminderDate.setDate(reminderDate.getDate() - args.reminderLeadDays)

    const startDate = validDate(args.startDate)
    if (startDate && reminderDate < startDate) return startDate
    return reminderDate
}
