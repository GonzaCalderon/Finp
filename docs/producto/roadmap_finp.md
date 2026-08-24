# Roadmap y backlog único de Finp

> Estado: vigente
> Audiencia: producto, desarrollo, calidad y agentes
> Última actualización: 2026-08-24
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

1. conservar la suite E2E global local y la documentación como gates verdes;
2. corregir la exactitud de Espacios con Mi Finp y Deudas;
3. rediseñar y estabilizar los recorridos principales de Espacios, mobile primero;
4. antes de promover a producción, rotar la credencial remota y activar E2E en CI;
5. ampliar colaboración sólo después de cerrar la base de Espacios;
6. revisar el criterio de producto de Escenarios antes de retomar Proyección;
7. retomar la orientación por dominio después de esa revisión;
8. estudiar mobile/offline cuando el producto web esté estable.

Los principios de producto y de trabajo viven en
[`../../AGENTS.md`](../../AGENTS.md) §4 y §6. Acá sólo rigen los de priorización:

- no iniciar una expansión grande con P0 abiertos evitables;
- una prioridad nueva no desplaza P0/P1 sin una decisión explícita.

## 3. Prioridad P0 — confianza financiera y cierre operativo

### FINP-P0-006 — Exactitud financiera de Espacios, Mi Finp y Deudas

- Estado: `en curso`.
- Decisiones:
  - [`0007 — Autoridad entre Espacios, Mi Finp y Deudas`](../decisiones/0007-autoridad-espacios-finp-deudas.md);
  - [`0008 — Modelo y consistencia financiera de Espacios`](../decisiones/0008-modelo-consistencia-financiera-espacios.md).
- Regla de entrega: es un cierre indivisible. Puede avanzar mediante commits y
  verificaciones internas, pero no pasa a `validación` ni se presenta como
  terminado hasta completar dominio, datos, API, UI afectada, migración,
  recuperación, pruebas y documentación.
- Solución comprometida:
  - convertir `SpaceEntry` en estado exclusivamente compartido y retirar
    confirmación y vínculo personal globales;
  - mantener un único impacto por usuario y movimiento, con parte propia,
    impacto real, impacto operacional, tipo y estado explícitos;
  - reutilizar `Transaction`: el pagador registra salida real y parte propia; el
    no pagador registra gasto operacional sin inventar salida de cuenta;
  - distinguir al pagador con parte cero como adelanto recuperable y al no
    pagador con parte cero como ausencia de acción financiera;
  - hacer del balance del Espacio la autoridad de la deuda derivada y evitar que
    una liquidación se descuente otra vez mediante `DebtMovement`;
  - concentrar alta, edición, anulación, impacto personal y liquidación en
    servicios de aplicación compartidos; las rutas sólo autentican, validan e
    invocan;
  - confirmar en una sesión MongoDB el movimiento, actividad auditable, deudas,
    movimientos de deuda, impacto/transacción del actor y pendientes que forman
    la misma intención;
  - usar claves de idempotencia e índices únicos para reintentos simultáneos y
    posteriores a una respuesta perdida;
  - usar control de concurrencia optimista en edición, anulación, roles y modo
    de deuda para no sobrescribir una versión que el usuario no revisó;
  - derivar notificaciones desde pendientes persistidos, con reconciliación
    observable sin repetir la operación financiera;
  - centralizar permisos y capacidades para roles, último `owner`, pausa,
    cierre, liquidación, reapertura y archivo;
  - persistir día financiero y zona horaria sin corrimiento UTC, y conservar
    moneda original, cotización y monto de reporte como snapshot.
- Secuencia interna obligatoria:
  1. caracterización de comportamiento y datos legacy, más reporte `dry-run`
     — completada el 2026-08-24;
  2. modelo, cálculos puros, servicios e índices nuevos con lectura compatible;
  3. APIs y UI existentes migradas al contrato nuevo, sin rutas paralelas;
  4. backfill idempotente, comparación, cutover y retiro del legado;
  5. fallos inyectados, rendimiento, accesibilidad y regresión completa.
- Avance verificado de la etapa 1:
  - `npm run audit:spaces:legacy` ejecuta una lectura snapshot estrictamente
    read-only, con aislamiento E2E reutilizado y confirmación exacta para
    development;
  - E2E: 2 Espacios, 18 hallazgos — 6 críticos, 4 altos, 6 medios y 2
    informativos;
  - development: 11 Espacios, 337 hallazgos — 20 críticos, 77 altos, 149
    medios y 91 informativos;
  - los hallazgos confirman, sin contradecir, las decisiones 0007 y 0008:
    existen relaciones huérfanas, deriva de deuda, liquidaciones con riesgo de
    doble aplicación, semántica legacy de impacto personal, pendientes faltantes
    y autoridad privada alojada todavía en estado compartido;
  - decisión: `GO` para la etapa 2 de modelo, cálculos, servicios e índices;
    `NO-GO` para cualquier backfill, cutover o migración automática hasta
    resolver y ensayar los hallazgos críticos y altos;
  - los reportes detallados permanecen locales y excluidos de Git bajo
    `test-results/audits/spaces/`; sólo estos conteos sanitizados son canónicos.
- Avance verificado de la etapa 2 — completada el 2026-08-24:
  - contrato compatible v2 para Espacio, movimiento compartido, impacto privado,
    transacción personal, deuda, movimiento de deuda, actividad y operación;
  - cálculos puros cent-based para reparto, redondeo, conversión, día financiero,
    impacto personal y balances directos o simplificados;
  - matriz central de capacidades, adaptación legacy determinista y control de
    concurrencia optimista;
  - servicios de aplicación transaccionales para alta, edición, anulación,
    impacto personal, liquidación desde Espacios o Deudas, ciclo de vida, roles,
    ownership y modo de deuda;
  - `SpaceOperation` conserva la intención idempotente y sus referencias sin
    contenido financiero libre; las notificaciones se reconcilian después del
    commit desde pendientes persistidos;
  - 10 índices compatibles aplicados y reaplicados únicamente sobre `finp-e2e`;
    development fue validado sólo en `dry-run` y producción permanece rechazada;
  - 37 casos unitarios focales y 6 recorridos de integración con sesión MongoDB
    real cubren exactitud, rollback, retry simultáneo, conflictos, historia,
    liquidaciones, permisos e índices parciales;
  - límite deliberado: los servicios v2 todavía no están conectados a las rutas
    ni a la interfaz, y no hubo backfill, cutover ni escritura en development.
    La etapa siguiente es la 3; el ítem continúa `en curso` y el `NO-GO` de
    migración automática sigue vigente.
- Criterio financiero:
  - cuentas muestran dinero real;
  - Dashboard y reportes muestran gasto propio;
  - Espacios y Deudas muestran el mismo saldo derivado;
  - adelanto, parte propia y liquidación permanecen distinguibles;
  - editar o anular historia vinculada pide revisión y nunca reescribe en
    silencio.
- Criterio operativo:
  - cada error informa si no escribió, revirtió o sólo falló una presentación;
  - no hay `catch` silencioso, `Promise.allSettled` ni compensación manual en la
    unidad financiera;
  - scripts identifican ambiente, tienen `dry-run`/`--apply`, conteos,
    anomalías, backup y rollback ensayado;
  - se miden latencia, tamaño de consulta, payload e idempotencia sin registrar
    contenido financiero; no se agrega cola, cache o dependencia sin evidencia.
- Verificación:
  - unit para reparto, redondeo, moneda, fecha, saldo y transiciones;
  - integración con sesión real para atomicidad, retry, concurrencia, migración
    y aislamiento;
  - API para `401`, `403/404`, validación, mass assignment, roles, estado e
    idempotencia;
  - componentes para preview, errores, foco, estados y recuperación;
  - E2E mobile y desktop para pagador total, adelanto, pagador con parte cero,
    no pagador con parte positiva/cero, liquidación parcial/total desde ambas
    superficies, edición, anulación, roles, cierre y datos legacy;
  - comparación explícita entre Cuentas, Transacciones, Dashboard, Espacios y
    Deudas; suite global y `docs:check` verdes.
- No se cierra si queda un fallback legacy sin criterio de retiro, un camino que
  sólo funciona en una superficie, una escritura derivada best-effort, una
  deuda en cero activa, un monto ambiguo o una combinación de la matriz sin
  prueba proporcional.
- Absorbe: FINP-P3-005.

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

### FINP-P1-013 — Cierre integral de experiencia de Espacios

- Estado: `bloqueado`.
- Bloqueado por: FINP-P0-006.
- Regla de entrega: es un único cierre de producto. Los recorridos pueden
  implementarse por bloques seguros, pero el ítem permanece abierto hasta que
  la experiencia principal, secundaria y transversal sea coherente.
- Alcance integral:
  - portada, estados vacío/carga/error, búsqueda y cards con señal útil;
  - creación mínima e invitación omisible, sin configuración prematura;
  - navegación estable `Inicio`, `Movimientos`, `Balances` y `Configuración` en
    mobile y desktop;
  - gasto guiado en tres pasos con categoría, adjuntos y opciones avanzadas por
    complejidad progresiva;
  - detalle que prioriza total, pagador, parte propia, adelanto y efecto en Mi
    Finp antes de metadata y actividad;
  - balances y liquidación con una intención y una operación compartida con
    Deudas;
  - separación visual y semántica entre movimiento, pendiente, notificación,
    revisión y deuda;
  - participantes, roles, invitación directa/link, General, Mi Finp, pausa,
    cierre, reapertura y archivo;
  - continuidad entre Espacios, Transacciones, Deudas y campana sin perder
    filtros, posición, borradores ni regreso.
- Patrones obligatorios:
  - mobile-first con la misma lógica y capacidad en desktop;
  - una intención, una superficie responsable y una acción primaria clara;
  - resultado financiero antes que mecanismo;
  - componentes, selectores, dialogs/sheets, tokens y lenguaje compartidos;
  - dominio resuelto en servidor; la UI sólo presenta previews y capacidades;
  - encabezado y acciones fuera del scroll, CTA sobre `safe area` y opciones
    infrecuentes progresivas;
  - carga, vacío, error, éxito, reversión y recuperación en cada mutación;
  - teclado, foco, labels, contraste, zoom, movimiento reducido, texto largo,
    montos grandes, ARS/USD y áreas táctiles verificadas.
- Criterio de uso:
  - una persona puede crear un Espacio, sumar participantes, registrar un gasto,
    entender total/parte/adelanto, impactar Mi Finp, identificar una deuda y
    liquidarla sin conocer el modelo interno;
  - los recorridos críticos se validan en mobile y desktop sin ambigüedad
    de monto, rol, estado, consecuencia o siguiente acción;
  - configuración y casos infrecuentes no compiten con el uso cotidiano;
  - las acciones ofrecidas coinciden con las capacidades del servidor.
- Verificación: tests de componentes y accesibilidad, E2E de recorridos y
  recuperación, revisión visual light/dark y anchos intermedios, contenido
  representativo y evaluación guiada de las tareas críticas antes del cierre.
- No se cierra con pantallas duplicadas, lógica mobile distinta, acciones sólo
  por `hover`, errores sólo en toast, placeholders, `TODO`, copy temporal,
  caminos sin recuperación ni una superficie secundaria pendiente de alinear.
- Absorbe: FINP-P1-014 y FINP-P1-015.

### FINP-P1-011 — Rotar credenciales remotas expuestas

- Estado: `pendiente`.
- Momento acordado: antes de configurar E2E en CI o promover a producción; no
  bloquea la estabilización local ni la documentación.
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

### FINP-P2-011 — Cierre operativo de Proyección

- Estado: `cerrado`.
- Alcance: compromisos personales, compras `1/1`, consumos históricos sin plan
  y cuotas, con período, certeza, ARS/USD, contexto y navegación correctos.
- Criterio cumplido: agrupaciones por tipo, tarjeta y categoría usan una lista
  canónica; preferencias sólo personalizan presentación; pagos y transacciones
  padre no duplican gastos.
- Evidencia: contrato compartido, servicio aislado por usuario sin consulta por
  período, query estricta y privada, clasificación compartida con Tarjetas y
  Dashboard, componentes responsive, unit/API y cuatro E2E aislados en Chromium
  desktop y Pixel 7.
- Decisión: [`0006 — Período, clasificación y lectura de Proyección`](../decisiones/0006-periodo-clasificacion-y-lectura-de-proyeccion.md).

### FINP-P2-012 — Escenarios de Proyección

- Estado: `en discovery`.
- Prioridad operativa: diferido por decisión del prompter; no es el siguiente
  bloque después de la estabilización.
- Alcance: comparar una base con cambios hipotéticos sin alterar compromisos,
  planes ni transacciones persistidos.
- Criterio a definir: variables permitidas, monedas, vigencia, explicación,
  guardado, descarte y costo de cálculo.
- Antecedente: existe una implementación experimental no integrada en
  `origin/codex/p2-012-escenarios`; no se continúa, rebasa ni integra hasta
  revisar la experiencia y el criterio de producto.

### FINP-P2-013 — Cashflow proyectado por cuenta

- Estado: `en discovery`.
- Alcance: estimar entradas y salidas por cuenta sin confundir tarjeta con
  cuenta futura de pago.
- Criterio a definir: cuenta probable, transferencias, pagos de resumen,
  multi-moneda, saldos, incertidumbre y ausencia de cuenta.

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

- Estado: `bloqueado`.
- Bloqueado por: FINP-P1-013.
- Dependencia funcional: compromisos variables e impacto personal estabilizado.
- Criterio: plantilla compartida, reparto, aplicación idempotente, un movimiento del Espacio e impacto privado por participante.

### FINP-P3-002 — Ajustes porcentuales pautados

- Estado: `pendiente`.
- Criterio: fecha efectiva, base, porcentaje, redondeo, preview y no reescritura histórica.

### FINP-P3-003 — Índices oficiales

- Estado: `en discovery`.
- Criterio: fuentes, rezagos, snapshot, trazabilidad y fallback manual.

### FINP-P3-006 — Apuntar préstamo desde Deudas

- Estado: `pendiente`.
- Criterio: cuenta, fecha, moneda y contraparte precargadas sin duplicar obligación.

### FINP-P3-007 — Cuotas en Espacios

- Estado: `en discovery`.
- Dependencias: FINP-P0-006 y FINP-P1-013.
- Criterio previo: definir reconocimiento, balances, settlements e impacto personal.

### FINP-P3-008 — Reintegros avanzados

- Estado: `bloqueado`.
- Bloqueado por: FINP-P0-006.
- Criterio: diferenciar devolución, adelanto y gasto sin distorsionar balances.

### FINP-P3-009 — Realtime

- Estado: `pendiente`.
- Restricción: no reemplazar idempotencia, invalidación ni recuperación.
- Decisión: evaluar costo operativo antes de adoptar infraestructura.

### FINP-P3-010 — Slugs y claridad de acceso a Espacios

- Estado: `pendiente`.
- Criterio: URLs legibles sin comprometer autorización ni estabilidad de enlaces.

### FINP-P3-011 — Compromisos compartidos dentro de Proyección

- Estado: `bloqueado`.
- Bloqueado por: FINP-P3-001.
- Alcance: total compartido, parte propia, adelanto, recuperable y contexto
  privado por participante sin mezclar contabilidad personal y compartida.

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

Ya priorizada como ítem: activar E2E es FINP-P0-004. Ya resueltas: la validación
documental corre con `npm run docs:check` y FINP-P1-012 eliminó las advertencias
del Sankey y Captura rápida.

## 10. Cerrado recientemente

### 2026-08-17

- FINP-P0-005: el seed vuelve a crear todas las cuentas del usuario general de
  E2E, fija Efectivo con saldo suficiente y restaura su cuenta predeterminada;
  los escenarios dejan de depender de residuos o del orden de ejecución;
- preflight y seed repetible aprobaron contra la base exclusiva `finp-e2e`;
- la suite global pasó 60 de 60 en Chromium desktop y Pixel 7 tanto sobre el
  build de producción como con `next dev`, sin reproducir los 404 ni las altas
  fallidas de la línea base. Nivel de aprendizaje: `no aplica`.
- FINP-P1-012: el Sankey compacta las capas presentes antes de ejecutar
  `d3-sankey`, y Captura rápida deja que Radix vincule su descripción mediante
  los identificadores accesibles propios;
- una regresión E2E monta el gráfico sin primera capa y verifica la descripción
  del diálogo; la suite global pasó 60 de 60 con `next dev` sin los dos avisos
  de la línea base. Nivel de aprendizaje: `no aplica`.

### 2026-08-04

- Corrección de FINP-P1-007: `Quitar de mi Finp` transporta la transacción
  seleccionada, elimina impactos normales u huérfanos con alcance exacto y
  teardown transaccional, conserva el movimiento compartido y compensa el alta
  personal si falla después de crear la transacción. Nivel de aprendizaje:
  `no aplica`.

### 2026-07-31

- FINP-P2-011: Proyección integra compromisos, compras `1/1`, consumos
  históricos sin plan y cuotas sin doble conteo; separa ARS/USD y certeza,
  permite agrupar la misma lista por tipo, tarjeta o categoría, recuerda
  presentación por usuario y ofrece detalle navegable, privacidad y recuperación;
- la clasificación `1/1` se comparte con Tarjetas y Dashboard, y el período de
  cada representación queda registrado en la decisión 0006;
- cuatro recorridos E2E pasan contra `finp-e2e` en Chromium desktop y Pixel 7,
  incluidos persistencia, ocultamiento, dark mode y movimiento reducido;
- escenarios, cashflow por cuenta y Proyección de compromisos compartidos quedan
  separados como FINP-P2-012, FINP-P2-013 y FINP-P3-011.

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
