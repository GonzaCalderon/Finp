# Compromisos variables y Captura rápida como orientador — implementación

**Última actualización:** 2026-07-25

Documentación técnica del bloque implementado el 2026-07-25. El diseño funcional vive en
`docs/producto/compromisos_espacios_y_proyeccion.md` y
`docs/producto/captura_rapida_como_orientador.md`; este documento explica **cómo quedó
construido**, qué decisiones se tomaron y dónde extenderlo.

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
| `resolveCommitmentAmountForPeriod` | `src/lib/server/commitment-amounts.ts` | Única fuente de verdad de "cuánto vale este compromiso en este período". Puro. |
| `resolveApplicationStateForPeriod` | `src/lib/server/commitments.ts` | Estado derivado. Puro. |
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

La fecha de referencia es el **vencimiento dentro del período**, no su inicio: un aumento
efectivo a mitad de mes debe regir si cae antes del vencimiento. Con `monthStartDay ≠ 1` el
período abarca dos meses calendario, así que `resolveCommitmentDueDate` prueba ambos y descarta
desbordes (31 de febrero).

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
completar la función**. Para `create_commitment`, `intent_completed` todavía **no se emite** —
haría falta emitirlo desde Compromisos cuando la plantilla se crea de verdad (ver §7).

> ⚠️ **Triplicación de enums.** Cada tipo de evento y método vive en tres archivos:
> `src/types/quick-capture.ts`, el enum de Mongoose en
> `quick-capture-learning-event.model.ts`, y el schema zod de
> `api/quick-capture/learning/events/route.ts`. Agregar un valor exige tocar los tres.

---

## 5. APIs

| Endpoint | Cambio |
|---|---|
| `GET /api/commitments` | Devuelve `currentPeriod`, `resolvedAmount`, `amountSource` y `amountCertainty`. El período lo resuelve el servidor. |
| `POST` / `PATCH /api/commitments` | **zod en el servidor** (antes no había). Errores de datos dan 400 con detalle, no 500. El PATCH sólo escribe los campos enviados. |
| `POST` / `DELETE /api/commitments/[id]/amounts` | Alta y baja de tramos de la agenda. Una fecha efectiva repetida corrige el tramo. |
| `POST /api/commitments/[id]/apply` | Acepta `origin`; escribe snapshot y procedencia; reutiliza filas `reverted`. |
| `GET /api/projection` | Delega en `getProjectionForUser`. Devuelve `certainty` y `occurrences`. |
| `GET /api/quick-capture/context` | Suma `commitments`, `currentPeriod` y `dismissedSuggestions`, con `.catch` tolerante. |
| `POST` / `DELETE /api/quick-capture/suggestions/dismiss` | Descarte persistente, idempotente. |
| `PATCH /api/quick-capture/learning/profile` | Acepta `markCaptureIntroSeen`. |
| `DELETE /api/transactions/[id]` | Llama `unlinkTransactionDependents` **antes** de borrar y devuelve qué revirtió. |
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

## 7. Deuda conocida y próximos pasos

### Pendiente explícito de este bloque

1. **`InstallmentPlan` no se limpia** al eliminar la transacción que lo originó. La dirección
   inversa sí está resuelta (`api/installments/[id]/route.ts`). Merece su propio bloque con
   verificación de saldos.
2. **El hermano de un pago dual** (`paymentGroupId`) se **reporta** pero no se borra: mueve
   dinero real y no debería resolverse por inferencia.
3. **`intent_completed` no se emite en la derivación.** Falta emitirlo desde Compromisos cuando
   la plantilla se crea con un `draft` presente. Sin eso, la métrica de finalización sólo cubre
   las aplicaciones, no las derivaciones.
4. **`getNavInsightsForUser` sigue sin test de integración**: sólo está testeado
   `buildNavInsightsFromSignals`. El cambio de período se verificó a mano.
5. **`auto_month_start`** está modelado y rotulado en la UI, pero no hay scheduler.

### Cómo agregar el próximo destino de orientación

El camino está preparado. Para sumar, por ejemplo, cuotas:

1. Agregar el `CaptureIntent` y sus `DraftFields` en `src/types/capture-intent.ts`.
2. Detectar la intención en `src/lib/utils/capture-intents.ts` (determinista, sin red).
3. Aceptar `initialDraft` en el diálogo destino y leer `?draft=` en su página.
4. Si el destino resuelve inline, agregar la rama en `handleOrientationAction`.
5. Sumar el ejemplo a `CaptureHelpPanel` — **sólo cuando ya funcione**.
6. E2E: interpretación, transporte del borrador, validación final y retorno ante error.

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
| Unit | 589 tests, 65 archivos. Nuevos: `period`, `commitment-amounts`, `commitment-matching`, `capture-intents`, `capture-draft`, `projection`, `transaction-teardown`, `rule-trace-on-edit`, `commitments-routes`. `commitments.test.ts` pasó de 6 a 23 casos. |
| E2E | 36 tests registrados (3 nuevos × 2 proyectos): derivación con borrador, aplicación de pendiente, y ayuda. |
| Typecheck | `npx tsc --noEmit` limpio. Se agregó el script `npm run typecheck`, que no existía. |
| Build | limpio. |

### Para correr los E2E hace falta `.env.test.local`

No está en el repo. Playwright levanta su propio server en el 3001 con las variables de ese
archivo, deliberadamente separado de la base de desarrollo del 3000. Copiar `.env.test.example`
y apuntarlo a una base de test.

### Backfill

```bash
npm run backfill:commitments            # dry-run
npm run backfill:commitments -- --apply # escribe
```

Idempotente. Completa `amountPolicy`, `estimationMode`, `createdFrom`, `aliases`,
`normalizedDescription` y el tramo inicial de la agenda; reconstruye `status` y `snapshot` de las
aplicaciones existentes; y escribe la procedencia en sus transacciones.

Reporta —sin tocarlas— las anomalías: aplicaciones sin transacción y aplicaciones cuya
transacción fue borrada. En la base de desarrollo apareció **una** de estas últimas, que es
exactamente el agujero que este bloque cierra.
