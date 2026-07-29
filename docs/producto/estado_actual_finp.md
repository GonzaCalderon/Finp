# Estado actual de Finp

> Estado: vigente
> Audiencia: producto, desarrollo, calidad y agentes
> Última actualización: 2026-07-28
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
- E2E local reproducible en una base aislada;
- smoke financiero real aprobado;
- falta rotar la credencial de pruebas para que el job E2E ya configurado pueda
  ejecutarse en CI.

La especificación completa está en [`especificacion_funcional.md`](especificacion_funcional.md). Las prioridades viven sólo en [`roadmap_finp.md`](roadmap_finp.md).

## 2. Estado técnico

Verificado localmente el 2026-07-28 sobre `dev` (`d8ae0e6`):

- Next.js 16.2.6, React 19.2.3 y TypeScript;
- MongoDB y Mongoose;
- autenticación con NextAuth;
- 98 rutas API;
- typecheck limpio;
- ESLint limpio;
- build de producción limpio, con 63 páginas generadas;
- 745 unit tests aprobados en 92 archivos, sin tests en `todo`;
- 52 de 52 escenarios E2E aprobados para desktop y mobile;
- preflight E2E sin conexión y seed repetible implementados; ambos rechazan
  bases sin marcador explícito o iguales a desarrollo;
- `.env.test.local` selecciona la base Atlas exclusiva `finp-e2e`, mientras
  desarrollo conserva `finm`;
- el seed se ejecutó dos veces: reparó los usuarios general y financiero, sus
  categorías, cuentas y datos representativos sin duplicados; el usuario general
  se restaura sin tocar el usuario independiente del smoke financiero;
- CI activo para lint, build y unit tests;
- job E2E activo; omite conexiones hasta recibir `MONGODB_URI_TEST` después de
  la rotación.

Ramas:

- `main`: producción;
- `dev`: desarrollo;
- `dev` coincide con `origin/dev` en `d8ae0e6`;
- `origin/main` es ancestro de `origin/dev` y está 17 commits detrás;
- la rama local `main` está 87 commits detrás de `origin/main` y no se usa para
  trabajo hasta actualizarla de forma autorizada.

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
- resumen de tarjeta por período y moneda con total, pagado, pendiente, crédito
  y estado `sin consumos`, `impaga`, `parcial`, `pagada` o `saldo a favor`;
- pagos de tarjeta duales vinculados como una misma intención, con borrado
  explícito de una parte o del grupo completo;
- importación Excel con revisión;
- fecha de inicio operativo;
- ocultamiento global de montos;
- preferencias persistidas.

### Exactitud financiera incorporada

- arrastre de saldos negativos entre períodos;
- pagos y cobros de deuda sin impacto operacional;
- corrección del doble descuento de compras en cuotas;
- baja del plan de cuotas junto con su compra originaria, sin cuotas
  proyectadas de una compra eliminada;
- patrimonio con tarjetas y deudas personales;
- consistencia de préstamos entre Dashboard y Transacciones;
- compra/venta de USD con cuentas, montos y cotización coherentes.

### Validación real

El smoke sobre `finp-e2e` compara Dashboard, Transacciones, Cuentas y Deudas para
el período actual y el anterior. Cubre saldo acumulado, saldo negativo, ARS/USD,
cuotas y pagos total y parcial de deuda, con capturas mobile y desktop adjuntas al
reporte de Playwright. El inicio de período personalizado mantiene cobertura
unitaria, pero no forma parte de este fixture remoto.

## 4. Captura, reglas y aprendizaje

### Captura rápida disponible

- acceso desde FAB y tecla `Q`;
- parser de gasto/ingreso, monto, moneda, fecha, descripción, cuenta, categoría y comercio;
- candidatos mensuales compartidos con Compromisos, cargados de forma diferida,
  con la misma evidencia, identidad y descarte;
- clasificación determinista de compra con tarjeta, compra en cuotas, pago de
  resumen y referencia a una cuota existente;
- compra en un pago confirmable con impacto y primer mes editable;
- selector compacto cuando la tarjeta es ambigua;
- handoff tipado de cuotas y pagos, sin perder borrador ni procedencia;
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
- preparación de un compromiso nuevo, incluido un candidato mensual aprendido;
- compra con tarjeta en un pago o en cuotas;
- pago de resumen;
- revisión de una cuota existente.

Puede aplicar el pendiente dentro del diálogo o abrir Compromisos y Tarjetas con
un borrador tipado, versionado y con procedencia. Una intención de tarjeta nunca
se ofrece como gasto simple.

El embudo cierra: aceptar el CTA y completar la función se registran como estados
distintos, y Compromisos anota la derivación completada una sola vez por borrador.

Los consumos en un pago se registran dentro del diálogo. Las cuotas y los pagos
se confirman en el flujo completo; la cuenta de origen de un pago siempre la
elige el usuario.

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
- backfill idempotente con modo `dry-run`, aplicado y verificado sobre `finm` el
  2026-07-28.

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
- alta y baja del impacto personal desde el movimiento del Espacio; quitarlo
  elimina la transacción personal vinculada sin alterar el origen compartido;
- revisión cuando cambia el origen;
- reconciliación de pendientes al cambiar el reparto: se actualizan, cancelan o
  crean según quién deba decidir con el reparto nuevo.

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
- operación atómica entre cuenta, deuda y movimiento;
- detalle inferior en mobile y lateral en desktop, con continuidad al volver a
  la relación;
- alta, pago y cobro responsive con encabezado y acciones fuera del scroll.

### Experiencia por cerrar

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

### Cobertura

No quedan unit tests en `todo`. Están cubiertos el swipe en ambos sentidos, que
leer, archivar, restaurar y descartar no resuelvan la acción pendiente, y la
reconciliación de pendientes cuando cambia el reparto de un movimiento.

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
- orquestación de NavInsights cubierta en período, aislamiento y señales;
- Playwright preparado para Chromium desktop y mobile;
- preflight E2E compartido por configuración, seed y Playwright;
- seed repetible que repara los usuarios general y financiero, categorías,
  cuentas y dataset representativo;
- suite completa aprobada contra `finp-e2e` sin escrituras en desarrollo;
- CI para verificaciones principales y job E2E listo para ejecutarse apenas
  reciba la credencial rotada;
- build de producción reproducible.

### Brechas

- primera ejecución remota de E2E bloqueada por la rotación de credenciales;
- cobertura de integración/API desigual;
- validación visual y accesibilidad no sistematizadas;
- cobertura no bloquea CI;
- faltan métricas de rendimiento y presupuesto de bundle.

## 11. Limitaciones conocidas

- Los grupos históricos de pagos duales se reparan sólo con
  `npm run repair:payment-groups`; el comando es `dry-run` por defecto y no debe
  aplicarse sin identificar la base y revisar el resultado.
- `auto_month_start` no tiene scheduler.
- La orientación aún no cubre reglas, Deudas, Espacios e Importación.
- La clasificación de tarjetas es determinista; no aprende todavía qué tarjeta
  elegir.
- La proyección omite consumos con tarjeta en un pago y no ofrece todavía el
  recorrido tarjeta → categoría → movimiento.
- No existe una superficie dedicada para análisis histórico, patrones,
  anomalías, objetivos y límites por categoría.
- No hay realtime ni offline.

Cada limitación priorizada tiene un único registro en el roadmap.

## 12. Último bloque entregado

Recurrencias aprendidas y tarjetas desde Captura rápida, 2026-07-28:

- candidatos mensuales visibles y descartables desde Captura rápida y
  Compromisos sin cambiar los umbrales vigentes;
- compras con tarjeta en un pago confirmables y reversibles dentro del diálogo;
- cuotas y pagos derivados con borradores tipados y datos preservados;
- referencias a cuotas existentes abiertas en revisión sin duplicar planes;
- clasificación, propiedad y moneda validadas con recorridos desktop y mobile;
- detección, aceptación y finalización registradas por separado sin persistir el
  texto financiero.
