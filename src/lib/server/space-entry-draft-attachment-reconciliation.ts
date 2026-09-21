import { Types } from 'mongoose'

export interface DraftAttachmentReconciliationCliOptions {
    apply: boolean
    draftId?: string
    limit: number
    help: boolean
}

export function parseDraftAttachmentReconciliationArguments(args: string[]): DraftAttachmentReconciliationCliOptions {
    const options: DraftAttachmentReconciliationCliOptions = { apply: false, limit: 50, help: false }
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index]
        if (argument === '--help' || argument === '-h') options.help = true
        else if (argument === '--apply') options.apply = true
        else if (argument === '--draft') {
            const value = args[index + 1]
            if (!value || !Types.ObjectId.isValid(value)) throw new Error('--draft exige un ObjectId válido.')
            options.draftId = value
            index += 1
        } else if (argument === '--limit') {
            const value = Number(args[index + 1])
            if (!Number.isInteger(value) || value < 1 || value > 200) throw new Error('--limit admite enteros entre 1 y 200.')
            options.limit = value
            index += 1
        } else throw new Error(`Opción desconocida: ${argument}.`)
    }
    return options
}
