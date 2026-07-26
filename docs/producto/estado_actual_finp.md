# Estado actual de Finp

> Estado: vigente
> Audiencia: producto, desarrollo, calidad y agentes
> Última actualización: 2026-07-26
> Fuente de verdad: alcance implementado y verificado

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Estado técnico](#2-estado-técnico)
3. [Finanzas personales](#3-finanzas-personales)
4. [Captura, reglas y aprendizaje](#4-captura-reglas-y-aprendizaje)
5. [Compromisos y proyección](#5-compromisos-y-proyección)
6. [Espacios](#6-espacios)
7. [Deudas](#7-deudas)
8. [Notificaciones y pendientes](#8-notificaciones-y-pendientes)
9. [Experiencia y plataformas](#9-experiencia-y-plataformas)
10. [Calidad](#10-calidad)
11. [Limitaciones conocidas](#11-limitaciones-conocidas)
12. [Último bloque entregado](#12-último-bloque-entregado)

## 1. Resumen ejecutivo

Finp es una aplicación web funcional de finanzas personales y compartidas. Cubre registro, análisis, automatización, proyección, colaboración y seguimiento.

Estado general:

- base apta para preproducción controlada;
- dominio personal amplio;
- Espacios y Deudas operativos;
- Captura rápida con aprendizaje y orientación;
- calidad automatizada sólida en lógica y servicios;
- falta cerrar E2E, validación con datos reales y algunos flujos mobile antes de una liberación más amplia.

La especificación completa está en [`especificacion_funcional.md`](especificacion_funcional.md). Las prioridades viven sólo en [`roadmap_finp.md`](roadmap_finp.md).

## 2. Estado técnico

Verificado localmente el 2026-07-25 sobre `dev`:

- Next.js 16.2.6, React 19.2.3 y TypeScript;
- MongoDB y Mongoose;
- autenticación con NextAuth;
- 98 rutas API;
- typecheck limpio;
- ESLint limpio;
- build de producción limpio, con 63 páginas generadas;
- 621 unit tests aprobados en 74 archivos;
- 5 tests declarados como `todo`;
- 40 escenarios E2E registrados para desktop y mobile;
- `.env.test.local` existe y está excluido de Git; los E2E no se ejecutaron en
  esta revisión porque todavía falta validar el aislamiento del entorno y
  completar la ejecución reproducible de la suite;
- CI activo para lint, build y unit tests;
- job E2E preparado, pero desactivado.

Ramas:

- `main`: producción;
- `dev`: desarrollo;
- al momento de la revisión, `dev` coincide con su referencia local `origin/dev`.
- las referencias remotas disponibles muestran historia divergente: 13 commits exclusivos de `origin/main` y 12 de `origin/dev`;
- la mayoría de los commits exclusivos de `main` son merges de releases, pero `main` no es ancestro de `dev`;
- se debe ejecutar un fetch y auditar contenido antes de normalizar la historia.

## 3. Finanzas personales

### Disponible

- cuentas ARS, USD y multi-moneda;
- saldos iniciales e historial;
- categorías por defecto y personalizadas;
- transacciones de ingreso, gasto, tarjeta, transferencia, cambio, pago de tarjeta y ajuste;
- dashboard por período financiero configurable;
- saldo disponible acumulado separado del resultado del período;
- cashflow y visualizaciones;
- tarjetas y planes de cuotas;
- importación Excel con revisión;
- fecha de inicio operativo;
- ocultamiento global de montos;
- preferencias persistidas.

### Exactitud financiera incorporada

- arrastre de saldos negativos entre períodos;
- pagos y cobros de deuda sin impacto operacional;
- corrección del doble descuento de compras en cuotas;
- patrimonio con tarjetas y deudas personales;
- consistencia de préstamos entre Dashboard y Transacciones;
- compra/venta de USD con cuentas, montos y cotización coherentes.

### Validación pendiente

El código y los tests cubren las reglas principales, pero falta smoke con datos reales para:

- saldo acumulado e histórico;
- pago total y parcial de deuda;
- cuotas;
- períodos con inicio personalizado;
- ARS/USD;
- saldos negativos.

## 4. Captura, reglas y aprendizaje

### Captura rápida disponible

- acceso desde FAB y tecla `Q`;
- parser de gasto/ingreso, monto, moneda, fecha, descripción, cuenta, categoría y comercio;
- autocompletado y resumen vivo;
- preview sin escritura;
- impacto de saldo;
- validaciones compartidas con Transacciones;
- derivación al formulario completo;
- detección de duplicados;
- advertencias de fechas;
- deshacer durante ocho segundos.

### Reglas

- motor compartido por creación, importación, cuotas, compromisos e impactos personales autorizados;
- normalización;
- simulación sin escritura;
- detección de conflictos y prioridades;
- trazabilidad en la transacción;
- sugerencias revisables y descartables;
- reevaluación de traza al editar.

### Aprendizaje

- alias sincronizados;
- patrones de descripción, cuenta, categoría y comercio;
- precedencia conservadora;
- explicación y evidencia;
- aceptación, corrección, descarte, reversión y abandono;
- pausa, olvido, restauración, conversión a regla y reinicio;
- retención limitada de eventos;
- aislamiento por usuario.

### Orientación disponible

Captura rápida distingue:

- transacción independiente;
- aplicación de compromiso pendiente;
- preparación de un compromiso nuevo.

Puede aplicar el pendiente dentro del diálogo o abrir Compromisos con un borrador tipado, versionado y con procedencia.

Captura rápida todavía no interpreta ni registra consumos con tarjeta de
crédito. El formulario completo y el módulo de Tarjetas sí los admiten.

## 5. Compromisos y proyección

### Disponible

- compromisos recurrentes;
- aplicación a transacciones;
- monto fijo;
- monto variable a confirmar;
- agenda manual de montos con vigencia;
- monto vigente y fecha efectiva coherentes en Compromisos y Dashboard;
- alta y edición guiadas en tres pasos;
- progreso mobile compacto y tres pasos visibles en desktop;
- validación al escribir, retorno al primer paso inválido y errores de servidor
  asociados al campo correspondiente;
- selector de categorías compartido con Nueva transacción, con búsqueda, chips
  y ranking por historial;
- selector táctil 1–31 y vista previa exacta de vencimiento y recordatorio;
- agenda de montos separada e historial rápido colapsable;
- cambio de monto desde ahora, próximo vencimiento o fecha elegida;
- historia monetaria vigente y pasada inmutable;
- fecha de aplicación visible;
- recordatorios in-app relativos al vencimiento;
- estados `upcoming`, `active`, `ending_soon`, `expired` e `inactive`;
- finalizados y desactivados conservados en una sección colapsada;
- candidatos mensuales con criterio híbrido, confianza mínima, afinidad por
  categoría y descarte persistente;
- snapshot por aplicación;
- estados derivados;
- procedencia visible;
- proyección con monto correcto por período;
- proyección de cuotas múltiples agrupada por tarjeta y detallada por consumo;
- actualización opcional de períodos futuros sin reescribir historia;
- backfill idempotente con modo `dry-run`.

### No disponible todavía

- compromisos compartidos en Espacios;
- ajustes porcentuales;
- índices oficiales;
- scheduler para `auto_month_start`;
- notificaciones push o recordatorios fuera de la aplicación;
- consumos con tarjeta en un pago dentro de Proyección;
- separación visible entre `TC · un pago` y `TC · cuotas`;
- agrupación de Proyección por categoría con porcentaje y detalle;
- vistas de Proyección personalizables;
- centro de análisis histórico por categoría, cuenta, tarjeta y método de pago;
- objetivos y límites por categoría;
- escenarios avanzados de proyección.

## 6. Espacios

### Disponible

- listado, creación y detalle responsive;
- tipos principales y configuraciones;
- participantes y roles;
- movimientos compartidos;
- split igual, único, porcentual y por montos;
- balances directos o simplificados;
- settlements y pagos recomendados;
- categorías internas;
- actividad;
- imágenes y PDF persistentes;
- edición y anulación lógica;
- invitaciones por link con expiración y revocación;
- onboarding `space-first`;
- configuración General y Mi Finp;
- impacto personal privado;
- categoría automática, fija o mapeada;
- revisión cuando cambia el origen.

### No disponible todavía

- cuotas dentro de Espacios;
- compromisos de Espacios;
- reintegros avanzados;
- realtime;
- sincronización automática completa de todas las ediciones/anulaciones con transacciones personales;
- eliminación definitiva de compatibilidad legacy.

## 7. Deudas

### Disponible

- posición neta;
- “Debo” y “Me deben”;
- deudas manuales y derivadas de Espacios;
- pagos y cobros;
- estados activos, parciales, pagados e ignorados;
- ignorar y restaurar;
- consolidación por relación;
- timeline;
- sincronización idempotente desde Espacios;
- operación atómica entre cuenta, deuda y movimiento.

### Experiencia por cerrar

- detalle y resolución de pendientes en mobile;
- integración más profunda con tarjetas;
- registrar un préstamo en Finp desde Deudas.

## 8. Notificaciones y pendientes

### Disponible

- campana global y badges;
- filtros por tipo y estado;
- leído, archivado y descartado;
- estado de acción separado;
- pendientes de impacto personal;
- revisión de movimientos editados o anulados;
- actividad de Espacios y novedades de Deudas;
- imports, compromisos e insights;
- swipe mobile;
- deduplicación y resolución de estados obsoletos;
- polling, foco y visibilidad.

### Cobertura pendiente

Cinco unit tests permanecen como `todo`:

- archivar/restaurar por swipe;
- descartar por swipe sin resolver la acción;
- cambios de monto en pendientes de Espacios;
- usuario removido de un split;
- usuario agregado a un split.

## 9. Experiencia y plataformas

### Disponible

- sidebar desktop;
- bottom navigation mobile;
- sheets y dialogs responsive;
- light y dark mode;
- safe areas;
- recorridos táctiles;
- ocultamiento de montos.

### No disponible

- PWA operativa;
- service worker;
- cache offline;
- base local;
- aplicación Android o iOS;
- sincronización local-first.

Mobile web sigue siendo la superficie prioritaria.

## 10. Calidad

### Fortalezas

- cobertura unitaria amplia de dominio;
- servicios compartidos para reglas financieras;
- tests de privacidad, aislamiento e idempotencia;
- Playwright preparado para Chromium desktop y mobile;
- CI para verificaciones principales;
- build de producción reproducible.

### Brechas

- E2E fuera del CI;
- `.env.test.local` y la guía local existen; falta validar base aislada, seed
  idempotente y ejecución completa reproducible;
- cobertura de integración/API desigual;
- validación visual y accesibilidad no sistematizadas;
- cobertura no bloquea CI;
- faltan métricas de rendimiento y presupuesto de bundle.

## 11. Limitaciones conocidas

- `InstallmentPlan` no se limpia al eliminar la transacción que lo originó.
- El hermano de un pago dual con `paymentGroupId` se reporta, pero no se elimina por inferencia.
- `intent_completed` no se emite al crear un compromiso desde un borrador.
- `getNavInsightsForUser` no tiene test de integración.
- `auto_month_start` no tiene scheduler.
- La detección híbrida de candidatos a compromiso está implementada, incluye el
  caso de control Pizza y sigue pendiente de validación E2E con datos reales
  representativos.
- La orientación aún no cubre reglas, cuotas, Deudas, Espacios e Importación.
- Captura rápida no cubre todavía consumos con tarjeta de crédito.
- La proyección omite consumos con tarjeta en un pago y no ofrece todavía el
  recorrido tarjeta → categoría → movimiento.
- No existe una superficie dedicada para análisis histórico, patrones,
  anomalías, objetivos y límites por categoría.
- No hay realtime ni offline.

Cada limitación priorizada tiene un único registro en el roadmap.

## 12. Último bloque entregado

Promoción `1c3ee40`, 2026-07-25:

- cierre mobile-first del alta y edición de Compromisos;
- recordatorios y fechas mensuales desde una fuente única;
- monto vigente, vigencias futuras e historial inmutable;
- sugerencias recurrentes con criterio híbrido y descarte persistente;
- integración entre Captura rápida y Compromisos;
- documentación funcional, técnica, de diseño y decisiones actualizada.

Documentación técnica: [`../tecnico/compromisos_variables_y_orientacion.md`](../tecnico/compromisos_variables_y_orientacion.md).
