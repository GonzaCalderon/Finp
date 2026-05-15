import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceCategory, SpaceEntry, SpaceEntryPersonalImpact } from '@/lib/models'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { syncSpaceDebtsForActiveParticipants } from '@/lib/server/debt-sync'
import { getPersonalImpactForEntries, markLinkedImpactsAsNeedsReview } from '@/lib/server/space-personal-impact'
import { buildReviewNotification, safeUpsertNotificationByDedupeKey } from '@/lib/server/notifications'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spaceEntryEditSchema } from '@/lib/validations'
import { calculateReportingAmount, extractId } from '@/lib/utils/spaces'
import { SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import type { ISpace, ISpaceEntry, ISpaceEntrySnapshot } from '@/types'

type Params = Promise<{ id: string; entryId: string }>

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

function detectSpaceEntryMaterialChanges(
    old: ISpaceEntry,
    data: ReturnType<typeof spaceEntryEditSchema.parse>
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
        const sortKey = (a: { participantId: string; percentage?: number; amount?: number }) => a.participantId
        const oldAlloc = JSON.stringify((old.splitAllocations ?? []).map((a) => ({ participantId: extractId(a.participantId) ?? '', percentage: a.percentage, amount: a.amount })).sort((a, b) => sortKey(a).localeCompare(sortKey(b))))
        const newAlloc = JSON.stringify([...data.splitAllocations].sort((a, b) => a.participantId.localeCompare(b.participantId)))
        if (oldAlloc !== newAlloc) changedFields.push('splitAllocations')
    }

    const changedLabels = changedFields.map((f) => MATERIAL_FIELD_LABELS[f] ?? f)
    return { isMaterial: changedFields.length > 0, changedFields, changedLabels }
}

export async function GET(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId } = await params

        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id })
            .populate('categoryId', 'name color type')
            .populate('spaceCategoryId', 'name color type isArchived')
            .lean<ISpaceEntry | null>()

        if (!entry) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        // Detectar settlements posteriores para warning pre-acción (edit / void)
        const [laterSettlements, allLinkedImpacts, currentUserReviewImpact, personalImpactsByEntryId] = await Promise.all([
            SpaceEntry.countDocuments({
                spaceId: id,
                type: 'settlement',
                isVoided: { $ne: true },
                status: { $nin: ['rejected', 'pending_confirmation'] },
                createdAt: { $gt: entry.createdAt },
            }),
            SpaceEntryPersonalImpact.find({
                entryId,
                status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
            }).lean(),
            SpaceEntryPersonalImpact.findOne({
                entryId,
                userId: new Types.ObjectId(session.user.id),
                status: SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
            }).lean(),
            getPersonalImpactForEntries(id, session.user.id, [entryId], [entry], context.participants),
        ])

        const currentUserHasLinkedImpact = Boolean(personalImpactsByEntryId[entryId]?.linkedImpact)

        return NextResponse.json({
            entry,
            hasLinkedTransaction: currentUserHasLinkedImpact,
            hasSubsequentSettlement: laterSettlements > 0,
            linkedImpactsCount: allLinkedImpacts.length,
            affectedUsersCount: allLinkedImpacts.length,
            currentUserHasLinkedImpact,
            currentUserNeedsReview: Boolean(currentUserReviewImpact),
        })
    } catch (error) {
        console.error('Error al obtener movimiento:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId } = await params

        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        const body = await request.json()
        const parsed = spaceEntryEditSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id }).lean<ISpaceEntry | null>()

        if (!entry) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        if (entry.isVoided) {
            return NextResponse.json({ error: 'No se puede editar un movimiento anulado' }, { status: 409 })
        }

        // Verificar permisos: creador, owner o admin
        const currentParticipant = context.currentParticipant
        const isCreator = extractId(entry.createdByUserId) === session.user.id
        const isPrivileged = currentParticipant?.role === 'owner' || currentParticipant?.role === 'admin'

        if (!isCreator && !isPrivileged) {
            return NextResponse.json({ error: 'No tenés permiso para editar este movimiento' }, { status: 403 })
        }

        const data = parsed.data
        const space = context.space as ISpace

        // Validar moneda contra el espacio
        if (data.currency && !space.currencies.includes(data.currency as typeof space.currencies[number])) {
            return NextResponse.json({ error: 'La moneda no está habilitada en este espacio.' }, { status: 400 })
        }

        const effectiveCurrency = data.currency ?? entry.currency
        const effectiveAmount = data.amount ?? entry.amount
        const effectiveExchangeRate = data.exchangeRate ?? entry.exchangeRate

        // Si la moneda difiere del reporte, se requiere exchangeRate
        if (effectiveCurrency !== space.reportingCurrency && !effectiveExchangeRate) {
            return NextResponse.json(
                { error: 'Ingresá una cotización para convertir el movimiento a la moneda de reporte.' },
                { status: 400 }
            )
        }

        // Validar participantes del split
        const participantsById = new Map(
            context.participants.map((p) => [extractId(p._id) ?? '', p])
        )

        if (data.paidByParticipantId && !participantsById.has(data.paidByParticipantId)) {
            return NextResponse.json({ error: 'El participante pagador no es válido.' }, { status: 400 })
        }

        const invalidShared = (data.sharedWithParticipantIds ?? []).find((pid) => !participantsById.has(pid))
        if (invalidShared) {
            return NextResponse.json({ error: 'El split incluye participantes inválidos.' }, { status: 400 })
        }

        const invalidAllocation = (data.splitAllocations ?? []).find((a) => !participantsById.has(a.participantId))
        if (invalidAllocation) {
            return NextResponse.json({ error: 'El split incluye participantes inválidos.' }, { status: 400 })
        }

        // Validar spaceCategoryId
        if (data.spaceCategoryId) {
            const category = await SpaceCategory.findOne({
                _id: data.spaceCategoryId,
                spaceId: id,
                isArchived: false,
            })
            if (!category) {
                return NextResponse.json({ error: 'La categoría seleccionada no es válida.' }, { status: 400 })
            }
        }

        // Detectar settlements posteriores (conservador: por createdAt)
        const laterSettlements = await SpaceEntry.countDocuments({
            spaceId: id,
            type: 'settlement',
            isVoided: { $ne: true },
            status: { $nin: ['rejected', 'pending_confirmation'] },
            createdAt: { $gt: entry.createdAt },
        })
        const hasSubsequentSettlement = laterSettlements > 0

        // Calcular reportingAmount server-side
        const reportingAmount = calculateReportingAmount({
            amount: effectiveAmount,
            currency: effectiveCurrency,
            reportingCurrency: space.reportingCurrency,
            exchangeRate: effectiveExchangeRate,
        })

        // Construir snapshot de la versión actual antes de editar
        const snapshot: ISpaceEntrySnapshot = {
            snapshotAt: new Date(),
            editedByUserId: new Types.ObjectId(session.user.id),
            title: entry.title,
            description: entry.description,
            amount: entry.amount,
            currency: entry.currency,
            reportingAmount: entry.reportingAmount,
            exchangeRate: entry.exchangeRate,
            date: entry.date,
            spaceCategoryId: entry.spaceCategoryId as Types.ObjectId | undefined,
            paidByParticipantId: entry.paidByParticipantId as Types.ObjectId | undefined,
            sharedWithParticipantIds: entry.sharedWithParticipantIds as Types.ObjectId[] | undefined,
            splitMode: entry.splitMode,
            splitAllocations: entry.splitAllocations as ISpaceEntrySnapshot['splitAllocations'],
            notes: entry.notes,
        }

        // Mantener max 5 versiones anteriores (LIFO)
        const existingVersions = (entry.previousVersions ?? []).slice(0, 4)
        const previousVersions = [snapshot, ...existingVersions]

        const updateFields: Record<string, unknown> = {
            editedAt: new Date(),
            editedByUserId: session.user.id,
            editCount: (entry.editCount ?? 0) + 1,
            previousVersions,
        }

        if (data.title !== undefined) updateFields.title = data.title
        if (data.description !== undefined) updateFields.description = data.description
        if (data.amount !== undefined) updateFields.amount = effectiveAmount
        if (data.currency !== undefined) updateFields.currency = effectiveCurrency
        if (data.amount !== undefined || data.currency !== undefined || data.exchangeRate !== undefined) {
            updateFields.reportingAmount = reportingAmount
        }
        if (data.exchangeRate !== undefined) {
            updateFields.exchangeRate = effectiveCurrency !== space.reportingCurrency ? effectiveExchangeRate : undefined
        }
        if (data.date !== undefined) updateFields.date = data.date
        if ('spaceCategoryId' in data) updateFields.spaceCategoryId = data.spaceCategoryId ?? null
        if (data.paidByParticipantId !== undefined) updateFields.paidByParticipantId = data.paidByParticipantId
        if (data.sharedWithParticipantIds !== undefined) updateFields.sharedWithParticipantIds = data.sharedWithParticipantIds
        if (data.splitMode !== undefined) updateFields.splitMode = data.splitMode
        if (data.splitAllocations !== undefined) updateFields.splitAllocations = data.splitAllocations
        if (data.notes !== undefined) updateFields.notes = data.notes

        const updatedEntry = await SpaceEntry.findByIdAndUpdate(
            entryId,
            { $set: updateFields },
            { new: true }
        )
            .populate('categoryId', 'name color type')
            .populate('spaceCategoryId', 'name color type isArchived')
            .lean<ISpaceEntry | null>()

        if (updatedEntry) {
            createSpaceActivityEvent({
                spaceId: id,
                actorUserId: session.user.id,
                actorParticipantId: extractId(context.currentParticipant?._id),
                type: 'entry_edited',
                entityType: 'entry',
                entityId: extractId(updatedEntry._id),
                title: `${context.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} editó ${updatedEntry.title}`,
                description: 'Se modificó un movimiento del espacio.',
                metadata: {
                    entryTitle: updatedEntry.title,
                    amount: updatedEntry.amount,
                    currency: updatedEntry.currency,
                    hasLinkedTransaction: false,
                    hasSubsequentSettlement,
                    previousAmount: entry.amount,
                    nextAmount: updatedEntry.amount,
                    previousDate: entry.date,
                    nextDate: updatedEntry.date,
                    previousPayer: extractId(entry.paidByParticipantId),
                    nextPayer: extractId(updatedEntry.paidByParticipantId),
                },
            }).catch((err) => console.error('[space-activity]', err))
        }

        try {
            await syncSpaceDebtsForActiveParticipants(id)
        } catch (err) {
            console.error('[debt-sync] entries PATCH:', err)
        }

        // Notificar a usuarios con impactos vinculados si hubo cambios materiales
        const { isMaterial, changedFields, changedLabels } = detectSpaceEntryMaterialChanges(entry, data)
        if (isMaterial && updatedEntry) {
            try {
                const affectedImpacts = await markLinkedImpactsAsNeedsReview(entryId, 'entry_edited', changedLabels)
                await Promise.allSettled(
                    affectedImpacts.map((impact) =>
                        safeUpsertNotificationByDedupeKey(
                            buildReviewNotification({
                                recipientUserId: impact.userId.toString(),
                                actorUserId: session.user.id,
                                entryId,
                                spaceId: id,
                                entryTitle: updatedEntry.title,
                                reason: 'entry_edited',
                                impactId: impact._id.toString(),
                                changedFields: changedLabels,
                            })
                        )
                    )
                )
            } catch (err) {
                console.error('[personal-sync] edit review notifications:', err)
            }
        }

        return NextResponse.json({ entry: updatedEntry, hasSubsequentSettlement, materialChange: isMaterial })
    } catch (error) {
        console.error('Error al editar movimiento:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
