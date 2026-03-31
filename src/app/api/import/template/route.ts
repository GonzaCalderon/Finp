import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Category } from '@/lib/models'
import { generateImportTemplate } from '@/lib/utils/excel-template'
import { getAccountCurrencyLabel } from '@/lib/utils/accounts'

export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    await connectDB()

    const [accounts, categories] = await Promise.all([
        Account.find({ userId: session.user.id, isActive: true }).select('name currency supportedCurrencies type').lean(),
        Category.find({ userId: session.user.id, isArchived: false }).select('name type').sort({ sortOrder: 1 }).lean(),
    ])

    const buffer = await generateImportTemplate({
        accounts: accounts.map((a) => ({
            name: a.name,
            currencyLabel: getAccountCurrencyLabel({
                type: a.type,
                currency: a.currency,
                supportedCurrencies: a.supportedCurrencies,
            }),
        })),
        categories: categories.map((c) => ({ name: c.name, type: c.type })),
    })

    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="plantilla-finp.xlsx"',
            'Cache-Control': 'no-store',
        },
    })
}
