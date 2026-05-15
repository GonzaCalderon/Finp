import ExcelJS from 'exceljs'
import type { ImportParsedData } from '@/types'
import {
    IMPORT_TRANSACTION_TYPE_LABELS,
    normalizeImportMonth,
    normalizeImportTransactionType,
} from '@/lib/utils/import-transactions'

// Mapa de encabezados tolerantes (sin tildes, variantes) → clave normalizada
const HEADER_ALIASES: Record<string, string> = {
    // fecha
    fecha: 'fecha',
    date: 'fecha',

    // tipo
    tipo: 'tipo',
    type: 'tipo',

    // descripción
    descripcion: 'descripción',
    descripción: 'descripción',
    description: 'descripción',
    concepto: 'descripción',
    detalle: 'descripción',

    // monto
    monto: 'monto',
    importe: 'monto',
    amount: 'monto',
    valor: 'monto',

    // moneda
    moneda: 'moneda',
    currency: 'moneda',
    divisa: 'moneda',

    // cuenta
    cuenta: 'cuenta',
    account: 'cuenta',
    'cuenta origen': 'cuenta',
    origen: 'cuenta',
    source_account: 'cuenta',

    // categoría
    categoria: 'categoría',
    categoría: 'categoría',
    category: 'categoría',
    rubro: 'categoría',

    // cuenta destino
    'cuenta destino': 'cuenta destino',
    destino: 'cuenta destino',
    destination_account: 'cuenta destino',
    'cuenta de destino': 'cuenta destino',

    // exchange
    'monto destino': 'monto destino',
    destination_amount: 'monto destino',
    'moneda destino': 'moneda destino',
    destination_currency: 'moneda destino',
    'cotizacion manual': 'cotización manual',
    'cotización manual': 'cotización manual',
    exchange_rate: 'cotización manual',

    // compatibilidad vieja: medio de pago
    'medio de pago': 'medio de pago',
    medio_de_pago: 'medio de pago',
    medio: 'medio de pago',
    'payment method': 'medio de pago',
    pago: 'medio de pago',

    // compatibilidad vieja: tarjeta
    tarjeta: 'tarjeta',
    card: 'tarjeta',
    'tarjeta de credito': 'tarjeta',
    'tarjeta de crédito': 'tarjeta',

    // cuotas
    cuotas: 'cuotas',
    installments: 'cuotas',
    'cuotas totales': 'cuotas',
    cuotas_totales: 'cuotas',
    'total cuotas': 'cuotas',

    // compatibilidad vieja: cuota actual
    'cuota actual': 'cuota actual',
    cuota_actual: 'cuota actual',
    'numero de cuota': 'cuota actual',
    'número de cuota': 'cuota actual',
    cuota: 'cuota actual',
    installment: 'cuota actual',

    // mes de primer pago
    'mes de primer pago': 'mes de primer pago',
    'mes primer pago': 'mes de primer pago',
    'primer pago': 'mes de primer pago',
    'mes primera cuota': 'mes de primer pago',
    'mes de primera cuota': 'mes de primer pago',
    'primera cuota': 'mes de primer pago',
    'mes primera imputacion': 'mes de primer pago',
    'mes primera imputación': 'mes de primer pago',
    'mes de primera imputacion': 'mes de primer pago',
    'mes de primera imputación': 'mes de primer pago',
    first_closing_month: 'mes de primer pago',
    'first closing month': 'mes de primer pago',

    // observaciones
    observaciones: 'observaciones',
    notas: 'observaciones',
    notes: 'observaciones',
    comentarios: 'observaciones',
    comentario: 'observaciones',

    // compatibilidad vieja: ignorar
    ignorar: 'ignorar',
    ignore: 'ignorar',
    omitir: 'ignorar',
    skip: 'ignorar',
}

function normalizeHeader(raw: string): string {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, ' ')
    return HEADER_ALIASES[normalized] ?? normalized
}

// Excel stores dates as days since Dec 30, 1899 (with a 1900 leap year bug)
function excelSerialToDate(serial: number): Date | undefined {
    if (!Number.isFinite(serial) || serial < 1) return undefined
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
    return isNaN(date.getTime()) ? undefined : date
}

function extractCellValue(raw: ExcelJS.CellValue): string | number | Date | undefined {
    if (raw === null || raw === undefined) return undefined
    if (raw instanceof Date) return raw
    if (typeof raw === 'number' || typeof raw === 'string') return raw
    if (typeof raw === 'boolean') return String(raw)

    const obj = raw as unknown as Record<string, unknown>

    if ('richText' in obj && Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text: string }>).map((rt) => rt.text).join('')
    }
    if ('text' in obj && typeof obj.text === 'string') {
        return obj.text
    }
    if ('result' in obj) {
        const result = obj.result
        if (result === null || result === undefined) return undefined
        if (result instanceof Date) return result
        if (typeof result === 'number' || typeof result === 'string') return result
        if (typeof result === 'boolean') return String(result)
        return undefined
    }
    return undefined
}

function parseDateCell(value: unknown): Date | undefined {
    if (!value) return undefined

    if (typeof value === 'number') {
        return excelSerialToDate(value)
    }

    if (typeof value === 'string') {
        const v = value.trim()
        if (!v) return undefined

        // DD/MM/YYYY
        const ddmmyyyy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
        if (ddmmyyyy) {
            const [, d, m, y] = ddmmyyyy
            const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
            const date = new Date(year, parseInt(m) - 1, parseInt(d))
            if (!isNaN(date.getTime())) return date
        }

        // YYYY-MM-DD
        const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (iso) {
            const date = new Date(v)
            if (!isNaN(date.getTime())) return date
        }

        // DD-MM-YYYY
        const ddmmyyyy2 = v.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
        if (ddmmyyyy2) {
            const [, d, m, y] = ddmmyyyy2
            const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
            const date = new Date(year, parseInt(m) - 1, parseInt(d))
            if (!isNaN(date.getTime())) return date
        }
    }

    if (value instanceof Date) return value
    return undefined
}

function parseAmount(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value === 'number') return value !== 0 ? value : undefined

    if (typeof value === 'string') {
        let normalized = value.trim().replace(/\$/g, '').replace(/\s/g, '')

        if (normalized.includes(',') && normalized.includes('.')) {
            if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
                normalized = normalized.replace(/\./g, '').replace(',', '.')
            } else {
                normalized = normalized.replace(/,/g, '')
            }
        } else if ((normalized.match(/\./g) ?? []).length > 1) {
            normalized = normalized.replace(/\./g, '')
        } else if ((normalized.match(/,/g) ?? []).length > 1) {
            normalized = normalized.replace(/,/g, '')
        } else {
            normalized = normalized.replace(',', '.')
        }

        const num = parseFloat(normalized)
        return isNaN(num) || num === 0 ? undefined : num
    }

    return undefined
}

function parseBoolean(value: unknown): boolean {
    if (!value) return false
    const str = String(value).trim().toLowerCase()
    return str === 'true' || str === 'si' || str === 'sí' || str === '1' || str === 'yes'
}

function parseNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined
    const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10)
    return isNaN(n) ? undefined : n
}

function parseMonthCell(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return normalizeImportMonth(value)
    }

    if (typeof value === 'number') {
        const date = excelSerialToDate(value)
        if (date) return normalizeImportMonth(date)
    }

    return normalizeImportMonth(String(value))
}

export interface ParsedRow {
    rowNumber: number
    rawData: Record<string, string>
    parsedData: ImportParsedData
    errors: string[]
    warnings: string[]
    status: 'ok' | 'incomplete' | 'invalid'
}

export interface ParseResult {
    rows: ParsedRow[]
    missingHeaders: string[]
    unknownHeaders: string[]
    totalRows: number
}

const REQUIRED_HEADERS = ['fecha', 'tipo', 'descripción', 'monto', 'moneda']

export async function parseImportFile(buffer: Buffer): Promise<ParseResult> {
    const workbook = new ExcelJS.Workbook()
    const workbookBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
    await workbook.xlsx.load(workbookBuffer)

    const sheetName =
        workbook.worksheets.find((ws) => ws.name.toLowerCase().includes('transaccion'))?.name ??
        workbook.worksheets.find((ws) => !ws.name.toLowerCase().includes('instruc'))?.name ??
        workbook.worksheets[0]?.name

    if (!sheetName) {
        return { rows: [], missingHeaders: REQUIRED_HEADERS, unknownHeaders: [], totalRows: 0 }
    }

    const ws = workbook.getWorksheet(sheetName)!

    // Build rawRows as 0-indexed arrays, matching xlsx's sheet_to_json with header:1
    const rawRows: (string | number | Date | undefined)[][] = []
    ws.eachRow({ includeEmpty: true }, (row) => {
        const vals = row.values as ExcelJS.CellValue[]
        // row.values is 1-indexed; slice(1) normalizes to 0-indexed
        rawRows.push(vals.slice(1).map(extractCellValue))
    })

    if (rawRows.length === 0) {
        return { rows: [], missingHeaders: [], unknownHeaders: [], totalRows: 0 }
    }

    const headerRowIndex =
        rawRows.findIndex((row) => row.some((cell) => REQUIRED_HEADERS.includes(normalizeHeader(String(cell ?? ''))))) >= 0
            ? rawRows.findIndex((row) => row.some((cell) => REQUIRED_HEADERS.includes(normalizeHeader(String(cell ?? '')))))
            : 0

    const headerRow = rawRows[headerRowIndex] ?? []
    const headerMap: Record<string, string> = {} // originalKey → normalizedKey
    const unknownHeaders: string[] = []

    headerRow.forEach((cell, index) => {
        const original = String(cell ?? '').trim()
        const normalized = normalizeHeader(original)
        headerMap[String(index)] = normalized
        if (!Object.values(HEADER_ALIASES).includes(normalized) && !REQUIRED_HEADERS.includes(normalized)) {
            if (original) unknownHeaders.push(original)
        }
    })

    const foundHeaders = new Set(Object.values(headerMap))
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !foundHeaders.has(h))

    const rows: ParsedRow[] = []

    rawRows.slice(headerRowIndex + 1).forEach((rawRow, index) => {
        const rowNumber = headerRowIndex + index + 2

        // Normalizar rawData
        const rawData: Record<string, string> = {}
        rawRow.forEach((val, cellIndex) => {
            const normalized = headerMap[String(cellIndex)] ?? String(cellIndex)
            rawData[normalized] = val !== undefined && val !== null ? String(val) : ''
        })

        const getCellValue = (header: string) => {
            const cellIndex = Object.entries(headerMap).find(([, normalized]) => normalized === header)?.[0]
            return cellIndex !== undefined ? rawRow[Number(cellIndex)] : undefined
        }

        // Ignorar fila vacía
        const allEmpty = Object.values(rawData).every((v) => !v.trim())
        if (allEmpty) return

        // Saltear filas de agrupación/ayuda si quedaron debajo del encabezado
        if (!rawData['tipo'] && !rawData['monto'] && !rawData['cuenta']) return

        // Parsear campos
        const parsedData: ImportParsedData = {
            ignored: false,
            date: parseDateCell(rawData['fecha']),
            type: normalizeImportTransactionType(rawData['tipo']),
            description: rawData['descripción']?.trim() || undefined,
            amount: parseAmount(rawData['monto']),
            currency: rawData['moneda']?.trim().toUpperCase() || undefined,
            destinationAmount: parseAmount(rawData['monto destino']),
            destinationCurrency: rawData['moneda destino']?.trim().toUpperCase() || undefined,
            exchangeRate: parseAmount(rawData['cotización manual']),
            categoryName: rawData['categoría']?.trim() || undefined,
            accountName: rawData['cuenta']?.trim() || undefined,
            destinationAccountName: rawData['cuenta destino']?.trim() || undefined,
            paymentMethod: rawData['medio de pago']?.trim() || undefined,
            cardName: rawData['tarjeta']?.trim() || undefined,
            installmentCount: parseNumber(rawData['cuotas']),
            installmentNumber: parseNumber(rawData['cuota actual']),
            firstClosingMonth: parseMonthCell(getCellValue('mes de primer pago')),
            notes: rawData['observaciones']?.trim() || undefined,
        }

        // Validar
        const errors: string[] = []
        const warnings: string[] = []

        if (!parseBoolean(rawData['ignorar'])) {
            if (!parsedData.date) {
                errors.push('La fecha es inválida o está vacía. Usá el formato DD/MM/AAAA.')
            }

            if (!parsedData.type) {
                errors.push('El tipo es requerido. Valores válidos: gasto, ingreso, gasto con TC, cambio, transferencia, pago de tarjeta, ajuste.')
            } else if (!Object.keys(IMPORT_TRANSACTION_TYPE_LABELS).includes(parsedData.type)) {
                errors.push(`Tipo desconocido: "${rawData['tipo']}".`)
            }

            if (!parsedData.description && !['transfer', 'credit_card_payment'].includes(parsedData.type ?? '')) {
                errors.push('La descripción es requerida.')
            }

            if (parsedData.amount === undefined) {
                errors.push('El monto debe ser un número válido distinto de cero.')
            }

            if (!parsedData.currency) {
                errors.push('La moneda es requerida (ARS o USD).')
            } else if (!['ARS', 'USD'].includes(parsedData.currency)) {
                errors.push(`Moneda desconocida: "${parsedData.currency}". Usá ARS o USD.`)
            }

            // Cuotas coherencia
            if (parsedData.installmentCount || parsedData.installmentNumber) {
                if (parsedData.installmentCount && !parsedData.installmentNumber) {
                    parsedData.installmentNumber = 1
                }
                if (parsedData.installmentNumber && !parsedData.installmentCount) {
                    warnings.push('Se indicó cuota actual pero falta cuotas.')
                }
                if (
                    parsedData.installmentCount &&
                    parsedData.installmentNumber &&
                    parsedData.installmentNumber > parsedData.installmentCount
                ) {
                    errors.push(
                        `Cuota actual (${parsedData.installmentNumber}) no puede ser mayor que cuotas (${parsedData.installmentCount}).`
                    )
                }
            }
        }

        const hasErrors = errors.length > 0
        const hasWarnings = warnings.length > 0 && !hasErrors
        const status = hasErrors ? 'invalid' : hasWarnings ? 'incomplete' : 'ok'

        rows.push({
            rowNumber,
            rawData,
            parsedData,
            errors,
            warnings,
            status,
        })
    })

    return {
        rows,
        missingHeaders,
        unknownHeaders,
        totalRows: rows.length,
    }
}
