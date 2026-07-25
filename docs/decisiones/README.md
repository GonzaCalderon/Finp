# Decisiones de Finp

> Estado: vigente
> Audiencia: producto, diseño, arquitectura y desarrollo
> Última actualización: 2026-07-25
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

Todavía no hay decisiones formalizadas en este formato. Las decisiones consolidadas existentes se migrarán desde los documentos históricos sólo cuando vuelvan a ser relevantes.
