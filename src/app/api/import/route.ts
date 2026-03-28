import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ImportBatch, ImportRow, Transaction, Category, Account } from '@/lib/models'
import { parseImportFile } from '@/lib/utils/excel-parser'
import { IMPORT_ROW_STATUS } from '@/lib/constants'
import type { ImportParsedData } from '@/types'

// GET /api/import — lista de batches del usuario
export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    await connectDB()

    const batches = await ImportBatch.find({ userId: session.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()

    return NextResponse.json({ batches })
}

// POST /api/import — subir archivo y crear batch draft
export async function POST(request: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return NextResponse.json({ error: 'Formato de request inválido' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    const fileName = file instanceof File ? file.name : 'import.xlsx'
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        return NextResponse.json(
            { error: 'Solo se aceptan archivos .xlsx o .xls' },
            { status: 400 }
        )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let parseResult
    try {
        parseResult = parseImportFile(buffer)
    } catch {
        return NextResponse.json(
            { error: 'No se pudo leer el archivo. Verificá que sea una plantilla Finp válida.' },
            { status: 422 }
        )
    }

    if (parseResult.missingHeaders.length > 0) {
        return NextResponse.json(
            {
                error: `El archivo no tiene los encabezados requeridos: ${parseResult.missingHeaders.join(', ')}. Descargá la plantilla oficial de Finp.`,
            },
            { status: 422 }
        )
    }

    if (parseResult.totalRows === 0) {
        return NextResponse.json(
            { error: 'El archivo no contiene filas de datos.' },
            { status: 422 }
        )
    }

    await connectDB()

    // Resolver nombres de categorías y cuentas
    const [categories, accounts] = await Promise.all([
        Category.find({ userId: session.user.id, isArchived: false }).lean(),
        Account.find({ userId: session.user.id, isActive: true }).lean(),
    ])

    const categoryByName = new Map(
        categories.map((c) => [c.name.toLowerCase().trim(), String(c._id)])
    )
    const accountByName = new Map(
        accounts.map((a) => [a.name.toLowerCase().trim(), String(a._id)])
    )

    // Detectar posibles duplicados (misma fecha + monto + descripción similar)
    const recentTransactions = await Transaction.find({
        userId: session.user.id,
        date: {
            $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // últimos 90 días
        },
    })
        .select('date amount description')
        .lean()

    function detectDuplicate(parsedData: ImportParsedData): string | undefined {
        if (!parsedData.date || !parsedData.amount) return undefined
        const rowDate = parsedData.date.toISOString().slice(0, 10)
        const match = recentTransactions.find((t) => {
            const tDate = new Date(t.date).toISOString().slice(0, 10)
            if (tDate !== rowDate) return false
            if (Math.abs(t.amount - (parsedData.amount ?? 0)) > 0.01) return false
            const desc1 = t.description.toLowerCase().trim()
            const desc2 = (parsedData.description ?? '').toLowerCase().trim()
            return desc1 === desc2 || desc1.includes(desc2) || desc2.includes(desc1)
        })
        return match ? String(match._id) : undefined
    }

    // Calcular resumen
    let valid = 0, invalid = 0, incomplete = 0, possibleDuplicate = 0, ignored = 0

    const rowDocs = parseResult.rows.map((row) => {
        const data = row.parsedData

        // Resolver IDs
        if (data.categoryName) {
            const catId = categoryByName.get(data.categoryName.toLowerCase().trim())
            if (catId) data.categoryId = catId
            else row.warnings.push(`Categoría "${data.categoryName}" no encontrada en Finp.`)
        }

        if (data.accountName) {
            const accId = accountByName.get(data.accountName.toLowerCase().trim())
            if (accId) data.sourceAccountId = accId
            else row.warnings.push(`Cuenta "${data.accountName}" no encontrada en Finp.`)
        }

        let possibleDuplicateId: string | undefined
        let rowStatus: string = row.status

        if (!data.ignored) {
            possibleDuplicateId = detectDuplicate(data)
            if (possibleDuplicateId && rowStatus !== 'invalid') {
                rowStatus = 'possible_duplicate'
                possibleDuplicate++
            } else if (rowStatus === 'invalid') {
                invalid++
            } else if (rowStatus === 'incomplete') {
                incomplete++
            } else {
                valid++
            }
        } else {
            rowStatus = IMPORT_ROW_STATUS.IGNORED
            ignored++
        }

        return {
            rowNumber: row.rowNumber,
            rawData: row.rawData,
            parsedData: data,
            status: rowStatus,
            warnings: row.warnings,
            errors: row.errors,
            possibleDuplicateId,
            ignored: !!data.ignored,
        }
    })

    // Crear batch
    const batch = await ImportBatch.create({
        userId: session.user.id,
        fileName,
        sourceType: 'xlsx_template',
        status: 'draft',
        summary: {
            total: parseResult.totalRows,
            valid,
            invalid,
            incomplete,
            possibleDuplicate,
            ignored,
            imported: 0,
        },
    })

    // Crear rows
    await ImportRow.insertMany(
        rowDocs.map((r) => ({ ...r, batchId: batch._id }))
    )

    return NextResponse.json({ batchId: batch._id.toString() }, { status: 201 })
}
