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
    'medio de pago',
    'tarjeta',
    'cuotas totales',
    'cuota actual',
    'mes primera cuota',
    'observaciones',
    'ignorar',
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
        'medio de pago': '',
        tarjeta: '',
        'cuotas totales': '',
        'cuota actual': '',
        'mes primera cuota': '',
        observaciones: '',
        ignorar: '',
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
        'medio de pago': 'tarjeta de crédito',
        tarjeta: 'Visa Santander',
        'cuotas totales': 12,
        'cuota actual': 1,
        'mes primera cuota': '2026-04',
        observaciones: 'Comprada en Garbarino',
        ignorar: '',
    },
    {
        fecha: '10/03/2026',
        tipo: 'ingreso',
        descripción: 'Sueldo marzo',
        monto: 350000,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': 'Cuenta corriente',
        categoría: 'Sueldo',
        'medio de pago': '',
        tarjeta: '',
        'cuotas totales': '',
        'cuota actual': '',
        'mes primera cuota': '',
        observaciones: '',
        ignorar: '',
    },
    {
        fecha: '28/03/2026',
        tipo: 'pago de tarjeta',
        descripción: 'Pago resumen Visa Santander',
        monto: 120000,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': 'Visa Santander',
        categoría: '',
        'medio de pago': 'transferencia',
        tarjeta: 'Visa Santander',
        'cuotas totales': '',
        'cuota actual': '',
        'mes primera cuota': '',
        observaciones: '',
        ignorar: '',
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
        'medio de pago': '',
        tarjeta: '',
        'cuotas totales': '',
        'cuota actual': '',
        'mes primera cuota': '',
        observaciones: 'Corrección manual',
        ignorar: '',
    },
]

// Hoja de instrucciones
const INSTRUCTIONS = [
    ['PLANTILLA OFICIAL FINP — IMPORTACIÓN DE TRANSACCIONES'],
    [''],
    ['INSTRUCCIONES'],
    [''],
    ['1. Completá la hoja "Transacciones" con tus movimientos.'],
    ['2. No modifiques los encabezados de la primera fila.'],
    ['3. Podés agregar todas las filas que necesites.'],
    ['4. Los campos marcados con * son obligatorios.'],
    ['5. Consultá la hoja "Listas" para ver tus cuentas y categorías disponibles.'],
    [''],
    ['CAMPOS OBLIGATORIOS'],
    ['fecha *       — Formato: DD/MM/AAAA (ej: 15/03/2026)'],
    ['tipo *        — Valores válidos: gasto, ingreso, transferencia, pago de tarjeta'],
    ['descripción * — Texto libre, máx. 200 caracteres'],
    ['monto *       — Número distinto de cero (ej: 12500, 12500.50 o -1500 para ajustes).'],
    ['moneda *      — ARS o USD'],
    [''],
    ['CAMPOS OPCIONALES'],
    ['cuenta            — Nombre exacto de tu cuenta en Finp (ver hoja "Listas")'],
    ['cuenta destino    — Obligatoria para ingreso, transferencia y pago de tarjeta'],
    ['categoría         — Obligatoria para ingreso, gasto y gasto con TC'],
    ['medio de pago     — efectivo, débito, tarjeta de crédito, transferencia'],
    ['tarjeta           — Nombre de la tarjeta de crédito'],
    ['cuotas totales    — Número entero. Usar para gasto con TC en cuotas.'],
    ['cuota actual      — Número de cuota (ej: 1). Debe ser menor o igual a cuotas totales.'],
    ['mes primera cuota — Formato YYYY-MM (ej: 2026-04). Obligatorio si el gasto con TC tiene más de 1 cuota.'],
    ['observaciones     — Notas adicionales'],
    ['ignorar           — Escribí SI o TRUE para ignorar esa fila en la importación'],
    [''],
    ['NOTAS IMPORTANTES'],
    ['- Usá los nombres exactos de tus cuentas y categorías tal como aparecen en la hoja "Listas".'],
    ['- Si una cuenta o tarjeta no existe en Finp, la fila quedará pendiente hasta que asignes una válida.'],
    ['- Pago de tarjeta, transferencia y ajuste no requieren categoría.'],
    ['- Gasto con TC usa una tarjeta de crédito como cuenta origen.'],
    ['- Finp detecta posibles duplicados antes de confirmar la importación.'],
]

export function generateImportTemplate(options?: TemplateOptions): Buffer {
    const wb = XLSX.utils.book_new()

    // Hoja de instrucciones
    const wsInstructions = XLSX.utils.aoa_to_sheet(INSTRUCTIONS)
    wsInstructions['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones')

    // Hoja de transacciones
    const wsData = XLSX.utils.json_to_sheet(EXAMPLE_ROWS, {
        header: TEMPLATE_HEADERS as unknown as string[],
    })
    wsData['!cols'] = [
        { wch: 14 }, // fecha
        { wch: 18 }, // tipo
        { wch: 30 }, // descripción
        { wch: 12 }, // monto
        { wch: 8 },  // moneda
        { wch: 22 }, // cuenta
        { wch: 22 }, // cuenta destino
        { wch: 25 }, // categoría
        { wch: 20 }, // medio de pago
        { wch: 20 }, // tarjeta
        { wch: 14 }, // cuotas totales
        { wch: 12 }, // cuota actual
        { wch: 16 }, // mes primera cuota
        { wch: 30 }, // observaciones
        { wch: 8 },  // ignorar
    ]
    XLSX.utils.book_append_sheet(wb, wsData, 'Transacciones')

    // Hoja de listas de referencia
    const lists: (string | number)[][] = [
        ['TIPOS DE TRANSACCIÓN VÁLIDOS'],
        ['Valor en plantilla', 'Descripción'],
        ['gasto', 'Egreso de dinero de una cuenta'],
        ['ingreso', 'Ingreso de dinero a una cuenta'],
        ['gasto con tc', 'Consumo con tarjeta de crédito (1 cuota o más)'],
        ['transferencia', 'Movimiento entre dos cuentas propias'],
        ['pago de tarjeta', 'Pago de saldo de tarjeta de crédito'],
        ['ajuste', 'Corrección manual de saldo o movimiento'],
        [],
        ['MEDIOS DE PAGO VÁLIDOS'],
        ['efectivo'],
        ['débito'],
        ['tarjeta de crédito'],
        ['transferencia'],
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
