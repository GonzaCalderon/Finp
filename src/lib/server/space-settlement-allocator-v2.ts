import {
    assertMoneyDto,
    convertMoneyExact,
    type ConversionSnapshot,
    type MoneyDto,
} from '@/lib/utils/money'

export interface SettlementComponentInputV2 {
    debtId?: string
    currency: string
    amount: MoneyDto
    order: number
}

export interface SettlementLegInputV2 {
    id: string
    paid: MoneyDto
    conversions?: Array<{
        targetCurrency: string
        snapshot: ConversionSnapshot
        expectedQuoteFingerprint?: string
    }>
}

export interface SettlementApplicationV2 {
    legId: string
    debtId?: string
    debtCurrency: string
    paid: MoneyDto
    applied: MoneyDto
    conversionSnapshot?: ConversionSnapshot
}

function moneyWithUnits(money: MoneyDto, units: bigint): MoneyDto {
    return { ...money, minorUnits: units.toString() }
}

function convertedUnits(source: MoneyDto, units: bigint, targetCurrency: string, snapshot: ConversionSnapshot) {
    return BigInt(convertMoneyExact({
        money: moneyWithUnits(source, units),
        targetCurrency,
        rate: snapshot.rate,
        direction: snapshot.direction,
    }).minorUnits)
}

/** Máximo consumo de origen que no sobrepasa el objetivo después del redondeo. */
function sourceUnitsForTarget(input: {
    source: MoneyDto
    available: bigint
    targetCurrency: string
    targetUnits: bigint
    snapshot: ConversionSnapshot
}) {
    let low = BigInt(0)
    let high = input.available
    while (low < high) {
        const middle = (low + high + BigInt(1)) / BigInt(2)
        const converted = convertedUnits(
            input.source,
            middle,
            input.targetCurrency,
            input.snapshot
        )
        if (converted <= input.targetUnits) low = middle
        else high = middle - BigInt(1)
    }
    return low
}

export function applySettlementLegsV2(input: {
    components: SettlementComponentInputV2[]
    legs: SettlementLegInputV2[]
}) {
    const components = [...input.components]
        .sort((left, right) => left.order - right.order || left.currency.localeCompare(right.currency))
        .map((component) => ({
            ...component,
            amount: assertMoneyDto(component.amount),
            remaining: BigInt(component.amount.minorUnits),
        }))
    if (components.length === 0 || input.legs.length === 0) {
        throw new Error('SPACE_SETTLEMENT_EMPTY')
    }
    if (components.some((component) => component.remaining <= BigInt(0))) {
        throw new Error('SPACE_SETTLEMENT_COMPONENT_INVALID')
    }

    const applications: SettlementApplicationV2[] = []
    const legResults = input.legs.map((leg) => {
        const paid = assertMoneyDto(leg.paid)
        let available = BigInt(paid.minorUnits)
        if (available <= BigInt(0)) throw new Error('SPACE_SETTLEMENT_LEG_INVALID')

        const applyTo = (component: typeof components[number], snapshot?: ConversionSnapshot) => {
            if (available <= BigInt(0) || component.remaining <= BigInt(0)) return
            if (!snapshot) {
                const consumed = available < component.remaining ? available : component.remaining
                applications.push({
                    legId: leg.id,
                    debtId: component.debtId,
                    debtCurrency: component.currency,
                    paid: moneyWithUnits(paid, consumed),
                    applied: moneyWithUnits(component.amount, consumed),
                })
                available -= consumed
                component.remaining -= consumed
                return
            }
            const maximumApplied = convertedUnits(paid, available, component.currency, snapshot)
            if (maximumApplied <= BigInt(0)) return
            const desiredApplied = maximumApplied < component.remaining ? maximumApplied : component.remaining
            const consumed = maximumApplied <= component.remaining
                ? available
                : sourceUnitsForTarget({
                    source: paid,
                    available,
                    targetCurrency: component.currency,
                    targetUnits: desiredApplied,
                    snapshot,
                })
            if (consumed <= BigInt(0)) return
            const applied = convertedUnits(paid, consumed, component.currency, snapshot)
            if (applied <= BigInt(0) || applied > component.remaining) return
            applications.push({
                legId: leg.id,
                debtId: component.debtId,
                debtCurrency: component.currency,
                paid: moneyWithUnits(paid, consumed),
                applied: moneyWithUnits(component.amount, applied),
                conversionSnapshot: snapshot,
            })
            available -= consumed
            component.remaining -= applied
        }

        for (const component of components) {
            if (component.currency === paid.currency) applyTo(component)
        }
        for (const component of components) {
            if (component.currency === paid.currency || component.remaining <= BigInt(0)) continue
            const conversion = leg.conversions?.find((item) => item.targetCurrency === component.currency)
            if (conversion) applyTo(component, conversion.snapshot)
        }
        if (available > BigInt(1)) throw new Error('SPACE_SETTLEMENT_OVERPAYMENT')
        return {
            id: leg.id,
            paid,
            unappliedMinorUnits: available.toString(),
        }
    })

    return {
        applications,
        legs: legResults,
        remaining: components.map((component) => moneyWithUnits(component.amount, component.remaining)),
    }
}
