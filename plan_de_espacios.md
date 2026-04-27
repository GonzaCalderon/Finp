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

#### Fase 4D — Integración visible con Finp personal

Problema detectado:
- Cuando un gasto de espacio impacta en Finp personal, puede quedar sin categoría personal.
- En Finp personal no queda suficientemente visible qué transacciones vienen de Espacios.

Decisión de producto:
- La categoría del espacio y la categoría personal son conceptos separados.
- `spaceCategoryId` organiza el movimiento dentro del espacio.
- `Transaction.categoryId` organiza el impacto dentro del Finp personal del usuario.
- Si el usuario decide impactar el gasto en sus finanzas, debe poder asignar una categoría personal.
- Las transacciones personales originadas desde Espacios deben identificarse claramente.

Incluye:
- Al elegir “Pagado desde” / impactar en Finp personal, mostrar selector de categoría personal separado de la categoría del espacio.
- Permitir sugerir categoría personal a partir de la categoría del espacio, si existe coincidencia por nombre o mapeo futuro.
- Si no se elige categoría personal, mostrarlo como “Sin categoría” en Finp personal, pero con posibilidad de corregir.
- Agregar metadata de origen en la transacción personal:
  - origen: `space`;
  - `spaceId`;
  - `spaceEntryId`;
  - nombre del espacio opcional como snapshot.
- En la lista/detalle de transacciones personales, mostrar badge o referencia:
  - “Espacio: Casa con Roro”;
  - o “Desde Espacios”.
- Permitir navegar desde la transacción personal al movimiento del espacio, si el usuario tiene acceso.
- En el movimiento del espacio, mostrar si fue impactado en Finp personal del usuario actual.

No incluye todavía:
- reintegros;
- cuentas por cobrar globales;
- impacto automático para otros participantes;
- sincronización entre usuarios.


---

### Fase 4.1 — Ajustes post-Fase 4
**Estado:** pendiente inmediato.

Objetivo:
Cerrar inconsistencias detectadas en QA de Fase 4 antes de avanzar a nuevas funciones.

Incluye:
- Corregir loop de `SpaceAttachmentsUploader` por `existingAttachments` inestable.
- Mejorar gestión de categorías del espacio con UX similar a categorías personales de Finp.
- Usar color picker/presets consistentes con Configuración.
- Mostrar categorías archivadas y permitir restaurarlas.
- Ocultar de la UI los tipos `Ingreso` y `Ajuste` en Espacios por ahora.
- Mantener soporte técnico para `income` y `adjustment`, pero sin exponerlos.
- Integrar categoría personal cuando un movimiento de espacio impacta en Finp personal.
- Identificar transacciones personales creadas desde Espacios con badge/origen.
- Corregir selector de moneda de movimiento para usar monedas admitidas por el espacio.
- Bloquear o explicar impacto personal cuando la moneda del espacio no es compatible con cuentas personales de Finp.
- Evaluar URL amigable para espacios mediante slug en vez de exponer solo ObjectId.
- Reacomodar configuración desktop aprovechando mejor el ancho disponible.
- Mejorar UX/UI de movimientos con patrón similar a Transacciones de Finp personal, adaptado a Espacios.

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
- Solicitar aprobación de participantes involucrados para edición o eliminación cuando corresponda.
- Mostrar tag “Editado” y acceso a versión anterior.
- Si se elimina un movimiento, no borrarlo físicamente: marcarlo como eliminado, mostrarlo en gris y excluirlo de cálculos operativos.
- Llevar aprobaciones/rechazos a notificaciones.

Reglas:
- Editar un movimiento recalcula balance.
- Si hay pagos/liquidaciones posteriores, mostrar advertencia.

---

### Fase 6 — Cuotas en Espacios
**Estado:** pendiente, fase de diseño ampliada.

Objetivo:
Permitir que un gasto del espacio pueda estar financiado en cuotas sin convertir Espacios en una mini proyección financiera completa.

Principio de diseño:
- Espacios no debe replicar Proyección, Compromisos ni Dashboard de Finp.
- Solo debe mostrar lo necesario para entender cuotas compartidas de forma clara y accionable.
- Las cuotas deben integrarse con Balance, Movimientos y Saldar deudas.

#### Modos de reconocimiento del gasto

Al cargar un gasto en cuotas, el usuario debe elegir cómo se reconoce dentro del espacio:

1. **Por cuota mensual** — recomendado para pareja, hogar y compras grandes.
   - El espacio reconoce cada cuota cuando corresponde.
   - El balance actual solo exige la cuota vigente o vencida.
   - Las cuotas futuras se muestran como compromiso futuro, no como deuda exigible.

2. **Total ahora** — útil para viajes, compras puntuales o cuando se quiere saldar todo de una vez.
   - El espacio reconoce la deuda completa desde la fecha del gasto.
   - El balance puede reclamar la totalidad de la parte correspondiente.

#### Vista específica de cuotas

Agregar una sección o tab contextual que solo aparezca si el espacio tiene gastos en cuotas.

Nombre tentativo:
- **Cuotas**
- **Planes**
- **Financiados**

Recomendación inicial: **Cuotas**.

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

#### Integración con Balance

Balance debe separar:
- **Saldo actual**: deuda exigible por cuotas vigentes/vencidas.
- **Compromiso futuro**: cuotas futuras ya acordadas, pero todavía no exigibles.

Ejemplo:
```txt
Saldo actual
Roro debe $50.000

Compromiso futuro
Quedan 8 cuotas por $50.000
```

Los pagos recomendados deberían priorizar deuda actual, no cuotas futuras.

#### Integración con Movimientos

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

#### Integración con Saldar deudas

Registrar pago debe permitir:
- saldar cuota actual;
- saldar varias cuotas;
- ingresar monto libre;
- pagar anticipadamente parte de cuotas futuras.

Si se paga más que la deuda actual, el excedente debe reducir compromiso futuro.

#### Integración Finp personal → Espacios

Si un usuario carga en Finp personal un gasto con tarjeta en cuotas, debe poder marcarlo como gasto del espacio.

Flujo futuro:
1. Usuario crea gasto con tarjeta en cuotas en Finp personal.
2. Elige “Compartir en espacio”.
3. Selecciona espacio.
4. Define split.
5. Define reconocimiento en el espacio:
   - por cuota mensual;
   - total ahora.
6. El movimiento del espacio queda vinculado a la transacción personal.

#### Integración Espacios → Finp personal

Si el usuario crea el gasto desde Espacios y elige “Pagado desde” una tarjeta/cuenta personal:
- Finp debe crear o vincular la transacción personal.
- Si es tarjeta en cuotas, debe reutilizar la lógica existente de cuotas de Finp.
- El espacio debe guardar el vínculo y su modo de reconocimiento.

#### Modelo conceptual futuro

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

#### Decisiones pendientes

1. Si el modo default para cuotas debe ser **Por cuota mensual**. Recomendación: sí.
2. Cómo tratar cuotas futuras al cerrar un espacio.
3. Si el pago anticipado debe marcar cuotas futuras como saldadas o solo reducir saldo futuro.
4. Cómo editar un plan de cuotas si ya hubo pagos registrados.
5. Cómo mostrar cuotas en espacios multi-moneda.

---

### Fase 7 — Invitaciones por link
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

### Fase 8 — Gastos compartidos simples
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

### Fase 9 — Reintegros
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

### Fase 10 — Integración avanzada Finp / Espacios
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
3. Fase 4 — categorías de espacio + comprobantes Blob + origen visible en Finp personal.
4. Fase 5 — detalle/edición de movimientos.
5. Fase 6 — cuotas en Espacios.
6. Fase 7 — invitaciones por link.
7. Fase 8 — gastos compartidos simples.
8. Fase 9 — reintegros.

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
17. Las cuotas en Espacios deben ser visibles y accionables, pero sin convertir Espacios en una proyección financiera completa.
18. Para gastos en cuotas, el espacio debe poder reconocer el gasto por cuota mensual o total ahora.
19. La deuda exigible por cuotas debe separarse del compromiso futuro.
20. Las cuotas de Espacios deben integrarse con las cuotas de Finp personal mediante vínculo, no duplicando lógica si ya existe una fuente personal.
21. Cuando un movimiento de Espacios impacta en Finp personal, debe poder asignarse una categoría personal separada de la categoría del espacio.
22. Las transacciones personales creadas desde Espacios deben mostrar claramente su origen y permitir volver al movimiento del espacio cuando corresponda.
23. Los movimientos de Espacios solo deben permitir monedas habilitadas en el espacio.
24. Si una moneda del espacio no es compatible con Finp personal, debe poder registrarse en el espacio, pero el impacto personal debe requerir conversión/cambio o quedar para una fase posterior.
25. Las URLs de espacios deberían evolucionar a slugs amigables para no exponer solo el ObjectId.

