# 0004 — Resumen bimonetario de tarjetas

> Estado: aceptada
> Fecha: 2026-07-26
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0004
> Responsables: Finp
> Ámbito: tarjetas, dashboard, reporting y arquitectura

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Estados derivados](#5-estados-derivados)
6. [Consecuencias](#6-consecuencias)
7. [Verificación](#7-verificación)

## 1. Contexto y problema

Dashboard y Tarjetas calculaban lecturas parciales del mismo período. Un pago
parcial podía presentarse como total y una tarjeta con consumos en ARS y USD
invitaba a interpretar una suma sin conversión como un único monto.

## 2. Restricciones

- ARS y USD son totales paralelos, no sumables.
- La tarjeta puede no tener consumos y aun así debe aparecer.
- Consumos, pagos y crédito pertenecen al período financiero consultado.
- Un pago cuenta sólo si su destino referencia esa tarjeta.
- La API por tarjeta debe conservar compatibilidad.

## 3. Opciones consideradas

### Opción A — Mantener cálculos por superficie

Reduce el cambio inicial, pero perpetúa divergencias entre Dashboard, Sankey y
Tarjetas.

### Opción B — Persistir el estado mensual

Simplifica lecturas, pero introduce una autoridad derivada que puede quedar
desactualizada.

### Opción C — Derivar un resumen compartido

Una función pura compone consumos y pagos por moneda y expone el mismo contrato
a todas las superficies.

## 4. Decisión

Se adopta la opción C:

- `credit-card.ts` es la fuente común de composición y estado;
- `/api/credit-cards/payment-summary?month=YYYY-MM` devuelve todas las tarjetas
  en `summaries`;
- con `cardId`, el endpoint conserva el contrato escalar anterior y agrega el
  estado;
- Dashboard y Sankey consumen la misma derivación;
- filtros visuales de la página no alteran el resumen mensual de cada tarjeta;
- la deuda remanente del plan de cuotas se calcula sobre el plan completo, no
  sólo sobre los movimientos filtrados.

## 5. Estados derivados

Por tarjeta y moneda se derivan `due`, `paid`, `pending` y `credit`. El estado
visible se compone sin conversión:

- `no_charges`: no hay cargos ni pagos del período;
- `unpaid`: hay cargos y no hay pago suficiente;
- `partial`: existe pago, pero queda pendiente;
- `paid`: los cargos están cubiertos dentro de la tolerancia;
- `overpaid`: el pago supera los cargos y existe saldo a favor.

La tolerancia evita estados erróneos por decimales.

## 6. Consecuencias

### Positivas

- Todas las superficies explican el mismo número.
- Los pagos parciales son visibles como parciales.
- El saldo a favor no se oculta.
- Una tarjeta sin actividad conserva su lugar y estado.

### Costos y límites

- El resumen consulta todas las tarjetas del usuario para el período.
- No convierte monedas ni construye un total patrimonial común.
- Los filtros de búsqueda sirven para explorar movimientos, no para redefinir
  el resumen financiero.

## 7. Verificación

- Unit tests de estados sin cargos, impaga, parcial, pagada y con saldo a favor.
- Casos ARS/USD que prueban separación estricta.
- Casos de pago destinado a otra tarjeta.
- Typecheck, lint, suite unitaria y build.

