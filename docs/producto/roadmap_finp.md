# Roadmap y backlog único de Finp

> Estado: vigente
> Audiencia: producto, desarrollo, calidad y agentes
> Última actualización: 2026-07-25
> Fuente de verdad: prioridades, pendientes y criterios de cierre

## Índice

1. [Reglas del backlog](#1-reglas-del-backlog)
2. [Dirección de desarrollo](#2-dirección-de-desarrollo)
3. [Prioridad P0 — confianza financiera y cierre operativo](#3-prioridad-p0-confianza-financiera-y-cierre-operativo)
4. [Prioridad P1 — deuda técnica y UX bloqueante](#4-prioridad-p1-deuda-técnica-y-ux-bloqueante)
5. [Prioridad P2 — recurrencia y orientación](#5-prioridad-p2-recurrencia-y-orientación)
6. [Prioridad P3 — colaboración y proyección](#6-prioridad-p3-colaboración-y-proyección)
7. [Prioridad P4 — plataforma y escalabilidad](#7-prioridad-p4-plataforma-y-escalabilidad)
8. [Discovery futuro](#8-discovery-futuro)
9. [Deuda de calidad transversal](#9-deuda-de-calidad-transversal)
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

Un documento de dominio puede describir una posibilidad, pero sólo este archivo decide prioridad.

## 2. Dirección de desarrollo

Orden:

1. cerrar exactitud y verificación;
2. eliminar deuda técnica inmediata del último bloque;
3. resolver UX mobile bloqueante;
4. aprender recurrencia sin crear automatismos;
5. ampliar orientación un destino por vez;
6. profundizar colaboración y proyección;
7. estudiar mobile/offline cuando el producto web esté estable.

Principios:

- bloques verticales y verificables;
- mobile primero;
- una fuente de verdad por regla;
- automatización explicable y reversible;
- no aumentar costo operativo sin presentar alternativas;
- no iniciar una expansión grande con P0 abiertos evitables.

## 3. Prioridad P0 — confianza financiera y cierre operativo

### FINP-P0-001 — Smoke financiero con datos reales

- Estado: `validación`.
- Alcance: saldo acumulado, saldos negativos, histórico, ARS/USD, préstamos, pago parcial/total de deuda y cuotas.
- Criterio: Dashboard, Transacciones, Cuentas y Deudas coinciden para períodos actuales e históricos.
- Evidencia: casos documentados, capturas mobile/desktop y ausencia de escrituras fuera de la base de prueba.

### FINP-P0-002 — Ejecutar y validar backfill de compromisos

- Estado: `pendiente`.
- Alcance: ejecutar `npm run backfill:commitments` en `dry-run`, revisar anomalías y aplicar sólo con aprobación.
- Criterio: datos existentes tienen política, agenda, estado, snapshot y procedencia; las anomalías quedan resueltas o documentadas.
- Riesgo: modifica datos; requiere backup y ambiente identificado.

### FINP-P0-003 — Entorno y suite E2E reproducibles

- Estado: `pendiente`.
- Alcance: crear guía y `.env.test.local` fuera de Git, sembrar base aislada y ejecutar los 40 escenarios.
- Criterio: E2E mobile y desktop reproducibles sin tocar desarrollo ni producción.

### FINP-P0-004 — Activar E2E crítico en CI

- Estado: `pendiente`.
- Dependencia: FINP-P0-003.
- Criterio: flujos críticos ejecutan en CI con secretos y base aislada; reportes se conservan ante fallos.

## 4. Prioridad P1 — deuda técnica y UX bloqueante

### FINP-P1-001 — Cascada de `InstallmentPlan`

- Estado: `pendiente`.
- Problema: eliminar una transacción originaria no limpia el plan.
- Criterio: eliminación y reversión conservan saldos, cuotas y trazabilidad; cubierto por unit/integration.

### FINP-P1-002 — Cierre de métricas de orientación

- Estado: `pendiente`.
- Problema: falta `intent_completed` cuando se crea un compromiso desde borrador.
- Criterio: aceptar y completar siguen siendo estados distintos y la derivación completada queda registrada una sola vez.

### FINP-P1-003 — Integración de NavInsights

- Estado: `pendiente`.
- Criterio: `getNavInsightsForUser` tiene cobertura de período, aislamiento y señales.

### FINP-P1-004 — Política para pagos duales

- Estado: `en discovery`.
- Problema: al eliminar una parte, el hermano con `paymentGroupId` sólo se reporta.
- Decisión requerida: conservar, ofrecer eliminar, o tratar el grupo como unidad.
- Criterio: decisión registrada y comportamiento cubierto sin inferencia riesgosa.

### FINP-P1-005 — Deudas mobile

- Estado: `pendiente`.
- Criterio: abrir detalle, comprender origen y resolver pendientes sin paneles inaccesibles ni saltos.

### FINP-P1-006 — Estado de tarjetas

- Estado: `pendiente`.
- Criterio: cada tarjeta muestra período, total, pendiente y estado pagada/parcial/impaga; pagos parciales no aparecen como totales.

### FINP-P1-007 — Registrar o quitar de Mi Finp

- Estado: `pendiente`.
- Criterio: CTA claro, impacto previo, monedas y formato correctos, acción de quitar visible en mobile.

### FINP-P1-008 — Pendientes de cambios en splits

- Estado: `pendiente`.
- Alcance: completar los tres unit tests `todo` sobre cambio de monto, usuario removido y usuario agregado.
- Criterio: pendientes y notificaciones se crean, actualizan o cancelan con regla explícita.

### FINP-P1-009 — Swipe de notificaciones

- Estado: `pendiente`.
- Alcance: completar dos unit tests `todo`.
- Criterio: archivar/restaurar y descartar no resuelven por accidente una acción pendiente.

### FINP-P1-010 — Normalizar historia de `main` y `dev`

- Estado: `validación`.
- Hallazgo: las referencias locales de `origin/main...origin/dev` muestran 13 commits exclusivos de `main` y 12 de `dev`.
- Contexto: los commits exclusivos de `main` son principalmente merges de releases, pero rompen la relación de ancestro esperada.
- Próximo análisis: fetch, comparación de árboles y revisión de PR pendientes.
- Criterio: `origin/main` es ancestro de `origin/dev`, o ambas ramas quedan iguales después de una promoción; ningún cambio productivo queda ausente en `dev`.
- Restricción: no reescribir historia ni resolver con reset destructivo.

## 5. Prioridad P2 — recurrencia y orientación

### FINP-P2-001 — Candidatos mensuales explicables

- Estado: `validación`.
- Alcance: detectar recurrencia desde historial vigente.
- Criterio:
  - evidencia por cantidad, período y variación;
  - criterio híbrido: estabilidad, cobertura y afinidad por categoría;
  - confianza mínima de 0,82;
  - monto fijo o variable sugerido;
  - sin creación automática;
  - descartes persistentes;
  - coordinación entre Captura rápida y Compromisos.
- Evidencia: motor puro, endpoint autenticado sin cache, borrador guiado,
  descarte persistente y pruebas unitarias/API. Falta smoke E2E con base aislada.

### FINP-P2-002 — Orientación a cuotas

- Estado: `pendiente`.
- Dependencias: FINP-P1-001 y contrato de borradores vigente.
- Criterio: interpretación, traslado, validación final, mobile/desktop, error y finalización medidos.

### FINP-P2-003 — Orientación a reglas

- Estado: `pendiente`.
- Criterio: propuesta precompleta una regla simulable; no activa automatización sin confirmar.

### FINP-P2-004 — Orientación a Deudas

- Estado: `pendiente`.
- Criterio: distinguir préstamo, pago/cobro y transacción independiente sin duplicar deuda.

### FINP-P2-005 — Orientación a Espacios

- Estado: `pendiente`.
- Criterio: elegir contexto, participantes y reparto en el módulo responsable; no exponer información privada.

### FINP-P2-006 — Orientación a Importación

- Estado: `pendiente`.
- Criterio: conservar intención y llevar al flujo de archivo/revisión sin prometer una importación desde texto.

### FINP-P2-007 — Bandeja diaria de revisión

- Estado: `en discovery`.
- Alcance: borradores, imports, movimientos incompletos y sugerencias de confianza media.
- Restricción: complemento opcional; no bloquea el registro.

### FINP-P2-008 — Categorías accionables

- Estado: `en discovery`.
- Alcance: evolución, comercios, recurrentes, gastos grandes, proyección y límites.
- Dependencias: calidad de ingreso, normalización y procedencia.

### FINP-P2-009 — Gastos grandes y atípicos

- Estado: `en discovery`.
- Criterio a definir: relevancia por historial, ingreso, límite e impacto en proyección; permitir marcar extraordinarios.

## 6. Prioridad P3 — colaboración y proyección

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

### FINP-P3-004 — Proyección avanzada

- Estado: `pendiente`.
- Alcance:
  - cuotas vs. consumos de un pago;
  - certeza de monto;
  - parte propia;
  - salida de cuenta;
  - escenarios.

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

## 7. Prioridad P4 — plataforma y escalabilidad

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

## 9. Deuda de calidad transversal

- aumentar integration/API tests;
- activar E2E;
- formalizar smoke visual mobile/desktop;
- incorporar accesibilidad básica;
- definir cobertura objetivo sin usarla como única medida;
- revisar seguridad con OWASP;
- evaluar dependencias con mantenimiento, licencia, bundle y vulnerabilidades;
- automatizar validación de documentación y enlaces;
- proteger `main` y `dev` con checks;
- medir rendimiento antes de adoptar procesos costosos.

## 10. Cerrado recientemente

### 2026-07-25

- rediseño mobile-first de Compromisos en tres pasos;
- stepper mobile compacto, categorías reutilizadas y validación accionable;
- monto vigente unificado, fecha efectiva e historial accesible;
- cambio de monto con tres vigencias e historia pasada inmutable;
- recordatorios in-app y estados de fin de vigencia;
- fechas mensuales y recordatorios derivados desde una única fuente;
- candidatos mensuales con criterio híbrido y caso de control Pizza;
- retiro de la automatización inerte de la interfaz;
- compromisos personales variables;
- agenda de montos y snapshots;
- Captura rápida como orientador hacia Compromisos;
- onboarding y ayuda contextual;
- reevaluación de reglas al editar;
- cascada parcial al eliminar transacciones;
- unificación de `monthStartDay`.

### 2026-07-24

- motor unificado de reglas;
- simulación, conflictos y sugerencias;
- Captura rápida con aprendizaje administrable.

### 2026-07-23

- saldo disponible acumulado;
- exactitud de pagos de deuda y cuotas;
- compra/venta de USD;
- sugerencias inteligentes de transacción;
- mejoras de calendario y categorías.

El historial detallado vive en Git y en `docs/archivados/`.

## 11. Cómo actualizar este archivo

Al iniciar:

- cambiar estado a `en curso`;
- enlazar decisión o dependencia si aplica.

Al cerrar:

- verificar el criterio;
- actualizar estado actual y documentación de dominio;
- mover un resumen a “Cerrado recientemente”;
- eliminar detalles que ya no ayuden a priorizar.

Al descubrir trabajo:

- comprobar que no exista;
- asignar ID y prioridad;
- explicar problema y criterio de cierre;
- no crear otro backlog.

Una prioridad nueva que desplace P0/P1 requiere explicar el motivo.
