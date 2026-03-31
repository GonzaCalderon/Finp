'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Download, FileSpreadsheet, ArrowLeft, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/shared/Spinner'
import { useImportBatches } from '@/hooks/useImportBatch'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function ImportPage() {
    usePageTitle('Importar transacciones')

    const router = useRouter()
    const { uploadFile } = useImportBatches()
    const { success, error: toastError } = useToast()

    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [fileError, setFileError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = useCallback(
        async (file: File) => {
            setFileError(null)
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                setFileError('Solo se aceptan archivos .xlsx o .xls')
                return
            }

            setUploading(true)
            try {
                const batchId = await uploadFile(file)
                success('Archivo procesado. Revisá las filas antes de confirmar.')
                router.push(`/transactions/import/${batchId}`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Error al procesar el archivo'
                setFileError(msg)
                toastError(msg)
            } finally {
                setUploading(false)
            }
        },
        [uploadFile, success, toastError, router]
    )

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
        e.target.value = ''
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }

    const downloadTemplate = () => {
        window.location.href = '/api/import/template'
    }

    return (
        <div className="flex flex-col min-h-full">
            <div className="flex items-center gap-3 px-4 md:px-6 py-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/transactions')}
                    className="gap-1.5"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Transacciones
                </Button>
            </div>

            <motion.div
                className="flex-1 px-4 md:px-6 pb-8 max-w-xl mx-auto w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="mb-6">
                    <h1 className="text-xl font-semibold">Importar transacciones</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Subí la nueva plantilla oficial de Finp con cuentas, cuenta destino, cuotas y mes de primer pago según corresponda.
                    </p>
                </div>

                {/* Descargar plantilla */}
                <div
                    className="rounded-xl border p-4 mb-5 flex items-center justify-between gap-4"
                    style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(34, 197, 94, 0.15)' }}
                        >
                            <FileSpreadsheet className="w-4 h-4" style={{ color: '#16a34a' }} />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Plantilla oficial Finp</p>
                            <p className="text-xs text-muted-foreground">
                                Descargala con el esquema actualizado y luego subila acá
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 flex-shrink-0">
                        <Download className="w-3.5 h-3.5" />
                        Descargar
                    </Button>
                </div>

                {/* Zona de carga */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !uploading && inputRef.current?.click()}
                    onKeyDown={(e) => e.key === 'Enter' && !uploading && inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className="rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2"
                    style={{
                        borderColor: dragOver ? 'var(--sky)' : fileError ? 'var(--destructive)' : 'var(--border)',
                        background: dragOver ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                    }}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleInputChange}
                        disabled={uploading}
                    />

                    {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Spinner className="w-8 h-8" />
                            <p className="text-sm text-muted-foreground">Procesando archivo…</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ background: 'var(--secondary)' }}
                            >
                                <Upload className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">
                                    Arrastrá tu archivo acá o hacé clic para seleccionarlo
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Solo archivos .xlsx o .xls
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {fileError && (
                    <div
                        className="mt-3 flex items-start gap-2 rounded-lg p-3 text-sm"
                        style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--destructive)' }}
                    >
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{fileError}</span>
                    </div>
                )}

                {/* Instrucciones */}
                <div className="mt-6 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Cómo funciona
                    </p>
                    {[
                        'Descargá la plantilla oficial y completá fecha, tipo, cuenta y los campos específicos de cada movimiento.',
                        'Subí el archivo: Finp lo procesa y detecta errores automáticamente.',
                        'Revisá las filas por tipo, editá inline lo necesario y aplicá los cambios.',
                        'Confirmá para crear todas las transacciones en tu cuenta.',
                    ].map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5"
                                style={{ background: 'var(--sky)', color: '#fff' }}
                            >
                                {i + 1}
                            </span>
                            <p className="text-sm text-muted-foreground">{step}</p>
                        </div>
                    ))}
                </div>

                {/* Historial */}
                <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/transactions/import/history')}
                        className="text-muted-foreground"
                    >
                        Ver historial de importaciones
                    </Button>
                </div>
            </motion.div>
        </div>
    )
}
