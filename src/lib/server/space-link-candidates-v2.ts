import { Types } from 'mongoose'

import { Account, SpaceEntry, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import { getAccessibleSpaceContext, getContextCapabilities } from '@/lib/server/spaces'
import { amountsForImpact } from '@/lib/server/space-personal-impact-service-v2'
import {
    assessLinkCandidateV2,
    expectedLinkTransactionType,
    linkAccountRuleForVariant,
    resolveLinkImpactVariant,
    type LinkRequirementV2,
} from '@/lib/server/space-link-candidate-v2'
import {
    calculateSpaceSharesV2,
    derivePersonalImpactAmountsV2,
    financialDateKeyToInstant,
    type SpaceSplitAllocationV2,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryPersonalImpact, ITransaction } from '@/types'
import type { SpaceSplitMode } from '@/lib/constants'

/**
 * Descubrimiento de candidatos para vincular una transacción personal
 * existente (arquitectura.md §8 «Candidatos de vínculo personal»). Lectura
 * pura: nunca escribe. Comparte `assessLinkCandidateV2` con el `resolve`
 * autoritativo — todo lo que esta ruta devuelve, `resolve` lo acepta.
 */

const MAX_CANDIDATES = 20
/** Margen generoso alrededor del instante representativo del día para acotar
 *  la consulta; el filtro exacto por día financiero lo hace `assessLinkCandidateV2`
 *  en memoria, así que un margen amplio no puede dejar pasar un falso positivo. */
const DAY_QUERY_MARGIN_MS = 24 * 60 * 60 * 1000

export type LinkCandidateDto = {
    transactionId: string
    description: string
    amount: number
    currency: string
    date: string
    accountName?: string
}

export type LinkCandidatesExcludedV2 = {
    alreadyLinked: number
    amountMismatch: number
    operationalMismatch: number
    accountMismatch: number
}

export type LinkCandidatesResultV2 = {
    applicable: boolean
    requirement?: {
        transactionType: ITransaction['type']
        currency: string
        amount: number
    }
    candidates: LinkCandidateDto[]
    excluded: LinkCandidatesExcludedV2
}

async function loadV2Context(spaceId: string, actorUserId: string, capability: 'create_entry' | 'resolve_personal_impact') {
    const context = await getAccessibleSpaceContext(spaceId, actorUserId)
    if (!context) {
        throw new ServiceError(404, 'SPACE_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    }
    if (context.space.contractVersion !== 2) {
        throw new ServiceError(404, 'SPACE_V2_NOT_FOUND', 'El Espacio no existe o todavía no fue migrado.')
    }
    const caps = getContextCapabilities(context)
    if (!caps.has(capability)) {
        throw new ServiceError(403, 'SPACE_CAPABILITY_DENIED', 'No podés ver candidatos en este Espacio.')
    }
    return context
}

function emptyExcluded(): LinkCandidatesExcludedV2 {
    return { alreadyLinked: 0, amountMismatch: 0, operationalMismatch: 0, accountMismatch: 0 }
}

async function listCandidatesForRequirement(input: {
    actorUserId: string
    requirement: LinkRequirementV2
    impactId?: string
}): Promise<{ candidates: LinkCandidateDto[]; excluded: LinkCandidatesExcludedV2 }> {
    const { requirement } = input
    const excluded = emptyExcluded()

    const dateFilter = requirement.dateKey && requirement.timezone
        ? (() => {
            const center = financialDateKeyToInstant(requirement.dateKey!, requirement.timezone!)
            return {
                date: {
                    $gte: new Date(center.getTime() - DAY_QUERY_MARGIN_MS),
                    $lt: new Date(center.getTime() + DAY_QUERY_MARGIN_MS),
                },
            }
        })()
        : {}

    // El tipo esperado admite `credit_card_expense` como equivalente de
    // `expense` (decisión 0012); la consulta trae ambos cuando corresponde
    // para no perder ese candidato legítimo antes de evaluarlo.
    const typeFilter = requirement.transactionType === 'expense'
        ? { type: { $in: ['expense', 'credit_card_expense'] } }
        : { type: requirement.transactionType }

    const candidateDocs = await Transaction.find({
        userId: input.actorUserId,
        currency: requirement.currency,
        status: { $ne: 'voided' },
        ...typeFilter,
        ...dateFilter,
        $or: [
            { spaceImpactId: { $exists: false } },
            ...(input.impactId ? [{ spaceImpactId: new Types.ObjectId(input.impactId) }] : []),
        ],
    })
        .sort({ date: -1 })
        .limit(200)
        .populate('sourceAccountId', 'name')
        .populate('destinationAccountId', 'name')
        .lean<Array<ITransaction & {
            sourceAccountId?: { _id: Types.ObjectId; name: string } | Types.ObjectId
            destinationAccountId?: { _id: Types.ObjectId; name: string } | Types.ObjectId
        }>>()

    const candidates: LinkCandidateDto[] = []
    for (const transaction of candidateDocs) {
        if (candidates.length >= MAX_CANDIDATES) break
        const assessment = assessLinkCandidateV2(transaction, requirement)
        if (assessment.compatible) {
            const account = transaction.sourceAccountId ?? transaction.destinationAccountId
            const accountName = account && typeof account === 'object' && 'name' in account
                ? (account as { name: string }).name
                : undefined
            candidates.push({
                transactionId: transaction._id.toString(),
                description: transaction.description,
                amount: transaction.amount,
                currency: transaction.currency,
                date: transaction.date.toISOString(),
                accountName,
            })
            continue
        }
        for (const issue of assessment.issues) {
            if (issue === 'amount_mismatch') excluded.amountMismatch += 1
            if (issue === 'operational_mismatch') excluded.operationalMismatch += 1
            if (issue === 'account_mismatch') excluded.accountMismatch += 1
            // type_mismatch, currency_mismatch y date_mismatch ya los filtró la
            // consulta; si aparecieran acá serían un candidato que la consulta
            // no debió traer, y no corresponde contarlos como motivo de la lista.
        }
    }

    // "Ya vinculada" es un universo aparte: mismas condiciones estructurales,
    // pero con spaceImpactId puesto en OTRO impacto. Contarlas exige la misma
    // consulta sin la exclusión de vínculo.
    excluded.alreadyLinked = await Transaction.countDocuments({
        userId: input.actorUserId,
        currency: requirement.currency,
        status: { $ne: 'voided' },
        ...typeFilter,
        ...dateFilter,
        spaceImpactId: { $exists: true, ...(input.impactId ? { $ne: new Types.ObjectId(input.impactId) } : {}) },
    })

    return { candidates, excluded }
}

export async function listLinkCandidatesForNewEntryV2(input: {
    actorUserId: string
    spaceId: string
    amount: number
    currency: string
    paidByParticipantId: string
    sharedWithParticipantIds: string[]
    splitMode: SpaceSplitMode
    splitAllocations?: SpaceSplitAllocationV2[]
    dateKey: string
    timezone: string
}): Promise<LinkCandidatesResultV2> {
    const context = await loadV2Context(input.spaceId, input.actorUserId, 'create_entry')
    const currentParticipantId = extractId(context.currentParticipant?._id)
    if (!currentParticipantId) {
        throw new ServiceError(404, 'SPACE_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    }
    const shares = calculateSpaceSharesV2({
        amount: input.amount,
        reportingAmount: input.amount,
        currency: input.currency,
        reportingCurrency: context.space.reportingCurrency,
        splitMode: input.splitMode,
        participantIds: input.sharedWithParticipantIds,
        allocations: input.splitAllocations,
    })
    const ownShare = shares.find((share) => share.participantId === currentParticipantId)
    const amounts = derivePersonalImpactAmountsV2({
        entryType: 'expense',
        entryAmount: input.amount,
        ownShareAmount: ownShare?.amount ?? 0,
        currency: input.currency,
        isPayer: input.paidByParticipantId === currentParticipantId,
    })
    if (amounts.action === 'none') {
        return { applicable: false, candidates: [], excluded: emptyExcluded() }
    }
    const variant = resolveLinkImpactVariant({
        kind: amounts.kind,
        isPayer: input.paidByParticipantId === currentParticipantId,
    })
    const requirement: LinkRequirementV2 = {
        transactionType: expectedLinkTransactionType(variant),
        currency: input.currency,
        amount: amounts.accountImpactAmount || amounts.ownShareAmount,
        operationalAmount: amounts.operationalAmount,
        accountRule: linkAccountRuleForVariant(variant),
        dateKey: input.dateKey,
        timezone: input.timezone,
    }
    const { candidates, excluded } = await listCandidatesForRequirement({
        actorUserId: input.actorUserId,
        requirement,
    })
    return {
        applicable: true,
        requirement: {
            transactionType: requirement.transactionType,
            currency: requirement.currency,
            amount: requirement.amount,
        },
        candidates,
        excluded,
    }
}

export async function listLinkCandidatesForImpactV2(input: {
    actorUserId: string
    spaceId: string
    entryId: string
    impactId: string
}): Promise<LinkCandidatesResultV2> {
    await loadV2Context(input.spaceId, input.actorUserId, 'resolve_personal_impact')
    const [entry, impact] = await Promise.all([
        SpaceEntry.findOne({
            _id: input.entryId,
            spaceId: input.spaceId,
            contractVersion: 2,
        }).lean<ISpaceEntry | null>(),
        SpaceEntryPersonalImpact.findOne({
            _id: input.impactId,
            entryId: input.entryId,
            spaceId: input.spaceId,
            userId: input.actorUserId,
            contractVersion: 2,
        }).lean<ISpaceEntryPersonalImpact | null>(),
    ])
    if (!entry || !impact) {
        throw new ServiceError(404, 'SPACE_PERSONAL_IMPACT_NOT_FOUND', 'El impacto personal no existe.')
    }
    const amounts = amountsForImpact(entry, impact)
    if (amounts.action === 'none') {
        return { applicable: false, candidates: [], excluded: emptyExcluded() }
    }
    if (!entry.timezone || !entry.dateKey) {
        return { applicable: false, candidates: [], excluded: emptyExcluded() }
    }
    const isPayer = extractId(entry.paidByParticipantId) === impact.participantId.toString()
    const variant = resolveLinkImpactVariant({ kind: amounts.kind, isPayer })
    const requirement: LinkRequirementV2 = {
        transactionType: expectedLinkTransactionType(variant),
        currency: entry.currency,
        amount: amounts.accountImpactAmount > 0 ? amounts.accountImpactAmount : amounts.ownShareAmount,
        operationalAmount: amounts.operationalAmount,
        accountRule: linkAccountRuleForVariant(variant),
        dateKey: entry.dateKey,
        timezone: entry.timezone,
    }
    const { candidates, excluded } = await listCandidatesForRequirement({
        actorUserId: input.actorUserId,
        requirement,
        impactId: input.impactId,
    })
    return {
        applicable: true,
        requirement: {
            transactionType: requirement.transactionType,
            currency: requirement.currency,
            amount: requirement.amount,
        },
        candidates,
        excluded,
    }
}

// Referencia explícita para que el modelo Account quede registrado antes del
// `populate`; Mongoose lo resuelve por nombre de colección, pero importar el
// modelo asegura que esté registrado en este punto de entrada.
void Account
