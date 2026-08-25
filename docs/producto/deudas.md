# Deudas en Finp

> Estado: vigente
> Audiencia: producto, diseño, desarrollo y agentes
> Última actualización: 2026-08-25
> Fuente de verdad: reglas funcionales de Deudas

## Índice

1. [Definición](#1-que-son-las-deudas)
2. [Propósito](#2-para-que-existe-un-modulo-propio)
3. [Tipos](#3-tipos-de-deuda)
4. [Pagos y cobros](#4-pagos-y-cobros)
5. [Consolidación](#5-consolidacion-y-estado)
6. [Relaciones](#6-relacion-con-cuentas)
7. [Reporting](#7-relacion-con-reporting)
8. [Espacios](#8-relacion-con-espacios)
9. [Experiencia responsive](#9-experiencia-responsive)
10. [Tarjetas](#10-relacion-futura-con-tarjeta-de-credito)
11. [Decisiones](#11-decisiones-consolidadas)

Las posibilidades futuras descritas aquí no establecen prioridad. El backlog único es [`roadmap_finp.md`](roadmap_finp.md).

## 1. Que son las deudas

El modulo Deudas representa obligaciones pendientes entre personas. Finp las trata como una capa propia porque no encajan bien ni como transaccion comun ni como cuenta.

Dos lecturas principales:

- `payable`: debo;
- `receivable`: me deben.

Dos origenes principales:

- manual;
- derivada de espacios.

## 2. Para que existe un modulo propio

Una deuda necesita:

- monto pendiente por moneda;
- contraparte;
- historial de pagos o cobros;
- estado;
- relacion con cuentas;
- relacion opcional con espacios;
- integracion con reportes sin contaminar gasto/ingreso.

Eso justifica que Finp no la haya dejado como una simple etiqueta de transaccion.

## 3. Tipos de deuda

### Deudas manuales

Se crean directamente desde el usuario.

Sirven para:

- prestamos informales;
- plata adelantada;
- cobros a favor;
- saldos que no vienen de Espacios.

### Deudas derivadas de espacios

Se sincronizan desde balances compartidos.

Principios:

- respetan el `debtMode` del espacio;
- pueden ignorarse o restaurarse sin borrar el origen compartido;
- no duplican el movimiento del espacio: representan la obligacion resultante.

## 4. Pagos y cobros

Las acciones principales del modulo son:

- pagar deuda;
- registrar cobro;
- ignorar;
- restaurar;
- revisar historial.

### Regla critica

Pagos y cobros de deuda:

- si impactan cuentas reales;
- no son gasto ni ingreso operacional.

Cuando la obligación y el pago usan monedas distintas, el movimiento conserva
por separado el dinero efectivamente pagado, el importe aplicado a la deuda y
el snapshot de conversión. La diferencia de cambio es trazable y no
operacional.

Esto evita errores de lectura financiera.

Ejemplo:

- si le pagas a alguien una deuda, tu saldo de cuenta baja;
- pero eso no debe inflar tus gastos del mes;
- si alguien te devuelve plata, tu saldo sube;
- pero eso no debe contar como ingreso nuevo.

## 5. Consolidacion y estado

El modulo consolida relaciones activas y su estado.

La consolidación y la simplificación operan independientemente dentro de cada
moneda. ARS, USD y EUR pueden convivir en una misma relación, pero nunca se
netean entre sí sin una conversión elegida y visible. Los totales de reporte
muestran su composición y las posiciones abiertas pueden incluir una
equivalencia actual sin modificar el saldo original.

Estados funcionales actuales:

- activa;
- parcialmente pagada;
- pagada;
- ignorada;
- cancelada.

La vista esta orientada a responder:

- cuanto debo;
- cuanto me deben;
- con quien;
- de donde sale ese saldo;
- como evoluciono.

## 6. Relacion con cuentas

La deuda no es una cuenta.

Pero sus movimientos si pueden tocar cuentas:

- pago de deuda -> salida real de cuenta;
- cobro de deuda -> entrada real de cuenta.

Principio:

- cuentas reflejan efectivo;
- deudas reflejan obligacion pendiente.

## 7. Relacion con reporting

Finp usa `operationalAmount` y tipos no operacionales para no mezclar pagos/cobros de deuda con consumo o ingresos reales de actividad.

Consecuencia:

- dashboard y reportes no deben leer un pago de deuda como nuevo gasto;
- sankey, cashflow operativo y resumen personal deben respetar esa separacion;
- la cuenta, en cambio, si debe mostrar el movimiento real.

## 8. Relacion con espacios

Cuando la deuda nace en un espacio:

- el espacio sigue siendo el origen funcional;
- la deuda aparece en `/debts` como reflejo operativo personal;
- el criterio directo o simplificado conserva una sola fuente compartida;
- pagos y cobros desde Deudas y desde Espacios invocan la misma operación
  atómica e idempotente;
- el saldo derivado se materializa por moneda y la simplificación nunca
  compensa divisas diferentes;
- una liquidación puede seleccionar varios componentes y combinar tramos ARS,
  USD u otras monedas habilitadas;
- cada tramo aplica primero contra su misma moneda y luego usa conversiones
  explícitas en el orden revisado por la persona;
- una liquidación parcial actualiza el saldo pendiente y ambas superficies sin
  crear otro gasto o ingreso operacional;
- un pago parcial conserva el resto en la moneda de la obligación y un
  sobrepago superior a una unidad menor se rechaza;
- una liquidación confirmada se revierte de forma explícita y no se edita;
- ignorar una deuda derivada no borra el movimiento del espacio ni altera su historial.
- durante una migración, una deuda derivada se reconstruye exclusivamente desde
  el ledger por moneda; el documento legacy queda en historia del ensayo y un
  settlement histórico se representa una vez, como tramo explícito;
- un Espacio legacy bloqueado no expone una deuda parcial como saldo confiable
  ni permite liquidarla hasta resolver o migrar su agregado.

Una decisión pendiente de `Agregar a Mi Finp` no es una deuda. Sólo existe
deuda derivada cuando hay una obligación monetaria positiva entre personas. Una
parte propia igual a cero no crea deuda por sí sola, pero sí puede existir una
deuda a favor cuando esa persona pagó por otras y adelantó el total.

## 9. Experiencia responsive

- En mobile, la relación y el detalle usan sheets inferiores de hasta `90dvh`.
- En desktop, el detalle se abre como panel lateral y la lista permanece visible.
- Abrir una deuda desde una relación conserva un regreso explícito a esa relación.
- Alta, pago y cobro mantienen encabezado y acciones fijos; sólo el formulario
  desplaza contenido.
- Las acciones inferiores respetan safe areas y un área táctil mínima.

## 10. Relacion futura con tarjeta de credito

La integracion profunda con TC sigue diferida.

Decision actual:

- no forzar una unificacion prematura;
- no reescribir la logica de tarjeta para encajarla artificialmente en Deudas;
- resolverla cuando haya suficiente uso real y despues de cuotas en espacios.

## 11. Decisiones consolidadas

- una deuda no es una cuenta;
- pagar deuda no es gasto;
- cobrar deuda no es ingreso operacional;
- las deudas de espacios pueden ignorarse y restaurarse;
- liquidar desde Espacios o Deudas representa la misma intención financiera;
- las deudas derivadas mantienen autoridad por moneda y no admiten neteo
  multimoneda silencioso;
- los pendientes de impacto personal no pertenecen a Deudas;
- el modulo debe mostrar posicion neta y relacion por persona;
- la fuente del saldo importa: manual no significa lo mismo que `space`.
- el backfill y rollback por Espacio siguen la
  [`decisión 0010`](../decisiones/0010-migracion-progresiva-espacios-v2.md).
