# Plan de espacios — Finp

Documento vivo para ordenar la evolución del módulo **Espacios**, su integración con Finp y las funciones relacionadas.

**Última actualización:** 2026-05-06

---

> Nota 2026-05-15: este documento queda como referencia histórica y de dominio para Espacios. El plan principal actualizado está en `plan_de_desarrollo_finp.md`; el plan de calidad y estabilización está en `docs/plan_calidad_estabilizacion_finp.md`.

---

## Estado actual resumido

El módulo **Espacios** ya cuenta con una base funcional avanzada:

- Home y detalle de espacios rediseñados.
- Nuevo gasto con split configurable.
- Balance con pagos, vista directa y vista simplificada.
- Categorías propias del espacio.
- Comprobantes persistentes en Vercel Blob privado.
- Detalle de movimiento.
- Edición y anulación lógica con trazabilidad.
- Actividad y notificaciones informativas.
- Impacto personal por usuario mediante `SpaceEntryPersonalImpact`.

La próxima fase grande recomendada es **Fase 6 — Cuotas en Espacios**.

Antes de entrar en Fase 6, conviene hacer QA puntual de la integración Finp personal / Espacios para confirmar que el estado “En tu Finp” sea realmente contextual del usuario actual.

---

# Fases implementadas

## Fase 1 — Rediseño visual base de Espacios

**Estado:** implementada.

Incluye:

- Home de Espacios más limpia, sin sidebar pesada.
- Header simple con “Administra tus proyectos”.
- Notificaciones movidas a bell/breadcrumb.
- Grid de espacios en desktop.
- Filtros mejorados sin scroll horizontal.
- Detalle mobile/desktop mejor encaminado.
- Configuración más clara.
- Balance más cómodo.
- KPIs mobile más livianos.
- Resumen con menos duplicación visual.
- Reducción del patrón cards sobre cards.

Pendiente menor:

- QA visual continuo en mobile, desktop y dark mode cuando se agreguen nuevas funciones.

---

## Fase 2 — Nuevo gasto y split

**Estado:** implementada.

Incluye:

- Flujo principal como “Nuevo gasto”.
- Tipo de movimiento oculto de la UI principal.
- Tipos `Ingreso` y `Ajuste` ocultos de la UI por ahora.
- Split con:
    - Partes iguales.
    - Responsable único.
    - Porcentajes.
    - Montos fijos.
- Comportamiento smart interno para porcentajes y montos fijos, sin mostrar “Smart” al usuario.
- Preview de reparto.
- FAB contextual en Espacios.
- “Pagado desde” solo cuando el pagador es el usuario actual.
- `SpaceInitialsAvatar` en participantes/pagador.
- `SpaceSplitPreviewBar` reutilizable.

Decisiones cerradas:

- No mostrar 50/50 ni 60/40 como presets visibles.
- No mostrar “Smart” como etiqueta de UI.
- `Responsable único` usa `splitMode: 'none'` + `sharedWithParticipantIds[0]`.

---

## Fase 3 — Saldar deudas en Espacios

**Estado:** implementada.

Incluye:

- Entry type `settlement`.
- Registrar pago parcial o total.
- Balance actualizado con settlements.
- Settlements pendientes de confirmación no saldan balance.
- Validación estricta de settlement.
- Simplificación de deudas.
- Configuración de simplificación.
- Filtro “Pagos”.
- Vista directa y vista simplificada.

Decisiones cerradas:

- **Vista simplificada:** busca minimizar la cantidad total de pagos necesarios para saldar deudas.
- **Vista directa:** muestra pagos según el origen directo de la deuda, sin optimización greedy.
- Un pago se registra entre personas, no “contra el espacio”.

---

## Fase 3.1 — UX avanzada de saldos

**Estado:** implementada dentro de Fase 5A/5B.

Incluye:

- `SpaceSettlementDialog` unificado.
- Header de contexto.
- Presets:
    - Total.
    - 50%.
    - Otro monto.
- Preview de:
    - saldo antes;
    - monto a pagar;
    - saldo restante después del pago.
- Pagos recomendados compactos.
- Acción rápida de pago recomendado con confirmación de pago total.
- CTA general `Registrar pago` reintroducido como flujo avanzado/manual, no como dialog viejo.
- Soporte para pagos parciales.

Pendiente futuro:

- Pago múltiple avanzado.

---

## Fase 4 — Categorías de espacio + comprobantes persistentes

**Estado:** implementada.

### Fase 4A — Categorías propias del espacio

Incluye:

- Modelo `SpaceCategory`.
- Categorías predeterminadas según tipo de espacio.
- Seed automático en espacios nuevos.
- Seed manual/idempotente en espacios existentes.
- CRUD desde configuración.
- Archivar categorías usadas.
- Restaurar categorías archivadas.
- Selector “Categoría del espacio” en nuevo gasto.
- Categoría visible en movimientos y reportes del espacio.
- Categorías personales separadas de categorías del espacio.

Decisión cerrada:

```ts
SpaceEntry.spaceCategoryId // categoría compartida del espacio
Transaction.categoryId     // categoría personal privada
```

La categoría personal se usa solo cuando el usuario decide impactar el gasto en su Finp.

### Fase 4B — Comprobantes persistentes con Vercel Blob

Incluye:

- Vercel Blob privado.
- Uso server-side de `BLOB_READ_WRITE_TOKEN`.
- Endpoints autenticados para subir, ver/streamear y borrar comprobantes.
- Metadata en `SpaceEntry.attachments`.
- Validación de tipo y tamaño.
- Soporte para imágenes y PDF.
- Manejo robusto de errores de upload/delete.
- Comprobantes visibles en detalle/lista de movimientos.
- Retención informada.

Decisión cerrada:

- Los comprobantes pertenecen al espacio.
- No deben ser accesibles públicamente desde afuera.
- Se sirven mediante endpoint autenticado.

### Fase 4C — Aviso de retención por 3 meses

**Estado:** implementada como aviso, sin limpieza automática.

Copy base:

> Los comprobantes se conservan por hasta 3 meses para optimizar el almacenamiento.

Aparece en:

- Uploader.
- Detalle de movimiento si hay comprobantes.
- Documentación de diseño.

Diferido:

- Cron o job de limpieza real.

### Fase 4D — Integración visible con Finp personal

**Estado:** implementada parcialmente y luego corregida formalmente en Fase 5F.

Incluye:

- Transacciones personales originadas desde Espacios con metadata:
    - `spaceId`;
    - `spaceEntryId`;
    - `spaceNameSnapshot`.
- Badge/origen “Espacio” en transacciones personales.
- Badge/origen en transacciones recientes del dashboard.
- Link/affordance para volver al movimiento del espacio cuando corresponda.
- Categoría personal separada de categoría del espacio.

Corregido luego en Fase 5F:

- El impacto personal dejó de ser global del movimiento y pasó a ser por usuario.

---

## Fase 4.1 — Ajustes post-Fase 4

**Estado:** implementada.

Incluye:

- Corrección del loop de `SpaceAttachmentsUploader` por `existingAttachments` inestable.
- Gestión de categorías del espacio con UX similar a categorías personales de Finp.
- Color picker/presets consistentes con Configuración.
- Color picker corregido para no quedar clippeado dentro de la card.
- Categorías archivadas visibles y restaurables.
- Tipos `Ingreso` y `Ajuste` ocultos de la UI.
- Selector de moneda restringido a monedas admitidas por el espacio.
- Validación server-side de moneda habilitada.
- Borrado de comprobantes corregido.
- Badge “Espacio” mejorado en transacciones personales.
- Badge/origen “Espacio” en transacciones recientes del dashboard.
- Configuración desktop reorganizada.
- UX/UI de movimientos acercada al patrón de Transacciones de Finp personal.

Pendiente futuro:

- URL amigable para espacios mediante slug.

---

## Fase 5 — Saldos, movimientos y edición controlada

**Estado:** implementada.

Objetivo:
Unificar la experiencia de saldar deudas y mejorar la operación diaria sobre movimientos ya cargados.

---

### Fase 5A — Registrar pago mejorado

**Estado:** implementada.

Incluye:

- `SpaceSettlementDialog` actualizado.
- Header de contexto.
- Presets Total / 50% / Otro.
- Preview saldo antes / pago / saldo restante.
- Pago parcial.
- CTA general `Registrar pago` como flujo avanzado/manual.
- Pagos recomendados con acción rápida de pago total y confirmación inline.

Diferido:

- Pago múltiple avanzado.

---

### Fase 5B — Movimientos más claros

**Estado:** implementada.

Incluye:

- `MovementCard` rediseñado con layout denso.
- Dot de color de categoría.
- Título/metadatos separados, no concatenados como texto corrido.
- Monto/status alineado.
- Settlements como `Pagador → Receptor`.
- Filtro “Pagos” en lugar de “Liquidaciones”.
- `SpaceEntryDetailSheet` con “Recibió” para settlements.
- Acciones rápidas editar/anular en desktop.
- En mobile, acciones dentro del detalle para no romper la fila.
- Affordance mobile para indicar que la fila abre detalle.

---

### Fase 5C — Pulido operativo de Nuevo movimiento, Resumen y Pagos recomendados

**Estado:** implementada.

Incluye:

- DatePicker consistente con el patrón de Finp.
- Validaciones visibles por campo.
- Scroll/foco al primer error.
- Resumen con deuda total general.
- CTA de Resumen hacia Balance.
- Pagos recomendados compactos.
- Confirmación rápida de pago total recomendado.
- Verificación de uso del dialog nuevo desde Balance.

---

### Fase 5D — Edición y anulación controlada

**Estado:** implementada.

Incluye:

- Edición de movimientos.
- Anulación lógica con `isVoided`.
- No se borra físicamente el movimiento.
- Movimientos anulados visibles en historial/lista con estilo muted y badge “Anulado”.
- Movimientos anulados excluidos de balances, summaries y pagos recomendados.
- Snapshots de versiones anteriores en `previousVersions`.
- Historial completo de cambios visible.
- Tags/badges:
    - `Editado`;
    - `Anulado`.
- Mostrar quién anuló y cuándo.
- Motivo de anulación si existe.
- Advertencias por pagos posteriores.
- Advertencias por impacto en Finp personal.
- Anulación no reversible en MVP.

Reglas:

- Editar recalcula balance.
- Anular recalcula balance excluyendo el movimiento.
- Si hay pagos posteriores, no se anulan automáticamente; se advierte al usuario.
- Si hay transacción personal vinculada, no se modifica automáticamente; se advierte al usuario.

Diferido:

- Desanular.
- Reversas automáticas.
- Sincronización automática con Finp personal.
- Aprobaciones configurables.

---

### Fase 5E — Actividad y notificaciones informativas

**Estado:** implementada según reporte.

Decisión de producto:

- No implementar aprobaciones obligatorias para editar o anular movimientos en el MVP.
- En grupos grandes, exigir aprobaciones puede volver engorroso el uso de Espacios.
- La transparencia será el mecanismo principal: toda acción sensible queda registrada y notificada.

Incluye:

- Modelo `SpaceActivityEvent`.
- Actividad visible del espacio.
- Actividad global visible para el usuario.
- Campana con novedades no leídas.
- Separación conceptual:
    - Actividad: historial informativo.
    - Notificación: novedad relevante/no leída.
    - Pendiente: requiere acción; se mantiene para invitaciones/confirmaciones existentes.
- Eventos por:
    - movimiento creado;
    - movimiento editado;
    - movimiento anulado;
    - pago registrado;
    - comprobante agregado/eliminado;
    - categoría creada/archivada/restaurada;
    - participante invitado/agregado/removido;
    - rol cambiado;
    - configuración modificada.
- Resumen con actividad real en lugar de “últimos movimientos” planos.
- Sheet/campana con pestañas o secciones de Pendientes y Actividad.
- Marcar actividad como leída.

No incluye:

- `SpaceEntryChangeRequest`.
- Aprobaciones obligatorias.
- Approve/reject/cancel.
- Bloqueo de edición/anulación hasta aprobación.
- Emails, push, Telegram.
- Sincronización automática con Finp personal.

Diferido opcional:

- Aprobaciones configurables por espacio si en el futuro se necesita un modo más formal.
- Regla configurable: “solo notificar” vs “requerir aprobación”.

---

### Fase 5F — Impacto personal por usuario en Espacios

**Estado:** implementada según reporte / clave antes de cuotas.

Problema resuelto:

- `linkedTransactionId`, `categoryId` personal y `status: linked` vivían en `SpaceEntry`, que es un documento compartido.
- Eso hacía que un movimiento impactado/vinculado por un usuario pareciera “Vinculado” para todos los participantes.
- La integración con Finp personal debía ser por usuario, no global del movimiento.

Decisión de producto:

- Todos los participantes deben poder vincular un movimiento del espacio a su Finp personal.
- El impacto personal es privado/contextual de cada usuario.
- El estado global del movimiento no cambia a “Vinculado”.
- `En tu Finp` solo se muestra al usuario que efectivamente vinculó/impactó ese movimiento.
- Las categorías personales nunca se usan como categoría visual del espacio.
- La categoría visual compartida siempre es `spaceCategoryId`.

Incluye:

- Nuevo modelo `SpaceEntryPersonalImpact`.
- Nuevo helper `space-personal-impact.ts`.
- Endpoint:
    - `GET /api/spaces/[id]/entries/[entryId]/personal-impact`;
    - `POST /api/spaces/[id]/entries/[entryId]/personal-impact`;
    - `DELETE /api/spaces/[id]/entries/[entryId]/personal-impact`.
- `createTransactionFromSpaceEntry` soporta:
    - `amountOverride`;
    - `dateOverride`;
    - `transactionTypeOverride`.
- Nuevos flujos dejan de escribir `SpaceEntry.status = 'linked'`.
- Nuevos flujos dejan de usar `SpaceEntry.linkedTransactionId` como vínculo compartido.
- `SpaceEntryPersonalImpact` guarda el impacto privado por `userId + entryId`.
- `personalImpactsByEntryId` o equivalente alimenta la UI contextual.
- Sección “Tu Finp” en el detalle del movimiento.
- Nuevo `SpacePersonalImpactDialog`.
- Cada participante activo puede registrar su propio impacto desde el detalle sin cambiar el estado compartido.

Legacy:

- `status === 'linked'` se muestra como `Confirmado`.
- `linkedTransactionId` legacy solo se considera “En tu Finp” si pertenece al usuario actual por `confirmedByUserId` o inferencia segura del pagador.
- No hay migración destructiva ni masiva.

Privacidad:

- No se genera actividad global pública por `SpaceEntryPersonalImpact`.
- No se exponen cuentas ni categorías personales de otros participantes.

QA recomendado antes de Fase 6:

- Usuario A registra un gasto y lo impacta en su Finp: solo Usuario A ve `En tu Finp`.
- Usuario B ve el mismo movimiento sin `En tu Finp` y puede registrarlo en su propio Finp.
- Usuario B registra su impacto: ambos usuarios tienen su propio vínculo sin pisarse.
- En Espacios se muestra siempre `spaceCategoryId`, nunca la categoría personal de otro usuario.
- Movimientos legacy con `status: linked` se ven como Confirmado.

Diferido:

- Sincronización automática de ediciones/anulaciones con transacciones personales.
- Reversas contables automáticas.
- Reintegros avanzados.
- Cuotas en espacios.
- Migración masiva de legacy a `SpaceEntryPersonalImpact`.

---

# Próxima fase recomendada

## Fase 6 — Cuotas en Espacios

**Estado:** pendiente, próxima fase fuerte recomendada.

Objetivo:
Permitir que un gasto del espacio pueda estar financiado en cuotas sin convertir Espacios en una mini proyección financiera completa.

Principio de diseño:

- Espacios no debe replicar Proyección, Compromisos ni Dashboard de Finp.
- Solo debe mostrar lo necesario para entender cuotas compartidas de forma clara y accionable.
- Las cuotas deben integrarse con Balance, Movimientos, Saldar deudas e Impacto personal.

### Modos de reconocimiento del gasto

Al cargar un gasto en cuotas, el usuario debe elegir cómo se reconoce dentro del espacio:

1. **Por cuota mensual** — recomendado para pareja, hogar y compras grandes.

    - El espacio reconoce cada cuota cuando corresponde.
    - El balance actual solo exige la cuota vigente o vencida.
    - Las cuotas futuras se muestran como compromiso futuro, no como deuda exigible.

2. **Total ahora** — útil para viajes, compras puntuales o cuando se quiere saldar todo de una vez.

    - El espacio reconoce la deuda completa desde la fecha del gasto.
    - El balance puede reclamar la totalidad de la parte correspondiente.

### Vista específica de cuotas

Agregar una sección o tab contextual que solo aparezca si el espacio tiene gastos en cuotas.

Nombre recomendado: **Cuotas**.

Debe mostrar:

- Gasto financiado.
- Cantidad de cuotas.
- Cuota actual.
- Monto de cuota.
- Parte del usuario.
- Quién pagó.
- Quién debe.
- Estado:
    - futura;
    - vigente;
    - vencida;
    - saldada;
    - parcialmente saldada.

No debe mostrar:

- proyecciones financieras completas;
- gráficos complejos;
- compromisos globales de Finp;
- dashboard paralelo.

### Integración con Balance

Balance debe separar:

- **Saldo actual:** deuda exigible por cuotas vigentes/vencidas.
- **Compromiso futuro:** cuotas futuras ya acordadas, pero todavía no exigibles.

Ejemplo:

```txt
Saldo actual
Roro debe $50.000

Compromiso futuro
Quedan 8 cuotas por $50.000
```

Los pagos recomendados deberían priorizar deuda actual, no cuotas futuras.

### Integración con Movimientos

Un gasto en cuotas debe verse como un único movimiento padre con detalle de plan:

```txt
Heladera
$900.000 · 9 cuotas
Cuota actual 1/9 · $100.000
```

El detalle debe mostrar el calendario de cuotas:

```txt
1/9 Abr 2026  $100.000  Vigente
2/9 May 2026  $100.000  Futura
3/9 Jun 2026  $100.000  Futura
```

### Integración con Saldar deudas

Registrar pago debe permitir:

- saldar cuota actual;
- saldar varias cuotas;
- ingresar monto libre;
- pagar anticipadamente parte de cuotas futuras.

Si se paga más que la deuda actual, el excedente debe reducir compromiso futuro.

### Integración Finp personal → Espacios

Si un usuario carga en Finp personal un gasto con tarjeta en cuotas, debe poder marcarlo como gasto del espacio.

Flujo futuro:

1. Usuario crea gasto con tarjeta en cuotas en Finp personal.
2. Elige “Compartir en espacio”.
3. Selecciona espacio.
4. Define split.
5. Define reconocimiento en el espacio:
    - por cuota mensual;
    - total ahora.
6. El movimiento del espacio queda vinculado a la transacción personal del usuario mediante `SpaceEntryPersonalImpact`.

### Integración Espacios → Finp personal

Si el usuario crea el gasto desde Espacios y elige “Registrar en mi Finp”:

- Finp debe crear o vincular la transacción personal del usuario actual.
- Si es tarjeta en cuotas, debe reutilizar la lógica existente de cuotas de Finp.
- El espacio debe guardar el vínculo por usuario en `SpaceEntryPersonalImpact`.
- No debe cambiar el estado global del movimiento a “Vinculado”.

### Modelo conceptual futuro

```ts
SpaceEntry.installmentPlan?: {
  source: 'linked_transaction' | 'manual'
  linkedTransactionId?: string
  totalAmount: number
  installments: number
  firstInstallmentMonth: string
  currentInstallment?: number
  recognitionMode: 'monthly' | 'upfront'
}
```

Si ya existe un modelo robusto de cuotas en transacciones personales, el espacio debería vincularse a esa fuente en vez de duplicar toda la lógica.

### Decisiones pendientes

1. Si el modo default para cuotas debe ser **Por cuota mensual**. Recomendación: sí.
2. Cómo tratar cuotas futuras al cerrar un espacio.
3. Si el pago anticipado debe marcar cuotas futuras como saldadas o solo reducir saldo futuro.
4. Cómo editar un plan de cuotas si ya hubo pagos registrados.
5. Cómo mostrar cuotas en espacios multi-moneda.
6. Cómo integrar cuotas con `SpaceEntryPersonalImpact` cuando distintos participantes impactan el mismo movimiento en su propio Finp.

---

# Fases futuras

## Fase 7 — Invitaciones por link

**Estado:** pendiente.

Incluye:

- Generar link.
- Copiar link.
- Aceptar espacio.
- Usuario nuevo puede registrarse y aceptar.
- Usuario logueado puede aceptar directo.
- Rol por defecto: participante.
- Owner/admin puede cambiar rol después.
- Regenerar/desactivar link más adelante.

---

## Fase 8 — Gastos compartidos simples

**Estado:** pendiente.

Decisiones cerradas:

- Existen sin espacio.
- No se convierten en espacio.
- Los crea quien paga.
- No hay sincronización en el MVP.
- Impactan inmediatamente.
- Impactan solo la parte propia.
- Muestran que el gasto fue compartido y cómo se repartió.

Ejemplo:

```txt
Cena total: $100.000
Tu parte: $40.000
Roro: $60.000
```

En Finp:

- Se registra gasto personal por $40.000.
- Se muestra que fue compartido.
- No se crea deuda sincronizada todavía.

---

## Fase 9 — Reintegros

**Estado:** pendiente, fase propia.

Decisión cerrada:

**Reintegro no es ingreso.**

Es dinero que vuelve porque alguien saldó parte de un gasto adelantado.

Debe:

- Aumentar saldo de cuenta.
- No sumar a ingresos operativos.
- Reducir deuda/a cobrar.
- Vincularse a espacio o gasto compartido simple.

Queda para después porque toca:

- Transacciones.
- Dashboard.
- Reportes.
- Categorías.
- Saldos.
- Edición/reversión.

---

## Fase 10 — Integración avanzada Finp / Espacios

**Estado:** futura.

Incluye:

- “A cobrar / A pagar” global.
- Pendientes de impacto personal.
- Reportes separando:
    - gasto propio;
    - adelantos;
    - reintegros.
- Sugerencias inteligentes:
    - “Compartiste 5 gastos con Roro, ¿querés crear un espacio?”.
- Sincronización avanzada de ediciones/anulaciones con Finp personal.
- Reversas automáticas o asistidas.
- Aprobaciones configurables por espacio si se requiere modo formal.

---

# Orden recomendado desde ahora

1. QA puntual de Fase 5F.
2. Fase 6 — cuotas en Espacios.
3. Fase 7 — invitaciones por link.
4. Fase 8 — gastos compartidos simples.
5. Fase 9 — reintegros.
6. Fase 10 — integración avanzada Finp / Espacios.

---

# QA mínimo antes de Fase 6

Validar especialmente la separación por usuario:

1. Usuario A registra un gasto y lo impacta en su Finp.
2. Usuario A ve `En tu Finp`.
3. Usuario B no ve `En tu Finp`.
4. Usuario B puede registrar su propio impacto.
5. Ambos impactos conviven sin pisarse.
6. La categoría compartida del espacio sigue siendo `spaceCategoryId`.
7. La categoría personal de A no aparece para B.
8. `status: linked` legacy se muestra como Confirmado.
9. El movimiento compartido no cambia su estado global al ser impactado por un usuario.
10. Transacciones personales de cada usuario muestran origen Espacio sin filtrar datos de otros.

---

# Decisiones de producto cerradas

1. Espacios son para gestión persistente o colaborativa.
2. Gastos compartidos simples existen sin espacio.
3. Gasto compartido simple impacta solo la parte propia en el MVP.
4. Gasto compartido simple no se convierte en espacio.
5. Finp puede recomendar crear un espacio si detecta repetición.
6. Si hay sincronización entre usuarios, se usa lógica tipo Espacios.
7. En gasto simple MVP no hay confirmación de terceros.
8. Reintegro será concepto propio.
9. Reintegro no es ingreso.
10. `Responsable único` en espacios usa `splitMode: 'none'` + `sharedWithParticipantIds[0]`.
11. Split visible queda reducido a:
    - Partes iguales.
    - Responsable único.
    - Porcentajes.
    - Montos fijos.
12. “Smart” no se muestra al usuario; solo es comportamiento interno.
13. Los espacios tienen categorías propias.
14. Las categorías personales solo se usan al impactar en Finp personal.
15. Los comprobantes se guardan en Vercel Blob privado.
16. Por ahora se informa retención de hasta 3 meses, pero no se implementa limpieza automática.
17. Las cuotas en Espacios deben ser visibles y accionables, pero sin convertir Espacios en una proyección financiera completa.
18. Para gastos en cuotas, el espacio debe poder reconocer el gasto por cuota mensual o total ahora.
19. La deuda exigible por cuotas debe separarse del compromiso futuro.
20. Las cuotas de Espacios deben integrarse con las cuotas de Finp personal mediante vínculo, no duplicando lógica si ya existe una fuente personal.
21. Cuando un movimiento de Espacios impacta en Finp personal, debe poder asignarse una categoría personal separada de la categoría del espacio.
22. Las transacciones personales creadas desde Espacios deben mostrar claramente su origen y permitir volver al movimiento del espacio cuando corresponda.
23. Los movimientos de Espacios solo deben permitir monedas habilitadas en el espacio.
24. Si una moneda del espacio no es compatible con Finp personal, debe poder registrarse en el espacio, pero el impacto personal debe requerir conversión/cambio o quedar para una fase posterior.
25. Las URLs de espacios deberían evolucionar a slugs amigables para no exponer solo el ObjectId.
26. No habrá aprobaciones obligatorias en el MVP de edición/anulación; la transparencia y notificaciones informativas reemplazan la aprobación.
27. Editar/anular aplica si el usuario tiene permiso; se registra en actividad y se notifica a involucrados.
28. El impacto personal en Finp es por usuario mediante `SpaceEntryPersonalImpact`.
29. `SpaceEntry.status = 'linked'` queda como legacy y se muestra como Confirmado.
30. `En tu Finp` es contextual del usuario actual, no estado global del movimiento.
31. No se generan eventos públicos del espacio por impacto personal para no exponer cuentas/categorías privadas.
32. La sincronización automática con Finp personal ante ediciones/anulaciones queda diferida.
33. Las reversas contables automáticas quedan diferidas.
34. La migración masiva de legacy a `SpaceEntryPersonalImpact` queda diferida.

---

# Deuda técnica / diferidos conocidos

- Slugs amigables para espacios.
- Limpieza automática de comprobantes pasados 3 meses.
- Migración legacy de `linkedTransactionId` / `status: linked` a `SpaceEntryPersonalImpact`.
- Sincronización automática entre edición/anulación de espacios y transacciones personales.
- Reversas contables asistidas o automáticas.
- Reintegros como tipo conceptual propio.
- Pago múltiple avanzado.
- Aprobaciones configurables por espacio.
- Emails/push/Telegram.
- Actividad global avanzada fuera de Espacios.
