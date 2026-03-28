import * as XLSX from 'xlsx'
import type { ImportParsedData } from '@/types'

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

    // categoría
    categoria: 'categoría',
    categoría: 'categoría',
    category: 'categoría',
    rubro: 'categoría',

    // medio de pago
    'medio de pago': 'medio de pago',
    medio_de_pago: 'medio de pago',
    medio: 'medio de pago',
    'payment method': 'medio de pago',
    pago: 'medio de pago',

    // tarjeta
    tarjeta: 'tarjeta',
    card: 'tarjeta',
    'tarjeta de credito': 'tarjeta',
    'tarjeta de crédito': 'tarjeta',

    // cuotas totales
    'cuotas totales': 'cuotas totales',
    cuotas_totales: 'cuotas totales',
    'total cuotas': 'cuotas totales',
    cuotas: 'cuotas totales',
    installments: 'cuotas totales',

    // cuota actual
    'cuota actual': 'cuota actual',
    cuota_actual: 'cuota actual',
    'numero de cuota': 'cuota actual',
    'número de cuota': 'cuota actual',
    cuota: 'cuota actual',
    installment: 'cuota actual',

    // observaciones
    observaciones: 'observaciones',
    notas: 'observaciones',
    notes: 'observaciones',
    comentarios: 'observaciones',
    comentario: 'observaciones',

    // ignorar
    ignorar: 'ignorar',
    ignore: 'ignorar',
    omitir: 'ignorar',
    skip: 'ignorar',
}

// Mapa de tipos de transacción en español → internos
const TYPE_MAP: Record<string, string> = {
    gasto: 'expense',
    gastos: 'expense',
    egreso: 'expense',
    egresos: 'expense',
    expense: 'expense',
    ingreso: 'income',
    ingresos: 'income',
    income: 'income',
    transferencia: 'transfer',
    transferencias: 'transfer',
    transfer: 'transfer',
    'pago de tarjeta': 'credit_card_payment',
    'pago tarjeta': 'credit_card_payment',
    pago_tarjeta: 'credit_card_payment',
    'tarjeta de crédito pago': 'credit_card_payment',
    credit_card_payment: 'credit_card_payment',
    'pago deuda': 'debt_payment',
    debt_payment: 'debt_payment',
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
    if (typeof value === 'number') return value > 0 ? value : undefined

    if (typeof value === 'string') {
        // Normalizar: quitar espacios, $ y separadores de miles
        const normalized = value
            .trim()
            .replace(/\$/g, '')
            .replace(/\s/g, '')
            .replace(/\./g, '') // quitar separador de miles (formato ARS)
            .replace(',', '.') // coma → punto decimal
        const num = parseFloat(normalized)
        return isNaN(num) || num <= 0 ? undefined : num
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
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
        defval: '',
        raw: true,
    })

    if (rawRows.length === 0) {
        return { rows: [], missingHeaders: [], unknownHeaders: [], totalRows: 0 }
    }

    // Mapear encabezados
    const firstRow = rawRows[0]
    const headerMap: Record<string, string> = {} // originalKey → normalizedKey
    const unknownHeaders: string[] = []

    for (const key of Object.keys(firstRow)) {
        const normalized = normalizeHeader(key)
        headerMap[key] = normalized
        if (!Object.values(HEADER_ALIASES).includes(normalized) && !REQUIRED_HEADERS.includes(normalized)) {
            unknownHeaders.push(key)
        }
    }

    const foundHeaders = new Set(Object.values(headerMap))
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !foundHeaders.has(h))

    const rows: ParsedRow[] = []

    rawRows.forEach((rawRow, index) => {
        const rowNumber = index + 2 // +2 porque la fila 1 son headers

        // Normalizar rawData
        const rawData: Record<string, string> = {}
        for (const [key, val] of Object.entries(rawRow)) {
            const normalized = headerMap[key] ?? key
            rawData[normalized] = val !== undefined && val !== null ? String(val) : ''
        }

        // Ignorar fila vacía
        const allEmpty = Object.values(rawData).every((v) => !v.trim())
        if (allEmpty) return

        // Parsear campos
        const ignored = parseBoolean(rawData['ignorar'])

        const parsedData: ImportParsedData = {
            ignored,
            date: parseDateCell(rawRow[Object.keys(rawRow).find((k) => normalizeHeader(k) === 'fecha') ?? '']),
            type: (() => {
                const raw = rawData['tipo']?.trim().toLowerCase()
                return raw ? (TYPE_MAP[raw] ?? raw) : undefined
            })(),
            description: rawData['descripción']?.trim() || undefined,
            amount: parseAmount(rawData['monto']),
            currency: rawData['moneda']?.trim().toUpperCase() || undefined,
            categoryName: rawData['categoría']?.trim() || undefined,
            accountName: rawData['cuenta']?.trim() || undefined,
            paymentMethod: rawData['medio de pago']?.trim() || undefined,
            cardName: rawData['tarjeta']?.trim() || undefined,
            installmentCount: parseNumber(rawData['cuotas totales']),
            installmentNumber: parseNumber(rawData['cuota actual']),
            notes: rawData['observaciones']?.trim() || undefined,
        }

        // Validar
        const errors: string[] = []
        const warnings: string[] = []

        if (!ignored) {
            if (!parsedData.date) {
                errors.push('La fecha es inválida o está vacía. Usá el formato DD/MM/AAAA.')
            }

            if (!parsedData.type) {
                errors.push('El tipo es requerido. Valores válidos: gasto, ingreso, transferencia, pago de tarjeta.')
            } else if (!['income', 'expense', 'transfer', 'credit_card_payment', 'debt_payment'].includes(parsedData.type)) {
                errors.push(`Tipo desconocido: "${rawData['tipo']}".`)
            }

            if (!parsedData.description) {
                errors.push('La descripción es requerida.')
            }

            if (parsedData.amount === undefined) {
                errors.push('El monto debe ser un número positivo válido.')
            }

            if (!parsedData.currency) {
                errors.push('La moneda es requerida (ARS o USD).')
            } else if (!['ARS', 'USD'].includes(parsedData.currency)) {
                errors.push(`Moneda desconocida: "${parsedData.currency}". Usá ARS o USD.`)
            }

            // Advertencias
            if (!parsedData.categoryName) {
                warnings.push('Sin categoría. Podrás asignarla en la revisión.')
            }

            if (!parsedData.accountName && parsedData.type !== 'transfer') {
                warnings.push('Sin cuenta. Podrás asignarla en la revisión.')
            }

            // Cuotas coherencia
            if (parsedData.installmentCount || parsedData.installmentNumber) {
                if (parsedData.installmentCount && !parsedData.installmentNumber) {
                    warnings.push('Se indicó cuotas totales pero falta cuota actual.')
                }
                if (parsedData.installmentNumber && !parsedData.installmentCount) {
                    warnings.push('Se indicó cuota actual pero falta cuotas totales.')
                }
                if (
                    parsedData.installmentCount &&
                    parsedData.installmentNumber &&
                    parsedData.installmentNumber > parsedData.installmentCount
                ) {
                    errors.push(
                        `Cuota actual (${parsedData.installmentNumber}) no puede ser mayor que cuotas totales (${parsedData.installmentCount}).`
                    )
                }
            }
        }

        const hasErrors = errors.length > 0
        const hasWarnings = warnings.length > 0 && !hasErrors
        const status = ignored ? 'ok' : hasErrors ? 'invalid' : hasWarnings ? 'incomplete' : 'ok'

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
