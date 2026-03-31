import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ImportBatch, ImportRow, Transaction, Category, Account } from '@/lib/models'
import { parseImportFile } from '@/lib/utils/excel-parser'
import { IMPORT_ROW_STATUS } from '@/lib/constants'
import type { IAccount, ICategory, ImportParsedData } from '@/types'
import { evaluateImportRow, mergeImportRawDataFallbacks } from '@/lib/utils/import-transactions'

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

    // Resolver referencias y validar con la lógica vigente de Finp
    const [categories, accounts] = await Promise.all([
        Category.find({ userId: session.user.id, isArchived: false }).lean(),
        Account.find({ userId: session.user.id, isActive: true }).lean(),
    ])

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
        const evaluation = evaluateImportRow({
            data: mergeImportRawDataFallbacks(row.parsedData, row.rawData),
            accounts: accounts as unknown as IAccount[],
            categories: categories as unknown as ICategory[],
        })
        const data = evaluation.data

        let possibleDuplicateId: string | undefined
        let rowStatus: string = evaluation.status
        const warnings = Array.from(new Set([...row.warnings, ...evaluation.warnings]))
        const errors = Array.from(new Set([...row.errors, ...evaluation.errors]))

        if (!data.ignored) {
            possibleDuplicateId = detectDuplicate(data)
            if (possibleDuplicateId && rowStatus === IMPORT_ROW_STATUS.OK) {
                rowStatus = 'possible_duplicate'
                warnings.push('Posible duplicado: ya existe una transacción similar con la misma fecha y monto.')
                possibleDuplicate++
            } else if (rowStatus === IMPORT_ROW_STATUS.INVALID) {
                invalid++
            } else if (rowStatus === IMPORT_ROW_STATUS.INCOMPLETE) {
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
            warnings,
            errors,
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
