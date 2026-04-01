import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account } from '@/lib/models'
import { accountSchema } from '@/lib/validations'
import {
    getInitialBalancesByCurrency,
    getPrimaryCurrency,
    normalizeDefaultPaymentMethods,
    normalizeSupportedCurrencies,
} from '@/lib/utils/accounts'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        await connectDB()

        const account = await Account.findOne({
            _id: id,
            userId: session.user.id,
        })

        if (!account) {
            return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
        }

        const accountObject = account.toObject()
        const supportedCurrencies = normalizeSupportedCurrencies(
            accountObject.supportedCurrencies,
            accountObject.currency,
            accountObject.type
        )
        const defaultPaymentMethods = normalizeDefaultPaymentMethods(
            accountObject.defaultPaymentMethods,
            accountObject.type
        )

        return NextResponse.json({
            account: {
                ...accountObject,
                supportedCurrencies,
                defaultPaymentMethods,
                initialBalances: getInitialBalancesByCurrency(accountObject),
                currency: getPrimaryCurrency({
                    type: accountObject.type,
                    currency: accountObject.currency,
                    supportedCurrencies,
                }),
            },
        })
    } catch (error) {
        console.error('Error al obtener cuenta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()

        await connectDB()

        const existingAccount = await Account.findOne({ _id: id, userId: session.user.id })

        if (!existingAccount) {
            return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
        }

        const existingObject = existingAccount.toObject()
        const parsed = accountSchema.safeParse({
            ...existingObject,
            ...body,
            supportedCurrencies: body.supportedCurrencies ?? existingObject.supportedCurrencies,
            currency: body.currency ?? existingObject.currency,
        })

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de cuenta inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const account = await Account.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            {
                $set: {
                    ...parsed.data,
                    initialBalances: getInitialBalancesByCurrency(parsed.data),
                },
            },
            { new: true }
        )

        if ((parsed.data.defaultPaymentMethods?.length ?? 0) > 0) {
            await Account.updateMany(
                {
                    userId: session.user.id,
                    _id: { $ne: id },
                    defaultPaymentMethods: { $in: parsed.data.defaultPaymentMethods },
                },
                {
                    $pull: {
                        defaultPaymentMethods: { $in: parsed.data.defaultPaymentMethods },
                    },
                }
            )
        }

        return NextResponse.json({ account })
    } catch (error) {
        console.error('Error al actualizar cuenta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        await connectDB()

        // Soft delete — no borramos, desactivamos
        const account = await Account.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { $set: { isActive: false } },
            { new: true }
        )

        if (!account) {
            return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ message: 'Cuenta desactivada correctamente' })
    } catch (error) {
        console.error('Error al eliminar cuenta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
