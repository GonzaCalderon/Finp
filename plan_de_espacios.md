# Plan de espacios — Finp

Documento vivo para ordenar la evolución del módulo **Espacios**, su integración con Finp y las funciones relacionadas.

---

## Estado actual resumido

### Fase 1 — Rediseño visual base de Espacios
**Estado:** implementada / en QA visual final.

Incluye:
- Home de Espacios más limpia, sin sidebar pesada.
- Header simple con “Administra tus proyectos”.
- Notificaciones movidas a bell/breadcrumb.
- Grid de espacios en desktop.
- Filtros mejorados sin scroll horizontal.
- Detalle mobile/desktop mejor encaminado.
- Configuración más clara.
- Balance más cómodo.

Pendiente:
- QA visual en mobile, desktop y dark mode.
- Ajustes menores si algo todavía se siente cargado.

---

### Fase 2 — Nuevo gasto y split
**Estado:** implementada / en QA funcional.

Incluye:
- Flujo principal como “Nuevo gasto”.
- Split con:
  - Partes iguales.
  - Responsable único.
  - Porcentajes.
  - Montos fijos.
- Preview de reparto.
- FAB contextual en Espacios.
- “Pagado desde” solo cuando el pagador es el usuario actual.

Pendiente menor:
- Confirmar que ya no aparecen 50/50, 60/40 ni “Smart” en la UI.
- Mejorar visual final de “Pagado desde” si todavía se ve plano.

---

### Fase 3 — Saldar deudas en Espacios
**Estado:** implementada / en prueba manual.

Incluye:
- Entry type `settlement`.
- Registrar pago parcial o total.
- Balance actualizado con settlements.
- Settlements pendientes de confirmación no saldan balance.
- Validación estricta de settlement.
- Simplificación de deudas.
- Configuración de simplificación.
- Filtro de liquidaciones.
- Tests y build OK según reporte del agente.

Pendiente de mejora:
- Mejorar sistema de pago de saldos.
- Opciones rápidas: pagar total, pagar mitad, otro monto.
- Mostrar saldo restante después del pago.
- Unificar el mismo dialog de pago desde todos los puntos de acceso.
- Evaluar pago múltiple.

---

## Próximas fases recomendadas

### Fase 3.1 — UX avanzada de saldos
**Estado:** pendiente.

Objetivo:
Hacer que saldar deudas sea más cómodo, descriptivo y unificado.

Incluye:
- Un único `SpaceSettlementDialog` accesible desde:
  - CTA general de Balance.
  - Pago recomendado.
  - Estado personal Debés / Te deben.
  - Últimos pagos registrados.
- Prefill desde pago recomendado.
- Opciones rápidas:
  - Total pendiente.
  - 50%.
  - Otro monto.
- Mostrar:
  - saldo actual;
  - monto a pagar;
  - saldo restante después del pago.
- Mensajes claros:
  - “Roro le debe a Gonzalo $60.000”.
  - “Después de este pago quedarán $20.000”.
  - “Con este pago queda saldado”.
- Preparar pago múltiple, pero no necesariamente implementarlo todavía.

---

### Fase 4 — Categorías de espacio + comprobantes persistentes
**Estado:** próxima fase fuerte recomendada.

#### Fase 4A — Categorías propias del espacio

Decisión cerrada:
- El espacio tiene sus propias categorías.
- Son visibles para todos los participantes.
- Son editables por owner/admin.
- Sirven para reportes del espacio.
- No dependen de categorías personales.

Modelo conceptual:
```ts
SpaceEntry.spaceCategoryId // categoría compartida del espacio
Transaction.categoryId     // categoría personal privada
```

La categoría personal se usa solo cuando el usuario decide impactar el gasto en su Finp.

Incluye:
- Modelo `SpaceCategory`.
- Categorías predeterminadas según tipo de espacio.
- CRUD desde configuración.
- Archivar categorías usadas.
- Selector “Categoría del espacio” en Nuevo gasto.
- Mostrar categoría en movimientos.
- No exponer categorías personales de otros usuarios.

#### Fase 4B — Comprobantes persistentes con Vercel Blob

Decisión cerrada:
- Los comprobantes son opcionales.
- Se guardan en Vercel Blob.
- El token `BLOB_READ_WRITE_TOKEN` va en entorno, nunca en cliente.
- La subida pasa por API server-side.
- Se guarda metadata en `SpaceEntry.attachments`.
- Se muestran en detalle/lista de movimientos.

Incluye:
- Endpoints de upload/ver/borrar.
- Validación de tipo y tamaño.
- Imágenes y PDF.
- Manejo de errores parciales.
- Reintento si falla upload.
- Icono/contador de comprobantes en movimientos.
- Detalle básico de movimiento si todavía no existe.

#### Fase 4C — Aviso de retención por 3 meses

Decisión actual:
- No implementar cron todavía.
- No borrar automáticamente todavía.
- Solo avisar al usuario.

Copy sugerido:
> Los comprobantes se conservan por hasta 3 meses para optimizar el almacenamiento.

Debe aparecer:
- En uploader.
- En detalle del movimiento si hay comprobantes.
- En `design.md`.

---

### Fase 5 — Visualización y edición de movimientos
**Estado:** pendiente.

Objetivo:
Mejorar la operación diaria sobre movimientos ya cargados.

Incluye:
- Detalle de movimiento en sheet.
- Editar movimiento.
- Editar categoría del espacio.
- Editar split.
- Ver comprobantes.
- Borrar/anular movimiento.
- Ver estado de confirmación.
- Mostrar si impactó o no en Finp personal.

Reglas:
- Editar un movimiento recalcula balance.
- Si hay pagos/liquidaciones posteriores, mostrar advertencia.

---

### Fase 6 — Invitaciones por link
**Estado:** pendiente.

Incluye:
- Generar link.
- Copiar link.
- Aceptar espacio.
- Usuario nuevo puede registrarse y aceptar.
- Rol por defecto: participante.
- Owner/admin puede cambiar rol después.
- Regenerar/desactivar link más adelante.

---

### Fase 7 — Gastos compartidos simples
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

### Fase 8 — Reintegros
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

### Fase 9 — Integración avanzada Finp / Espacios
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

---

## Orden recomendado desde ahora

1. QA de Fase 3.
2. Fase 3.1 — mejorar saldar deudas.
3. Fase 4 — categorías de espacio + comprobantes Blob.
4. Fase 5 — detalle/edición de movimientos.
5. Fase 6 — invitaciones por link.
6. Fase 7 — gastos compartidos simples.
7. Fase 8 — reintegros.

---

## Decisiones de producto cerradas

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
15. Los comprobantes se guardan en Vercel Blob.
16. Por ahora se informa retención de hasta 3 meses, pero no se implementa limpieza automática.

