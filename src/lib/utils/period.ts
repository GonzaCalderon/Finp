/**
 * Devuelve el rango [start, end) de un período financiero mensual.
 *
 * Si monthStartDay=1 (default): equivale al mes calendario.
 * Si monthStartDay=15: el período va del día 15 de ese mes al día 15 del siguiente.
 *
 * Ejemplo: year=2026, month=3 (marzo), monthStartDay=15
 *   → start: 2026-03-15
 *   → end:   2026-04-15
 *
 * @param year Año del período (ej: 2026)
 * @param month Mes del período, 1-12 (ej: 3 para marzo)
 * @param monthStartDay Día del mes en que inicia el ciclo financiero, 1-28 (default: 1)
 */
export function getFinancialMonthRange(
    year: number,
    month: number,
    monthStartDay = 1
): { start: Date; end: Date } {
    if (monthStartDay === 1) {
        return {
            start: new Date(year, month - 1, 1),
            end: new Date(year, month, 1),
        }
    }

    return {
        start: new Date(year, month - 1, monthStartDay),
        end: new Date(year, month, monthStartDay),
    }
}

/**
 * Dado un momento en el tiempo y un monthStartDay, devuelve el identificador
 * del período financiero activo (formato "YYYY-MM").
 *
 * Ejemplo: si hoy es 2026-03-10 y monthStartDay=15,
 * el período activo es febrero (2026-02-15 → 2026-03-14), devuelve "2026-02".
 */
export function getCurrentFinancialPeriod(now: Date, monthStartDay = 1): string {
    const day = now.getDate()
    const year = now.getFullYear()
    const month = now.getMonth() + 1 // 1-12

    if (monthStartDay === 1 || day >= monthStartDay) {
        return `${year}-${String(month).padStart(2, '0')}`
    }

    // Todavía no arrancó el ciclo de este mes → pertenece al período anterior
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
}

/**
 * Analiza un string "YYYY-MM" y devuelve el rango de fechas usando monthStartDay.
 */
export function parseFinancialPeriod(
    period: string,
    monthStartDay = 1
): { start: Date; end: Date } {
    const [year, month] = period.split('-').map(Number)
    return getFinancialMonthRange(year, month, monthStartDay)
}

export function shiftFinancialPeriod(period: string, offsetMonths: number): string {
    const [year, month] = period.split('-').map(Number)
    const shifted = new Date(year, month - 1 + offsetMonths, 1)
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`
}
