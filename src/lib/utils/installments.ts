/**
 * Mes de impacto inicial usado por los flujos actuales de tarjeta.
 *
 * La fecha de cierre de la cuenta todavía no participa de esta decisión: hasta
 * que exista una política de cierres explícita, la primera cuota se propone para
 * el mes calendario siguiente y siempre queda visible para que el usuario la
 * corrija antes de confirmar.
 */
export function getDefaultFirstClosingMonth(date: Date): string {
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
}
