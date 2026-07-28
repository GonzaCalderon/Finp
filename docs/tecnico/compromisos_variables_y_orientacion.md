# Compromisos variables y Captura rápida como orientador — implementación

> Estado: vigente
> Audiencia: desarrollo, calidad y agentes
> Última actualización: 2026-07-25
> Fuente de verdad: implementación del bloque de compromisos variables y orientación

## Índice

1. [Contexto](#1-contexto-de-partida)
2. [Modelo](#2-modelo-de-datos)
3. [Servicios](#3-servicios-y-su-responsabilidad)
4. [Orientación](#4-contrato-de-orientación)
5. [APIs](#5-apis)
6. [UX](#6-ux)
7. [Deuda y extensión](#7-deuda-conocida-y-extensión)
8. [Verificación y backfill](#8-verificación)

Documentación técnica del bloque implementado el 2026-07-25. El diseño funcional vive en
`docs/producto/compromisos_espacios_y_proyeccion.md` y
`docs/producto/captura_rapida_como_orientador.md`; este documento explica **cómo quedó
construido**, qué decisiones se tomaron y dónde extenderlo.

La sección de deuda conserva contexto técnico. La prioridad y el estado vigente de cada pendiente viven únicamente en `docs/producto/roadmap_finp.md`.

---

## 1. Contexto de partida

La auditoría previa encontró que Compromisos era el módulo más pobre en relación a lo que la
proyección prometía: monto fijo único, sin historial, sin estados de aplicación, sin snapshot y
**sin ningún vínculo visible** entre la transacción generada y el compromiso que la originó.

Dos aclaraciones sobre el repo que conviene tener presentes:

- **No hay Prisma.** La persistencia es MongoDB + Mongoose 8. **No hay migraciones ni tooling
  de migración.** Todo campo nuevo necesita default seguro en lectura, entrada en el guard de
  refresco de caché del modelo, y un script de backfill idempotente si importa.
- **No se usan sesiones/transacciones de Mongo** en ningún punto del proyecto. Toda escritura
  multi-documento es una saga con compensación manual.

---

## 2. Modelo de datos

### 2.1 `ScheduledCommitment`

Campos nuevos en `src/lib/models/scheduled-commitment.model.ts`:

| Campo | Tipo | Notas |
|---|---|---|
| `amountPolicy` | `fixed` \| `variable` | default `fixed` |
| `amountSchedule` | `[{ effectiveFrom, amount, source, note?, createdAt }]` | subdocumento embebido, default `[]` |
| `estimationMode` | `template` \| `last` \| `average` | sólo se usa si la política es `variable` |
| `normalizedDescription` | `String` (indexado) | `normalizeRuleText(description)`, para el matching |
| `aliases` | `[String]` | denominaciones alternativas, ya normalizadas |
| `createdFrom` | `web` \| `quick_capture` | procedencia de la plantilla |
| `reminderLeadDays` | `0..31` opcional | anticipación relativa; no programa jobs |

`accountId` **ya existía en el modelo pero nunca se escribía**: ahora es la cuenta habitual y
precarga la aplicación.

La agenda es un subdocumento embebido y no una colección aparte porque se lee siempre junto al
compromiso y tiene pocos ítems.

### 2.2 `CommitmentApplication`

**Decisión clave: los estados previos se derivan al leer, no se materializan.** La fila sólo
existe cuando algo ocurrió realmente.

- Persistidos: `registered`, `skipped`, `cancelled`, `reverted`.
- Derivados por `resolveApplicationStateForPeriod`: `scheduled`, `awaiting_amount`, `ready`.

El tipo `CommitmentApplicationState` es la unión completa, así que materializarlos más adelante
no rompería el contrato: sólo cambiaría dónde vive cada valor.

Campos nuevos: `status`, `snapshot`, `origin`, `revertedAt`, `revertedReason`.

Se **conserva** el índice único `{userId, commitmentId, period}`. Una reversión no borra la fila:
pasa a `reverted` y hace `$unset` de `transactionId`; una nueva aplicación del mismo período
**reutiliza esa fila**.

> ⚠️ **Consecuencia que costó un bug:** al conservar la fila, toda consulta de "¿está aplicado?"
> debe filtrar `status: 'registered'`. Si no, un período revertido sigue figurando como aplicado.
> Hoy filtran los tres puntos: `api/commitments`, `api/dashboard` y `nav-insights`.

### 2.3 `Transaction`

Procedencia de compromiso, denormalizada para evitar un lookup inverso por fila en el listado:
`commitmentId`, `commitmentApplicationId`, `commitmentPeriod`, `commitmentNameSnapshot`.

`commitmentNameSnapshot` sobrevive al borrado del compromiso, con el mismo criterio que
`appliedRuleNameSnapshot`.

### 2.4 `FunctionalSuggestionDismissal`

Lo único que se persiste del ciclo de orientación. Los candidatos se calculan en vivo; los
descartes tienen que sobrevivir a la sesión para que la captura no se vuelva invasiva.

---

## 3. Servicios y su responsabilidad

Principio rector: **una sola implementación de cada decisión**, consumida por todos los puntos
de entrada.

| Servicio | Archivo | Responsabilidad |
|---|---|---|
| `resolveCommitmentOccurrencesInRange` y derivados | `src/lib/utils/commitment-dates.ts` | Única fuente de verdad para ocurrencias, próxima fecha, meses cortos y recordatorios. |
| `resolveCommitmentAmountForPeriod` | `src/lib/server/commitment-amounts.ts` | Única fuente de verdad de "cuánto vale este compromiso en este período". Puro. |
| `resolveApplicationStateForPeriod` | `src/lib/server/commitments.ts` | Estado derivado. Puro. |
| `resolveCommitmentLifecycleStatus` | `src/lib/server/commitment-lifecycle.ts` | Próximo, activo, por finalizar, finalizado o inactivo. |
| `resolveCommitmentReminder` | `src/lib/server/commitment-lifecycle.ts` | Fecha y estado del recordatorio in-app. |
| `buildCommitmentSuggestions` | `src/lib/utils/commitment-suggestions.ts` | Candidatos mensuales explicables desde historial. |
| `applyCommitmentForUser` | `src/lib/server/commitments.ts` | Aplicación con snapshot y procedencia. |
| `revertApplicationForTransaction` | `src/lib/server/commitments.ts` | Reversión idempotente. |
| `syncApplicationSnapshotFromTransaction` | `src/lib/server/commitments.ts` | Actualiza la foto sin tocar la plantilla. |
| `unlinkTransactionDependents` | `src/lib/server/transaction-teardown.ts` | Cascada al eliminar una transacción. |
| `findApplicableCommitments` | `src/lib/server/commitment-matching.ts` | Matching texto ↔ pendiente. Puro. |
| `getApplicableCommitmentsForUser` | `src/lib/server/commitment-context.ts` | Candidatos para el contexto de Captura rápida. |
| `detectCaptureIntents` | `src/lib/utils/capture-intents.ts` | Detección determinista de intención. Puro. |
| `getProjectionForUser` | `src/lib/server/projection.ts` | Proyección (extraída de la route). |
| `resolveRuleTraceForEdit` | `src/lib/server/transactions.ts` | Recalcula la traza de regla al editar. |

### Precedencia del monto

```
aplicación registrada (snapshot)  → confirmed
tramo de la agenda vigente         → calculated
estimación (política variable)     → estimated / pending_amount
monto de la plantilla              → calculated
```

La fecha de referencia es el **vencimiento dentro del período**, no su inicio: un cambio
efectivo a mitad de mes debe regir si cae antes del vencimiento. Con `monthStartDay ≠ 1` el
período abarca dos meses calendario, así que la utilidad central prueba ambos. Los días
29 a 31 se ajustan al último día disponible del mes corto. Una ocurrencia anterior a
`startDate` se excluye; `nextDueDate` busca la primera válida y
`nextReminderDate` puede caer en el mes anterior. Sólo el primer recordatorio se
limita a la fecha de inicio.

### Reutilización deliberada

- `normalizeRuleText` (`src/lib/utils/rules.ts`) para el matching, **la misma normalización del
  motor de reglas**, para no introducir un segundo criterio que pueda divergir.
- `getTextSimilarity` con el umbral 0.72 que ya usa la detección de duplicados.
- `getCurrentFinancialPeriod` / `parseFinancialPeriod` (`src/lib/utils/period.ts`) en **todos**
  los puntos que antes calculaban meses calendario.
- `createTransactionForUser` sin cambios: la transacción del compromiso sigue atravesando el
  motor unificado de reglas.

---

## 4. Contrato de orientación

`src/types/capture-intent.ts` — dominio **separado** del aprendizaje semántico, aunque reutilice
su infraestructura de eventos, feedback, privacidad e idempotencia. Recomendar un módulo tiene
umbrales y consecuencias distintas a completar un campo.

### Transporte del borrador

`src/lib/client/capture-draft.ts`. El sobre vive en `sessionStorage` bajo
`finp:capture-draft:<draftId>` y **en la URL sólo viaja el id**.

Razones:

1. Los campos llevan datos financieros personales (monto, descripción, comercio) y no deben
   quedar en la barra de direcciones, el historial ni los logs de servidor.
2. Sobrevive a un refresh, a diferencia de un contexto React.
3. No depende de qué instancia del launcher lo creó — `useTransactionLauncher` está montado dos
   veces (desktop y mobile) con estado independiente.

El sobre se **consume una sola vez**, valida `version` y `expiresAt` (TTL 10 min), y tolera que
`sessionStorage` esté bloqueado (Safari privado) sin romper la derivación: el destino abre vacío.

### `provenance`

Mapa campo → origen (`text`, `alias`, `rule`, `learned`, `default`, `commitment`). Es lo que
permite al módulo destino distinguir lo que Finp interpretó de un valor por omisión, y por eso el
aviso del diálogo de Compromisos no anuncia la moneda cuando vino como `default`.

### Jerarquía de detección

1. **Intención explícita** en el texto (`el 5 de cada mes`) → propone crear el compromiso.
2. **Coincidencia con un pendiente** → propone aplicarlo.
3. Nada → no interrumpe.

Una intención explícita **nunca** se reemplaza por evidencia histórica. Devuelve como máximo
una propuesta por frase.

### Eventos

`intent_detected`, `intent_accepted`, `intent_dismissed`, `intent_completed`, y los métodos
`derive` y `never`.

`intent_accepted` e `intent_completed` son distintos a propósito: **tocar el CTA no equivale a
completar la función**. Para `create_commitment`, Compromisos emite `intent_completed` mediante
`reportCaptureIntentCompleted` (`src/lib/client/capture-intent-events.ts`) cuando la plantilla se
crea de verdad.

El `eventId` deriva del `draftId` (`intent_completed:<intent>:<draftId>`) y el endpoint inserta con
`$setOnInsert`: un reintento, un doble submit o dos pestañas dejan **un solo** evento. La
atribución se abandona si el diálogo se cierra sin crear, si se edita otro compromiso o si se
acepta un candidato mensual, que es otra superficie. Un segundo alta en la misma visita tampoco
vuelve a contar la derivación.

El evento no lleva monto, descripción ni comercio: para el embudo sólo importa que la derivación
terminó. Captura rápida conserva su cola con debounce porque emite muchos eventos por sesión; un
destino emite uno solo y le alcanza un POST best-effort.

> ⚠️ **Triplicación de enums.** Cada tipo de evento y método vive en tres archivos:
> `src/types/quick-capture.ts`, el enum de Mongoose en
> `quick-capture-learning-event.model.ts`, y el schema zod de
> `api/quick-capture/learning/events/route.ts`. Agregar un valor exige tocar los tres.

---

## 5. APIs

| Endpoint | Cambio |
|---|---|
| `GET /api/commitments` | Devuelve período, monto y fecha efectivos, `resolvedDueDate`, `nextDueDate`, `nextReminderDate`, `occursThisPeriod`, aplicación actual, ciclo de vida y recordatorio derivado. Los campos nuevos son opcionales para preservar compatibilidad. |
| `POST` / `PATCH /api/commitments` | **zod en el servidor** (antes no había). Errores de datos dan 400 con detalle, no 500. El PATCH sólo escribe los campos enviados. |
| `GET /api/commitments/suggestions` | Calcula candidatos mensuales sin escribir datos; respuesta privada y sin cache. |
| `POST` / `DELETE /api/commitments/[id]/amounts` | Alta y baja de tramos futuros. Acepta aumentos y disminuciones; rechaza editar o eliminar historia vigente/pasada con `IMMUTABLE_COMMITMENT_AMOUNT_HISTORY`. |
| `POST /api/commitments/[id]/apply` | Acepta `origin`; escribe snapshot y procedencia; reutiliza filas `reverted`. |
| `GET /api/projection` | Delega en `getProjectionForUser`. Devuelve `certainty` y `occurrences`. |
| `GET /api/quick-capture/context` | Suma `commitments`, `currentPeriod` y `dismissedSuggestions`, con `.catch` tolerante. |
| `POST` / `DELETE /api/quick-capture/suggestions/dismiss` | Descarte persistente, idempotente. |
| `PATCH /api/quick-capture/learning/profile` | Acepta `markCaptureIntroSeen`. |
| `DELETE /api/transactions/[id]` | Llama `unlinkTransactionDependents` **antes** de borrar y devuelve qué revirtió, incluida la baja del plan de cuotas. |
| `PATCH /api/transactions/[id]` | Sincroniza el snapshot, recalcula la traza de regla, devuelve `commitmentTemplateUpdateAvailable`. |

### Atomicidad del apply

Sigue siendo una saga con compensación, no una transacción de Mongo:

1. crear la transacción (con `commitmentId`, período y nombre);
2. `findOneAndUpdate` con `upsert` y filtro `status: { $ne: 'registered' }` — esto lo hace
   **atómico**: si otra request ya registró el período, el upsert intenta insertar y el índice
   único lo rechaza con 11000 → 409, en vez de pisar la aplicación existente;
3. cerrar el vínculo escribiendo `commitmentApplicationId` en la transacción.

Si el paso 2 falla, `cleanupCreatedTransaction` borra la transacción **sólo si ninguna otra
aplicación la referencia**. Un crash entre 1 y 2 sigue dejando un gasto huérfano: es la
limitación conocida del enfoque sin transacciones.

### Re-evaluación de reglas al editar

`resolveRuleTraceForEdit` refresca la traza pero **no aplica las acciones sobre los datos**: en
una edición el usuario está siendo explícito y su valor gana. Se le pasa el `categoryId` del
usuario justamente para que la acción de categoría quede marcada como omitida por valor
explícito y no figure como aplicada.

---

## 6. UX

- **Alta y edición en tres pasos**: `Compromiso`, `Frecuencia` y `Aplicación`,
  con validación al escribir, retorno al primer paso inválido y errores de API
  mapeados a campos. Mobile usa `Paso N de 3 · Nombre` y barra compacta.
- **Categorías compartidas**: búsqueda, chips con color y ranking por historial
  reutilizan `CategoryPickerField` y `/api/categories/ranking`.
- **Día mensual**: datepicker compartido en popover, limitado a un calendario
  estable de 31 días, con nombres accesibles y vista previa concreta.
- **Layout del diálogo**: encabezado y footer no desplazan; sólo el contenido
  central tiene scroll. Desktop usa hasta 56 rem y dos columnas en Frecuencia y
  Aplicación; mobile conserva una columna, categorías colapsables y CTA visible.
- **Aplicación manual**: `auto_month_start` se acepta como dato legacy, pero no
  se expone ni se crea hasta que exista scheduler. Los registros legacy se
  presentan como manuales.
- **Agenda separada**: `Cambiar monto` abre una superficie propia con monto
  vigente y tres vigencias: ahora, próximo vencimiento o fecha elegida. El
  historial pasado es inmutable y sólo los tramos futuros se eliminan.
- **Ciclo de vida**: próximos, vigentes, por finalizar, finalizados e inactivos
  se derivan sin reescribir historia. Finalizados e inactivos quedan colapsados.
- **Recordatorio in-app**: mismo día o anticipación relativa. `nav-insights`
  prioriza el compromiso dentro de la ventana o después del vencimiento.
- **Candidatos mensuales**: aplican el criterio híbrido del ADR 0002 y umbral
  0,82; muestran meses, cobertura, variación, día y categoría. Aceptar precarga
  el alta; `No es un compromiso` persiste el rechazo.

- **Tarjeta de orientación** (`CaptureOrientationCard`): título, motivo, evidencia, y siempre
  cuatro acciones — la principal, `Registrar sólo este gasto` / `Registrar aparte`, `Ahora no` y
  `No volver a sugerir`. Anuncia el **importe que se va a aplicar**, no el previsto por la
  plantilla, y aclara la diferencia cuando existe.
- Se silencia mientras haya bloqueos locales: primero se arregla el movimiento, después se orienta.
- **Ayuda** (`CaptureHelpPanel`): galería por objetivo, con ejemplos accionables. Sólo anuncia
  capacidades **realmente disponibles**.
- **Intro** de una sola vez con campo propio `captureIntroSeenAt`, separado de `introSeenAt`: el
  banner de aprendizaje sólo aparece cuando ya hay patrones, así que un usuario nuevo nunca lo
  veía y no servía para anunciar las capacidades del diálogo.
- **Procedencia en Transacciones**: pill violeta `Compromiso: <nombre> · <período>` junto al pill
  sky de regla, con link a `/commitments`.
- **`Actualizar próximos períodos`**: se ofrece como `confirm` posterior a la edición y, al
  aceptar, **agrega un tramo a la agenda** con la fecha efectiva del período editado. Propaga
  hacia adelante sin reescribir historia.

---

## 7. Deuda conocida y extensión

La deuda detectada durante este bloque se administra en el roadmap único:

- `FINP-P1-003`: integración de NavInsights;
- `FINP-P1-004`: política para pagos duales;
- `FINP-P4-002`: scheduler de `auto_month_start`.

Este documento conserva el contexto de implementación; [`../producto/roadmap_finp.md`](../producto/roadmap_finp.md) conserva estado, prioridad y criterio.

### Cómo agregar el próximo destino de orientación

El camino está preparado. Para sumar, por ejemplo, cuotas:

1. Agregar el `CaptureIntent` y sus `DraftFields` en `src/types/capture-intent.ts`.
2. Detectar la intención en `src/lib/utils/capture-intents.ts` (determinista, sin red).
3. Aceptar `initialDraft` en el diálogo destino y leer `?draft=` en su página.
4. Si el destino resuelve inline, agregar la rama en `handleOrientationAction`.
5. Cerrar el embudo: llamar a `reportCaptureIntentCompleted` cuando el destino
   complete la función de verdad, no cuando abra su formulario.
6. Sumar el ejemplo a `CaptureHelpPanel` — **sólo cuando ya funcione**.
7. E2E: interpretación, transporte del borrador, validación final y retorno ante error.

### Trampas del entorno que costaron bugs reales

Vale dejarlas escritas porque van a volver:

1. **Caché de modelos de Mongoose.** Un campo nuevo en un modelo sin guard de refresco se
   descarta en silencio al escribir **y** al leer. Pasó con `captureIntroSeenAt`. Todo modelo que
   reciba campos nuevos necesita su `needsSchemaRefresh`.
2. **StrictMode ejecuta los efectos dos veces.** Un efecto que *consume* algo (como el sobre del
   borrador) tiene que ser idempotente, o la segunda pasada pisa el resultado de la primera.
3. **`setState` dentro de un efecto** lo rechaza el linter de React del proyecto. Hay que mover
   el reset al handler que corresponda.
4. **Rango semiabierto.** `parseFinancialPeriod` devuelve `[start, end)`. Al migrar código que
   usaba un `end` inclusivo (`23:59:59.999`), hay que cambiar `$lte` por `$lt` o se cuenta un día
   de más.

---

## 8. Verificación

| | |
|---|---|
| Unit | 724 tests aprobados, sin `todo`, en 87 archivos. Incluye fechas, agenda inmutable, sugerencias híbridas, APIs y componentes del flujo. |
| E2E | 40 de 40 tests aprobados para desktop y Pixel 7 contra `finp-e2e`. Incluye alta con fechas entre meses, recuperación de errores, categorías y las tres vigencias de monto. |
| Typecheck | `npx tsc --noEmit` limpio. Se agregó el script `npm run typecheck`, que no existía. |
| Build | limpio. |

### Para correr los E2E hace falta `.env.test.local`

El procedimiento canónico está en
[`../../tests/e2e/helpers/README.md`](../../tests/e2e/helpers/README.md). Antes de
seed o Playwright, `npm run test:e2e:check` debe confirmar una base exclusiva.

### Backfill

```bash
npm run backfill:commitments            # dry-run
npm run backfill:commitments -- --apply # escribe
```

Idempotente. Completa `amountPolicy`, `estimationMode`, `createdFrom`, `aliases`,
`normalizedDescription` y el tramo inicial de la agenda; reconstruye `status` y `snapshot` de las
aplicaciones existentes; y escribe la procedencia en sus transacciones.

Reporta —sin tocarlas— las anomalías: aplicaciones sin transacción y aplicaciones cuya
transacción fue borrada. El 2026-07-28 se verificó un respaldo lógico completo y se aplicó
el backfill sobre `finm`: actualizó un compromiso, no modificó aplicaciones ni transacciones
y el dry-run posterior quedó en cero cambios. Persiste documentada una aplicación cuya
transacción ya había sido eliminada; el script la omite y conserva la referencia histórica.
