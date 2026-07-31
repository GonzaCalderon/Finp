export interface PaymentGroupMember {
    id?: string
    _id?: string | { toString(): string }
    amount: number
    currency: string
}

export interface PaymentGroupChoiceDescription {
    canDeleteGroup: boolean
    singleLabel: 'Sólo esta parte'
    singleDescription: string
    groupLabel: string
    groupDescription: string
}

function memberId(member: PaymentGroupMember): string {
    if (member.id) return member.id
    if (!member._id) return ''
    return typeof member._id === 'string' ? member._id : member._id.toString()
}

function formatMember(member: PaymentGroupMember): string {
    const amount = new Intl.NumberFormat('es-AR', {
        maximumFractionDigits: 2,
    }).format(member.amount)
    return `${member.currency} ${amount}`
}

export function describePaymentGroupChoice(
    currentTransactionId: string,
    members: PaymentGroupMember[]
): PaymentGroupChoiceDescription {
    const current = members.find((member) => memberId(member) === currentTransactionId)
    const currencies = Array.from(new Set(members.map((member) => member.currency)))
    const canDeleteGroup = members.length >= 2

    return {
        canDeleteGroup,
        singleLabel: 'Sólo esta parte',
        singleDescription: current
            ? `Se eliminará ${formatMember(current)}. La otra parte se conservará como movimiento independiente.`
            : 'Se eliminará sólo este movimiento.',
        groupLabel: currencies.length > 0
            ? `El pago completo (${currencies.join(' + ')})`
            : 'El pago completo',
        groupDescription: canDeleteGroup
            ? `Se eliminarán ${members.map(formatMember).join(' + ')}.`
            : 'El grupo ya no tiene otra parte vinculada.',
    }
}
