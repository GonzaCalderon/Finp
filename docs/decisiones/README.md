# Decisiones de Finp

> Estado: vigente
> Audiencia: producto, diseño, arquitectura y desarrollo
> Última actualización: 2026-08-30
> Fuente de verdad: registro de decisiones duraderas

## Índice

1. [Propósito](#1-propósito)
2. [Cuándo crear una decisión](#2-cuándo-crear-una-decisión)
3. [Cuándo no crearla](#3-cuándo-no-crearla)
4. [Formato](#4-formato)
5. [Estados](#5-estados)
6. [Referencias externas](#6-referencias-externas)
7. [Índice de decisiones](#7-índice-de-decisiones)

## 1. Propósito

Una decisión registra por qué Finp eligió un camino cuando existían alternativas relevantes. Complementa al código y a la arquitectura: conserva contexto, compromisos y consecuencias.

Se usa una adaptación breve de Markdown Architectural Decision Records (MADR).

## 2. Cuándo crear una decisión

- Cambia una fuente de verdad.
- Establece un patrón transversal.
- Introduce una dependencia estructural.
- Modifica persistencia, seguridad, privacidad o sincronización.
- Elige una estrategia mobile, offline o de integración externa.
- Acepta un costo material de rendimiento u operación.
- Adopta o rechaza una práctica observada en otro sistema.
- Revierte una decisión anterior.

## 3. Cuándo no crearla

- Corrección obvia sin alternativa arquitectónica.
- Refactor local que conserva contratos.
- Detalle temporal de implementación.
- Tarea o idea pendiente: pertenece al roadmap.
- Descripción del comportamiento: pertenece a la especificación.

## 4. Formato

Copiar [`plantilla.md`](plantilla.md) con un nombre:

```text
NNNN-titulo-breve.md
```

Una decisión debe ser comprensible sin leer la conversación que la originó.

## 5. Estados

- `propuesta`: todavía requiere decisión.
- `aceptada`: dirige el desarrollo.
- `rechazada`: fue considerada y no elegida.
- `reemplazada`: otra decisión ocupa su lugar.
- `obsoleta`: el contexto dejó de aplicar.

Cambiar una decisión aceptada requiere crear otra y enlazarlas.

## 6. Referencias externas

Una referencia debe indicar:

- fuente y fecha de consulta;
- problema que el otro sistema resolvió;
- evidencia o reputación disponible;
- similitudes y diferencias con Finp;
- riesgos de trasladar el patrón.

La referencia informa; la decisión sigue siendo propia de Finp.

## 7. Índice de decisiones

- [`0001 — Compromisos manuales y recordatorios relativos`](0001-compromisos-manuales-y-recordatorios-relativos.md):
  aplicación manual hasta scheduler, recordatorio relativo, flujo guiado y
  ciclo de vida derivado.
- [`0002 — Criterio híbrido para sugerencias de compromisos`](0002-criterio-hibrido-sugerencias-de-compromisos.md):
  umbral de confianza, evidencia temporal, estabilidad, afinidad por categoría
  y caso de control Pizza.
- [`0003 — Borrado explícito de pagos duales`](0003-borrado-explicito-de-pagos-duales.md):
  elección entre una parte y el grupo completo, compatibilidad y reparación de
  grupos huérfanos.
- [`0004 — Resumen bimonetario de tarjetas`](0004-resumen-bimonetario-de-tarjetas.md):
  fuente compartida, estados derivados y separación estricta entre ARS y USD.
- [`0005 — Captura rápida, tarjetas y handoffs tipados`](0005-captura-rapida-tarjetas-y-handoffs.md):
  clasificación financiera determinista, contratos discriminados, límites de
  resolución local y transporte a superficies especializadas.
- [`0006 — Período, clasificación y lectura de Proyección`](0006-periodo-clasificacion-y-lectura-de-proyeccion.md):
  período de tarjetas, compra `1/1`, certeza, agrupaciones invariantes y límites
  del cierre operativo.
- [`0007 — Autoridad entre Espacios, Mi Finp y Deudas`](0007-autoridad-espacios-finp-deudas.md):
  origen compartido, parte propia exacta, impacto privado y una sola operación
  de liquidación entre Espacios y Deudas.
- [`0008 — Modelo y consistencia financiera de Espacios`](0008-modelo-consistencia-financiera-espacios.md):
  modelo discriminado, servicios de aplicación, atomicidad, idempotencia,
  permisos, migración y retiro del legado.
- [`0009 — Autoridad multimoneda de Espacios`](0009-autoridad-multimoneda-espacios.md):
  dinero exacto, snapshots, cotizaciones, saldos por moneda, liquidaciones
  multitramos y presentación de composiciones.
- [`0010 — Migración progresiva de Espacios v2`](0010-migracion-progresiva-espacios-v2.md):
  clasificación cerrada, copia sanitizada, manifiesto privado, backfill por
  Espacio, verificación y rollback exacto.
- [`0011 — Cutover de Espacios v2 en development`](0011-cutover-espacios-v2-en-development.md):
  autorización explícita, transformación in-place sobre `finm`, corte único de
  los 11 Espacios, respaldo local y límites frente a producción y al fallback
  global.
- [`0012 — Gasto de Espacio pagado con tarjeta en un pago`](0012-gasto-espacio-tarjeta-un-pago.md):
  cargo privado por el total real, parte propia operacional, clasificación
  `1/1`, ARS/USD y separación explícita de las cuotas compartidas futuras.
- [`0013 — Borrador privado persistente de movimiento de Espacio`](0013-borrador-privado-persistente-movimiento-espacio.md):
  recurso por autor y Espacio, autosave, listado privado, adjuntos recuperables
  y publicación atómica e idempotente.
