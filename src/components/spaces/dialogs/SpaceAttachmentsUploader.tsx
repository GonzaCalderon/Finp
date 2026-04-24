'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { FileImage, FileText, ImagePlus, Paperclip, Trash2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpaceDialogPanel, SpaceDialogSectionEyebrow } from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { cn } from '@/lib/utils'

export type SpaceAttachmentDraft = {
    id: string
    file: File
    previewUrl?: string
}

function formatFileSize(size: number) {
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
    attachments,
    onFilesSelected,
    onRemove,
}: {
    attachments: SpaceAttachmentDraft[]
    onFilesSelected: (files: File[]) => void
    onRemove: (id: string) => void
}) {
    const [dragging, setDragging] = useState(false)
    const inputRef = useRef<HTMLInputElement | null>(null)

    const handleFiles = (files: FileList | null) => {
        if (!files?.length) return
        onFilesSelected(Array.from(files))
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
                        Tickets, facturas o capturas como respaldo del movimiento. No es obligatorio adjuntar nada.
                    </p>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(event) => handleFiles(event.target.files)}
                />

                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragEnter={() => setDragging(true)}
                    onDragLeave={() => setDragging(false)}
                    onDragOver={(event) => {
                        event.preventDefault()
                        setDragging(true)
                    }}
                    onDrop={(event) => {
                        event.preventDefault()
                        setDragging(false)
                        handleFiles(event.dataTransfer.files)
                    }}
                    className={cn(
                        'flex w-full flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed px-5 py-8 text-center transition-colors',
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
                    <Button type="button" variant="outline" className="rounded-full">
                        <ImagePlus className="h-4 w-4" />
                        Seleccionar archivos
                    </Button>
                </button>

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
                                            {attachment.file.type || 'Archivo'} · {formatFileSize(attachment.file.size)}
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="rounded-full"
                                        onClick={() => onRemove(attachment.id)}
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
