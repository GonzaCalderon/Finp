import * as XLSX from 'xlsx'

// Encabezados visibles en español (orden de columnas en la plantilla)
export const TEMPLATE_HEADERS = [
    'fecha',
    'tipo',
    'descripción',
    'monto',
    'moneda',
    'cuenta',
    'cuenta destino',
    'categoría',
    'cuotas',
    'mes de primer pago',
    'observaciones',
] as const

export type TemplateHeader = typeof TEMPLATE_HEADERS[number]

export interface TemplateOptions {
    accounts?: Array<{ name: string; currency: string }>
    categories?: Array<{ name: string; type: string }>
}

// Filas de ejemplo para la plantilla
const EXAMPLE_ROWS = [
    {
        fecha: '15/03/2026',
        tipo: 'gasto',
        descripción: 'Supermercado Coto',
        monto: 12500,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': '',
        categoría: 'Supermercado',
        cuotas: '',
        'mes de primer pago': '',
        observaciones: '',
    },
    {
        fecha: '14/03/2026',
        tipo: 'gasto con tc',
        descripción: 'Notebook Samsung',
        monto: 900000,
        moneda: 'ARS',
        cuenta: 'Visa Santander',
        'cuenta destino': '',
        categoría: 'Tecnología y herramientas',
        cuotas: 12,
        'mes de primer pago': '2026-04',
        observaciones: 'Comprada en Garbarino',
    },
    {
        fecha: '10/03/2026',
        tipo: 'ingreso',
        descripción: 'Sueldo marzo',
        monto: 350000,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': '',
        categoría: 'Sueldo',
        cuotas: '',
        'mes de primer pago': '',
        observaciones: '',
    },
    {
        fecha: '28/03/2026',
        tipo: 'pago de tarjeta',
        descripción: '',
        monto: 120000,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': 'Visa Santander',
        categoría: '',
        cuotas: '',
        'mes de primer pago': '',
        observaciones: '',
    },
    {
        fecha: '31/03/2026',
        tipo: 'ajuste',
        descripción: 'Ajuste saldo billetera',
        monto: -1500,
        moneda: 'ARS',
        cuenta: 'Mercado Pago',
        'cuenta destino': '',
        categoría: '',
        cuotas: '',
        'mes de primer pago': '',
        observaciones: 'Corrección manual',
    },
]

// Hoja de instrucciones
const INSTRUCTIONS = [
    ['PLANTILLA OFICIAL FINP — IMPORTACIÓN DE TRANSACCIONES'],
    [''],
    ['INSTRUCCIONES'],
    [''],
    ['1. Completá la hoja "Transacciones" con tus movimientos.'],
    ['2. No modifiques las dos primeras filas de encabezado.'],
    ['3. Podés agregar todas las filas que necesites.'],
    ['4. Cada tipo usa solo las columnas que le corresponden.'],
    ['5. Consultá la hoja "Listas" para ver tus cuentas y categorías disponibles.'],
    [''],
    ['CAMPOS OBLIGATORIOS'],
    ['fecha *       — Formato: DD/MM/AAAA (ej: 15/03/2026)'],
    ['tipo *        — Valores válidos: ingreso, gasto, gasto con TC, transferencia, ajuste, pago de tarjeta'],
    ['descripción   — Requerida salvo en transferencia y pago de tarjeta'],
    ['monto *       — Número distinto de cero (ej: 12500, 12500.50 o -1500 para ajustes).'],
    ['moneda *      — ARS o USD'],
    [''],
    ['CAMPOS OPCIONALES'],
    ['cuenta            — Cuenta principal del movimiento. En gasto con TC representa la tarjeta.'],
    ['cuenta destino    — Solo para transferencia y pago de tarjeta.'],
    ['categoría         — Solo para ingreso, gasto y gasto con TC.'],
    ['cuotas            — Solo para gasto con TC. Usá 1 si es una sola cuota.'],
    ['mes de primer pago — Formato YYYY-MM (ej: 2026-04). Obligatorio para gasto con TC.'],
    ['observaciones     — Notas adicionales'],
    [''],
    ['NOTAS IMPORTANTES'],
    ['- Usá los nombres exactos de tus cuentas y categorías tal como aparecen en la hoja "Listas".'],
    ['- Si una cuenta no existe en Finp, la fila quedará marcada como no resuelta para revisión.'],
    ['- En pago de tarjeta, cuenta = cuenta que paga y cuenta destino = tarjeta.'],
    ['- En gasto con TC, cuenta = tarjeta y cuotas/mes de primer pago son obligatorios.'],
    ['- Finp detecta posibles duplicados antes de confirmar la importación.'],
]

export function generateImportTemplate(options?: TemplateOptions): Buffer {
    const wb = XLSX.utils.book_new()

    // Hoja de instrucciones
    const wsInstructions = XLSX.utils.aoa_to_sheet(INSTRUCTIONS)
    wsInstructions['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones')

    // Hoja de transacciones
    const transactionRows = [
        ['Campos comunes', '', '', '', '', '', 'Según el tipo', '', '', '', 'Opcional'],
        [...TEMPLATE_HEADERS],
        ...EXAMPLE_ROWS.map((row) => TEMPLATE_HEADERS.map((header) => row[header] ?? '')),
    ]
    const wsData = XLSX.utils.aoa_to_sheet(transactionRows)
    wsData['!cols'] = [
        { wch: 14 }, // fecha
        { wch: 18 }, // tipo
        { wch: 30 }, // descripción
        { wch: 12 }, // monto
        { wch: 8 },  // moneda
        { wch: 22 }, // cuenta
        { wch: 22 }, // cuenta destino
        { wch: 25 }, // categoría
        { wch: 10 }, // cuotas
        { wch: 18 }, // mes de primer pago
        { wch: 30 }, // observaciones
    ]
    wsData['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },
    ]
    XLSX.utils.book_append_sheet(wb, wsData, 'Transacciones')

    // Hoja de listas de referencia
    const lists: (string | number)[][] = [
        ['TIPOS DE TRANSACCIÓN VÁLIDOS'],
        ['Valor en plantilla', 'Descripción'],
        ['ingreso', 'Ingreso de dinero a una cuenta'],
        ['gasto', 'Egreso de dinero de una cuenta'],
        ['gasto con tc', 'Consumo con tarjeta de crédito (1 cuota o más)'],
        ['transferencia', 'Movimiento entre dos cuentas propias'],
        ['ajuste', 'Corrección manual de saldo o movimiento'],
        ['pago de tarjeta', 'Pago de saldo de tarjeta de crédito'],
        [],
        ['COLUMNAS CLAVE'],
        ['cuenta', 'Cuenta principal del movimiento'],
        ['cuenta destino', 'Solo transferencia y pago de tarjeta'],
        ['cuotas', 'Solo gasto con TC'],
        ['mes de primer pago', 'Solo gasto con TC'],
    ]

    if (options?.accounts && options.accounts.length > 0) {
        lists.push([], ['TUS CUENTAS EN FINP (copiar nombre exacto en columna "cuenta")'])
        lists.push(['Nombre de cuenta', 'Moneda'])
        for (const a of options.accounts) {
            lists.push([a.name, a.currency])
        }
    } else {
        lists.push([], ['TUS CUENTAS EN FINP'], ['(No tenés cuentas activas en Finp todavía)'])
    }

    if (options?.categories && options.categories.length > 0) {
        lists.push([], ['TUS CATEGORÍAS EN FINP (copiar nombre exacto en columna "categoría")'])
        lists.push(['Nombre de categoría', 'Tipo'])
        for (const c of options.categories) {
            lists.push([c.name, c.type === 'expense' ? 'gasto' : 'ingreso'])
        }
    } else {
        lists.push([], ['TUS CATEGORÍAS EN FINP'], ['(No tenés categorías activas en Finp todavía)'])
    }

    const wsLists = XLSX.utils.aoa_to_sheet(lists)
    wsLists['!cols'] = [{ wch: 38 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsLists, 'Listas')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
