'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
    Eye,
    FileImage,
    FileText,
    ImagePlus,
    Loader2,
    Paperclip,
    Trash2,
    UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { extractId } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'
import type { ISpaceEntryAttachment } from '@/types'

export type SpaceAttachmentDraft = {
    id: string
    file: File
    previewUrl?: string
}

export function formatAttachmentSize(size: number) {
    if (size >= 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(1)} MB`
    }

    if (size >= 1024) {
        return `${Math.round(size / 1024)} KB`
    }

    return `${size} B`
}

function isImage(file: File) {
    return file.type.startsWith('image/')
}

function isPdf(file: File) {
    return file.type === 'application/pdf'
}

export function SpaceAttachmentsUploader({
    attachments = [],
    onFilesSelected,
    onRemove,
    entryId,
    spaceId,
    existingAttachments = [],
    onAttachmentUploaded,
    onAttachmentDeleted,
    disabled = false,
}: {
    attachments?: SpaceAttachmentDraft[]
    onFilesSelected?: (files: File[]) => void
    onRemove?: (id: string) => void
    entryId?: string
    spaceId?: string
    existingAttachments?: ISpaceEntryAttachment[]
    onAttachmentUploaded?: (attachment: ISpaceEntryAttachment) => void
    onAttachmentDeleted?: (attachmentId: string) => void
    disabled?: boolean
}) {
    const [dragging, setDragging] = useState(false)
    const [persistedAttachments, setPersistedAttachments] = useState(existingAttachments)
    const [uploadingFiles, setUploadingFiles] = useState<Array<{
        id: string
        name: string
        size: number
        type: string
    }>>([])
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const liveMode = Boolean(spaceId && entryId)

    useEffect(() => {
        setPersistedAttachments(existingAttachments)
    }, [existingAttachments])

    const uploadFile = async (file: File) => {
        if (!spaceId || !entryId) return

        const uploadId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${file.name}`

        setUploadingFiles((previous) => [
            ...previous,
            { id: uploadId, name: file.name, size: file.size, type: file.type },
        ])
        setError(null)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const data = await apiJson<{ attachment: ISpaceEntryAttachment }>(
                `/api/spaces/${spaceId}/entries/${entryId}/attachments`,
                {
                    method: 'POST',
                    body: formData,
                }
            )

            setPersistedAttachments((previous) => [...previous, data.attachment])
            onAttachmentUploaded?.(data.attachment)
            invalidateData(SPACE_INVALIDATION_TAGS)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos subir el comprobante.')
        } finally {
            setUploadingFiles((previous) => previous.filter((item) => item.id !== uploadId))
        }
    }

    const handleFiles = (files: FileList | null) => {
        if (!files?.length || disabled) return

        const selectedFiles = Array.from(files)
        if (liveMode) {
            selectedFiles.forEach((file) => void uploadFile(file))
            return
        }

        onFilesSelected?.(selectedFiles)
    }

    const handleDeletePersisted = async (attachmentId: string) => {
        if (!spaceId || !entryId || disabled) return

        setDeletingId(attachmentId)
        setError(null)

        try {
            await apiJson(`/api/spaces/${spaceId}/entries/${entryId}/attachments/${attachmentId}`, {
                method: 'DELETE',
            })

            setPersistedAttachments((previous) =>
                previous.filter((attachment) => extractId(attachment._id) !== attachmentId)
            )
            onAttachmentDeleted?.(attachmentId)
            invalidateData(SPACE_INVALIDATION_TAGS)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos borrar el comprobante.')
        } finally {
            setDeletingId(null)
        }
    }

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
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        Adjuntá imágenes o PDF
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Tickets, facturas o capturas como respaldo del movimiento.
                    </p>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    disabled={disabled}
                    className="hidden"
                    onChange={(event) => handleFiles(event.target.files)}
                />

                <div
                    onClick={() => !disabled && inputRef.current?.click()}
                    onDragEnter={() => !disabled && setDragging(true)}
                    onDragLeave={() => setDragging(false)}
                    onDragOver={(event) => {
                        event.preventDefault()
                        if (!disabled) setDragging(true)
                    }}
                    onDrop={(event) => {
                        event.preventDefault()
                        setDragging(false)
                        handleFiles(event.dataTransfer.files)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            if (!disabled) inputRef.current?.click()
                        }
                    }}
                    className={cn(
                        'flex w-full flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed px-5 py-8 text-center transition-colors',
                        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                        dragging
                            ? 'border-primary/30 bg-primary/8 text-primary'
                            : 'border-border bg-background/70 text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground'
                    )}
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UploadCloud className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                            Arrastrá imágenes o PDF acá
                        </p>
                        <p className="text-xs text-muted-foreground">
                            También podés seleccionar desde tus archivos.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={(event) => {
                            event.stopPropagation()
                            if (!disabled) inputRef.current?.click()
                        }}
                        disabled={disabled}
                    >
                        <ImagePlus className="h-4 w-4" />
                        Seleccionar archivos
                    </Button>
                </div>

                {error ? (
                    <p className="rounded-[18px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {error}
                    </p>
                ) : null}

                <p className="text-xs text-muted-foreground">
                    Los comprobantes se conservan por hasta 3 meses para optimizar el almacenamiento.
                </p>

                {persistedAttachments.length > 0 || uploadingFiles.length > 0 ? (
                    <div className="space-y-3">
                        {persistedAttachments.map((attachment) => {
                            const attachmentId = extractId(attachment._id) ?? ''
                            const viewHref = spaceId && entryId && attachmentId
                                ? `/api/spaces/${spaceId}/entries/${entryId}/attachments/${attachmentId}`
                                : undefined
                            const attachmentIsImage = attachment.mimeType.startsWith('image/')
                            const attachmentIsPdf = attachment.mimeType === 'application/pdf'

                            return (
                                <div
                                    key={attachmentId || attachment.storageKey}
                                    className="rounded-[22px] border border-foreground/[0.07] bg-background/72 p-3"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
                                            {attachmentIsPdf ? (
                                                <FileText className="h-6 w-6" />
                                            ) : attachmentIsImage ? (
                                                <FileImage className="h-6 w-6" />
                                            ) : (
                                                <Paperclip className="h-6 w-6" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1 space-y-1">
                                            <p className="truncate text-sm font-semibold text-foreground">
                                                {attachment.fileName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {attachment.mimeType || 'Archivo'} · {formatAttachmentSize(attachment.size)}
                                            </p>
                                        </div>

                                        {viewHref ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="rounded-full"
                                                asChild
                                            >
                                                <a href={viewHref} target="_blank" rel="noreferrer">
                                                    <Eye className="h-4 w-4" />
                                                    <span className="sr-only">Ver comprobante</span>
                                                </a>
                                            </Button>
                                        ) : null}

                                        {liveMode ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="rounded-full"
                                                onClick={() => void handleDeletePersisted(attachmentId)}
                                                disabled={deletingId === attachmentId || disabled}
                                            >
                                                {deletingId === attachmentId ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                                <span className="sr-only">Quitar adjunto</span>
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}

                        {uploadingFiles.map((file) => (
                            <div
                                key={file.id}
                                className="rounded-[22px] border border-foreground/[0.07] bg-background/72 p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Subiendo · {formatAttachmentSize(file.size)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}

                {attachments.length > 0 ? (
                    <div className="space-y-3">
                        {attachments.map((attachment) => (
                            <div
                                key={attachment.id}
                                className="rounded-[22px] border border-foreground/[0.07] bg-background/72 p-3"
                            >
                                <div className="flex items-start gap-3">
                                    {isImage(attachment.file) && attachment.previewUrl ? (
                                        <Image
                                            src={attachment.previewUrl}
                                            alt={attachment.file.name}
                                            width={64}
                                            height={64}
                                            unoptimized
                                            className="h-16 w-16 rounded-[16px] object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
                                            {isPdf(attachment.file) ? (
                                                <FileText className="h-6 w-6" />
                                            ) : isImage(attachment.file) ? (
                                                <FileImage className="h-6 w-6" />
                                            ) : (
                                                <Paperclip className="h-6 w-6" />
                                            )}
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {attachment.file.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {attachment.file.type || 'Archivo'} · {formatAttachmentSize(attachment.file.size)}
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="rounded-full"
                                        onClick={() => onRemove?.(attachment.id)}
                                        disabled={disabled}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Quitar adjunto</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </SpaceDialogPanel>
    )
}
