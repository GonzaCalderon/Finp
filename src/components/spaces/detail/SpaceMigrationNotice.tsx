import type { SpaceDetailDto } from '@/types'

export function SpaceMigrationNotice({
    status,
}: {
    status: Pick<SpaceDetailDto, 'migration' | 'readMode'>
}) {
    if (!status.migration.readOnly && status.readMode !== 'legacy_incompatible') return null
    const migrationBlocked = status.migration.state === 'blocked'
    return (
        <div
            className="rounded-2xl border border-warning/25 bg-warning-soft p-4 text-sm text-warning-foreground"
            role="status"
        >
            {migrationBlocked
                ? 'Este Espacio necesita una revisión antes de migrar. Su historia sigue disponible, pero las acciones y los totales quedan pausados para no mostrar un saldo parcial.'
                : 'Este Espacio conserva su historia, pero Finp no puede calcular sus saldos con precisión. Está disponible sólo para consulta hasta revisar los datos legacy.'}
        </div>
    )
}
