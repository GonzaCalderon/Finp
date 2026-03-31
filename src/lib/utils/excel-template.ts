import ExcelJS from 'exceljs'

// Encabezados visibles en espanol (orden de columnas en la plantilla)
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
    'monto destino',
    'moneda destino',
    'cotización manual',
    'observaciones',
] as const

export type TemplateHeader = typeof TEMPLATE_HEADERS[number]

export interface TemplateOptions {
    accounts?: Array<{ name: string; currencyLabel: string }>
    categories?: Array<{ name: string; type: string }>
}

const COLORS = {
    ink: '20303C',
    inkSoft: '5D6B75',
    white: 'FFFFFF',
    slate: 'E8EEF2',
    slateSoft: 'F4F7F9',
    line: 'D8E1E8',
    common: 'DCEFE7',
    commonDark: '2F7A57',
    commonSoft: 'F4FBF7',
    type: 'DCE9F8',
    typeDark: '2563A6',
    typeSoft: 'F4F8FE',
    optional: 'F5E7CE',
    optionalDark: 'A16207',
    optionalSoft: 'FEFAF1',
    title: '0F5A4F',
    titleSoft: 'E2F4EE',
    noteSoft: 'F7F4EC',
    noteDark: '7C6534',
    example: 'FAFCFE',
    income: 'E8F7EE',
    expense: 'FDECEC',
    card: 'EAF4FD',
    exchange: 'E6F7F5',
    transfer: 'F2ECFC',
    adjustment: 'FFF4E6',
    payment: 'FEF0E7',
} as const

const TYPE_VALUES = [
    'ingreso',
    'gasto',
    'gasto con tc',
    'cambio',
    'transferencia',
    'ajuste',
    'pago de tarjeta',
]

const EXAMPLE_ROWS = [
    {
        fecha: '15/03/2026',
        tipo: 'gasto',
        'descripción': 'Supermercado Coto',
        monto: 12500,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': '',
        'categoría': 'Supermercado',
        cuotas: '',
        'mes de primer pago': '',
        'monto destino': '',
        'moneda destino': '',
        'cotización manual': '',
        observaciones: '',
    },
    {
        fecha: '14/03/2026',
        tipo: 'gasto con tc',
        'descripción': 'Notebook Samsung',
        monto: 900000,
        moneda: 'ARS',
        cuenta: 'Visa Santander',
        'cuenta destino': '',
        'categoría': 'Tecnología y herramientas',
        cuotas: 12,
        'mes de primer pago': '2026-04',
        'monto destino': '',
        'moneda destino': '',
        'cotización manual': '',
        observaciones: 'Comprada en Garbarino',
    },
    {
        fecha: '20/03/2026',
        tipo: 'cambio',
        'descripción': 'Compra de USD para ahorro',
        monto: 1200000,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': 'Ahorros USD',
        'categoría': '',
        cuotas: '',
        'mes de primer pago': '',
        'monto destino': 1000,
        'moneda destino': 'USD',
        'cotización manual': 1200,
        observaciones: '',
    },
    {
        fecha: '10/03/2026',
        tipo: 'ingreso',
        'descripción': 'Sueldo marzo',
        monto: 350000,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': '',
        'categoría': 'Sueldo',
        cuotas: '',
        'mes de primer pago': '',
        'monto destino': '',
        'moneda destino': '',
        'cotización manual': '',
        observaciones: '',
    },
    {
        fecha: '28/03/2026',
        tipo: 'pago de tarjeta',
        'descripción': '',
        monto: 120000,
        moneda: 'ARS',
        cuenta: 'Cuenta corriente',
        'cuenta destino': 'Visa Santander',
        'categoría': '',
        cuotas: '',
        'mes de primer pago': '',
        'monto destino': '',
        'moneda destino': '',
        'cotización manual': '',
        observaciones: '',
    },
    {
        fecha: '31/03/2026',
        tipo: 'ajuste',
        'descripción': 'Ajuste saldo billetera',
        monto: -1500,
        moneda: 'ARS',
        cuenta: 'Mercado Pago',
        'cuenta destino': '',
        'categoría': '',
        cuotas: '',
        'mes de primer pago': '',
        'monto destino': '',
        'moneda destino': '',
        'cotización manual': '',
        observaciones: 'Corrección manual',
    },
] satisfies Array<Record<TemplateHeader, string | number>>

const HEADER_HELP: Record<TemplateHeader, string> = {
    fecha: 'Obligatorio. Formato sugerido: DD/MM/AAAA.',
    tipo: 'Obligatorio. Usa uno de los tipos validos de Finp.',
    'descripción': 'Obligatoria salvo en transferencia, cambio y pago de tarjeta.',
    monto: 'Obligatorio. Usa numero positivo, excepto ajustes que pueden ser negativos.',
    moneda: 'Obligatoria. Valores validos: ARS o USD.',
    cuenta: 'Cuenta principal. En gasto con TC representa la tarjeta.',
    'cuenta destino': 'Para transferencia, cambio y pago de tarjeta.',
    'categoría': 'Solo para ingreso, gasto y gasto con TC.',
    cuotas: 'Solo para gasto con TC. Usa 1 si es una sola cuota.',
    'mes de primer pago': 'Solo para gasto con TC. Formato YYYY-MM.',
    'monto destino': 'Solo para cambio manual. Monto que ingresa en la moneda destino.',
    'moneda destino': 'Solo para cambio manual. Debe ser distinta de la moneda origen.',
    'cotización manual': 'Solo para cambio manual. Tipo de cambio usado en la operación.',
    observaciones: 'Campo opcional para notas o contexto adicional.',
}

function applyThinBorder(cell: ExcelJS.Cell) {
    cell.border = {
        top: { style: 'thin', color: { argb: COLORS.line } },
        left: { style: 'thin', color: { argb: COLORS.line } },
        bottom: { style: 'thin', color: { argb: COLORS.line } },
        right: { style: 'thin', color: { argb: COLORS.line } },
    }
}

function styleSectionTitle(cell: ExcelJS.Cell, fill: string, color: string) {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fill },
    }
    cell.font = {
        bold: true,
        color: { argb: color },
        size: 12,
    }
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
    }
    applyThinBorder(cell)
}

function styleHeaderCell(cell: ExcelJS.Cell) {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.ink },
    }
    cell.font = {
        bold: true,
        color: { argb: COLORS.white },
        size: 11,
    }
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
    }
    applyThinBorder(cell)
}

function styleDataCell(
    cell: ExcelJS.Cell,
    fill?: string,
    alignment?: Partial<ExcelJS.Alignment>
) {
    if (fill) {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fill },
        }
    }
    cell.font = { size: 10, color: { argb: COLORS.ink } }
    cell.alignment = { vertical: 'middle', ...alignment }
    applyThinBorder(cell)
}

function getRowFillByType(type?: string) {
    switch ((type ?? '').toLowerCase()) {
        case 'ingreso':
            return COLORS.income
        case 'gasto':
            return COLORS.expense
        case 'gasto con tc':
            return COLORS.card
        case 'cambio':
            return COLORS.exchange
        case 'transferencia':
            return COLORS.transfer
        case 'ajuste':
            return COLORS.adjustment
        case 'pago de tarjeta':
            return COLORS.payment
        default:
            return COLORS.example
    }
}

function addInfoBlock(sheet: ExcelJS.Worksheet, rowIndex: number, title: string, lines: string[]) {
    const titleCell = sheet.getCell(`A${rowIndex}`)
    titleCell.value = title
    titleCell.font = { bold: true, size: 12, color: { argb: COLORS.title } }
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.noteSoft },
    }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
    applyThinBorder(titleCell)

    lines.forEach((line, index) => {
        const cell = sheet.getCell(`A${rowIndex + 1 + index}`)
        cell.value = line
        cell.font = { size: 10, color: { argb: COLORS.inkSoft } }
        cell.alignment = { wrapText: true, vertical: 'top' }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.white },
        }
        applyThinBorder(cell)
    })
}

function styleListHeader(row: ExcelJS.Row) {
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: COLORS.white }, size: 10 }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.ink },
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        applyThinBorder(cell)
    })
}

export async function generateImportTemplate(options?: TemplateOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Finp'
    workbook.created = new Date()
    workbook.modified = new Date()

    const instructions = workbook.addWorksheet('Instrucciones', {
        views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    })
    instructions.properties.defaultRowHeight = 19
    instructions.properties.tabColor = { argb: COLORS.title }
    instructions.columns = [{ width: 88 }]
    instructions.mergeCells('A1:A2')
    const title = instructions.getCell('A1')
    title.value = 'Plantilla oficial Finp - Importacion de transacciones'
    title.font = { bold: true, size: 18, color: { argb: COLORS.title } }
    title.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.titleSoft },
    }
    title.alignment = { vertical: 'middle', horizontal: 'left' }
    applyThinBorder(title)

    const subtitle = instructions.getCell('A3')
    subtitle.value =
        'Completa la hoja "Transacciones" y usa "Listas" como referencia para nombres exactos y tipos validos.'
    subtitle.font = { size: 10, color: { argb: COLORS.inkSoft }, italic: true }
    subtitle.alignment = { vertical: 'middle', horizontal: 'left' }

    addInfoBlock(instructions, 4, 'Como usarla', [
        '1. Completa la hoja "Transacciones" con tus movimientos.',
        '2. No modifiques las dos primeras filas de encabezado.',
        '3. Cada tipo usa solo sus columnas correspondientes.',
        '4. Consulta la hoja "Listas" para copiar nombres exactos de cuentas y categorias.',
        '5. Si importas gasto con TC, completa tambien cuotas y mes de primer pago.',
        '6. Si importas un cambio manual, completa cuenta destino, monto destino, moneda destino y cotización.',
    ])

    addInfoBlock(instructions, 12, 'Campos obligatorios', [
        'fecha, tipo, monto y moneda siempre son obligatorios.',
        'descripcion es obligatoria salvo en transferencia, cambio y pago de tarjeta.',
        'cuenta destino aplica a transferencia, cambio y pago de tarjeta.',
        'categoria solo aplica a ingreso, gasto y gasto con TC.',
        'cuotas y mes de primer pago son obligatorios para gasto con TC.',
        'monto destino, moneda destino y cotización manual son obligatorios para cambio.',
    ])

    addInfoBlock(instructions, 20, 'Tips utiles', [
        'Usa una fila por movimiento.',
        'Si un nombre no coincide con Finp, la fila quedara marcada para revision.',
        'En pago de tarjeta: cuenta = cuenta que paga, cuenta destino = tarjeta.',
        'En gasto con TC: cuenta = tarjeta.',
        'En cambio: cuenta = origen, cuenta destino = destino, y la cotización queda guardada en la operación.',
    ])

    for (let row = 1; row <= instructions.rowCount; row += 1) {
        instructions.getRow(row).height = row <= 2 ? 24 : row === 3 ? 20 : 19
    }

    const sheet = workbook.addWorksheet('Transacciones', {
        views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
    })
    sheet.properties.defaultRowHeight = 21
    sheet.properties.tabColor = { argb: COLORS.typeDark }
    sheet.columns = [
        { key: 'fecha', width: 14 },
        { key: 'tipo', width: 18 },
        { key: 'descripcion', width: 30 },
        { key: 'monto', width: 14 },
        { key: 'moneda', width: 10 },
        { key: 'cuenta', width: 24 },
        { key: 'cuenta destino', width: 24 },
        { key: 'categoria', width: 26 },
        { key: 'cuotas', width: 10 },
        { key: 'mes de primer pago', width: 18 },
        { key: 'monto destino', width: 16 },
        { key: 'moneda destino', width: 14 },
        { key: 'cotización manual', width: 16 },
        { key: 'observaciones', width: 34 },
    ]

    sheet.mergeCells('A1:F1')
    sheet.mergeCells('G1:M1')
    const optionalGroup = sheet.getCell('N1')
    sheet.getCell('A1').value = 'Campos comunes'
    sheet.getCell('G1').value = 'Segun el tipo'
    optionalGroup.value = 'Opcional'
    sheet.getCell('A1').note = 'Campos presentes en la mayoria de los movimientos.'
    sheet.getCell('G1').note = 'Completa estas columnas segun el tipo de transaccion.'
    optionalGroup.note = 'Dato libre para aclaraciones o contexto.'

    styleSectionTitle(sheet.getCell('A1'), COLORS.common, COLORS.commonDark)
    styleSectionTitle(sheet.getCell('G1'), COLORS.type, COLORS.typeDark)
    styleSectionTitle(optionalGroup, COLORS.optional, COLORS.optionalDark)

    const headerRow = sheet.getRow(2)
    TEMPLATE_HEADERS.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1)
        cell.value = header
        styleHeaderCell(cell)
        cell.note = HEADER_HELP[header]
    })
    sheet.getRow(1).height = 23
    headerRow.height = 24

    EXAMPLE_ROWS.forEach((rowData) => {
        const row = sheet.addRow(
            TEMPLATE_HEADERS.map((header) => rowData[header] ?? '')
        )
        const rowFill = getRowFillByType(String(rowData.tipo))
        row.eachCell((cell, colNumber) => {
            styleDataCell(
                cell,
                rowFill,
                colNumber === 4
                    ? { horizontal: 'right' }
                    : colNumber === 1 || colNumber === 5 || colNumber === 9 || colNumber === 10 || colNumber === 12
                        ? { horizontal: 'center' }
                        : undefined
            )
            if ((colNumber === 4 || colNumber === 11 || colNumber === 13) && typeof cell.value === 'number') {
                cell.numFmt = '#,##0.00'
            }
            if (colNumber === 9 && typeof cell.value === 'number') {
                cell.alignment = { horizontal: 'center', vertical: 'middle' }
            }
        })
        row.height = 22
    })

    for (let rowNumber = 8; rowNumber <= 120; rowNumber += 1) {
        const row = sheet.getRow(rowNumber)
        TEMPLATE_HEADERS.forEach((header, index) => {
            const cell = row.getCell(index + 1)
            let fill: string = COLORS.white
            if (index <= 5) fill = COLORS.commonSoft
            if (index >= 6 && index <= 12) fill = COLORS.typeSoft
            if (index === 13) fill = COLORS.optionalSoft

            styleDataCell(
                cell,
                fill,
                index === 3
                    ? { horizontal: 'right' }
                    : index === 0 || index === 4 || index === 8 || index === 9 || index === 11
                        ? { horizontal: 'center' }
                        : undefined
            )
            if (header === 'monto' || header === 'monto destino' || header === 'cotización manual') {
                cell.numFmt = '#,##0.00'
            }
        })
        row.height = 21
    }

    sheet.autoFilter = {
        from: 'A2',
        to: 'N2',
    }

    const lists = workbook.addWorksheet('Listas', {
        views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    })
    lists.properties.defaultRowHeight = 20
    lists.properties.tabColor = { argb: COLORS.optionalDark }
    lists.columns = [
        { width: 40 },
        { width: 20 },
    ]

    lists.mergeCells('A1:B1')
    const listsTitle = lists.getCell('A1')
    listsTitle.value = 'Referencias Finp'
    listsTitle.font = { bold: true, size: 16, color: { argb: COLORS.title } }
    listsTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.titleSoft },
    }
    listsTitle.alignment = { vertical: 'middle', horizontal: 'left' }
    applyThinBorder(listsTitle)

    let currentRow = 3

    const addListSection = (titleText: string, headers: string[], rows: Array<Array<string>>) => {
        lists.mergeCells(`A${currentRow}:B${currentRow}`)
        const titleCell = lists.getCell(`A${currentRow}`)
        titleCell.value = titleText
        titleCell.font = { bold: true, color: { argb: COLORS.ink }, size: 12 }
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.slate },
        }
        applyThinBorder(titleCell)
        currentRow += 1

        const headerRowRef = lists.getRow(currentRow)
        headers.forEach((header, index) => {
            headerRowRef.getCell(index + 1).value = header
        })
        styleListHeader(headerRowRef)
        currentRow += 1
        const dataStartRow = currentRow

        rows.forEach((row) => {
            const inserted = lists.getRow(currentRow)
            row.forEach((value, index) => {
                const cell = inserted.getCell(index + 1)
                cell.value = value
                styleDataCell(
                    cell,
                    currentRow % 2 === 0 ? COLORS.slateSoft : COLORS.white,
                    index === 1 ? { horizontal: 'left' } : undefined
                )
            })
            currentRow += 1
        })
        const dataEndRow = currentRow - 1

        currentRow += 1

        return { dataStartRow, dataEndRow }
    }

    addListSection(
        'Tipos validos',
        ['Valor en plantilla', 'Descripcion'],
        [
            ['ingreso', 'Ingreso de dinero a una cuenta'],
            ['gasto', 'Egreso de dinero de una cuenta'],
            ['gasto con tc', 'Consumo con tarjeta de credito'],
            ['cambio', 'Cambio manual entre ARS y USD'],
            ['transferencia', 'Movimiento entre dos cuentas propias'],
            ['ajuste', 'Correccion manual'],
            ['pago de tarjeta', 'Pago de saldo de tarjeta'],
        ]
    )

    addListSection(
        'Columnas clave',
        ['Columna', 'Uso'],
        [
            ['cuenta', 'Cuenta principal del movimiento'],
            ['cuenta destino', 'Transferencia, cambio y pago de tarjeta'],
            ['cuotas', 'Solo gasto con TC'],
            ['mes de primer pago', 'Solo gasto con TC'],
            ['monto destino', 'Solo cambio manual'],
            ['moneda destino', 'Solo cambio manual'],
            ['cotización manual', 'Solo cambio manual'],
        ]
    )

    const accountSection = addListSection(
        'Tus cuentas en Finp',
        ['Nombre de cuenta', 'Moneda'],
        options?.accounts?.length
            ? options.accounts.map((account) => [account.name, account.currencyLabel])
            : [['No tienes cuentas activas en Finp todavia', '']]
    )

    const categorySection = addListSection(
        'Tus categorias en Finp',
        ['Nombre de categoria', 'Tipo'],
        options?.categories?.length
            ? options.categories.map((category) => [
                category.name,
                category.type === 'expense' ? 'gasto' : 'ingreso',
            ])
            : [['No tienes categorias activas en Finp todavia', '']]
    )

    for (let rowNumber = 3; rowNumber <= 250; rowNumber += 1) {
        sheet.getCell(`B${rowNumber}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`"${TYPE_VALUES.join(',')}"`],
            showErrorMessage: true,
            errorTitle: 'Tipo invalido',
            error: 'Usa uno de los tipos validos de la plantilla.',
        }

        sheet.getCell(`E${rowNumber}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"ARS,USD"'],
            showErrorMessage: true,
            errorTitle: 'Moneda invalida',
            error: 'Usa ARS o USD.',
        }

        sheet.getCell(`I${rowNumber}`).dataValidation = {
            type: 'whole',
            operator: 'greaterThan',
            formulae: [0],
            allowBlank: true,
            showErrorMessage: true,
            errorTitle: 'Cuotas invalidas',
            error: 'Usa un numero entero mayor a 0.',
        }

        sheet.getCell(`K${rowNumber}`).dataValidation = {
            type: 'decimal',
            operator: 'greaterThan',
            formulae: [0],
            allowBlank: true,
            showErrorMessage: true,
            errorTitle: 'Monto destino invalido',
            error: 'Usa un numero mayor a 0 cuando cargues un cambio manual.',
        }

        sheet.getCell(`L${rowNumber}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"ARS,USD"'],
            showErrorMessage: true,
            errorTitle: 'Moneda destino invalida',
            error: 'Usa ARS o USD.',
        }

        sheet.getCell(`M${rowNumber}`).dataValidation = {
            type: 'decimal',
            operator: 'greaterThan',
            formulae: [0],
            allowBlank: true,
            showErrorMessage: true,
            errorTitle: 'Cotización invalida',
            error: 'Usa un numero mayor a 0 para la cotización manual.',
        }

        if (options?.accounts?.length) {
            const accountsFormula = `'Listas'!$A$${accountSection.dataStartRow}:$A$${accountSection.dataEndRow}`
            sheet.getCell(`F${rowNumber}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [accountsFormula],
                showErrorMessage: true,
                errorTitle: 'Cuenta invalida',
                error: 'Selecciona una cuenta existente en Finp.',
            }
            sheet.getCell(`G${rowNumber}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [accountsFormula],
                showErrorMessage: true,
                errorTitle: 'Cuenta invalida',
                error: 'Selecciona una cuenta existente en Finp.',
            }
        }

        if (options?.categories?.length) {
            const categoriesFormula = `'Listas'!$A$${categorySection.dataStartRow}:$A$${categorySection.dataEndRow}`
            sheet.getCell(`H${rowNumber}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [categoriesFormula],
                showErrorMessage: true,
                errorTitle: 'Categoria invalida',
                error: 'Selecciona una categoria existente en Finp.',
            }
        }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
}
