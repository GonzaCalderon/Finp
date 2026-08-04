# Decisiones de Finp

> Estado: vigente
> Audiencia: producto, diseño, arquitectura y desarrollo
> Última actualización: 2026-07-31
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
- [`0007 — Escenarios efímeros sobre una base viva`](0007-escenarios-efimeros-sobre-base-viva.md):
  borrador de sesión, rebase sobre datos reales, precedencia de cambios y
  ausencia de persistencia financiera.
