'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

/**
 * Galería de ejemplos por objetivo, recuperable desde `¿Qué puedo escribir?`.
 *
 * Sólo anuncia capacidades realmente disponibles.
 */
const EXAMPLE_GROUPS: Array<{ goal: string; hint: string; examples: string[] }> = [
    {
        goal: 'Registrar un gasto o ingreso',
        hint: 'Escribí monto y descripción en cualquier orden. La fecha, la cuenta y la categoría se completan solas.',
        examples: ['Café 1500 ayer mp', 'Supermercado 38500 mp', 'Cobré 800000 sueldo galicia'],
    },
    {
        goal: 'Registrar compras y pagos de tarjeta',
        hint: 'Nombrá la tarjeta. Una compra simple se confirma acá; las cuotas y el pago del resumen conservan los datos y abren el flujo completo.',
        examples: [
            'Supermercado 38500 Visa',
            'Notebook 120000 Visa en 6 cuotas',
            'Pagué el resumen Visa 50000',
        ],
    },
    {
        goal: 'Preparar un compromiso mensual',
        hint: 'Si mencionás una recurrencia, Finp prepara el compromiso y abre su configuración.',
        examples: [
            'Alquiler 650000 el 5 de cada mes',
            'Internet 45000 mensual',
            'Luz mensual monto variable',
        ],
    },
    {
        goal: 'Aplicar un compromiso pendiente',
        hint: 'Si el texto coincide con algo que ya tenés pendiente, te lo ofrece antes de duplicarlo.',
        examples: ['Pagué alquiler 675000 hoy mp', 'Expensas 92000'],
    },
    {
        goal: 'Fechas en tu idioma',
        hint: 'Entiende fechas relativas y días de la semana.',
        examples: ['Nafta 54000 antes de ayer', 'Farmacia 8200 el martes', 'Peaje 1200 hace 3 días'],
    },
]

interface CaptureHelpPanelProps {
    onClose: () => void
    onPickExample: (example: string) => void
}

export function CaptureHelpPanel({ onClose, onPickExample }: CaptureHelpPanelProps) {
    return (
        <div
            data-testid="capture-help-panel"
            className="rounded-xl border bg-muted/30 p-3"
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-medium">¿Qué puedo escribir?</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Escribí como hablás. Finp registra el movimiento o te guía hacia la
                        función correcta.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label="Cerrar ayuda"
                    onClick={onClose}
                >
                    <X className="size-3.5" />
                </Button>
            </div>

            <div className="mt-3 space-y-3">
                {EXAMPLE_GROUPS.map((group) => (
                    <div key={group.goal}>
                        <p className="text-xs font-medium text-foreground">{group.goal}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                            {group.hint}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {group.examples.map((example) => (
                                <button
                                    key={example}
                                    type="button"
                                    // Los ejemplos son accionables: tocarlos los escribe.
                                    onClick={() => onPickExample(example)}
                                    className="rounded-full border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
