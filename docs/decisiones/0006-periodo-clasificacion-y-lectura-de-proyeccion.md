# 0006 — Período, clasificación y lectura de Proyección

> Estado: aceptada
> Fecha: 2026-07-31
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0006
> Responsables: Finp
> Ámbito: Proyección, Tarjetas, Compromisos y Preferencias

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Contrato y certeza](#5-contrato-y-certeza)
6. [Agrupaciones y personalización](#6-agrupaciones-y-personalización)
7. [Consecuencias y límites](#7-consecuencias-y-límites)
8. [Verificación](#8-verificación)

## 1. Contexto y problema

Proyección incluía compromisos y cuotas, pero omitía compras en un pago, no
distinguía un plan `1/1` de una cuota múltiple y podía divergir de Tarjetas o
Dashboard. Tampoco había un contrato serializable compartido para expresar
origen, certeza, contexto y totales por fuente.

Había que decidir en qué período cae cada representación de tarjeta, cómo evitar
contar a la vez plan y transacción padre, y cómo permitir lecturas alternativas
sin cambiar el resultado financiero.

## 2. Restricciones

- ARS y USD nunca se suman ni se convierten implícitamente.
- Los períodos financieros respetan `monthStartDay`, rangos `[start, end)` e
  inicio operativo.
- Un pago de tarjeta no reduce el gasto proyectado ni crea otro gasto.
- La transacción padre de un plan no puede contarse además del plan.
- La cuenta de una tarjeta no equivale a la cuenta futura de pago.
- Toda consulta y preferencia pertenece al usuario autenticado.
- La personalización sólo puede recordar presentación; no aprende cálculos.

## 3. Opciones consideradas

### Opción A — Usar siempre la fecha de compra

Es simple para consumos históricos, pero contradice el primer cierre elegido al
crear un plan moderno y puede presentar un `1/1` en un período distinto al de
Tarjetas.

### Opción B — Tratar todo plan como cuota

Reutiliza la estructura existente, pero presenta una compra `1/1` como cuota
múltiple y hace divergir los resúmenes por tipo.

### Opción C — Clasificar por representación vigente y agrupar una lista única

El plan conserva autoridad sobre su cierre; el consumo histórico sin plan usa
su fecha financiera; `1/1` se clasifica como un pago; las agrupaciones son sólo
transformaciones de presentación.

## 4. Decisión

Se adopta la opción C:

- plan `1/1`: `card_single`, período `firstClosingMonth`, certeza `confirmed`;
- transacción histórica sin plan: `card_single`, período financiero de su
  fecha, certeza `confirmed`;
- plan con más de una cuota: `card_installment`, período derivado del plan,
  certeza `calculated`;
- la transacción con `installmentPlanId` nunca vuelve a sumarse;
- `credit_card_payment` y su alias histórico no forman parte de los consumos;
- Tarjetas, Dashboard y Proyección comparten la clasificación `single` o
  `installment`.

## 5. Contrato y certeza

`GET /api/projection` devuelve ítems discriminados y serializables con origen,
descripción, moneda, monto, categoría, tarjeta o cuenta cuando corresponda,
fecha o vencimiento, certeza y enlace navegable. Cada período separa totales de
Compromisos, `TC · un pago`, `TC · cuotas`, estimados y cantidad de montos
pendientes.

Los compromisos conservan la precedencia común:

1. snapshot registrado: `confirmed`;
2. agenda o plantilla: `calculated`;
3. referencia variable: `estimated`;
4. variable sin referencia: `pending_amount`.

Un monto pendiente se comunica como “Monto a confirmar”; no se presenta como
`$0`. Los períodos pasados distinguen lo registrado de lo esperado.

## 6. Agrupaciones y personalización

La vista predeterminada muestra próximos seis períodos, agrupados por tipo. Las
alternativas son:

- por tipo: fuente → tarjeta cuando corresponde → categoría → consumo;
- por tarjeta: Compromisos separados y tarjeta → tipo → categoría → consumo;
- por categoría: categoría → tipo → tarjeta cuando corresponde → consumo.

Las tres parten de la misma lista canónica y conservan inclusión y totales. Se
recuerdan por usuario agrupación, modo, horizonte y moneda del gráfico. Año
calendario es un modo secundario con selector de año.

Nivel de aprendizaje: `personalizar` únicamente esta presentación recordada.
Montos, monedas, períodos, certeza e inclusión siguen siendo deterministas.

## 7. Consecuencias y límites

### Positivas

- Una compra `1/1` se lee igual en Tarjetas, Dashboard y Proyección.
- No existe doble conteo entre plan y transacción padre.
- El backend consulta cada colección una vez por request, no una vez por
  período.
- UI mobile y desktop comparten componentes y agrupador.
- Los enlaces transportan filtros, nunca montos.

### Costos

- Los planes y transacciones históricas compatibles deben coexistir durante la
  lectura.
- Las preferencias privadas no se cachean y requieren fallback local seguro.

### Fuera de este cierre

- escenarios comparativos;
- cashflow proyectado por cuenta;
- compromisos compartidos, parte propia, adelantos y recuperables.

Esos límites conservan ítems separados en el roadmap; el último depende de
Compromisos en Espacios.

## 8. Verificación

- Unitarias para `1/1`, histórico sin plan, cuotas, límites de período,
  `monthStartDay`, inicio operativo, doble conteo, monedas, certeza y
  agrupaciones invariantes.
- API y servicio para autenticación, query estricta, `no-store`, aislamiento,
  serialización y consultas acotadas.
- Preferencias y componentes para defaults, fallback, hidratación, error,
  reintento, respuestas obsoletas, privacidad y accesibilidad.
- E2E aislado en Chromium desktop y Pixel 7 para seis meses, ARS/USD, expansión,
  navegación, persistencia, ocultamiento, dark mode y movimiento reducido.
