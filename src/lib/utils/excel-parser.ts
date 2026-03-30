import * as XLSX from 'xlsx'
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

function parseDateCell(value: unknown): Date | undefined {
    if (!value) return undefined

    // Excel puede dar fechas como número serial
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value)
        if (date) return new Date(date.y, date.m - 1, date.d)
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

export function parseImportFile(buffer: Buffer): ParseResult {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })

    // Buscar hoja "Transacciones" (o la primera hoja si no existe)
    const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase().includes('transaccion')) ??
        wb.SheetNames.find((n) => !n.toLowerCase().includes('instruc')) ??
        wb.SheetNames[0]

    if (!sheetName) {
        return { rows: [], missingHeaders: REQUIRED_HEADERS, unknownHeaders: [], totalRows: 0 }
    }

    const ws = wb.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(ws, {
        header: 1,
        defval: '',
        raw: true,
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
            categoryName: rawData['categoría']?.trim() || undefined,
            accountName: rawData['cuenta']?.trim() || undefined,
            destinationAccountName: rawData['cuenta destino']?.trim() || undefined,
            paymentMethod: rawData['medio de pago']?.trim() || undefined,
            cardName: rawData['tarjeta']?.trim() || undefined,
            installmentCount: parseNumber(rawData['cuotas']),
            installmentNumber: parseNumber(rawData['cuota actual']),
            firstClosingMonth: normalizeImportMonth(rawData['mes de primer pago']),
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
                errors.push('El tipo es requerido. Valores válidos: gasto, ingreso, gasto con TC, transferencia, pago de tarjeta, ajuste.')
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
