import { getCurrentFinancialPeriod, parseFinancialPeriod } from '../../../src/lib/utils/period'

export const PROJECTION_SMOKE_USER_NAME = 'Projection Smoke User'

export const PROJECTION_SMOKE_IDS = {
    bankAccount: '710000000000000000000001',
    creditCard: '710000000000000000000002',
    commitment: '710000000000000000000011',
    singlePlan: '710000000000000000000021',
    installmentPlan: '710000000000000000000022',
    singleParent: '710000000000000000000031',
    installmentParent: '710000000000000000000032',
    historicalSingle: '710000000000000000000033',
} as const

export const PROJECTION_SMOKE_NAMES = {
    bankAccount: 'E2E Proyeccion Banco',
    creditCard: 'E2E Proyeccion Tarjeta',
    commitment: 'E2E Proyeccion Alquiler',
    singlePlan: 'E2E Proyeccion Compra 1 de 1',
    installmentPlan: 'E2E Proyeccion Viaje 3 cuotas',
    historicalSingle: 'E2E Proyeccion Historica sin plan',
} as const

export function deriveProjectionSmokeEmail(email: string): string {
    const normalized = email.trim().toLowerCase()
    const separator = normalized.lastIndexOf('@')
    if (separator <= 0 || separator === normalized.length - 1) {
        throw new Error('TEST_USER_EMAIL no permite derivar el usuario de Proyeccion.')
    }
    return `${normalized.slice(0, separator)}+projection-smoke${normalized.slice(separator)}`
}

function dateInsidePeriod(period: string, offsetDays: number): Date {
    const { start } = parseFinancialPeriod(period)
    const date = new Date(start)
    date.setDate(date.getDate() + offsetDays)
    date.setHours(12, 0, 0, 0)
    return date
}

export function buildProjectionSmokePeriod(now = new Date()) {
    const current = getCurrentFinancialPeriod(now)
    return {
        current,
        dates: {
            commitmentStart: dateInsidePeriod(current, 0),
            singlePurchase: dateInsidePeriod(current, 2),
            installmentPurchase: dateInsidePeriod(current, 3),
            historicalSingle: dateInsidePeriod(current, 4),
        },
    }
}
