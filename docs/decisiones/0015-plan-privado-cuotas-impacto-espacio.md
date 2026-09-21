# 0015 — Plan privado de cuotas para un impacto de Espacio

> Estado: aceptada
> Fecha: 2026-09-16
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0015
> Responsables: prompter y equipo Finp
> Ámbito: producto, arquitectura, datos, privacidad y experiencia
> Reemplaza parcialmente: decisión 0012

## Índice

1. [Contexto](#1-contexto)
2. [Decisión](#2-decisión)
3. [Contrato financiero](#3-contrato-financiero)
4. [Consistencia y ciclo de vida](#4-consistencia-y-ciclo-de-vida)
5. [Experiencia](#5-experiencia)
6. [Compatibilidad](#6-compatibilidad)
7. [Verificación](#7-verificación)

## 1. Contexto

La decisión 0012 habilitó una tarjeta privada para el pagador de un gasto de
Espacio, pero fijó el consumo como `1/1` sin `InstallmentPlan`. Esa restricción
impide describir una compra real en cuotas y también omite el primer período de
cierre que el flujo normal de Tarjetas exige.

La ampliación no convierte al movimiento compartido en un plan. Cuotas,
tarjeta y cierre continúan siendo una decisión privada de la persona que agrega
su impacto a Mi Finp.

## 2. Decisión

1. Cuando una creación de impacto personal elige una tarjeta de crédito, debe
   configurar cantidad de cuotas y primer mes de cuota antes de confirmar.
2. Mi Finp crea un `InstallmentPlan` privado incluso para `1/1`, porque el primer
   cierre forma parte del dato confirmado.
3. El movimiento del Espacio conserva una única fecha, total y reparto. No
   recibe campos de tarjeta ni se divide por períodos.
4. Vincular una transacción existente conserva el plan que esa transacción ya
   tenga y no crea otro.
5. La configuración se ofrece tanto durante `Nuevo gasto` como desde `Agregar a
   Mi Finp` en el detalle.

## 3. Contrato financiero

El plan conserva dos magnitudes:

| Magnitud | Fuente | Uso |
|---|---:|---|
| `totalAmount` | total real pagado | deuda y resumen de la tarjeta |
| `operationalTotalAmount` | parte propia | reportes y categorías personales |
| `installmentAmount` | total real / cuotas | vencimiento real por período |
| `operationalInstallmentAmount` | parte propia / cuotas | gasto operacional por período |

Los planes existentes no originados en Espacios pueden omitir las magnitudes
operacionales; en ese caso se mantiene la equivalencia histórica con el total.
No se mezclan monedas ni se infiere una conversión.

## 4. Consistencia y ciclo de vida

- Plan, transacción e impacto se crean en la misma transacción de base de datos
  y bajo la misma clave de idempotencia.
- Si la operación falla, no queda un plan o una transacción huérfanos.
- `Quitar de Mi Finp` elimina el plan privado y su transacción, y marca el
  impacto como removido sin modificar el movimiento compartido.
- Una sincronización explícita actualiza total, parte propia, fecha, descripción
  y categoría del plan; conserva cantidad de cuotas y primer cierre ya
  confirmados.
- El plan pertenece sólo al usuario autenticado. Ningún DTO compartido expone
  tarjeta, cuotas o período de cierre.

## 5. Experiencia

Al elegir una tarjeta se muestran:

- cantidad de cuotas, con mínimo de una;
- primera cuota, propuesta para el mes calendario siguiente a la compra y
  siempre editable;
- valor por cuota y resumen de períodos;
- ayuda para ingresar el valor conocido de una cuota y calcular el total.

La revisión anticipa tarjeta, cantidad, primera cuota, cargo real y parte
propia. Un dato inválido conserva el formulario y enfoca el error.

## 6. Compatibilidad

La ampliación es aditiva. Los planes existentes continúan válidos y no requieren
backfill. Los consumos históricos de Espacios sin plan siguen leyéndose como
`TC · un pago`; sólo las altas nuevas que confirman una tarjeta usan el contrato
de esta decisión.

FINP-P3-007 conserva su alcance: modelar cuotas como parte del estado compartido
del Espacio, si alguna vez se decide hacerlo. Esta decisión cubre únicamente el
plan privado de Mi Finp.

## 7. Verificación

- Unitarias de contrato para cantidad, primer cierre y magnitudes real y
  operacional.
- Integración con plan y transacción atómicos, reintento idempotente, ARS/USD,
  pagador con adelanto y eliminación en cascada.
- Componentes para aparición exclusiva al elegir tarjeta, validación, resumen y
  persistencia en borrador.
- E2E mobile y desktop desde alta y desde detalle, incluida la remoción sin
  cambiar el movimiento compartido.
- Build de producción para comprobar que la ruta dinámica de impacto personal
  queda registrada; un caché de desarrollo desactualizado se recupera
  reiniciando el servidor y regenerando `.next`.
