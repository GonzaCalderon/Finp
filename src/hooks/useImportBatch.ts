'use client'

import { useState, useCallback } from 'react'
import type { IImportBatch, IImportRow, ImportParsedData } from '@/types'

interface BatchDetail {
    batch: IImportBatch
    rows: IImportRow[]
}

export function useImportBatches() {
    const [batches, setBatches] = useState<IImportBatch[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchBatches = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/import')
            if (!res.ok) throw new Error('Error al cargar historial')
            const data = await res.json()
            setBatches(data.batches)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
        } finally {
            setLoading(false)
        }
    }, [])

    const uploadFile = useCallback(async (file: File): Promise<string> => {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/import', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al subir archivo')
        return data.batchId
    }, [])

    const deleteBatch = useCallback(async (batchId: string) => {
        const res = await fetch(`/api/import/${batchId}`, { method: 'DELETE' })
        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error ?? 'Error al eliminar importación')
        }
        setBatches((prev) => prev.filter((b) => String(b._id) !== batchId))
    }, [])

    return { batches, loading, error, fetchBatches, uploadFile, deleteBatch }
}

export function useImportBatchDetail(batchId: string) {
    const [detail, setDetail] = useState<BatchDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchDetail = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/import/${batchId}`)
            if (!res.ok) throw new Error('Error al cargar importación')
            const data = await res.json()
            setDetail(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
        } finally {
            setLoading(false)
        }
    }, [batchId])

    const updateRow = useCallback(
        async (rowId: string, updates: { reviewedData?: Partial<ImportParsedData>; ignored?: boolean }) => {
            const res = await fetch(`/api/import/${batchId}/rows/${rowId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Error al actualizar fila')

            // Actualizar estado local
            setDetail((prev) => {
                if (!prev) return prev
                return {
                    batch: { ...prev.batch, summary: data.summary },
                    rows: prev.rows.map((r) => (String(r._id) === rowId ? data.row : r)),
                }
            })

            return data
        },
        [batchId]
    )

    const confirmImport = useCallback(async () => {
        const res = await fetch(`/api/import/${batchId}/confirm`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al confirmar importación')
        // Refrescar detalle
        await fetchDetail()
        return data
    }, [batchId, fetchDetail])

    return { detail, loading, error, fetchDetail, updateRow, confirmImport }
}
