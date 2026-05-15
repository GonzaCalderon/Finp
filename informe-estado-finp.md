# Informe de estado actual de Finp

Estado relevado: 15 de mayo de 2026.

## Resumen ejecutivo

Finp es una aplicación web de gestión financiera personal construida con Next.js, React, TypeScript, MongoDB y NextAuth. El producto ya cubre un flujo funcional amplio: registro de usuarios, autenticación, cuentas multi-moneda, transacciones, tarjetas de crédito, cuotas, compromisos recurrentes, dashboard financiero, proyección, reglas automáticas de categorización, configuración de usuario, categorías e importación desde Excel. Además, cuenta con módulos completos de Espacios compartidos, Deudas personales y un sistema de notificaciones globales.

El estado actual es el de una app web funcional con experiencia responsive y una capa de dominio considerable. Todavía no es una app mobile nativa ni una PWA offline-first. La experiencia mobile existe dentro del navegador mediante layout responsive, sidebar desktop y bottom navigation mobile, pero los datos dependen del backend y de MongoDB en línea.

## Stack técnico

### Runtime y framework

- Framework principal: Next.js `16.1.7`, App Router.
- UI: React `19.2.3` y React DOM `19.2.3`.
- Lenguaje: TypeScript.
- Estilos: Tailwind CSS 4, CSS variables globales y componentes UI propios basados en patrones tipo shadcn/Radix.
- Animación: Framer Motion.
- Iconografía: Lucide React.
- Formularios: React Hook Form con Zod.
- Validación: Zod.
- Gráficos: Recharts, D3 y d3-sankey.
- Fechas: date-fns y utilidades propias de período financiero.
- Excel: `exceljs` y `xlsx`.

### Backend y persistencia

- Backend: Route Handlers de Next.js bajo `src/app/api`.
- Base de datos: MongoDB a través de Mongoose.
- Conexión DB: `src/lib/db/index.ts` mantiene cache global de conexión para evitar reconexiones en desarrollo/serverless.
- Autenticación: NextAuth v5 beta con provider de credenciales.
- Hash de contraseña: bcryptjs.
- Sesión: JWT, con `maxAge` de 1 hora y `updateAge` de 30 minutos.

### Testing y calidad

- Unit tests: Vitest con entorno jsdom.
- E2E: Playwright con proyectos desktop Chromium y mobile Chromium.
- CI: GitHub Actions con jobs de lint, build y unit tests.
- E2E en CI: preparado pero comentado/desactivado por defecto.

## Estructura general del proyecto

```text
src/
  app/
    (auth)/                 Login y registro
    (app)/                  Area autenticada
    api/                    Endpoints internos
    modules/                Modulos por dominio
  components/
    shared/                 Componentes de producto
    ui/                     Primitivas UI
  contexts/                 Providers de estado global cliente
  hooks/                    Hooks de datos e interaccion
  lib/
    client/                 Helpers cliente
    constants/              Constantes de dominio
    db/                     Conexion MongoDB
    env/                    Configuracion de entorno
    models/                 Modelos Mongoose
    utils/                  Logica de dominio reutilizable
    validations/            Schemas Zod
  types/                    Tipos compartidos
tests/
  unit/
  e2e/
```

El README actual sigue siendo el README base de Next.js y no documenta todavía el dominio, setup real, decisiones técnicas ni operación de Finp.

## Estado funcional del producto

### Autenticación y usuario

Funcionalidades disponibles:

- Registro con email, contraseña y nombre.
- Login con credenciales.
- Validación de formularios con React Hook Form y Zod.
- Redirección a la vista por defecto del usuario.
- Redirección automática a login cuando la sesión vence.
- Cambio de datos de perfil.
- Cambio de contraseña.
- Preferencias persistidas en DB con fallback a `localStorage`.

Archivos principales:

- `src/lib/auth.ts`
- `src/proxy.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/components/shared/SessionGuard.tsx`
- `src/lib/client/auth-client.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/user/route.ts`
- `src/app/api/user/password/route.ts`

Observaciones:

- La app usa NextAuth con credenciales y JWT.
- `SessionGuard` instala un interceptor cliente para detectar 401/403 en llamadas fetch y forzar re-login.
- Ante errores de conectividad transitorios, `SessionGuard` evita forzar logout.
- La duración corta de sesión es consistente con seguridad, pero limita cualquier experiencia offline futura.

### Dashboard

Funcionalidades disponibles:

- Resumen mensual por período financiero.
- Ingresos, gastos, balance y gasto mensual de tarjeta.
- Tendencias contra período anterior.
- Gastos por categoría.
- Cuentas activas con saldos.
- Patrimonio: activos, pasivos y neto.
- Compromisos pendientes del período.
- Cuotas activas del mes.
- Visualización Sankey para flujos.
- Soporte para ocultar montos.
- Selección de período.
- Banner si falta configurar fecha de inicio operativo.

Archivos principales:

- `src/app/(app)/dashboard/page.tsx`
- `src/app/api/dashboard/route.ts`
- `src/components/shared/SankeyChart.tsx`
- `src/components/shared/CurrencyBreakdownAmount.tsx`
- `src/components/shared/ResponsiveAmount.tsx`
- `src/lib/utils/transaction-summary.ts`
- `src/lib/utils/balance.ts`
- `src/lib/utils/credit-card.ts`

Observaciones:

- El dashboard calcula tarjetas y cuotas con lógica propia, no solo con agregaciones simples.
- El período financiero respeta `monthStartDay`.
- La fecha de inicio operativo evita mezclar métricas con datos históricos previos al uso real de Finp.

### Transacciones

Tipos soportados:

- Ingreso.
- Gasto.
- Gasto con tarjeta de crédito.
- Transferencia.
- Cambio manual entre monedas.
- Pago de tarjeta.
- Pago de deuda legado, normalizado a pago de tarjeta.
- Ajuste.

Funcionalidades disponibles:

- Listado paginado.
- Filtros por período, tipo, categoría, cuenta, moneda y cuotas.
- Ordenamiento por fecha, monto o descripción.
- Creación, edición y eliminación.
- Validación de saldos cuando la cuenta no permite saldo negativo.
- Validación de monedas soportadas por cuenta.
- Descripción automática cuando el tipo lo permite.
- Reglas automáticas aplicadas al crear gastos, ingresos y gastos con tarjeta.
- Soporte de transacciones agrupadas por `paymentGroupId`.
- Soporte de importación por `importBatchId`.
- Soporte de transacciones con `installmentPlanId`.

Archivos principales:

- `src/app/(app)/transactions/page.tsx`
- `src/components/shared/TransactionDialog.tsx`
- `src/hooks/useTransactions.ts`
- `src/app/api/transactions/route.ts`
- `src/app/api/transactions/[id]/route.ts`
- `src/lib/validations/transaction.ts`
- `src/lib/utils/transactions.ts`
- `src/lib/utils/transaction-description.ts`
- `src/lib/utils/exchange.ts`

Observaciones:

- `useTransactions` centraliza carga, paginación, mutaciones e invalidación.
- La API calcula el resumen mensual independientemente de los filtros aplicados al listado.
- La app usa un sistema cliente de invalidación por tags para refrescar vistas afectadas.

### Cuentas

Tipos soportados:

- Banco.
- Efectivo.
- Billetera.
- Tarjeta de crédito.
- Deuda.
- Ahorro.

Funcionalidades disponibles:

- Alta, edición y baja lógica/operativa según endpoint.
- Saldos calculados por moneda.
- Cuentas mono-moneda y multi-moneda.
- Tarjetas de crédito siempre normalizadas como ARS y USD.
- Métodos de pago predeterminados: efectivo, débito y tarjeta.
- Una sola cuenta predeterminada por método.
- Configuración de tarjeta: cierre, vencimiento y límite.
- Configuración de saldo negativo permitido.
- Inclusión/exclusión en patrimonio.
- Color de cuenta.
- Sheet de detalle de cuenta.

Archivos principales:

- `src/app/(app)/accounts/page.tsx`
- `src/components/shared/AccountDialog.tsx`
- `src/components/shared/AccountDetailSheet.tsx`
- `src/contexts/AccountsContext.tsx`
- `src/hooks/useAccounts.ts`
- `src/app/api/accounts/route.ts`
- `src/app/api/accounts/[id]/route.ts`
- `src/app/api/accounts/[id]/detail/route.ts`
- `src/lib/models/account.model.ts`
- `src/lib/utils/accounts.ts`
- `src/lib/utils/balance.ts`

Observaciones:

- Los saldos no se guardan como fuente primaria: se recalculan desde transacciones e iniciales.
- Para tarjetas, puede incluirse deuda pendiente por cuotas en el cálculo.
- Existe compatibilidad con el campo legado `initialBalance`, pero se normaliza a `initialBalances`.

### Categorías

Funcionalidades disponibles:

- Categorías de ingresos y gastos.
- Categorías predeterminadas.
- Alta, edición, archivado/eliminación.
- Color por categoría.
- Ordenamiento por `sortOrder`.
- Endpoint de uso para prevenir o advertir eliminaciones con transacciones asociadas.

Archivos principales:

- `src/app/(app)/categories/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/components/shared/CategoryDialog.tsx`
- `src/contexts/CategoriesContext.tsx`
- `src/hooks/useCategories.ts`
- `src/app/api/categories/route.ts`
- `src/app/api/categories/[id]/route.ts`
- `src/app/api/categories/[id]/usage/route.ts`
- `src/app/api/categories/defaults/route.ts`
- `src/lib/constants/defaultCategories.ts`
- `src/lib/models/category.model.ts`

Observaciones:

- Las categorías predeterminadas cubren gastos frecuentes, ingresos principales y préstamos.
- En configuración existe un flujo para cargar categorías predeterminadas faltantes.

### Tarjetas de crédito y cuotas

Funcionalidades disponibles:

- Registro de gastos con tarjeta.
- Registro de compras en cuotas.
- Cálculo de cuota mensual activa.
- Cálculo de deuda pendiente por mes.
- Resumen mensual por tarjeta: total a pagar, pagado y pendiente.
- Edición y eliminación de planes de cuotas.
- Vista especializada de gastos con tarjeta.
- Sheet de detalle para gastos de tarjeta.

Archivos principales:

- `src/app/(app)/transactions/credit-card/page.tsx`
- `src/components/shared/InstallmentDialog.tsx`
- `src/components/shared/CreditCardExpenseSheet.tsx`
- `src/hooks/useInstallments.ts`
- `src/hooks/useCreditCardExpenses.ts`
- `src/app/api/installments/route.ts`
- `src/app/api/installments/[id]/route.ts`
- `src/app/api/credit-cards/payment-summary/route.ts`
- `src/lib/models/installment-plan.model.ts`
- `src/lib/utils/credit-card.ts`

Observaciones:

- Un plan de cuotas crea una transacción padre de tipo `credit_card_expense`.
- La lógica distingue compra simple y compra en cuotas dentro del resumen mensual.
- Existe normalización de `debt_payment` como tipo legado hacia `credit_card_payment`.

### Compromisos

Funcionalidades disponibles:

- Alta, edición y eliminación de compromisos programados.
- Recurrencias mensual, semanal y única a nivel de constantes, con foco funcional actual en mensual.
- Monto, moneda, categoría y día de vencimiento.
- Rango de vigencia por fecha de inicio y fin.
- Aplicación manual de compromiso para generar transacción.
- Registro de aplicaciones por período para evitar duplicados.
- Estado "aplicado este mes".

Archivos principales:

- `src/app/(app)/commitments/page.tsx`
- `src/components/shared/CommitmentDialog.tsx`
- `src/components/shared/ApplyCommitmentDialog.tsx`
- `src/hooks/useCommitments.ts`
- `src/app/api/commitments/route.ts`
- `src/app/api/commitments/[id]/route.ts`
- `src/app/api/commitments/[id]/apply/route.ts`
- `src/lib/models/scheduled-commitment.model.ts`

Observaciones:

- `CommitmentApplication` tiene índice único por usuario, compromiso y período.
- El dashboard consume compromisos pendientes del período actual.

### Proyección

Funcionalidades disponibles:

- Vista de proyección anual.
- Vista de proyección mensual a N meses.
- Inclusión de compromisos mensuales activos.
- Inclusión de cuotas por tarjeta.
- Totales en ARS y USD.
- Indicación de mes actual y meses pasados.

Archivos principales:

- `src/app/(app)/projection/page.tsx`
- `src/app/api/projection/route.ts`

Observaciones:

- La proyección actual se basa en compromisos y cuotas. No proyecta ingresos variables ni patrones históricos de gasto.
- Usa meses calendario en el endpoint actual, mientras otras partes usan período financiero configurable. Esto puede ser un punto a revisar para consistencia.

### Reglas automáticas

Funcionalidades disponibles:

- Listado, creación, edición y eliminación de reglas.
- Activación/desactivación.
- Prioridad.
- Alcance por tipo: gasto, ingreso o cualquiera.
- Campo evaluado: descripción o comercio.
- Condición: contiene, igual a, empieza con.
- Acciones: asignar categoría, setear tipo ingreso/gasto y normalizar comercio.
- Aplicación automática al crear transacciones compatibles.

Archivos principales:

- `src/app/(app)/rules/page.tsx`
- `src/components/shared/TransactionRuleDialog.tsx`
- `src/hooks/useTransactionRules.ts`
- `src/app/api/transaction-rules/route.ts`
- `src/app/api/transaction-rules/[id]/route.ts`
- `src/lib/models/transaction-rule.model.ts`
- `src/lib/utils/rules.ts`

Observaciones:

- Las reglas se ordenan por prioridad descendente.
- En la creación de transacciones, la regla puede completar categoría y comercio si el usuario no los ingresó.

### Importación desde Excel

Funcionalidades disponibles:

- Descarga de plantilla oficial Finp.
- Subida de `.xlsx` o `.xls`.
- Parseo del archivo.
- Validación de encabezados requeridos.
- Creación de batch en borrador.
- Creación de filas de revisión.
- Estados por fila: ok, incompleta, inválida, posible duplicado, ignorada, importada.
- Detección de duplicados por fecha, monto y descripción similar en últimos 90 días.
- Edición de filas antes de confirmar.
- Ignorar filas.
- Confirmación del batch.
- Creación de transacciones y planes de cuotas al confirmar.
- Eliminación de batches en borrador.
- Historial de importaciones.

Archivos principales:

- `src/app/(app)/transactions/import/page.tsx`
- `src/app/(app)/transactions/import/history/page.tsx`
- `src/app/(app)/transactions/import/[batchId]/page.tsx`
- `src/components/shared/ImportRowEditDialog.tsx`
- `src/app/api/import/route.ts`
- `src/app/api/import/template/route.ts`
- `src/app/api/import/[batchId]/route.ts`
- `src/app/api/import/[batchId]/rows/[rowId]/route.ts`
- `src/app/api/import/[batchId]/confirm/route.ts`
- `src/lib/utils/excel-parser.ts`
- `src/lib/utils/excel-template.ts`
- `src/lib/utils/import-transactions.ts`
- `src/lib/models/import-batch.model.ts`
- `src/lib/models/import-row.model.ts`

Observaciones:

- El flujo de importación es robusto y está modelado como revisión previa, no como carga directa irreversible.
- La confirmación impide avanzar si hay filas incompletas o inválidas.
- Los gastos con tarjeta importados crean `InstallmentPlan`, incluso si tienen una sola cuota.

### Configuración

Funcionalidades disponibles:

- Perfil de usuario.
- Seguridad/cambio de contraseña.
- Preferencias:
  - Vista predeterminada.
  - Día de inicio del mes financiero, entre 1 y 28.
  - Fecha de inicio operativo.
  - Cuenta predeterminada.
  - Moneda consolidada y cotización de referencia, presente en hook/preferencias.
- Administración de categorías.
- Carga de categorías predeterminadas.

Archivos principales:

- `src/app/(app)/settings/page.tsx`
- `src/hooks/usePreferences.ts`
- `src/app/api/preferences/route.ts`

Observaciones:

- `usePreferences` mantiene una estrategia híbrida: estado inicial desde `localStorage`, sincronización posterior con API y fallback si la API no responde.
- Las preferencias invalidan dashboard, transacciones, gastos de tarjeta y proyección.

### Espacios

Funcionalidades disponibles:

- Tipos de espacio: Pareja, Grupo, Viaje, Proyecto.
- Listado con filtros y grid en desktop.
- Detalle de espacio con: Balance, Movimientos, Actividad, Configuración.
- Nuevo movimiento con split configurable: partes iguales, responsable único, porcentajes, montos fijos.
- Preview de reparto antes de confirmar.
- Settlements: registrar pagos parciales o totales entre participantes.
- Balance directo y simplificado según `debtMode` del espacio.
- Pagos recomendados basados en balance.
- Categorías internas propias del espacio.
- Comprobantes adjuntos persistidos en Vercel Blob privado.
- Edición de movimientos con historial de versiones.
- Anulación lógica con `isVoided` y campo de motivo.
- Actividad del espacio: registro de eventos por movimiento, categoría, participante y configuración.
- Impacto personal por usuario mediante `SpaceEntryPersonalImpact`:
    - Cada participante puede vincular un movimiento a su Finp privado de forma independiente.
    - El estado global del movimiento no se modifica; el vínculo es privado por usuario.
- Sincronización multiusuario:
    - Al crear un movimiento, los participantes involucrados reciben un pendiente accionable.
    - `emitPersonalSyncEvent` garantiza idempotencia por `(userId, entryId, actionType)`.
- Roles de participantes con permisos.
- Invitaciones con modelo `SpaceInvite`.

Archivos principales:

- `src/app/(app)/spaces/page.tsx`
- `src/app/(app)/spaces/[id]/page.tsx`
- `src/components/spaces/`
- `src/hooks/useSpaces.ts`, `useSpaceEntries.ts`, `useSpaceParticipants.ts`, `useSpacePendingActions.ts`
- `src/app/api/spaces/`, `src/app/api/personal-pending-actions/`
- `src/lib/models/space.model.ts`, `space-entry.model.ts`, `space-entry-personal-impact.model.ts`
- `src/lib/utils/space-personal-impact.ts`, `space-entry-changes.ts`, `personal-sync-events.ts`

### Deudas

Funcionalidades disponibles:

- Módulo propio en `/debts`.
- Dos categorías: "Debo" y "Me deben".
- Deudas manuales y deudas derivadas de Espacios.
- Resumen de posición neta.
- Lista agrupada por persona.
- Filtros: Todo, Debo, Me deben, Espacios, Manuales, Ignoradas.
- Registrar pago de deuda con impacto real en cuenta.
- Registrar cobro de deuda con impacto real en cuenta.
- Pagos/cobros excluidos de métricas operativas (no suman como gasto/ingreso).
- Ignorar y restaurar deudas derivadas de Espacios.
- Sincronización automática de deudas cuando cambian movimientos del espacio.
- Rediseño visual (Fase 6G):
    - Relationship sidebar con contexto de la persona/espacio relacionado.
    - Hero de posición neta.
    - Cards compactas por categoría.
    - Timeline de movimientos.
    - Dialogs rediseñados para nueva deuda, pago y cobro.
    - Empty states.
- Integración con Transacciones, Cuentas, Dashboard y Espacios.

Archivos principales:

- `src/app/(app)/debts/page.tsx`
- `src/components/debts/`
- `src/hooks/useDebts.ts`
- `src/app/api/debts/`
- `src/lib/models/debt.model.ts`, `debt-movement.model.ts`
- `src/lib/utils/debt-sync.ts`

### Notificaciones

Funcionalidades disponibles:

- Sistema de notificaciones globales para el usuario.
- Tipos de notificación: `personal_impact_pending`, `space_entry_created`, `space_entry_voided`, `space_entry_voided_review`, `space_entry_edited_review`, `debt_payment_registered`, `debt_collect_registered`, `system_info`.
- Categorías: `space`, `debt`, `personal_impact`, `system`, `insight`.
- Prioridades: `low`, `normal`, `high`.
- Estados: `unread`, `read`, `archived`, `dismissed`.
- `actionStatus`: `none`, `pending`, `completed`, `ignored`, `cancelled`.
- Deduplicación idempotente por `dedupeKey` único sparse.
- Marcar como leída, marcar todas como leídas.
- Archivar y restaurar.
- Descartar (dismiss).
- Campana global con badge de count (máx 9+) y punto ámbar para pendientes.
- Sheet de notificaciones con 5 tabs: Todas, Pendientes, Espacios, Deudas, Archivadas.
- Paginación cursor-based por tab.
- CTA en notificaciones de acción pendiente.
- Swipe actions en mobile: deslizar derecho para archivar, izquierdo para descartar.
- Botones de acción al hover en desktop.
- Polling cada 20s con la pestaña visible; 15s dentro del sheet.
- Resolución automática de notificaciones al completar la acción relacionada.
- Alerta `NEEDS_REVIEW` cuando un entry vinculado se anula o edita con cambios materiales.

Archivos principales:

- `src/components/notifications/`
- `src/contexts/NotificationsContext.tsx`
- `src/app/api/notifications/`
- `src/lib/models/notification.model.ts`
- `src/lib/server/notifications.ts`

## Modelo de datos

### User

Campos principales:

- Email único, contraseña hasheada y nombre visible.
- Moneda base y timezone.
- Preferencias embebidas:
  - `defaultView`
  - `monthStartDay`
  - `defaultAccountId`
  - `consolidatedCurrency`
  - `referenceArsPerUsdRate`
  - `operationalStartDate`

Modelo: `src/lib/models/user.model.ts`.

### Account

Campos principales:

- Usuario propietario.
- Nombre, tipo, moneda principal y monedas soportadas.
- Métodos de pago predeterminados.
- Institución, descripción y color.
- Activa/inactiva.
- Inclusión en patrimonio.
- Saldos iniciales por moneda.
- Configuración de tarjeta.
- Configuración de deuda.
- Permiso de saldo negativo.

Modelo: `src/lib/models/account.model.ts`.

### Category

Campos principales:

- Usuario propietario.
- Nombre, tipo ingreso/gasto, ícono, color.
- Predeterminada.
- Archivada.
- Orden.

Modelo: `src/lib/models/category.model.ts`.

### Transaction

Campos principales:

- Usuario propietario.
- Tipo, monto, moneda, fecha y descripción.
- Categoría.
- Cuenta origen y destino.
- Campos de cambio manual: monto destino, moneda destino y cotización.
- Grupo de pago.
- Notas, tags, comercio.
- Estado.
- Plan de cuotas asociado.
- Origen de creación: web, telegram, system.
- Regla aplicada.
- Batch de importación.

Modelo: `src/lib/models/transaction.model.ts`.

### InstallmentPlan

Campos principales:

- Usuario propietario.
- Tarjeta/cuenta.
- Categoría.
- Descripción y comercio.
- Moneda.
- Monto total, cantidad de cuotas, monto de cuota.
- Fecha de compra.
- Primer mes de cierre.

Modelo: `src/lib/models/installment-plan.model.ts`.

### ScheduledCommitment y CommitmentApplication

Campos principales:

- Compromiso: descripción, monto, moneda, categoría, cuenta, recurrencia, día del mes, modo de aplicación, vigencia y estado.
- Aplicación: usuario, compromiso, período, transacción generada, fecha y origen manual/system.

Modelo: `src/lib/models/scheduled-commitment.model.ts`.

### TransactionRule

Campos principales:

- Usuario propietario.
- Nombre, estado y prioridad.
- Alcance.
- Campo, condición y valor.
- Acciones: categoría, tipo y comercio normalizado.

Modelo: `src/lib/models/transaction-rule.model.ts`.

### ImportBatch e ImportRow

Campos principales:

- Batch: usuario, archivo, fuente, estado y resumen.
- Row: batch, número de fila, datos crudos, datos parseados, datos revisados, estado, warnings, errores, duplicado posible, transacción creada e ignorada.

Modelos:

- `src/lib/models/import-batch.model.ts`
- `src/lib/models/import-row.model.ts`

### Debt y DebtMovement

Campos principales de Debt:

- Usuario propietario.
- Tipo: `payable` (debo) o `receivable` (me deben).
- Origen: `manual` o `space`.
- Contraparte (nombre y userId).
- Espacio de origen (si corresponde).
- Monto total, monto pagado/cobrado y monto pendiente.
- Moneda.
- Estado: activa, saldada, ignorada.
- Descripción.

Campos principales de DebtMovement:

- Deuda asociada.
- Tipo de movimiento: `payment` o `collect`.
- Monto y moneda.
- Transacción real vinculada.
- Fecha.

Modelos:

- `src/lib/models/debt.model.ts`
- `src/lib/models/debt-movement.model.ts`

### SpaceEntryPersonalImpact

Campos principales:

- `userId`: propietario del impacto.
- `spaceEntryId` y `spaceId`.
- `status`: `pending`, `linked`, `ignored`, `cancelled`, `removed`, `needs_review`.
- `actionType`: `impact_space_expense`, `impact_space_payment`, `impact_space_collect`.
- `linkedTransactionId`: transacción personal creada.
- `operationalAmount`: parte propia del usuario.
- `accountImpactAmount`: monto real movido en cuenta.
- Campos de revisión: `reviewReason`, `reviewRequestedAt`, `reviewChangedFields`, `reviewedAt`, `reviewedResolution`.
- `debtId`, `debtMovementId`: referencias cruzadas.
- Índices únicos parciales: 1 LINKED por `(userId, entryId)`, 1 PENDING por `(userId, entryId, actionType)`.

Modelo: `src/lib/models/space-entry-personal-impact.model.ts`.

### Notification

Campos principales:

- `recipientUserId`, `actorUserId`.
- `type`: enum con 8 valores.
- `category`: `space`, `debt`, `personal_impact`, `system`, `insight`.
- `priority`: `low`, `normal`, `high`.
- `status`: `unread`, `read`, `archived`, `dismissed`.
- `actionStatus`: `none`, `pending`, `completed`, `ignored`, `cancelled`.
- `pendingActionId`: referencia a `SpaceEntryPersonalImpact`.
- `entityRefs`: objeto con referencias a space, entry, debt, transaction, personalImpact.
- `action`: CTA con label, href y actionType.
- `dedupeKey`: único sparse para idempotencia.
- `metadata`: datos adicionales (monto, moneda, campos cambiados).
- Timestamps: `readAt`, `dismissedAt`, `archivedAt`, `resolvedAt`, `expiresAt`.

Modelo: `src/lib/models/notification.model.ts`.

## API interna

Endpoints principales:

| Endpoint | Métodos | Responsabilidad |
| --- | --- | --- |
| `/api/auth/register` | POST | Crear usuario |
| `/api/auth/[...nextauth]` | NextAuth | Login, sesión y auth |
| `/api/user` | GET, PATCH | Leer y actualizar perfil |
| `/api/user/password` | POST | Cambiar contraseña |
| `/api/preferences` | GET, PATCH | Leer y actualizar preferencias |
| `/api/accounts` | GET, POST | Listar y crear cuentas |
| `/api/accounts/[id]` | GET, PATCH, DELETE | Operar cuenta individual |
| `/api/accounts/[id]/detail` | GET | Detalle ampliado de cuenta |
| `/api/categories` | GET, POST | Listar y crear categorías |
| `/api/categories/[id]` | PATCH, DELETE | Editar/eliminar categoría |
| `/api/categories/[id]/usage` | GET | Uso de categoría |
| `/api/categories/defaults` | GET, POST | Categorías predeterminadas |
| `/api/transactions` | GET, POST | Listar, resumir y crear transacciones |
| `/api/transactions/[id]` | GET, PATCH, DELETE | Operar transacción individual |
| `/api/installments` | GET, POST | Listar y crear planes de cuotas |
| `/api/installments/[id]` | PATCH, DELETE | Editar/eliminar plan |
| `/api/credit-cards/payment-summary` | GET | Resumen mensual de tarjetas |
| `/api/commitments` | GET, POST | Listar y crear compromisos |
| `/api/commitments/[id]` | PATCH, DELETE | Editar/eliminar compromiso |
| `/api/commitments/[id]/apply` | POST | Aplicar compromiso |
| `/api/dashboard` | GET | Dashboard mensual |
| `/api/projection` | GET | Proyección |
| `/api/sankey` | GET | Datos para Sankey |
| `/api/cashflow` | GET | Datos de flujo/cashflow |
| `/api/transaction-rules` | GET, POST | Listar y crear reglas |
| `/api/transaction-rules/[id]` | PATCH, DELETE | Editar/eliminar regla |
| `/api/import` | GET, POST | Historial de batches y carga de archivo |
| `/api/import/template` | GET | Descargar plantilla Excel |
| `/api/import/[batchId]` | GET, DELETE | Detalle/eliminar batch |
| `/api/import/[batchId]/rows/[rowId]` | PATCH | Editar fila de importación |
| `/api/import/[batchId]/confirm` | POST | Confirmar importación |
| `/api/seed` | POST | Seed de datos |

## Arquitectura cliente

### Layout autenticado

`src/app/(app)/layout.tsx` envuelve la app autenticada con:

- `HideAmountsProvider`
- `CategoriesProvider`
- `AccountsProvider`
- `SessionGuard`
- `Navbar`
- Breadcrumb
- Scroll to top

### Navegación

Desktop:

- Sidebar fija izquierda.
- Botón flotante para nueva transacción.

Mobile:

- Bottom navigation con Dashboard, Transacciones, Proyección y Más.
- Acción central prominente para agregar.
- Action sheet para nueva transacción o importación.
- Menú "Más" con accesos secundarios.

### Estado cliente

Estrategias usadas:

- Contextos para cuentas, categorías y ocultar montos.
- Hooks por dominio para consumir APIs.
- Invalidación en memoria por tags mediante `src/lib/client/data-sync.ts`.
- Preferencias con fallback a `localStorage`.
- Montos ocultos persistidos en `localStorage`.

No se observa uso de una librería de server state tipo TanStack Query o SWR. La app implementa su propia invalidación simple.

## Diseño visual actual

El sistema visual está definido principalmente en `src/app/globals.css`.

Características:

- Tema claro y oscuro con CSS variables.
- Tipografía Geist Sans y Geist Mono.
- Color primario celeste/sky.
- Sidebar oscuro.
- Fondos claros neutros en light mode.
- Cards blancas con bordes suaves y shadow sutil.
- Estados positivos en verde, negativos/destructivos en rojo y destacados secundarios en ámbar.
- Animaciones suaves con Framer Motion y transiciones CSS.
- Respeto de `prefers-reduced-motion`.
- Safe area helpers para mobile.

Tokens principales:

- `--background`
- `--foreground`
- `--card`
- `--primary`
- `--secondary`
- `--muted`
- `--accent`
- `--destructive`
- `--border`
- `--ring`
- `--sky`
- `--amber`
- `--card-shadow`
- `--sidebar`

## Estado mobile

Finp tiene experiencia responsive avanzada para una web app:

- Bottom nav mobile.
- CTA central.
- Action sheet.
- Panel "Más".
- Safe area handling.
- Cards y resúmenes adaptados.
- Carrusel mobile en dashboard.
- Tipografía y tamaños adaptados en pantallas clave.

Limitaciones actuales:

- No hay manifest PWA visible.
- No hay service worker.
- No hay cache offline de assets.
- No hay base local IndexedDB/SQLite.
- No hay cola de sincronización.
- No hay wrapper Capacitor/Expo.
- Sin internet, la app depende de la disponibilidad de Next server y MongoDB.

Conclusión: hoy Finp es mobile-friendly, no mobile-native ni offline-first.

## Offline y base local

Estado actual:

- Persistencia real: MongoDB remota/local según `MONGODB_URI`.
- Persistencia cliente: `localStorage` para preferencias de UI y fallback de preferencias.
- Sin IndexedDB.
- Sin SQLite.
- Sin mecanismo de reconciliación de datos.
- Sin outbox de cambios locales.

Viabilidad:

- Es viable llevar Finp a un modelo local-first, pero requiere una capa nueva:
  - DB local por entidad.
  - Outbox de cambios.
  - Sync pull/push.
  - Resolución de conflictos.
  - IDs locales y server IDs.
  - Manejo de sesión offline.

Impacto técnico:

- Medio-alto si se busca offline real.
- Bajo-medio si se busca solo instalación mobile/PWA sin edición offline.

## Seguridad

Fortalezas:

- Contraseñas hasheadas con bcryptjs.
- Sesión JWT.
- Proxy protege rutas no autenticadas.
- APIs verifican sesión mediante `auth()`.
- La mayoría de consultas filtran por `userId`.
- Registro valida email único.
- Cambio de contraseña en endpoint dedicado.

Puntos a revisar:

- Asegurar que todos los endpoints dinámicos filtran estrictamente por `userId`.
- Revisar endpoint `/api/seed` antes de producción.
- Evaluar rate limiting en login, registro e importación.
- Evaluar política de expiración de sesión vs experiencia de usuario.
- Evaluar protección contra archivos Excel excesivamente grandes.
- Evaluar CSRF/riesgos propios de credenciales y cookies según configuración final de NextAuth.

## Calidad, tests y CI

Tests existentes:

- Validaciones de auth.
- Validaciones de cuenta.
- Validaciones de transacción.
- Utilidades de transacciones.
- Preferencias del diálogo de transacción.
- Resumen de transacciones.
- E2E de auth.
- E2E de transacciones.

CI:

- `npm run lint`
- `npm run build`
- `npm run test:unit`
- Coverage unitario como reporte no bloqueante.

Limitaciones:

- E2E en CI está preparado pero desactivado.
- Playwright depende de DB de test y usuario semilla.
- El README de E2E indica que los tests no limpian siempre la DB si fallan a mitad.
- No hay coverage mínimo obligatorio.

## Estado de versionado observado

Al momento del relevamiento, `git status --short` muestra cambios pendientes en:

- `src/app/(app)/transactions/page.tsx`
- `src/app/api/dashboard/route.ts`
- `src/app/api/transactions/route.ts`
- `src/hooks/useTransactions.ts`
- `.codex/`
- `src/lib/utils/transaction-summary.ts`
- `tests/unit/utils/transaction-summary.test.ts`

Este informe no revierte ni asume propiedad sobre esos cambios.

## Riesgos y deuda técnica

### Riesgos funcionales

- La proyección usa una lógica mensual relativamente simple y no contempla ingresos proyectados, gastos históricos promedio ni escenarios.
- Hay mezcla de mes calendario y período financiero en distintas piezas; conviene auditar consistencia.
- El dominio de tarjeta y cuotas es fuerte, pero complejo: requiere más tests para evitar regresiones.
- La importación Excel tiene muchas ramas de validación y creación: debería tener cobertura amplia de integración.

### Riesgos técnicos

- `TransactionDialog.tsx` y otros componentes grandes concentran mucha lógica de UI y dominio.
- La invalidación por tags es simple y útil, pero puede crecer en complejidad a medida que aumenten pantallas y cachés.
- No hay capa formal de servicios de dominio entre API routes y modelos.
- Hay lógica de resumen duplicada/parcialmente repartida entre dashboard, transacciones y utilidades.
- La app depende de `fetch` y estado local manual; una librería de server state podría reducir código repetido.

### Riesgos de producto

- La app ya maneja muchos conceptos financieros. Onboarding y estados vacíos son críticos para que un usuario nuevo entienda qué crear primero.
- El soporte multi-moneda y tarjetas puede resultar potente pero demandante; conviene priorizar claridad en formularios.
- Offline/mobile real requerirá rediseñar la persistencia, no solo envolver la web.

## Recomendaciones priorizadas

### Corto plazo

1. Actualizar `README.md` con setup real, variables de entorno, scripts y flujos de test.
2. Documentar reglas de dominio críticas: saldos, tarjetas, cuotas, períodos financieros e importación.
3. Agregar tests unitarios para `credit-card.ts`, `balance.ts`, `period.ts`, `operational-start.ts` e importación.
4. Activar o formalizar un flujo E2E reproducible con seed/cleanup.
5. Revisar consistencia entre período financiero y proyección.
6. Revisar `/api/seed` y condicionarlo a entorno de desarrollo/test.

### Mediano plazo

1. Extraer servicios de dominio para transacciones, tarjetas, cuentas e importación.
2. Reducir componentes grandes separando subcomponentes y hooks.
3. Evaluar TanStack Query o SWR para server state, cache e invalidación.
4. Mejorar onboarding de usuario nuevo.
5. Agregar auditoría de seguridad y límites de archivo en importación.

### Mobile/offline

1. Convertir primero en PWA instalable sin edición offline.
2. Agregar service worker y cache de shell de app.
3. Crear IndexedDB local para lectura offline.
4. Agregar outbox para cambios offline.
5. Diseñar sync incremental con MongoDB.
6. Evaluar Capacitor después de estabilizar el build cliente/offline.

## Conclusión

Finp está en un estado avanzado para una app personal/financiera web: tiene dominio real, múltiples módulos conectados y una experiencia mobile web cuidada. Su principal límite no es la falta de funcionalidad base, sino la consolidación técnica: documentación, tests, separación de dominio, consistencia de cálculos y preparación para offline/mobile real.

La dirección recomendada es fortalecer la base actual antes de reescribir: documentar, testear dominios críticos, estabilizar E2E, simplificar componentes grandes y luego avanzar hacia PWA/local-first si el objetivo mobile offline sigue siendo prioritario.
