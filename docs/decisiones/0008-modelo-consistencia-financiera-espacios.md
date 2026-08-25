# 0008 — Modelo y consistencia financiera de Espacios

> Estado: aceptada
> Fecha: 2026-08-24
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0008
> Responsables: prompter y equipo Finp
> Ámbito: arquitectura, datos, seguridad, experiencia y operaciones

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Modelo objetivo](#5-modelo-objetivo)
6. [Operaciones y consistencia](#6-operaciones-y-consistencia)
7. [Permisos y ciclo de vida](#7-permisos-y-ciclo-de-vida)
8. [Migración, despliegue y recuperación](#8-migración-despliegue-y-recuperación)
9. [Errores, observabilidad y rendimiento](#9-errores-observabilidad-y-rendimiento)
10. [Consecuencias](#10-consecuencias)
11. [Verificación](#11-verificación)
12. [Referencias](#12-referencias)

## 1. Contexto y problema

La decisión 0007 separa la autoridad de Espacios, Mi Finp y Deudas, pero no
define cómo llevar ese contrato al modelo y a las operaciones existentes.

La implementación actual presenta riesgos estructurales:

- `SpaceEntry` mezcla estado compartido con confirmación y vínculo personal;
- conserva un `linkedTransactionId` global aunque el impacto es privado por
  usuario;
- `SpaceEntryPersonalImpact.amount` puede representar parte propia, total o
  liquidación y sólo algunos caminos completan los montos real y operacional;
- crear una transacción personal y vincularla usa compensación posterior en vez
  de una única transacción de base;
- rutas HTTP coordinan modelos, dominio, actividad, deudas y notificaciones;
- varias sincronizaciones financieras usan `Promise.allSettled` o capturan el
  error después de confirmar el movimiento;
- una deuda derivada se recalcula desde un balance que ya incluye liquidaciones
  y también descuenta pagos previos de `remainingAmount`, con riesgo de aplicar
  dos veces el mismo pago;
- no existe una clave de idempotencia de intención para recuperar una respuesta
  perdida sin repetir la operación.

Corregir cada síntoma dentro de su endpoint conservaría fuentes paralelas y
fallos parciales. Hace falta una solución de dominio completa.

## 2. Restricciones

- El monolito modular y MongoDB son suficientes para esta etapa; no se introduce
  infraestructura distribuida sin evidencia de escala.
- Mi Finp conserva sus servicios, cuentas, reporting y reglas como autoridad.
- Espacios funciona sin que todos los participantes configuren Mi Finp.
- Una operación financiera no confirma parcialmente.
- Notificaciones son presentación; pendientes, movimientos, impactos y deudas
  son dominio.
- Fechas financieras representan un día civil, no un instante accidental.
- Moneda original, conversión y moneda de reporte conservan snapshot.
- Un reintento devuelve el resultado anterior o completa exactamente una vez.
- El despliegue debe leer datos legacy mientras se migra y permitir rollback de
  código sin perder historia.
- No se exponen cuentas, categorías, transacciones ni preferencias de otro
  participante.

## 3. Opciones consideradas

### Opción A — Reparar cada endpoint

Mantener la coordinación actual y agregar validaciones, `try/catch` e índices en
cada ruta. Es rápida, pero deja reglas duplicadas, compensaciones, estados
ambiguos y sincronizaciones best-effort. No permite demostrar atomicidad. Se
rechaza.

### Opción B — Eventos asíncronos y cola externa

Confirmar el movimiento y propagar deudas, impactos y avisos mediante una cola
durable. Escala bien y desacopla, pero exige infraestructura, reintentos,
operación y consistencia eventual que Finp todavía no necesita. Se rechaza para
la escala actual; adoptarla requerirá medición y una decisión nueva.

### Opción C — Servicios de aplicación y consistencia fuerte en MongoDB

Centralizar cada intención financiera en un servicio, calcular con utilidades
puras y confirmar las escrituras financieras relacionadas dentro de una sesión
MongoDB. Derivar presentación desde fuentes persistidas. Reutiliza la
arquitectura actual y ofrece atomicidad e idempotencia sin infraestructura
nueva. Se acepta.

## 4. Decisión

Se adopta la opción C.

La solución se compone de cinco piezas inseparables:

1. modelo discriminado con una fuente por estado y monto;
2. servicios de aplicación compartidos por Espacios y Deudas;
3. transacciones MongoDB e idempotencia por intención;
4. migración verificable y retiro explícito del legado;
5. contratos de UI, errores, observabilidad, rendimiento y pruebas de punta a
   punta.

Una ruta HTTP autentica, valida, invoca el servicio y traduce el resultado. No
calcula balances, crea efectos derivados ni decide permisos financieros.

## 5. Modelo objetivo

### Movimiento compartido

`SpaceEntry` describe sólo el hecho compartido:

- estado compartido `recorded` o `voided`;
- total, moneda original, cotización y monto de reporte como snapshot;
- día financiero, zona horaria usada, pagador y reparto;
- autoría, versiones, adjuntos y anulación.

El reparto histórico conserva participantes aunque después queden inactivos. La
actividad del participante restringe selección y permisos futuros, no elimina
su parte, deuda o identidad de movimientos ya registrados.

`pending_confirmation`, `confirmed`, `linked` y `rejected` dejan de ser estados
compartidos. `confirmationRequired`, `confirmedByUserId`,
`linkedTransactionId` y equivalentes se leen mediante compatibilidad durante la
migración y después se retiran. No conviven como segunda autoridad.

### Impacto personal

Existe un único `SpaceEntryPersonalImpact` por `userId + entryId`. Cambia de
estado, no crea documentos paralelos para `pending`, `linked` y `needs_review`.

Conserva explícitamente:

- tipo discriminado: gasto propio, adelanto, liquidación pagada o liquidación
  cobrada;
- `ownShareAmount`;
- `accountImpactAmount`;
- `operationalAmount`;
- moneda y snapshot del origen;
- transacción, cuenta y categoría privadas si corresponden;
- estado, decisión, revisión y resolución;
- clave de idempotencia y versión del contrato.

Para un gasto:

| Caso | Cuenta | Reporting | Acción personal |
|---|---:|---:|---|
| Pagó el total y su parte es el total | total | parte propia | Registrar gasto |
| Pagó más que su parte | total | parte propia | Registrar gasto y adelanto recuperable |
| Pagó y su parte es cero | total | cero | Registrar adelanto; no presentarlo como gasto |
| No pagó y su parte es positiva | cero | parte propia | Registrar gasto sin inventar salida de cuenta |
| No pagó y su parte es cero | cero | cero | No crear acción financiera |

La transacción personal reutiliza `Transaction`:

- pagador: `amount` representa la salida real, cuenta origen presente y
  `operationalAmount` representa la parte propia, incluso cuando es cero;
- no pagador: `amount` y `operationalAmount` representan la parte propia y no
  existe cuenta origen ni destino;
- liquidación: usa los tipos no operacionales de pago o cobro de deuda y la
  cuenta real correspondiente;
- `spaceId` y `spaceEntryId` conservan procedencia exacta.

El servicio común de transacciones admite la variante sin cuenta sólo mediante
un contrato interno discriminado de Espacios. El formulario general no puede
crear gastos sin cuenta por omitir un campo.

`Agregar a Mi Finp` crea una transacción nueva. Vincular una existente queda
como operación avanzada de reconciliación: exige propiedad, moneda, fecha,
dirección, montos y procedencia compatibles y muestra un preview antes de
confirmar.

### Deuda derivada

Para `sourceType = space`, el balance vigente del Espacio después de
liquidaciones es la autoridad del saldo pendiente.

- `Debt.remainingAmount` materializa exactamente ese saldo;
- una liquidación ya incluida en el balance no vuelve a descontarse por
  `DebtMovement`;
- `DebtMovement` conserva historia y referencia al `SpaceEntry` de liquidación;
- la clave única incluye usuario, Espacio, contraparte, moneda de reporte y modo
  de deuda cuando afecte identidad;
- relaciones con saldo cero no aparecen como activas;
- una parte propia cero puede producir una deuda a favor si esa persona pagó por
  otras; no produce deuda sólo por tener parte cero.

### Fechas y monedas

El día financiero se persiste como `YYYY-MM-DD` junto con una zona horaria IANA
del Espacio. El `Date` legacy se mantiene sólo durante compatibilidad. La
conversión hacia una transacción personal usa una utilidad compartida y nunca
`toISOString()` como regla de formulario.

Cada movimiento conserva monto y moneda originales, moneda de reporte,
cotización y monto convertido. Una liquidación en otra moneda habilitada exige
cotización explícita y conserva el mismo snapshot; el movimiento de cuenta usa
la moneda real y el balance compartido usa el monto de reporte.

## 6. Operaciones y consistencia

Los casos de uso se concentran en servicios de aplicación:

- registrar movimiento compartido;
- editar o anular movimiento;
- registrar, vincular, revisar o quitar impacto personal;
- liquidar obligación de Espacio;
- cerrar, pausar, reabrir o archivar Espacio;
- administrar participantes y roles.

Espacios y Deudas invocan el mismo servicio de liquidación. No existen versiones
paralelas por endpoint.

Dentro de una sesión MongoDB se confirman, según la intención:

- movimiento o versión compartida;
- actividad financiera auditable;
- balances y deudas materiales afectadas;
- movimiento de deuda;
- transacción e impacto privado del actor;
- pendientes privados derivados.

Las notificaciones se generan de forma idempotente desde pendientes ya
persistidos. Su fallo no altera dinero ni oculta el pendiente en la superficie
canónica; queda observable y puede reconciliarse sin repetir la operación.

Cada mutación recibe una clave de idempotencia opaca, acotada por usuario,
Espacio y tipo de operación. Un índice único impide duplicados concurrentes. La
respuesta persistida permite distinguir operación nueva, reintento exitoso y
conflicto de payload.

Edición, anulación, cambio de modo de deuda y cambio de roles usan versión
esperada u otro control de concurrencia optimista. Si el origen cambió desde que
se abrió el formulario, el servicio devuelve conflicto y obliga a revisar; no
aplica el último envío por encima del anterior.

Los settlements confirmados son historia inmutable. Editar o anular un gasto
anterior muestra el balance resultante, conserva esas liquidaciones y puede
producir saldo inverso si hubo un sobrepago. El cambio reconcilia pendientes y
lleva impactos vinculados a revisión dentro de la misma operación.

Cambiar entre deuda directa y simplificada recalcula las proyecciones en una
sola transacción, cierra claves que dejan de representar una relación activa y
conserva movimientos y referencias históricas.

No se usa `Promise.allSettled`, un `catch` silencioso ni compensación manual para
escrituras financieras que forman una sola intención.

## 7. Permisos y ciclo de vida

Una matriz de capacidades de servidor es la única fuente para autorización y
para las acciones que la API expone a la interfaz.

- participante activo: crea gastos y registra liquidaciones en las que es parte;
- creador: edita o anula su movimiento dentro de las reglas históricas;
- `admin` y `owner`: administran movimientos, configuración compartida,
  categorías e invitaciones con actividad visible;
- sólo `owner`: transfiere propiedad, archiva o ejecuta acciones irreversibles;
- cualquier usuario: administra únicamente su configuración e impacto privados;
- nunca se elimina o desactiva al último `owner` sin transferencia atómica.

Ciclo de vida:

- `active`: admite operaciones autorizadas;
- `paused`: congela escrituras compartidas hasta reanudar; permite resolver
  impactos privados y revisiones;
- `closed`: impide gastos y ediciones nuevas, pero permite liquidar balances
  existentes y resolver impactos privados; puede reabrirse;
- `archived`: sólo lectura hasta restauración autorizada.

Registrar en nombre de otra persona se presenta como acción excepcional,
requiere capacidad explícita y deja actor y parte representada en actividad. No
se infiere permiso por ocultar o mostrar un botón.

## 8. Migración, despliegue y recuperación

La migración tiene fases compatibles:

1. inventario `dry-run` de estados legacy, vínculos globales, impactos
   duplicados, montos cero, transacciones huérfanas, deudas inconsistentes y
   fechas sin zona;
2. ampliación de schema e índices sin retirar lecturas antiguas;
3. backfill idempotente con conteos, anomalías y archivo de reparación;
4. lectura nueva con adaptador legacy y escritura exclusiva del modelo nuevo;
5. comparación de balances, cuentas, reporting y deudas antes y después;
6. retiro de campos, estados, rutas y fallbacks legacy sólo después de una
   ventana verificada.

Todo script exige ambiente, base explícita, `dry-run`, `--apply`, backup,
conteos por usuario/Espacio y salida sin contenido financiero sensible. El
rollback de código sigue leyendo el formato anterior durante la ventana; una
migración destructiva no se aplica hasta comprobar restauración.

## 9. Errores, observabilidad y rendimiento

Los servicios retornan errores tipados para validación, permiso, conflicto,
idempotencia, estado del Espacio, moneda, fecha, incompatibilidad histórica y
fallo interno. La UI informa si la operación no comenzó, se revirtió o quedó
confirmada y sólo falló una actualización de presentación.

Sin registrar montos, descripciones ni datos privados, se miden:

- resultado y latencia por tipo de operación;
- hits y conflictos de idempotencia;
- abortos de transacción;
- pendientes sin notificación derivada;
- registros legacy o anomalías restantes;
- cantidad de entradas y participantes procesados por recálculo.

Antes y después se mide consulta, payload, tiempo de servicio y render con
fixtures pequeños y grandes. Se agregan índices a partir de consultas reales y
no se carga historia ilimitada en el cliente. Si la consistencia sincrónica no
cumple la línea base acordada, se presenta la alternativa incremental y la
asíncrona con costo operativo antes de cambiar esta decisión.

## 10. Consecuencias

### Positivas

- una sola autoridad para estado, parte propia, saldo y liquidación;
- escrituras financieras atómicas y recuperables;
- rutas pequeñas y servicios reutilizables;
- Mi Finp refleja dinero real y gasto propio sin duplicarlos;
- Deudas y Espacios no pueden aplicar dos veces una liquidación;
- migración y retiro legacy forman parte de la solución;
- UI y servidor comparten capacidades sin duplicar permisos.

### Negativas o costos

- requiere migración de modelos y contratos, no sólo cambios de UI;
- obliga a refactorizar rutas y pruebas existentes;
- la ventana de compatibilidad duplica temporalmente lecturas;
- las transacciones de varios modelos necesitan medir tiempo y tamaño;
- el soporte de día financiero y zona horaria modifica formularios y fixtures.

## 11. Verificación

La decisión se considera aplicada sólo cuando:

- no existen estados personales activos en `SpaceEntry` ni vínculos globales
  usados como autoridad;
- la matriz pagador/no pagador/parte cero produce cuenta, reporting y deuda
  exactos;
- un reintento concurrente y uno posterior a perder la respuesta no duplican;
- dos ediciones concurrentes producen un conflicto revisable y nunca una
  sobrescritura silenciosa;
- un fallo inyectado en cada escritura revierte la unidad financiera completa;
- liquidar desde Espacios y Deudas produce las mismas entidades y saldos;
- edición, anulación, pausa, cierre, reapertura, roles y último `owner` respetan
  la matriz de capacidades;
- participantes inactivos conservan identidad, reparto y deuda históricos sin
  aparecer como opción nueva;
- el `dry-run`, backfill, comparación y rollback se ensayan sobre una copia de
  prueba con datos legacy representativos;
- unit, integración, API, componentes y E2E mobile/desktop cubren casos felices,
  bordes, permisos, privacidad, recuperación y accesibilidad;
- typecheck, lint, unit, build, documentación y suite E2E global permanecen
  verdes;
- no quedan rutas alternativas, `TODO`, fallbacks silenciosos ni compatibilidad
  sin fecha y criterio de retiro dentro del alcance.

## 12. Referencias

- [`0007 — Autoridad entre Espacios, Mi Finp y Deudas`](0007-autoridad-espacios-finp-deudas.md).
- [`espacios.md`](../producto/espacios.md), contrato funcional y de experiencia.
- [`arquitectura.md`](../tecnico/arquitectura.md), capas, consistencia y migraciones.
- [`guia_desarrollo.md`](../tecnico/guia_desarrollo.md), servicios, errores y
  patrones de implementación.
- [`plan_calidad_estabilizacion_finp.md`](../calidad/plan_calidad_estabilizacion_finp.md),
  matriz de riesgo y criterios de release.
