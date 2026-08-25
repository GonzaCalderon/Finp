# Estado actual de Finp

> Estado: vigente
> Audiencia: producto, desarrollo, calidad y agentes
> Última actualización: 2026-08-24
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

- base personal apta para preproducción controlada; Espacios requiere cerrar su
  exactitud P0 antes de considerarse listo para liberación;
- dominio personal amplio;
- Espacios y Deudas tienen capacidades operativas amplias, con inconsistencias
  de integración y experiencia verificadas;
- Captura rápida con aprendizaje y orientación;
- calidad automatizada sólida en lógica y servicios;
- entorno E2E local aislado y reproducible, con 64 de 64 escenarios globales
  aprobados en desktop y mobile tanto sobre producción como en desarrollo;
- smoke financiero con validación histórica y fixtures independientes del orden
  de ejecución;
- rotación de la credencial y activación E2E en CI diferidas hasta la preparación
  de la promoción a producción.

La especificación completa está en [`especificacion_funcional.md`](especificacion_funcional.md). Las prioridades viven sólo en [`roadmap_finp.md`](roadmap_finp.md).

## 2. Estado técnico

Checks base verificados localmente el 2026-08-24 sobre
`codex/spaces-financial-model-v2`, incluida la suite E2E global:

- Next.js 16.2.6, React 19.2.3 y TypeScript;
- MongoDB y Mongoose;
- autenticación con NextAuth;
- 99 rutas API;
- typecheck limpio;
- ESLint limpio;
- validación documental limpia;
- build de producción limpio, con 62 páginas generadas;
- 881 unit tests aprobados en 117 archivos, sin tests en `todo`;
- 10 recorridos de integración de Espacios v2 aprobados contra `finp-e2e` con
  sesiones MongoDB reales;
- 66 de 66 escenarios E2E globales aprobados en Chromium desktop y Pixel 7
  sobre el build de producción;
- 66 de 66 escenarios E2E globales aprobados nuevamente con `next dev`, sin 404
  ni altas fallidas después de una ejecución larga;
- preflight E2E sin conexión y seed repetible implementados; ambos rechazan
  bases sin marcador explícito o iguales a desarrollo;
- `.env.test.local` selecciona la base Atlas exclusiva `finp-e2e`, mientras
  desarrollo conserva `finm`;
- el seed recrea todas las cuentas del usuario general, restaura su cuenta
  predeterminada y mantiene usuarios independientes para smoke financiero,
  Proyección e impactos personales de Espacios;
- CI activo para lint, build y unit tests;
- job E2E activo; omite conexiones hasta recibir `MONGODB_URI_TEST` después de
  la rotación.
- auditoría legacy de Espacios disponible como lectura snapshot estrictamente
  read-only para E2E y development, con confirmación de base, códigos estables,
  reportes locales sanitizados y rechazo de producción;

Ramas:

- `main`: producción;
- `dev`: desarrollo;
- `dev` coincide con `origin/dev` en `9b5252f`;
- `codex/spaces-financial-model-v2`: modelo y recorridos financieros v2 de
  Espacios;
- `origin/main` es ancestro de `origin/dev` y está un commit detrás;
- la rama local `main` está desactualizada y no se usa para trabajo hasta
  actualizarla de forma autorizada.

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
- proyección de compras `1/1`, consumos históricos sin plan y cuotas múltiples,
  sin doble conteo y con ARS/USD separados;
- clasificación compartida con Tarjetas y Dashboard: `1/1` es un pago y sólo
  los planes mayores a una cuota se presentan como cuotas;
- vista inicial por tipo y próximos seis períodos, con Año calendario como modo
  secundario;
- agrupación por tipo, tarjeta o categoría sobre la misma lista canónica;
- resumen y gráfico apilado por Compromisos, `TC · un pago` y `TC · cuotas`;
- certeza visible, estimaciones advertidas y montos pendientes sin `$0`;
- cuenta habitual o vencimiento como contexto y enlaces filtrados sin montos;
- preferencias por usuario para agrupación, modo, horizonte y moneda del
  gráfico, con fallback local e hidratación estable;
- ocultamiento global de montos, error recuperable, reintento, cancelación de
  respuestas obsoletas e invalidación desde datos dependientes;
- componentes compartidos mobile/desktop, expansión accesible y soporte de
  dark mode y movimiento reducido;
- actualización opcional de períodos futuros sin reescribir historia;
- backfill idempotente con modo `dry-run`, aplicado y verificado sobre `finm` el
  2026-07-28.

### No disponible todavía

- compromisos compartidos en Espacios;
- ajustes porcentuales;
- índices oficiales;
- scheduler para `auto_month_start`;
- notificaciones push o recordatorios fuera de la aplicación;
- centro de análisis histórico por categoría, cuenta, tarjeta y método de pago;
- objetivos y límites por categoría;
- escenarios avanzados de proyección;
- cashflow proyectado por cuenta;
- compromisos compartidos, parte propia, adelantos y recuperables dentro de
  Proyección.

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
- baja individual de transacciones personales huérfanas mediante identidad
  exacta y privada, con respuesta idempotente;
- prevención de nuevos huérfanos: ids poblados normalizados y compensación de
  la transacción recién creada si falla el alta del impacto;
- revisión cuando cambia el origen;
- reconciliación de pendientes al cambiar el reparto: se actualizan, cancelan o
  crean según quién deba decidir con el reparto nuevo;
- contrato público v2 sin documentos Mongoose, lectura legacy normalizada y
  modo seguro de sólo lectura cuando no se puede demostrar un saldo;
- movimientos paginados por `dateKey + _id`, capacidades calculadas por servidor
  y mutaciones con idempotencia y revisión esperada;
- gasto v2 en tres pasos con revisión de total, parte propia, cuenta, gasto
  operacional, adelanto y deuda antes de confirmar;
- liquidación propia o representada compartida por Espacios y Deudas, con
  decisión personal separada para cada contraparte;
- configuración v2 con moneda de reporte inmutable desde el primer movimiento,
  preservación de monedas usadas y continuidad histórica de participantes;
- dinero v2 exacto en unidades menores y registro ISO activo con escalas 0, 2
  y 3;
- gastos, partes y equivalencias históricas con snapshot inmutable, más
  revaluación separada de posiciones abiertas;
- referencias DolarAPI/Frankfurter en lote, reemplazo manual y recuperación
  segura ante cambio, vencimiento o proveedor caído;
- balances y deudas independientes por moneda, con liquidaciones atómicas de
  varios componentes y tramos;
- tira de cotizaciones, composición `Incluye…` y filtros combinables por moneda
  original, pagada o de deuda.

### Brechas verificadas

La auditoría funcional y de interfaz confirmó que la amplitud disponible no
equivale todavía a un recorrido confiable de punta a punta:

- el estado compartido y la decisión privada pueden presentarse como si una
  persona tuviera que confirmar el movimiento para los demás;
- `Agregar a Mi Finp` no guía siempre hacia la parte propia exacta ni distingue
  al no pagador con parte cero del pagador que realizó un adelanto;
- la carga y edición del impacto personal pueden mostrar o permitir un monto que
  no representa con claridad gasto propio, salida real y adelanto;
- pendientes, notificaciones y deudas se superponen en algunos recorridos y
  pueden producir relaciones sin saldo útil;
- el cierre del Espacio, los roles y la protección del último `owner` no están
  aplicados de forma uniforme entre interfaz y servidor;
- las fechas editables pueden desplazarse por conversión UTC;
- mobile y desktop divergen en navegación, densidad y ubicación de acciones;
- faltan estados de recuperación, foco y accesibilidad consistentes en flujos
  principales y secundarios.

La caracterización de datos ejecutada el 2026-08-24 confirmó además:

- E2E: 2 Espacios y 18 hallazgos — 6 críticos, 4 altos, 6 medios y 2
  informativos;
- development: 11 Espacios y 337 hallazgos — 20 críticos, 77 altos, 149 medios
  y 91 informativos;
- los grupos críticos y altos incluyen huérfanos, deriva entre balance y deuda,
  liquidaciones aplicadas dos veces, impactos privados duplicados o incompletos,
  vínculos personales globales y pendientes faltantes;
- las decisiones 0007 y 0008 siguen vigentes: el resultado habilita la etapa de
  modelo compatible, pero bloquea cualquier migración automática o cutover.

La base compatible v2 completada el 2026-08-24 incorpora:

- modelo explícito de parte propia, impacto real y operacional, snapshots de
  origen, día financiero, revisión y procedencia;
- cálculo cent-based de repartos, moneda, balances y deuda directa o simplificada;
- permisos y transiciones centralizados, protección del último `owner` y control
  de concurrencia optimista;
- servicios transaccionales e idempotentes para movimientos, historia, impacto
  privado, liquidaciones, deudas y administración;
- reconciliación de notificaciones posterior al commit, sin repetir la unidad
  financiera;
- 10 índices compatibles aplicados sólo en E2E y una prueba de integración real
  de rollback, concurrencia, replay, historia y ambas superficies de liquidación.

Las etapas 2 y 3 ya están conectadas a las rutas e interfaz existentes, y el
checkpoint multimoneda amplía ese mismo contrato sin crear rutas paralelas. La
activación de escrituras permanece limitada a fixtures v2 en `finp-e2e`. No
hubo backfill, cutover ni escritura en development o producción; por eso no se
levanta el `NO-GO` de migración.

Los detalles con identificadores permanecen locales en
`test-results/audits/spaces/` y no se versionan.

La fuente del comportamiento esperado es [`espacios.md`](espacios.md). La
corrección y el rediseño están registrados una sola vez como FINP-P0-006 y
FINP-P1-013 en [`roadmap_finp.md`](roadmap_finp.md).

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
- seed repetible que repara los usuarios general, financiero y de Proyección,
  categorías, cuentas y datasets representativos;
- suite global aprobada contra `finp-e2e` en Chromium desktop y Pixel 7 tanto
  sobre el build de producción como con `next dev`, sin escrituras en desarrollo;
- regresión E2E para el Sankey con capas dispersas y la descripción accesible de
  Captura rápida, sin recuperar desde excepciones ni advertencias de Radix;
- CI para verificaciones principales y job E2E listo para ejecutarse apenas
  reciba la credencial rotada;
- build de producción reproducible.
- auditoría legacy de Espacios cubierta con detectores puros, barreras de
  entorno, adaptador Mongo sin primitivas de escritura y prueba E2E contra el
  seed aislado;
- modelo financiero v2 de Espacios cubierto dentro de 881 unitarias globales y
  10 recorridos de integración sobre transacciones MongoDB reales;

### Brechas

- primera ejecución remota de E2E bloqueada por la rotación de credenciales;
- cobertura de integración/API desigual;
- validación visual y accesibilidad no sistematizadas;
- cobertura no bloquea CI;
- falta extender las métricas de rendimiento a los demás dominios y establecer
  un presupuesto global de bundle.

## 11. Limitaciones conocidas

- Los grupos históricos de pagos duales se reparan sólo con
  `npm run repair:payment-groups`; el comando es `dry-run` por defecto y no debe
  aplicarse sin identificar la base y revisar el resultado.
- `auto_month_start` no tiene scheduler.
- La orientación aún no cubre reglas, Deudas, Espacios e Importación.
- Los recorridos v2 de Espacios cumplen el contrato de parte propia, autonomía,
  consistencia y permisos definido en las decisiones
  [`0007`](../decisiones/0007-autoridad-espacios-finp-deudas.md) y
  [`0008`](../decisiones/0008-modelo-consistencia-financiera-espacios.md), y la
  autoridad multimoneda definida en
  [`0009`](../decisiones/0009-autoridad-multimoneda-espacios.md), pero
  su activación sigue limitada a `finp-e2e`: los datos legacy no se migran ni
  se habilitan para escritura v2 hasta aprobar backfill y cutover.
- La auditoría de Espacios mantiene un `NO-GO` explícito para backfill y cutover
  hasta clasificar o resolver los 20 hallazgos críticos y 77 altos de
  development.
- La clasificación de tarjetas es determinista; no aprende todavía qué tarjeta
  elegir.
- Proyección no calcula cashflow por cuenta ni escenarios y todavía no incluye
  compromisos compartidos, parte propia, adelantos o recuperables.
- No existe una superficie dedicada para análisis histórico, patrones,
  anomalías, objetivos y límites por categoría.
- No hay realtime ni offline.

Cada limitación priorizada tiene un único registro en el roadmap.

## 12. Último bloque entregado

Soporte multimoneda integral sobre contratos y recorridos financieros de
Espacios v2, 2026-08-24:

- contratos y cálculos puros nuevos con adaptación de lectura legacy;
- servicios de aplicación atómicos, idempotentes y con control de concurrencia;
- una sola autoridad de deuda derivada y liquidación compartida por Espacios y
  Deudas;
- dinero exacto, registro ISO y snapshots históricos o manuales sin usar punto
  flotante como autoridad;
- referencias DolarAPI/Frankfurter cacheadas y solicitadas en lote, con
  conflicto recuperable por cambio o vencimiento;
- saldo de deuda por moneda y liquidación atómica con varios componentes y
  tramos, sin neteo silencioso;
- composición de totales, tira de referencias y filtros multimoneda en mobile y
  desktop;
- 10 índices parciales reaplicados idempotentemente sobre `finp-e2e`, con
  development limitado a `dry-run`;
- 881 unitarias globales, 10 recorridos de integración v2 y 66 E2E globales en
  desarrollo y producción aprobados;
- lectura de 1.000 movimientos medida en 45.987 bytes y 859 ms para una página
  de 50 elementos;
- etapas 2 y 3 y checkpoint multimoneda implementados; backfill, comparación
  legacy, rollback de migración y cutover continúan pendientes, por lo que el P0
  permanece `en curso`.
