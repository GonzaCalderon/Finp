'use client'

import { useEffect, useRef, useState } from 'react'
import { FileImage, FileText, Loader2, Paperclip, RotateCcw, Trash2, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SpaceDialogPanel, SpaceDialogSectionEyebrow } from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { formatAttachmentSize } from '@/components/spaces/dialogs/SpaceAttachmentsUploader'
import { cn } from '@/lib/utils'
import type { SpaceEntryDraftAttachmentDto } from '@/types'

type LocalUpload = {
    id: string
    file: File
    idempotencyKey: string
    message?: string
}

function newKey() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function AttachmentIcon({ mimeType, loading = false }: { mimeType: string; loading?: boolean }) {
    if (loading) return <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
    if (mimeType === 'application/pdf') return <FileText className="h-5 w-5" aria-hidden="true" />
    if (mimeType.startsWith('image/')) return <FileImage className="h-5 w-5" aria-hidden="true" />
    return <Paperclip className="h-5 w-5" aria-hidden="true" />
}

export function SpaceDraftAttachmentsUploader({
    attachments,
    disabled = false,
    onUpload,
    onRemove,
    onBlockingChange,
}: {
    attachments: SpaceEntryDraftAttachmentDto[]
    disabled?: boolean
    onUpload: (file: File, idempotencyKey: string, attachmentId?: string) => Promise<void>
    onRemove: (attachmentId: string) => Promise<void>
    onBlockingChange?: (blocked: boolean) => void
}) {
    const [dragging, setDragging] = useState(false)
    const [uploads, setUploads] = useState<LocalUpload[]>([])
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [retryTarget, setRetryTarget] = useState<string | undefined>()
    const [announcement, setAnnouncement] = useState('')
    const inputRef = useRef<HTMLInputElement | null>(null)
    const triggerRef = useRef<HTMLButtonElement | null>(null)

    const processFile = async (file: File, attachmentId?: string) => {
        const localId = newKey()
        const idempotencyKey = newKey()
        setUploads((current) => [...current, { id: localId, file, idempotencyKey }])
        setAnnouncement(`Subiendo ${file.name}`)
        try {
            await onUpload(file, idempotencyKey, attachmentId)
            setUploads((current) => current.filter((item) => item.id !== localId))
            setAnnouncement(`${file.name} está listo`)
        } catch (error) {
            const persistedAttachmentId = error && typeof error === 'object' && 'attachmentId' in error
                ? (error as { attachmentId?: unknown }).attachmentId
                : undefined
            setUploads((current) => typeof persistedAttachmentId === 'string'
                ? current.filter((item) => item.id !== localId)
                : current.map((item) => item.id === localId
                    ? { ...item, message: error instanceof Error ? error.message : 'No se pudo subir' }
                    : item))
            setAnnouncement(`No se pudo subir ${file.name}`)
            requestAnimationFrame(() => document.getElementById(`draft-upload-${localId}`)?.focus())
        }
    }

    const processFiles = async (files: File[]) => {
        const available = Math.max(0, 5 - attachments.length - uploads.length)
        for (const file of files.slice(0, available)) {
            await processFile(file)
        }
        if (files.length > available) setAnnouncement('Cada movimiento admite hasta 5 archivos.')
    }

    const selectFiles = (files: FileList | null) => {
        if (!files?.length || disabled) return
        const selected = Array.from(files)
        if (retryTarget) {
            const target = retryTarget
            setRetryTarget(undefined)
            void processFile(selected[0], target)
        } else {
            void processFiles(selected)
        }
        if (inputRef.current) inputRef.current.value = ''
    }

    const remove = async (attachmentId: string) => {
        setRemovingId(attachmentId)
        setAnnouncement('Quitando archivo')
        try {
            await onRemove(attachmentId)
            setAnnouncement('Archivo quitado')
            requestAnimationFrame(() => triggerRef.current?.focus())
        } catch (error) {
            setAnnouncement(error instanceof Error ? error.message : 'No se pudo quitar el archivo')
            requestAnimationFrame(() => document.getElementById(`draft-attachment-${attachmentId}`)?.focus())
        } finally {
            setRemovingId(null)
        }
    }

    const unresolved = attachments.some((item) => item.status !== 'ready') || uploads.length > 0

    useEffect(() => {
        onBlockingChange?.(unresolved)
    }, [onBlockingChange, unresolved])

    return (
        <SpaceDialogPanel>
            <div className="space-y-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <SpaceDialogSectionEyebrow>Comprobantes</SpaceDialogSectionEyebrow>
                        <span className="rounded-full border border-border/80 bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Opcional
                        </span>
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">Adjuntá imágenes o PDF</h3>
                    <p className="text-sm text-muted-foreground">
                        Hasta 5 archivos JPG, PNG, WebP o PDF de 10 MB. Se guardan de forma privada con el borrador.
                    </p>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple={!retryTarget}
                    disabled={disabled}
                    className="sr-only"
                    aria-label={retryTarget ? 'Elegir reemplazo para el archivo' : 'Elegir comprobantes'}
                    onChange={(event) => selectFiles(event.target.files)}
                />

                <Button
                    ref={triggerRef}
                    type="button"
                    variant="outline"
                    className={cn(
                        'min-h-11 w-full rounded-[22px] border-dashed py-6',
                        dragging && 'border-primary bg-primary/5'
                    )}
                    disabled={disabled || attachments.length + uploads.length >= 5}
                    onClick={() => inputRef.current?.click()}
                    onDragEnter={() => setDragging(true)}
                    onDragLeave={() => setDragging(false)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                        event.preventDefault()
                        setDragging(false)
                        void processFiles(Array.from(event.dataTransfer.files))
                    }}
                >
                    <UploadCloud className="h-5 w-5" aria-hidden="true" />
                    Seleccionar archivos
                </Button>

                <div className="space-y-2">
                    {attachments.map((attachment) => {
                        const removing = removingId === attachment.id
                        const status = removing
                            ? 'Quitando…'
                            : attachment.status === 'ready'
                                ? 'Listo'
                                : attachment.status === 'preparing'
                                    ? 'Subiendo…'
                                    : 'No se pudo subir'
                        return (
                            <div
                                id={`draft-attachment-${attachment.id}`}
                                key={attachment.id}
                                tabIndex={-1}
                                className="flex min-h-11 items-center gap-3 rounded-[20px] border border-border/80 bg-background/70 p-3"
                            >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                                    <AttachmentIcon mimeType={attachment.mimeType} loading={attachment.status === 'preparing' || removing} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">{attachment.fileName}</p>
                                    <p className={cn('text-xs', attachment.status === 'upload_failed' ? 'text-destructive' : 'text-muted-foreground')}>
                                        {attachment.mimeType} · {formatAttachmentSize(attachment.size)} · {status}
                                    </p>
                                </div>
                                {attachment.status === 'upload_failed' ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="min-h-11 rounded-full"
                                        disabled={disabled || removing}
                                        onClick={() => {
                                            setRetryTarget(attachment.id)
                                            inputRef.current?.click()
                                        }}
                                    >
                                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                        Reintentar
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="min-h-11 min-w-11 rounded-full"
                                    disabled={disabled || removing}
                                    aria-label={`Quitar ${attachment.fileName}`}
                                    onClick={() => void remove(attachment.id)}
                                >
                                    {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </div>
                        )
                    })}

                    {uploads.map((upload) => (
                        <div
                            id={`draft-upload-${upload.id}`}
                            key={upload.id}
                            tabIndex={-1}
                            className="flex min-h-11 items-center gap-3 rounded-[20px] border border-border/80 bg-background/70 p-3"
                        >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                                <AttachmentIcon mimeType={upload.file.type} loading={!upload.message} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{upload.file.name}</p>
                                <p className={cn('text-xs', upload.message ? 'text-destructive' : 'text-muted-foreground')}>
                                    {formatAttachmentSize(upload.file.size)} · {upload.message ?? 'Subiendo…'}
                                </p>
                            </div>
                            {upload.message ? (
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="min-h-11 rounded-full"
                                        onClick={() => {
                                            setUploads((current) => current.filter((item) => item.id !== upload.id))
                                            void processFile(upload.file)
                                        }}
                                    >
                                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                        Reintentar
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="min-h-11 min-w-11 rounded-full"
                                        aria-label={`Quitar ${upload.file.name}`}
                                        onClick={() => setUploads((current) => current.filter((item) => item.id !== upload.id))}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>

                {unresolved ? (
                    <p className="text-xs text-muted-foreground" data-testid="space-draft-attachment-blocker">
                        Esperá la carga o resolvé los archivos con error antes de guardar el gasto.
                    </p>
                ) : null}
                <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
            </div>
        </SpaceDialogPanel>
    )
}
