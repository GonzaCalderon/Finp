import { Types } from 'mongoose'

export function objectId(): Types.ObjectId {
    return new Types.ObjectId()
}

export function objectIdString(): string {
    return objectId().toString()
}

export function fixedObjectId(seedName: string): Types.ObjectId {
    const hex = Array.from(seedName).reduce((acc, char, index) => {
        const code = char.charCodeAt(0).toString(16).padStart(2, '0')
        return acc + code + index.toString(16)
    }, '')

    return new Types.ObjectId(hex.padEnd(24, '0').slice(0, 24))
}

export function asObjectId(value: string | Types.ObjectId): Types.ObjectId {
    return typeof value === 'string' ? new Types.ObjectId(value) : value
}
