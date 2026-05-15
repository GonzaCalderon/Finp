# Plan de desarrollo — Finp

Documento vivo para ordenar la evolución de **Finp**, especialmente la integración entre **Finanzas personales**, **Espacios**, **Deudas**, **Transacciones**, **Cuentas** y futuras funciones relacionadas.

**Última actualización:** 2026-05-09

---

## Estado actual resumido

Finp ya cuenta con una base funcional avanzada en tres frentes principales:

1. **Finanzas personales**
    - Transacciones.
    - Cuentas.
    - Dashboard.
    - Gastos con tarjeta de crédito.
    - Pagos con TC.
    - Importación.
    - Multi-moneda ARS/USD.
    - Fecha de inicio operativo.
    - Métricas operativas separadas de movimientos reales cuando corresponde.

2. **Espacios**
    - Home y detalle de espacios rediseñados.
    - Nuevo gasto con split configurable.
    - Balance con pagos.
    - Categorías internas del espacio.
    - Comprobantes persistentes.
    - Detalle de movimiento.
    - Edición y anulación lógica con trazabilidad.
    - Actividad y notificaciones informativas.
    - Impacto personal por usuario mediante `SpaceEntryPersonalImpact`.

3. **Deudas**
    - Módulo propio con “Debo” y “Me deben”.
    - Deudas manuales.
    - Deudas derivadas de Espacios.
    - Pagos y cobros de deuda con impacto real en cuentas.
    - Pagos/cobros excluidos de gastos e ingresos operativos.
    - Integración con Transacciones, Cuentas, Dashboard y Espacios.
    - Rediseño visual de `/debts` pendiente.

La prioridad inmediata es **rediseñar la experiencia visual de Deudas** para que el módulo quede alineado con Finp antes de avanzar con cuotas en Espacios.

---

# Principios de diseño y dominio

## Separación conceptual

Finp debe mantener separadas estas capas:

```txt
Cuenta = dónde está o por dónde se mueve la plata.
Transacción = movimiento financiero o hecho operativo.
Deuda = obligación pendiente de pagar o cobrar.
Espacio = contexto compartido entre participantes.
Impacto personal = cómo un hecho compartido afecta el Finp privado de un usuario.
```

Reglas clave:

- Una deuda **no es una cuenta**.
- Un pago de deuda mueve cuenta y reduce deuda, pero **no suma gasto**.
- Un cobro/reintegro mueve cuenta y reduce lo que me deben, pero **no suma ingreso**.
- Un gasto compartido puede tener:
    - monto real movido en cuenta;
    - monto operativo propio;
    - deuda a pagar/cobrar asociada.
- En reportes personales se usa el monto operativo propio.
- En cuentas se usa el impacto real de cuenta.

---

# Tipos de espacios

Por ahora los tipos de espacios se mantienen acotados para evitar categorías sin variaciones reales:

```txt
Pareja
Grupo
Viaje
Proyecto
```

Los tipos de espacio deben servir para proponer configuraciones por defecto, no solo para decorar la UI.

Ejemplos de uso futuro:

| Tipo | Defaults sugeridos |
|---|---|
| Pareja | Deuda simplificada, categorías internas frecuentes, posible categoría personal fija o manual |
| Grupo | Deuda simplificada, foco en pagos recomendados |
| Viaje | Usar nombre del espacio como categoría virtual personal |
| Proyecto | Usar nombre del espacio como categoría virtual personal o categoría fija |

Los defaults deben ser editables por el usuario.

---

# Configuración de espacios

La configuración de un espacio deberá dividirse conceptualmente en dos bloques:

## Configuración global del espacio

Afecta a todos los participantes.

Ejemplos:

- Nombre del espacio.
- Tipo de espacio.
- Participantes.
- Monedas habilitadas.
- Criterio de deuda del espacio:
    - directa;
    - simplificada.
- Categorías internas del espacio.
- Reglas compartidas del espacio.
- Comprobantes.
- Roles/permisos.

## Configuración personal del espacio

Afecta solo al Finp del usuario actual.

Ejemplos:

- Cómo impactar gastos del espacio en mi Finp.
- Categoría personal predeterminada.
- Usar nombre del espacio como categoría virtual.
- Categorizar cada gasto manualmente.
- Mapeo entre categorías del espacio y categorías personales.
- Ignorar o seguir deudas del espacio en mi Finp.
- Preferencias personales de visualización.

Los nombres finales de UI pueden ser más compactos. Por ahora la separación conceptual es:

```txt
Configuración del espacio
Mi configuración
```

o:

```txt
General
Mi Finp
```

Se definirá el copy final más adelante.

---

# Fases implementadas

## Fase 1 — Rediseño visual base de Espacios

**Estado:** implementada.

Incluye:

- Home de Espacios más limpia.
- Header simple con “Administra tus proyectos”.
- Notificaciones movidas a bell/breadcrumb.
- Grid de espacios en desktop.
- Filtros mejorados.
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
    - partes iguales;
    - responsable único;
    - porcentajes;
    - montos fijos.
- Comportamiento smart interno para porcentajes y montos fijos, sin mostrar “Smart”.
- Preview de reparto.
- FAB contextual en Espacios.
- “Pagado desde” solo cuando el pagador es el usuario actual.
- `SpaceInitialsAvatar`.
- `SpaceSplitPreviewBar`.

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
- Validación estricta de settlement.
- Simplificación de deudas.
- Configuración de simplificación.
- Filtro “Pagos”.
- Vista directa y vista simplificada.

Decisiones cerradas:

- **Vista simplificada:** minimiza la cantidad total de pagos necesarios para saldar deudas.
- **Vista directa:** muestra pagos según el origen directo de la deuda.
- Un pago se registra entre personas, no contra el espacio.
- Los settlements deben impactar el balance del espacio inmediatamente; no deben quedar bloqueados por confirmación del pagador real.
- Si alguien constata un pago hecho por otra persona, el pago debe impactar en el espacio y el pagador real luego puede decidir si lo impacta en su Finp personal.

---

## Fase 3.1 — UX avanzada de saldos

**Estado:** implementada dentro de Fase 5A/5B.

Incluye:

- `SpaceSettlementDialog` unificado.
- Header de contexto.
- Presets:
    - total;
    - 50%;
    - otro monto.
- Preview de:
    - saldo antes;
    - monto a pagar;
    - saldo restante después del pago.
- Pagos recomendados compactos.
- Acción rápida de pago recomendado con confirmación de pago total.
- CTA general `Registrar pago` como flujo avanzado/manual.
- Soporte para pagos parciales.

Diferido:

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
- Manejo robusto de errores.
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
- Link/affordance para volver al movimiento del espacio.
- Categoría personal separada de categoría del espacio.

Corregido luego en Fase 5F:

- El impacto personal dejó de ser global del movimiento y pasó a ser por usuario.

---

## Fase 4.1 — Ajustes post-Fase 4

**Estado:** implementada.

Incluye:

- Corrección del loop de `SpaceAttachmentsUploader`.
- Gestión de categorías del espacio con UX similar a categorías personales.
- Color picker/presets consistentes.
- Color picker corregido para no quedar clippeado.
- Categorías archivadas visibles y restaurables.
- Tipos `Ingreso` y `Ajuste` ocultos de la UI.
- Selector de moneda restringido a monedas admitidas por el espacio.
- Validación server-side de moneda habilitada.
- Borrado de comprobantes corregido.
- Badge “Espacio” mejorado en transacciones personales.
- Badge/origen “Espacio” en transacciones recientes.
- Configuración desktop reorganizada.
- UX/UI de movimientos acercada al patrón de Transacciones.

Pendiente futuro:

- URL amigable para espacios mediante slug.

---

## Fase 5 — Saldos, movimientos y edición controlada

**Estado:** implementada.

Objetivo:
Unificar la experiencia de saldar deudas y mejorar la operación diaria sobre movimientos ya cargados.

### Fase 5A — Registrar pago mejorado

**Estado:** implementada.

Incluye:

- `SpaceSettlementDialog` actualizado.
- Header de contexto.
- Presets Total / 50% / Otro.
- Preview saldo antes / pago / saldo restante.
- Pago parcial.
- CTA general `Registrar pago`.
- Pagos recomendados con acción rápida de pago total.

Diferido:

- Pago múltiple avanzado.

### Fase 5B — Movimientos más claros

**Estado:** implementada.

Incluye:

- `MovementCard` rediseñado con layout denso.
- Dot de color de categoría.
- Título/metadatos separados.
- Monto/status alineado.
- Settlements como `Pagador → Receptor`.
- Filtro “Pagos”.
- `SpaceEntryDetailSheet` con “Recibió” para settlements.
- Acciones rápidas editar/anular en desktop.
- En mobile, acciones dentro del detalle.
- Affordance mobile para indicar que la fila abre detalle.

### Fase 5C — Pulido operativo de Nuevo movimiento, Resumen y Pagos recomendados

**Estado:** implementada.

Incluye:

- DatePicker consistente con Finp.
- Validaciones visibles por campo.
- Scroll/foco al primer error.
- Resumen con deuda total general.
- CTA de Resumen hacia Balance.
- Pagos recomendados compactos.
- Confirmación rápida de pago total recomendado.
- Verificación de uso del dialog nuevo desde Balance.

### Fase 5D — Edición y anulación controlada

**Estado:** implementada.

Incluye:

- Edición de movimientos.
- Anulación lógica con `isVoided`.
- No se borra físicamente el movimiento.
- Movimientos anulados visibles con estilo muted y badge “Anulado”.
- Movimientos anulados excluidos de balances, summaries y pagos recomendados.
- Snapshots de versiones anteriores en `previousVersions`.
- Historial completo de cambios.
- Badges:
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
- Si hay pagos posteriores, no se anulan automáticamente.
- Si hay transacción personal vinculada, no se modifica automáticamente.

Diferido:

- Desanular.
- Reversas automáticas.
- Sincronización automática con Finp personal.
- Aprobaciones configurables.

### Fase 5E — Actividad y notificaciones informativas

**Estado:** implementada.

Decisión:

- No implementar aprobaciones obligatorias para editar o anular movimientos en MVP.
- La transparencia será el mecanismo principal.

Incluye:

- Modelo `SpaceActivityEvent`.
- Actividad visible del espacio.
- Actividad global visible para el usuario.
- Campana con novedades no leídas.
- Separación:
    - Actividad;
    - Notificación;
    - Pendiente.
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
- Resumen con actividad real.
- Sheet/campana con pestañas o secciones.
- Marcar actividad como leída.

No incluye:

- `SpaceEntryChangeRequest`.
- Aprobaciones obligatorias.
- Emails, push, Telegram.
- Sincronización automática con Finp personal.

Diferido:

- Aprobaciones configurables.
- Regla configurable: “solo notificar” vs “requerir aprobación”.

### Fase 5F — Impacto personal por usuario en Espacios

**Estado:** implementada.

Problema resuelto:

- `linkedTransactionId`, `categoryId` personal y `status: linked` vivían en `SpaceEntry`, documento compartido.
- Un movimiento impactado por un usuario parecía “Vinculado” para todos.
- La integración con Finp personal debía ser por usuario.

Decisiones:

- Todos los participantes pueden vincular un movimiento del espacio a su Finp personal.
- El impacto personal es privado/contextual.
- El estado global del movimiento no cambia a “Vinculado”.
- `En tu Finp` solo se muestra al usuario que efectivamente vinculó/impactó ese movimiento.
- Las categorías personales nunca se usan como categoría visual del espacio.
- La categoría visual compartida siempre es `spaceCategoryId`.

Incluye:

- Modelo `SpaceEntryPersonalImpact`.
- Helper `space-personal-impact.ts`.
- Endpoint:
    - `GET /api/spaces/[id]/entries/[entryId]/personal-impact`;
    - `POST /api/spaces/[id]/entries/[entryId]/personal-impact`;
    - `DELETE /api/spaces/[id]/entries/[entryId]/personal-impact`.
- `createTransactionFromSpaceEntry` soporta:
    - `amountOverride`;
    - `dateOverride`;
    - `transactionTypeOverride`.
- Nuevos flujos dejan de escribir `SpaceEntry.status = 'linked'`.
- Nuevos flujos dejan de usar `SpaceEntry.linkedTransactionId`.
- `SpaceEntryPersonalImpact` guarda impacto privado por `userId + entryId`.
- Sección “Tu Finp” en el detalle del movimiento.
- `SpacePersonalImpactDialog`.
- Cada participante activo puede registrar su propio impacto desde el detalle.

Legacy:

- `status === 'linked'` se muestra como `Confirmado`.
- `linkedTransactionId` legacy solo se considera “En tu Finp” si pertenece al usuario actual por inferencia segura.
- No hay migración destructiva masiva.

Privacidad:

- No se genera actividad global pública por `SpaceEntryPersonalImpact`.
- No se exponen cuentas ni categorías personales de otros participantes.

Diferido:

- Sincronización automática de ediciones/anulaciones con transacciones personales.
- Reversas contables automáticas.
- Migración masiva de legacy.

---

# Fase 6 — Deudas personales base

**Estado:** implementada / en QA funcional.

Esta fase reemplazó la antigua “Fase 6 — Cuotas en Espacios”. Las cuotas pasan a una fase posterior.

Objetivo:
Crear un módulo propio de Deudas para modelar obligaciones pendientes sin forzar todo dentro de Transacciones.

## Fase 6A — Lógica/backend de Deudas

**Estado:** implementada.

Incluye:

- Modelos `Debt` y `DebtMovement`.
- Tipos:
    - `payable` / `receivable`;
    - `manual` / `space`.
- Endpoints `/api/debts`.
- Endpoints de:
    - pago;
    - cobro;
    - ignorar/restaurar;
    - resumen;
    - deudas de espacios.
- Sincronización idempotente desde Espacios.
- `debtMode` en `Space`.
- Nuevos tipos de transacción:
    - `personal_debt_payment`;
    - `personal_debt_collect`.
- Pagos/cobros afectan cuentas reales.
- Pagos/cobros no computan como gasto/ingreso operativo.
- Tarjetas de crédito no se reescriben ni se mezclan en esta fase.

## Fase 6B — UX/UI de Deudas e integración operativa

**Estado:** implementada / rediseño visual pendiente.

Incluye:

- Ruta `/debts`.
- Navegación hacia Deudas.
- Hook `useDebts`.
- Resumen Debo / Me deben / Neto.
- Lista agrupada por persona.
- Filtros:
    - Todo;
    - Debo;
    - Me deben;
    - Espacios;
    - Manuales;
    - Ignoradas.
- Sheets de detalle por persona y por deuda.
- Dialogs:
    - nueva deuda;
    - pagar deuda;
    - registrar cobro.
- Ignorar/restaurar deudas de espacios.
- `debtMode` visible en configuración de espacio.
- Sync automática de deudas cuando cambian movimientos de espacios.

Diferido:

- Rediseño visual de `/debts`.
- Integración profunda con tarjetas.
- Reversión avanzada de pagos/cobros.

## Fase 6C — Integración Transacciones / Reportes / Cuentas

**Estado:** implementada / en QA.

Objetivo:
Que los movimientos de Deudas y Espacios se vean correctamente en Transacciones, Cuentas, Dashboard y reportes.

Incluye:

- Badges para:
    - pago de deuda;
    - cobro de deuda;
    - gastos de espacios.
- Nombres más naturales:
    - “Raúl te pagó”;
    - “Le pagaste a Roro”.
- Pagos/cobros de deuda excluidos de métricas operativas.
- Filtros de transacciones adaptados.
- Edición común restringida para pagos/cobros de deuda.
- Links hacia deuda/espacio cuando corresponde.
- Helper de monto operativo.
- Diferenciación entre:
    - monto operativo propio;
    - monto real movido en cuenta.
- Dashboard y reportes usan monto operativo.
- Cuentas usan impacto real de cuenta como principal.

Regla clave:

```txt
Contexto operativo:
  mostrar tu parte como principal.

Contexto de cuenta:
  mostrar impacto real de cuenta como principal.
```

## Fase 6D — Pulido de integración Deudas / Espacios / Transacciones

**Estado:** implementada / en QA.

Incluye:

- Mejoras en visualización de “Tu parte” y “Total pagado”.
- Acciones robustas para gastos originados en espacios:
    - editar en espacio;
    - quitar de mi Finp;
    - advertencias claras.
- Si se quita de mi Finp, el espacio deja de mostrar “En tu Finp” para ese usuario.
- Links profundos hacia espacios/movimientos cuando exista metadata suficiente.
- Mejora de badges en Dashboard.
- Cuentas adaptadas a espacios y deudas.
- Movimientos de espacios mejorados usando patrón visual de Balance.
- Balance de espacio respeta `debtMode` como criterio único.
- Corrección de filtro de categorías en Transacciones.
- Ícono de Deudas revisado.

---

# Próxima fase inmediata

## Fase 6E — Rediseño visual del módulo Deudas

**Estado:** próxima recomendada.

Objetivo:
Rediseñar `/debts` para que deje de sentirse como una pantalla técnica y pase a sentirse como un módulo propio de Finp.

Principios:

- Mobile-first.
- Claro, moderno y financiero.
- Centrado en personas.
- Sin tabla contable pesada.
- Sin lenguaje contable complejo.
- Con jerarquía visual:
    1. posición neta;
    2. Debo / Me deben;
    3. personas;
    4. detalle y acciones.

Debe incluir:

- Header claro.
- Hero de posición neta.
- Cards compactas Debo / Me deben.
- Filtros simples.
- Lista agrupada por persona.
- Detail sheet por persona.
- Detail sheet por deuda.
- Timeline de movimientos.
- Dialogs de nueva deuda, pago y cobro más claros.
- Empty states.
- Bloque liviano para tarjetas de crédito con link a Pagos con TC, sin integrarlas al total.

No debe incluir:

- Cambios de backend fuertes.
- Integración profunda con tarjetas.
- Cuotas en espacios.
- Conversión multi-moneda.
- Reintegros avanzados.

---

# Fases futuras

## Fase 7 — Cuotas en Espacios

**Estado:** pendiente.

Objetivo:
Permitir que un gasto del espacio pueda estar financiado en cuotas sin convertir Espacios en una mini proyección financiera completa.

Principios:

- Espacios no debe replicar Proyección, Compromisos ni Dashboard de Finp.
- Solo debe mostrar lo necesario para entender cuotas compartidas.
- Las cuotas deben integrarse con:
    - Balance;
    - Movimientos;
    - Saldar deudas;
    - Deudas;
    - Impacto personal.

### Modos de reconocimiento

1. **Por cuota mensual**
    - Recomendado para pareja, hogar y compras grandes.
    - El espacio reconoce cada cuota cuando corresponde.
    - El balance actual solo exige cuotas vigentes/vencidas.
    - Las cuotas futuras son compromiso futuro, no deuda exigible.

2. **Total ahora**
    - Útil para viajes, compras puntuales o cuando se quiere saldar todo.
    - El espacio reconoce la deuda completa desde la fecha del gasto.

### Vista de cuotas

Agregar sección/tab contextual **Cuotas** si el espacio tiene gastos en cuotas.

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
- dashboard paralelo.

### Integración con Balance

Balance debe separar:

```txt
Saldo actual
Compromiso futuro
```

Los pagos recomendados priorizan deuda actual, no cuotas futuras.

### Integración con Movimientos

Un gasto en cuotas debe verse como movimiento padre con detalle de plan.

### Integración con Saldar deudas

Registrar pago debe permitir:

- saldar cuota actual;
- saldar varias cuotas;
- ingresar monto libre;
- pagar anticipadamente parte de cuotas futuras.

Si se paga más que la deuda actual, el excedente debe reducir compromiso futuro.

### Integración Finp personal → Espacios

Si un usuario carga en Finp personal un gasto con tarjeta en cuotas, debe poder marcarlo como gasto del espacio.

### Integración Espacios → Finp personal

Si el usuario crea el gasto desde Espacios y elige “Registrar en mi Finp”:

- Finp crea o vincula la transacción personal.
- Si es tarjeta en cuotas, reutiliza lógica existente de cuotas de Finp.
- El espacio guarda vínculo por usuario en `SpaceEntryPersonalImpact`.
- No cambia estado global del movimiento.

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

Decisiones pendientes:

1. Default para cuotas: recomendación, `monthly`.
2. Cómo tratar cuotas futuras al cerrar un espacio.
3. Pago anticipado: marcar cuotas futuras o reducir saldo futuro.
4. Edición de plan si ya hubo pagos.
5. Cuotas en espacios multi-moneda.
6. Integración con `SpaceEntryPersonalImpact`.

---

## Fase 8 — Invitaciones por link

**Estado:** pendiente.

Incluye:

- Generar link.
- Copiar link.
- Aceptar espacio.
- Usuario nuevo puede registrarse y aceptar.
- Usuario logueado puede aceptar directo.
- Rol por defecto: participante.
- Owner/admin puede cambiar rol después.
- Regenerar/desactivar link.

---

## Fase 9 — Gastos compartidos simples

**Estado:** pendiente.

Decisiones cerradas:

- Existen sin espacio.
- No se convierten en espacio.
- Los crea quien paga.
- No hay sincronización en MVP.
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

## Fase 10 — Reintegros avanzados

**Estado:** pendiente.

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

## Fase 11 — Automatización de impacto personal desde Espacios

**Estado:** futura.

Objetivo:
Permitir que cada espacio defina cómo se categorizan sus gastos al impactar en el Finp personal del usuario.

La categoría interna del espacio no cambia.

## Modos propuestos

### 1. Usar nombre del espacio como categoría virtual

Ejemplo:

```txt
Espacio: Viaje a Europa
En Finp: categoría visible “Viaje a Europa”
```

Reglas:

- No crea una categoría normal visible en Configuración de Finp.
- Funciona en dashboard, gráficos, transacciones y reportes.
- Sirve para viajes, proyectos o eventos.
- Puede migrarse luego a una categoría personal real si hace falta.

### 2. Usar una categoría personal fija

Ejemplo:

```txt
Espacio: Casa
Categoría personal fija: Hogar
```

Reglas:

- Usa una categoría real del usuario.
- Aplica a todos los gastos impactados desde ese espacio.
- El usuario puede cambiarla.

### 3. Categorizar cada gasto a mano

Reglas:

- Al impactar un gasto, el usuario elige categoría personal.
- Máximo control.
- Menos automatización.

### 4. Vincular categorías del espacio con categorías personales

Ejemplo:

```txt
Alojamiento  → Viajes
Comida       → Comida
Transporte   → Transporte
```

Reglas:

- Opción avanzada.
- Automatiza por categoría interna del espacio.
- Mantiene independencia entre categorías del espacio y categorías personales.

## Categoría virtual de espacio

Debe funcionar como categoría en:

- Dashboard.
- Gráficos.
- Transacciones.
- Reportes.
- Filtros si corresponde.

Pero no debe aparecer como categoría común editable en Configuración.

Debe existir una migración futura:

```txt
Migrar gastos categorizados como “Viaje a Europa”
a una categoría personal real.
```

Reglas de migración:

- Solo afecta transacciones personales del usuario.
- No cambia movimientos del espacio.
- No cambia categorías internas del espacio.
- No afecta a otros participantes.
- Mantiene metadata de origen espacio.

---

## Fase 12 — Integración avanzada Finp / Espacios

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

1. Fase 6E — Rediseño visual de Deudas.
2. Fase 7 — Cuotas en Espacios.
3. Fase 8 — Invitaciones por link.
4. Fase 9 — Gastos compartidos simples.
5. Fase 10 — Reintegros avanzados.
6. Fase 11 — Automatización de impacto personal desde Espacios.
7. Fase 12 — Integración avanzada Finp / Espacios.

Este orden puede cambiar si una necesidad funcional aparece antes.

---

# QA recomendado actual

Validar especialmente:

## Deudas

1. Crear deuda manual Debo.
2. Crear deuda manual Me deben.
3. Pagar deuda.
4. Registrar cobro.
5. Ver que pagos/cobros afectan cuentas.
6. Ver que pagos/cobros no suman gasto/ingreso.
7. Ignorar deuda de espacio.
8. Restaurar deuda de espacio.
9. Ver deuda saldada desde link/historial.
10. Confirmar que una deuda saldada no desaparece del sistema, solo de vistas activas.

## Espacios + Deudas

1. Crear gasto de espacio.
2. Ver deuda derivada.
3. Registrar pago desde espacio.
4. Confirmar que impacta balance del espacio inmediatamente.
5. Confirmar que reduce deuda derivada.
6. Confirmar que no obliga al pagador real a impactar en su Finp personal.
7. Pagador real puede impactar o ignorar el movimiento en su Finp.
8. Cambiar `debtMode`.
9. Confirmar que Balance muestra solo el criterio configurado.
10. Confirmar que deudas derivadas respetan `debtMode`.

## Transacciones / Cuentas / Dashboard

1. Gasto de espacio muestra “Tu parte” como principal en contextos operativos.
2. Gasto de espacio muestra impacto real como principal en Cuentas.
3. “Total pagado” aparece como secundario donde corresponde.
4. Pagos de deuda tienen badge correcto.
5. Cobros de deuda tienen badge correcto.
6. Pagos/cobros no se editan como transacciones comunes.
7. Filtros de transacciones incluyen tipos de deuda.
8. Categorías y gráficos no se alteran con pagos/cobros.

---

# Decisiones de producto cerradas

1. Espacios son para gestión persistente o colaborativa.
2. Tipos actuales de espacio:
    - Pareja;
    - Grupo;
    - Viaje;
    - Proyecto.
3. Gastos compartidos simples existen sin espacio.
4. Gasto compartido simple impacta solo la parte propia en MVP.
5. Gasto compartido simple no se convierte en espacio.
6. Finp puede recomendar crear un espacio si detecta repetición.
7. Si hay sincronización entre usuarios, se usa lógica tipo Espacios.
8. En gasto simple MVP no hay confirmación de terceros.
9. Reintegro será concepto propio.
10. Reintegro no es ingreso.
11. `Responsable único` en espacios usa `splitMode: 'none'` + `sharedWithParticipantIds[0]`.
12. Split visible queda reducido a:
    - partes iguales;
    - responsable único;
    - porcentajes;
    - montos fijos.
13. “Smart” no se muestra al usuario; solo es comportamiento interno.
14. Los espacios tienen categorías propias.
15. Las categorías personales solo se usan al impactar en Finp personal.
16. Los comprobantes se guardan en Vercel Blob privado.
17. Por ahora se informa retención de hasta 3 meses, sin limpieza automática.
18. Deudas es módulo propio.
19. La UI conceptual de Deudas es:
    - Debo;
    - Me deben.
20. Una deuda no es una cuenta.
21. Pagos de deuda no son gastos.
22. Cobros/reintegros no son ingresos.
23. Las deudas de espacios pueden generarse automáticamente.
24. El gasto personal desde Espacios no se crea automáticamente salvo acción del usuario.
25. El usuario puede ignorar deudas del espacio en su Finp.
26. Cada espacio tiene un único criterio de deuda:
    - directa;
    - simplificada.
27. No conviven ambos criterios como criterio operativo.
28. Si el espacio usa deuda simplificada, Deudas usa ese criterio.
29. Si usa deuda directa, respeta deuda directa por origen.
30. Settlements impactan el balance del espacio inmediatamente.
31. La confirmación del pagador real no bloquea el settlement.
32. El impacto personal en Finp es por usuario mediante `SpaceEntryPersonalImpact`.
33. `En tu Finp` es contextual del usuario actual.
34. No se generan eventos públicos del espacio por impacto personal.
35. Si el usuario selecciona una cuenta real de pago, el saldo real baja por el total pagado.
36. Los reportes de gasto solo computan la parte propia.
37. Contextos operativos muestran la parte propia como principal.
38. Contextos de cuenta muestran el impacto real de cuenta como principal.
39. Tarjetas de crédito se integrarán con cuidado y no se reescriben por ahora.
40. Las cuotas en Espacios deben ser visibles y accionables sin convertir Espacios en una proyección financiera completa.
41. Para gastos en cuotas, el espacio debe poder reconocer el gasto por cuota mensual o total ahora.
42. La deuda exigible por cuotas debe separarse del compromiso futuro.
43. Las cuotas de Espacios deben integrarse con Finp personal mediante vínculo, no duplicando lógica si ya existe.
44. Cuando un movimiento de Espacios impacta en Finp personal, puede asignarse una categoría personal separada.
45. Los movimientos de Espacios solo permiten monedas habilitadas.
46. Si una moneda del espacio no es compatible con Finp personal, el impacto personal requiere conversión/cambio o queda diferido.
47. Las URLs de espacios deberían evolucionar a slugs amigables.
48. No habrá aprobaciones obligatorias en MVP; se usa transparencia y notificaciones.
49. Editar/anular aplica según permisos, se registra en actividad y se notifica.
50. Las reversas contables automáticas quedan diferidas.
51. La migración masiva de legacy queda diferida.
52. La configuración de espacios debe separar configuración global y configuración personal.
53. El nombre del espacio podrá usarse como categoría virtual personal.
54. La categoría virtual de espacio no debe aparecer como categoría normal en Configuración de Finp.
55. Debe existir la posibilidad futura de migrar gastos con categoría virtual a una categoría personal real.
56. Los tipos de espacio deben proponer configuraciones por defecto.

---

# Deuda técnica / diferidos conocidos

- Slugs amigables para espacios.
- Limpieza automática de comprobantes pasados 3 meses.
- Migración legacy de `linkedTransactionId` / `status: linked` a `SpaceEntryPersonalImpact`.
- Sincronización automática avanzada entre edición/anulación de espacios y transacciones personales.
- Reversas contables asistidas o automáticas.
- Reintegros como tipo conceptual propio.
- Pago múltiple avanzado.
- Aprobaciones configurables por espacio.
- Emails/push/Telegram.
- Actividad global avanzada fuera de Espacios.
- Integración profunda de tarjetas de crédito con Deudas.
- Conversión multi-moneda en deudas.
- Link profundo a movimiento específico en todos los contextos.
- Rediseño visual final de Deudas.
- Automatización avanzada de categorías personales por espacio.
