# Roadmap y backlog único de Finp

> Estado: vigente
> Audiencia: producto, desarrollo, calidad y agentes
> Última actualización: 2026-07-31
> Fuente de verdad: prioridades, pendientes y criterios de cierre

## Índice

1. [Reglas del backlog](#1-reglas-del-backlog)
2. [Dirección de desarrollo](#2-dirección-de-desarrollo)
3. [Prioridad P0 — confianza financiera y cierre operativo](#3-prioridad-p0-confianza-financiera-y-cierre-operativo)
4. [Prioridad P1 — deuda técnica y UX bloqueante](#4-prioridad-p1-deuda-técnica-y-ux-bloqueante)
5. [Prioridad P2 — recurrencia, proyección y análisis](#5-prioridad-p2-recurrencia-proyección-y-análisis)
6. [Prioridad P3 — colaboración](#6-prioridad-p3-colaboración)
7. [Prioridad P4 — plataforma, orientación diferida y escalabilidad](#7-prioridad-p4-plataforma-orientación-diferida-y-escalabilidad)
8. [Discovery futuro](#8-discovery-futuro)
9. [Prácticas de calidad permanentes](#9-prácticas-de-calidad-permanentes)
10. [Cerrado recientemente](#10-cerrado-recientemente)
11. [Cómo actualizar este archivo](#11-cómo-actualizar-este-archivo)

## 1. Reglas del backlog

Este es el único backlog de Finp.

Estados:

- `pendiente`: aceptado, sin iniciar;
- `en discovery`: necesita decisión;
- `en curso`: existe trabajo activo;
- `bloqueado`: requiere condición externa;
- `validación`: implementado, falta evidencia final;
- `cerrado`: criterio cumplido.

Prioridades:

- `P0`: exactitud, pérdida de datos, seguridad o bloqueo de liberación;
- `P1`: flujo importante roto o deuda cercana a código crítico;
- `P2`: siguiente evolución de producto;
- `P3`: expansión posterior;
- `P4`: plataforma o largo plazo.

Un ítem `validación` o `pendiente` que no puede avanzar declara `Bloqueado por:` y
el ID que lo condiciona. Sin esa línea, el tope de la lista promete trabajo que no
se puede tomar.

Por omisión un ítem lo ejecuta un agente sin intervención; la ausencia de
`Requiere:` significa "tomable ahora". Sólo se declara la excepción:

- `Requiere: decisión del prompter`: hay alternativas que el agente no elige;
- `Requiere: entorno o datos reales`: necesita secretos, base aislada, backup o
  producción. `en discovery` ya implica decisión pendiente y no lo repite.

Un documento de dominio puede describir una posibilidad, pero sólo este archivo decide prioridad.

## 2. Dirección de desarrollo

Orden:

1. cerrar exactitud y verificación;
2. eliminar deuda técnica inmediata del último bloque;
3. resolver UX mobile bloqueante;
4. aprender recurrencia sin crear automatismos;
5. profundizar Proyección y explicar el impacto financiero futuro;
6. profundizar colaboración;
7. retomar la orientación por dominio después de Proyección;
8. estudiar mobile/offline cuando el producto web esté estable.

Los principios de producto y de trabajo viven en
[`../../AGENTS.md`](../../AGENTS.md) §4 y §6. Acá sólo rigen los de priorización:

- no iniciar una expansión grande con P0 abiertos evitables;
- una prioridad nueva no desplaza P0/P1 sin una decisión explícita.

## 3. Prioridad P0 — confianza financiera y cierre operativo

### FINP-P0-004 — Activar E2E crítico en CI

- Estado: `bloqueado`.
- Bloqueado por: FINP-P1-011.
- Requiere: entorno o datos reales.
- Disponible: workflow activo con preflight, seed, build, Playwright
  mobile/desktop, secretos de aplicación efímeros y artefactos ante fallos. Sin
  `MONGODB_URI_TEST` informa el bloqueo y no conecta.
- Pendiente externo: rotar la credencial, limitarla a `finp-e2e`, cargar la URI
  nueva en GitHub y obtener la primera ejecución verde.
- Criterio: flujos críticos ejecutan en CI con secretos y base aislada; reportes se conservan ante fallos.

## 4. Prioridad P1 — deuda técnica y UX bloqueante

### FINP-P1-011 — Rotar credenciales remotas expuestas

- Estado: `pendiente`.
- Prioridad operativa: no bloquea desarrollo local ni documentación.
- Alcance: rotar la credencial del usuario de MongoDB, revocar la anterior y
  actualizar los entornos locales autorizados y `MONGODB_URI_TEST` en GitHub.
- Restricción: la credencial actual no se copia a CI ni a otros servicios; la
  rotación debe completarse antes de configurar los secretos de FINP-P0-004.
- Criterio: credencial anterior inválida, aplicación conectando con la nueva y
  ausencia de secretos en logs, commits y artefactos.


## 5. Prioridad P2 — recurrencia, proyección y análisis

### FINP-P2-001 — Candidatos mensuales explicables

- Estado: `cerrado`.
- Alcance: detectar recurrencia desde historial vigente.
- Criterio:
  - evidencia por cantidad, período y variación;
  - criterio híbrido: estabilidad, cobertura y afinidad por categoría;
  - confianza mínima de 0,82;
  - monto fijo o variable sugerido;
  - sin creación automática;
  - descartes persistentes;
  - coordinación entre Captura rápida y Compromisos.
- Evidencia: motor puro y umbrales de la decisión 0002, endpoint autenticado sin
  cache, carga diferida en Captura rápida, `subjectKey` y descarte compartidos,
  borrador guiado y recorrido E2E aislado en ambas superficies, desktop y mobile.

### FINP-P2-002 — Captura rápida con tarjeta y orientación a cuotas

- Estado: `cerrado`.
- Dependencias: contrato de borradores vigente. La cascada de `InstallmentPlan`
  ya está cerrada.
- Alcance:
  - reconocer un consumo con tarjeta desde texto explícito y contexto;
  - completar directamente un consumo en un pago cuando tarjeta, monto,
    moneda, fecha y categoría sean válidos;
  - trasladar un consumo en varias cuotas al flujo especializado con los datos
    interpretados y su procedencia;
  - distinguir consumo, cuota y pago del resumen.
- Criterio: reglas y validaciones compartidas con Tarjetas, selección clara de
  tarjeta, impacto anticipado, aprendizaje prudente, mobile/desktop, errores,
  deshacer y finalización medidos.
- Evidencia: detector determinista, selector ante ambigüedad, preview de compra
  en un pago, handoffs tipados para cuotas y pagos, revisión sin duplicar planes,
  procedencia `quick_capture`, rollback y E2E aislado desktop/mobile.

### FINP-P2-011 — Proyección avanzada

- Estado: `pendiente`.
- Prioridad operativa: siguiente bloque.
- Alcance inicial: auditar y cerrar la inclusión de compras con tarjeta en un
  pago y consumos históricos sin plan, sin omisiones ni doble conteo, con ARS y
  USD separados.
- Alcance completo: la lectura por tipo, tarjeta y categoría descripta en
  [`especificacion_funcional.md`](especificacion_funcional.md) §14, más certeza de
  monto, parte propia, salida de cuenta y escenarios.
- Criterio: la vista predeterminada y la personalización se definen después de
  asegurar la exactitud; cambiar de vista no cambia reglas, totales ni inclusión
  de datos.
- Relación: comparte agregaciones y navegación con FINP-P2-008/009/010, pero
  Proyección conserva foco futuro y no absorbe toda la administración histórica.

### FINP-P2-007 — Bandeja diaria de revisión

- Estado: `en discovery`.
- Alcance: borradores, imports, movimientos incompletos y sugerencias de confianza media.
- Restricción: complemento opcional; no bloquea el registro ni adelanta los
  destinos de orientación diferidos a P4.

### FINP-P2-008 — Centro de análisis por categorías

- Estado: `en discovery`.
- Alcance: análisis histórico por categoría según
  [`especificacion_funcional.md`](especificacion_funcional.md) §14.
- Dependencias: calidad de ingreso, normalización y procedencia.
- Criterio a definir: período, monedas, conversiones, datos incompletos,
  categorías modificadas, rendimiento de agregaciones y experiencia
  mobile-first.

### FINP-P2-009 — Patrones y gastos atípicos

- Estado: `en discovery`.
- Alcance: patrones por categoría, comercio, cuenta, tarjeta y método de pago.
- Criterio a definir: relevancia por historial, estacionalidad, ingreso, límite
  e impacto en proyección; explicar la comparación y permitir marcar un gasto
  como extraordinario.

### FINP-P2-010 — Objetivos y límites por categoría

- Estado: `en discovery`.
- Alcance: objetivo o límite por período, avance, desvío, alertas y efecto
  esperado sobre la planificación.
- Restricción: un límite informa y orienta; no bloquea ni reclasifica
  transacciones automáticamente.
- Criterio a definir: arrastre entre períodos, multi-moneda, edición histórica,
  categorías sin datos y relación con ingresos y Proyección.

## 6. Prioridad P3 — colaboración

### FINP-P3-001 — Compromisos en Espacios

- Estado: `pendiente`.
- Dependencias: compromisos variables e impacto personal.
- Criterio: plantilla compartida, reparto, aplicación idempotente, un movimiento del Espacio e impacto privado por participante.

### FINP-P3-002 — Ajustes porcentuales pautados

- Estado: `pendiente`.
- Criterio: fecha efectiva, base, porcentaje, redondeo, preview y no reescritura histórica.

### FINP-P3-003 — Índices oficiales

- Estado: `en discovery`.
- Criterio: fuentes, rezagos, snapshot, trazabilidad y fallback manual.

### FINP-P3-005 — Parte propia igual a cero

- Estado: `pendiente`.
- Criterio: el detalle muestra explícitamente `Tu parte: $0`.

### FINP-P3-006 — Apuntar préstamo desde Deudas

- Estado: `pendiente`.
- Criterio: cuenta, fecha, moneda y contraparte precargadas sin duplicar obligación.

### FINP-P3-007 — Cuotas en Espacios

- Estado: `en discovery`.
- Criterio previo: definir reconocimiento, balances, settlements e impacto personal.

### FINP-P3-008 — Reintegros avanzados

- Estado: `pendiente`.
- Criterio: diferenciar devolución, adelanto y gasto sin distorsionar balances.

### FINP-P3-009 — Realtime

- Estado: `pendiente`.
- Restricción: no reemplazar idempotencia, invalidación ni recuperación.
- Decisión: evaluar costo operativo antes de adoptar infraestructura.

### FINP-P3-010 — Slugs y claridad de acceso a Espacios

- Estado: `pendiente`.
- Criterio: URLs legibles sin comprometer autorización ni estabilidad de enlaces.

## 7. Prioridad P4 — plataforma, orientación diferida y escalabilidad

### FINP-P4-001 — Limpieza de compatibilidad legacy

- Estado: `pendiente`.
- Alcance: `linkedTransactionId`, `status: linked`, adjuntos y migraciones históricas.
- Criterio: métricas de uso, migración idempotente y eliminación segura.

### FINP-P4-002 — Scheduler de compromisos

- Estado: `en discovery`.
- Alcance: ejecutar `auto_month_start`.
- Requiere: idempotencia, zona horaria, retries, observabilidad y costo.
- Restricción vigente: la UI no ofrece automatización y toda alta es manual.

### FINP-P4-003 — PWA básica

- Estado: `en discovery`.
- Alcance posible: instalación y cache de shell.
- Restricción: no prometer operación financiera offline sin cola y resolución de conflictos.

### FINP-P4-004 — Offline y local-first

- Estado: `en discovery`.
- Requiere: modelo de sincronización, conflictos, cifrado local, borrado, multi-dispositivo y costo.

### FINP-P4-005 — Rendimiento y presupuestos

- Estado: `pendiente`.
- Alcance: bundle, consultas, polling, render y almacenamiento.
- Criterio: métricas base y umbrales antes de optimizaciones mayores.

Los siguientes destinos de Orientación se difirieron desde P2 el 2026-07-31
para priorizar Proyección. Siguen aceptados y no fueron descartados.

### FINP-P4-006 — Orientación a reglas

- Estado: `pendiente`.
- Criterio: propuesta precompleta una regla simulable; no activa automatización sin confirmar.

### FINP-P4-007 — Orientación a Deudas

- Estado: `pendiente`.
- Criterio: distinguir préstamo, pago/cobro y transacción independiente sin duplicar deuda.

### FINP-P4-008 — Orientación a Espacios

- Estado: `pendiente`.
- Criterio: elegir contexto, participantes y reparto en el módulo responsable; no exponer información privada.

### FINP-P4-009 — Orientación a Importación

- Estado: `pendiente`.
- Criterio: conservar intención y llevar al flujo de archivo/revisión sin prometer una importación desde texto.

## 8. Discovery futuro

### Aplicación Android/iOS

- Estado: `en discovery`.
- Momento: después de estabilizar web y definir requisitos offline/notificaciones/dispositivo.
- Alternativas a estudiar: PWA, wrapper, framework multiplataforma o desarrollo nativo.
- Decisión requerida: ADR con experiencia, reutilización, rendimiento, costo y mantenimiento.
- La web se mantiene como producto principal.

### Integraciones bancarias y billeteras

- Estado: `en discovery`.
- Objetivo: reducir ingreso manual.
- Riesgos: cobertura argentina, seguridad, consentimiento, costo, estabilidad y normalización.

### Integración profunda tarjetas + Deudas

- Estado: `pendiente`.
- Objetivo: relacionar obligación, resumen y pago sin duplicar contabilidad.

## 9. Prácticas de calidad permanentes

Esto **no es backlog**: son prácticas que toda entrega debe considerar y que por
definición nunca se cierran. Cuando una se prioriza como trabajo concreto, deja de
vivir acá y se convierte en un ítem con ID, criterio y estado.

- aumentar integration/API tests;
- formalizar smoke visual mobile/desktop;
- incorporar accesibilidad básica;
- definir cobertura objetivo sin usarla como única medida;
- revisar seguridad con OWASP;
- evaluar dependencias con mantenimiento, licencia, bundle y vulnerabilidades;
- proteger `main` y `dev` con checks;
- medir rendimiento antes de adoptar procesos costosos.

Ya priorizadas como ítem: activar E2E es FINP-P0-004. Ya resueltas: la validación
documental corre con `npm run docs:check`.

## 10. Cerrado recientemente

### 2026-07-28

- FINP-P0-001: un usuario independiente y un seed determinista cubren dos
  períodos, saldo acumulado y negativo, ARS/USD, una compra en tres cuotas y
  préstamos pagados parcial y totalmente. Dashboard, Transacciones, Cuentas y
  Deudas coinciden; las capturas mobile/desktop quedan adjuntas a Playwright y la
  suite completa pasa 44 de 44 escenarios;
- FINP-P0-002: después de verificar fuera de Git un respaldo lógico completo de
  `finm`, el backfill actualizó un compromiso y no necesitó modificar aplicaciones
  ni transacciones; el dry-run posterior quedó en cero cambios. Se conserva
  documentada y sin tocar una aplicación cuya transacción ya había sido eliminada;
- FINP-P0-003: Atlas usa la base exclusiva `finp-e2e`, distinta de `finm`; el
  preflight confirma nombre y destino antes de conectar, el seed crea o repara el
  usuario, 20 categorías, Efectivo y Tarjeta E2E sin duplicarlos en una segunda
  ejecución, y los 44 escenarios Playwright pasan en Chromium desktop y Pixel 7;
- las pruebas E2E se alinearon con el formulario vigente y con el contrato privado
  de borradores; además, una compra en cuotas ahora invalida Transacciones y
  aparece en la lista sin recargar;
- una redirección HTML al login ya no puede interpretarse como respuesta JSON:
  se informa sesión expirada sin romper el dashboard.

### 2026-07-26

- FINP-P1-004: un pago dual se elimina con alcance explícito: una sola parte o
  el grupo ARS + USD. El borrado parcial normaliza grupos huérfanos y existe un
  reparador idempotente en modo `dry-run`;
- FINP-P1-005: Deudas usa detalle inferior en mobile, lateral en desktop,
  navegación de regreso entre relación y deuda, y formularios de pago, cobro y
  alta con encabezado y acciones siempre accesibles;
- FINP-P1-006: Dashboard y Tarjetas comparten un resumen bimonetario por período
  con total, pagado, pendiente, crédito y estado por tarjeta, sin sumar ARS y USD;
- FINP-P1-007: movimientos de Espacios permiten registrar y quitar el impacto
  privado desde mobile. Quitar elimina la transacción personal vinculada y no
  modifica el movimiento compartido;
- FINP-P1-008: editar el reparto de un movimiento reconcilia los pendientes. A
  quien le cambió el monto se le actualiza el pendiente y se refresca su aviso;
  quien salió del split lo ve cancelado y su notificación resuelta; quien entró
  recibe uno nuevo. La regla de quién debe decidir se comparte entre el alta y la
  edición. Los `linked` siguen yendo a revisión, que es otro camino;
- FINP-P1-009: swipe cubierto en ambos sentidos, con umbral por distancia y por
  velocidad; leer, archivar, restaurar y descartar no escriben `actionStatus`, así
  que ninguno resuelve por accidente la acción pendiente;
- FINP-P1-003: `getNavInsightsForUser` queda cubierto en período, aislamiento y
  señales. El aislamiento se verifica sobre las catorce consultas del servicio y
  el conteo falla si se agrega una sin dueño declarado;
- FINP-P1-002: Compromisos emite `intent_completed` al crear la plantilla desde
  un borrador derivado; el `eventId` deriva del borrador, así la derivación queda
  registrada una sola vez y aceptar el CTA sigue siendo un estado distinto;
- FINP-P1-001: eliminar la compra originaria da de baja su `InstallmentPlan`, el
  plan sólo cae si ninguna otra compra lo referencia, borrar el plan pasa por el
  teardown compartido y la confirmación anticipa la baja de las cuotas;
- ramas `main` y `dev` sincronizadas en `1c3ee40` después de la promoción, sin
  diferencias de árbol ni reescritura de historia;
- prueba de privacidad de borradores de Captura rápida convertida en
  determinista y CI nuevamente verde.

### 2026-07-25

Promoción `1c3ee40`: Compromisos mobile-first en tres pasos, montos variables con
agenda y vigencias, candidatos mensuales con criterio híbrido, y Captura rápida
orientando hacia Compromisos. El detalle de lo entregado vive en
[`estado_actual_finp.md`](estado_actual_finp.md) §12.

Se conservan sólo los bloques que todavía explican por qué el trabajo actual está
donde está. Lo anterior al 2026-07-25 —motor de reglas, aprendizaje administrable,
saldo acumulado, exactitud de deuda y cuotas, compra/venta de USD— vive en Git y en
[`../archivados/`](../archivados/), que es donde hay que buscar historia.

## 11. Cómo actualizar este archivo

Al iniciar:

- cambiar estado a `en curso`;
- enlazar decisión o dependencia si aplica.

Al cerrar:

- verificar el criterio;
- actualizar estado actual y documentación de dominio;
- **barrer las referencias entrantes**: buscar el ID en el repositorio y corregir
  cada `Bloqueado por:`, `Desbloquea:` o `Dependencias:` que lo nombre, incluidas
  las de documentos técnicos. Un ítem cerrado que sigue figurando como bloqueante
  detiene trabajo que ya se puede tomar;
- mover un resumen a “Cerrado recientemente”;
- eliminar detalles que ya no ayuden a priorizar.

Al descubrir trabajo:

- comprobar que no exista;
- asignar ID y prioridad;
- explicar problema y criterio de cierre;
- declarar `Alcance:` cuando el borde no sea obvio; sin esa línea el ejecutor
  decide solo qué entra, y eso puede ser una decisión de producto;
- verificar que el criterio se pueda cumplir con lo que el repositorio ya puede
  correr, o incluir en el alcance construir esa capacidad;
- no crear otro backlog.

Una prioridad nueva que desplace P0/P1 requiere explicar el motivo.
