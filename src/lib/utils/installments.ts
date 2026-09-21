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

export function getInstallmentMonthOptions(
    anchorDate: Date,
    selectedValue?: string
): Array<{ value: string; label: string }> {
    const options = Array.from({ length: 4 }, (_, index) => {
        const current = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + index, 1)
        return {
            value: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
            label: current.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
        }
    })

    if (selectedValue && !options.some((option) => option.value === selectedValue)) {
        const [year, month] = selectedValue.split('-').map(Number)
        if (Number.isInteger(year) && month >= 1 && month <= 12) {
            options.unshift({
                value: selectedValue,
                label: new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
                    month: 'long',
                    year: 'numeric',
                }),
            })
        }
    }

    return options
}

export function getInstallmentPlanPeriodLabel(firstClosingMonth: string, count: number): string {
    if (!firstClosingMonth || count < 1) return ''
    const [year, month] = firstClosingMonth.split('-').map(Number)
    if (!Number.isInteger(year) || month < 1 || month > 12) return ''
    const first = new Date(year, month - 1, 1)
    const last = new Date(year, month - 2 + count, 1)
    const format = (date: Date) => date
        .toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
        .replace('.', '')
    return count === 1 ? format(first) : `${format(first)} → ${format(last)}`
}
