# Notificaciones e insights en Finp

> Estado: vigente
> Audiencia: producto, diseño, desarrollo y agentes
> Última actualización: 2026-08-24
> Fuente de verdad: reglas funcionales de seguimiento

## Índice

1. [Alcance](#1-que-cubre-esta-capa)
2. [Centro de notificaciones](#2-notificationcenter)
3. [Pendientes](#3-pending-actions-vs-notifications)
4. [Review](#4-review-flows)
5. [Insights](#5-navinsight)
6. [Responsive](#6-mobile-y-desktop)
7. [Actualización](#7-polling-e-invalidacion)
8. [Semántica y decisiones](#8-prioridades-y-semantica)

Los pendientes de implementación viven únicamente en [`roadmap_finp.md`](roadmap_finp.md).

## 1. Que cubre esta capa

Finp ya tiene una capa de seguimiento transversal que combina:

- campana global;
- sheet de notificaciones;
- pendientes accionables;
- review flows;
- NavInsight en la navegacion.

Su funcion no es almacenar la verdad del dominio, sino hacer visible lo que el usuario deberia leer, revisar o resolver.

## 2. NotificationCenter

En terminos de producto, el NotificationCenter actual es:

- campana global con badge;
- acceso a sheet con tabs;
- acciones rapidas de lectura, archivo y descarte;
- resolucion automatica cuando la accion asociada ya fue procesada.

Tabs actuales:

- Todas;
- Pendientes;
- Espacios;
- Deudas;
- Archivadas.

Estados actuales de la notificacion:

- `unread`;
- `read`;
- `archived`;
- `dismissed`.

Estado de accion asociado:

- `none`;
- `pending`;
- `completed`;
- `ignored`;
- `cancelled`.

## 3. Pending actions vs notifications

Esta distincion tiene que quedar firme:

- notification != source of truth;
- pendingAction != linked;
- archived != resolved.

### Notification

Es la capa visible de seguimiento. Puede reabrirse, archivarse o descartarse sin cambiar por si sola el dominio.

### Pending action

Es el trabajo pendiente real del usuario, hoy centrado en
`SpaceEntryPersonalImpact` con estado `pending`. En Espacios existe cuando el
usuario tiene una parte propia positiva o un adelanto real todavía no resuelto.

No es una aprobación del movimiento compartido ni una deuda. Una parte propia
igual a cero sin pago no genera pendiente ni notificación accionable; si la
persona pagó por otras, la acción corresponde al adelanto, no a un gasto propio.

### Linked

Significa que el usuario ya impacto ese movimiento en su Finp.

Principio:

- un pendiente puede generar una notificacion;
- una notificacion archivada puede seguir apuntando a una accion no resuelta;
- resolver la accion puede cerrar o cancelar notificaciones relacionadas.
- cambiar un reparto puede actualizar o cancelar un pendiente que todavía no
  creó historia, pero nunca reescribir automáticamente un impacto `linked`.

## 4. Review flows

Los review flows cubren casos donde un movimiento compartido ya vinculado cambio materialmente o fue anulado.

Funcionamiento actual:

- el impacto personal pasa a `needs_review`;
- se genera una notificacion de review;
- el usuario decide que hacer con su transaccion personal;
- no hay reversa automatica obligatoria.

Motivos actuales:

- `entry_voided`;
- `entry_edited`.

Principio consolidado:

- el sistema alerta y preserva contexto;
- no corrige silenciosamente la contabilidad personal.

## 5. NavInsight

NavInsight es la capa de resumen corto en navegacion. Toma senales de varios modulos y prioriza lo importante.

Hoy puede resumir:

- movimientos que requieren review;
- pendientes de impacto personal;
- notificaciones pendientes o unread;
- deudas activas;
- actividad nueva en espacios;
- imports en borrador;
- compromisos proximos;
- insights de resumen;
- tendencia de tarjeta.

No reemplaza:

- la campana;
- la lista de pendientes;
- la vista detallada del modulo origen.

## 6. Mobile y desktop

### Mobile

- swipe derecho para archivar, o restaurar si ya estaba archivada;
- swipe izquierdo para descartar;
- el gesto se confirma por distancia o por velocidad, y arrastrar no abre la
  notificación al soltar;
- ninguno de los dos resuelve la acción pendiente: eso sólo lo hace atenderla;
- tabs con scroll horizontal;
- hint tactil en tabs activas.

### Desktop

- botones de accion al hover;
- interaccion mas densa en lista.

## 7. Polling e invalidacion

La app actual resuelve frescura con una combinacion de polling e invalidacion cliente.

Comportamiento actual:

- polling general de conteos cada 20 segundos si la pestana esta visible;
- polling del sheet abierto cada 15 segundos;
- refresh adicional en focus y `visibilitychange`;
- invalidacion por tags con `data-sync`.

Tags relevantes:

- `notifications`;
- `personal-pending-actions`;
- `spaces`;
- `debts`;
- `nav-insights`.

Esto confirma otra decision importante:

- hoy Finp no es realtime real;
- la consistencia se sostiene con refresco oportunista y eventos idempotentes.

## 8. Prioridades y semantica

Las prioridades actuales son:

- `low`;
- `normal`;
- `high`.

No definen por si solas resolucion automatica. Sirven para:

- ordenar lo visible;
- destacar casos urgentes;
- alimentar NavInsight y badges.

## 9. Decisiones consolidadas

- notification no es fuente de verdad;
- pending action no equivale a linked;
- pending action no equivale a aprobación compartida ni a deuda;
- una parte propia igual a cero sin pago no genera una acción pendiente;
- archived no equivale a resuelto;
- dismissed no debe seguir molestando, pero el dominio puede seguir existiendo;
- review no implica eliminacion automatica de la transaccion personal;
- notificaciones y pendientes deben ser idempotentes y deduplicados;
- la privacidad del usuario esta por encima de la conveniencia de mostrar demasiada informacion contextual.
