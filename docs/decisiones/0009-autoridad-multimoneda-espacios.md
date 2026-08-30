# 0009 — Autoridad multimoneda de Espacios

> Estado: aceptada
> Fecha: 2026-08-24
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0009
> Responsables: prompter y equipo Finp
> Ámbito: dinero, cotizaciones, balances, deudas, liquidaciones y experiencia

## Índice

1. [Contexto](#1-contexto)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Cotizaciones y revaluación](#5-cotizaciones-y-revaluación)
6. [Deudas y liquidaciones](#6-deudas-y-liquidaciones)
7. [Interfaz y Mi Finp](#7-interfaz-y-mi-finp)
8. [Rollout](#8-rollout)
9. [Consecuencias](#9-consecuencias)
10. [Verificación](#10-verificación)
11. [Referencias](#11-referencias)

## 1. Contexto

Espacios necesita permitir que gastos, partes, adelantos, deudas y pagos
convivan en ARS, USD, EUR u otras monedas habilitadas sin presentar una suma
ambigua. El modelo anterior convertía todo a una moneda de reporte con números
de punto flotante y podía reducir una deuda expresada en una moneda con un pago
de otra sin conservar una aplicación suficientemente explícita.

La moneda de reporte sigue siendo necesaria para lectura agregada, pero no puede
reemplazar la autoridad de los importes originales ni reescribir historia cada
vez que cambia el mercado.

## 2. Restricciones

- El dinero confirmado debe ser exacto en la unidad menor de cada moneda.
- Un gasto histórico conserva la referencia con la que se confirmó.
- Dos monedas distintas nunca se compensan silenciosamente.
- Espacios funciona aunque Mi Finp no tenga una cuenta en una moneda del
  Espacio.
- Una liquidación financiera se confirma completa o se revierte completa.
- No se agregan credenciales, colas ni proveedores pagos para esta etapa.
- El modelo nuevo continúa limitado a la base E2E hasta aprobar migración.

## 3. Opciones consideradas

### A — Convertir todo al valor actual de reporte

Simplifica la pantalla, pero modifica el significado histórico, oculta la
moneda de la obligación y hace que el saldo cambie sin un movimiento. Se
rechaza.

### B — Mantener canastas puras sin conversiones

Preserva cada moneda, pero no resuelve totales comparables ni pagos realizados
en una moneda distinta de la deuda. Se rechaza como solución integral.

### C — Autoridad por moneda y conversiones explícitas con snapshot

Mantiene saldos separados, usa la moneda de reporte sólo como equivalencia y
registra cada conversión aplicada. Permite totales comprensibles sin perder el
hecho financiero original. Se acepta.

## 4. Decisión

Se adopta la opción C:

- el contrato público usa `MoneyDto { currency, minorUnits, scale }`;
- la persistencia v2 guarda unidades menores exactas como texto entero;
- el registro habilitado contiene monedas ISO 4217 de curso legal con su escala
  0, 2 o 3 y excluye códigos de metales, fondos y unidades contables;
- toda conversión redondea una sola vez a la unidad menor de destino;
- todo reparto usa restos mayores y desempata mediante una clave estable;
- cada movimiento conserva moneda e importe original, equivalente histórico de
  reporte y `ConversionSnapshot` con tasa decimal, dirección, fuente, autor
  manual, tiempos y camino;
- la equivalencia de reporte es una lectura: nunca reemplaza el saldo original
  ni autoriza una compensación entre monedas.

## 5. Cotizaciones y revaluación

Las referencias automáticas se resuelven en este orden:

1. par directo;
2. camino por USD;
3. camino por EUR;
4. cotización manual cuando no existe un camino confiable.

DolarAPI aporta la referencia oficial USD/ARS: compra para USD → ARS y el
inverso de venta para ARS → USD. Frankfurter aporta referencias internacionales
diarias. DolarAPI se cachea 15 minutos y Frankfurter durante su frecuencia
diaria; el cliente recupera el lote al volver a foco y cada 15 minutos sólo si
la pestaña está visible. Nunca consulta una cotización por cada movimiento.

El caché no determina la validez de la referencia. Ambos proveedores publican
sólo en días hábiles, de modo que fuera del horario de mercado la última
observación puede tener días y seguir siendo la vigente. Una referencia se
considera actual mientras su observación no supere los cinco días, ventana que
cubre un fin de semana largo; más allá se lee como desactualizada. Derivar la
validez del caché dejaba vencida toda cotización de noche y los fines de
semana, e impedía tanto el autocompletado como la confirmación en servidor.

La persona puede reemplazar una referencia automática. La revisión compara el
valor y el snapshot queda marcado como manual con autor y momento. Una
referencia vencida se puede leer como desactualizada, pero confirmar exige
actualizarla o adoptarla explícitamente como manual. Un cambio de huella entre
preview y confirmación produce conflicto y conserva el borrador.

Gastos y reportes históricos usan snapshots inmutables. Sólo las posiciones
abiertas muestran, además, equivalencia actual y diferencia respecto del valor
histórico; una falla del proveedor no inventa ni presenta un total parcial.

## 6. Deudas y liquidaciones

La autoridad de deuda es un ledger separado por moneda. La simplificación se
ejecuta dentro de cada moneda y no netea ARS contra USD, EUR u otra divisa.

Una liquidación contiene:

- uno o más componentes de deuda elegidos y ordenados;
- uno o más tramos del dinero efectivamente pagado;
- aplicaciones de cada tramo a la moneda de cada componente;
- snapshots de todas las conversiones aplicadas;
- vínculo o decisión personal privada por tramo.

El asignador aplica primero la misma moneda y luego convierte el remanente en el
orden visible. Rechaza sobrepagos superiores a una unidad menor; un pago parcial
mantiene el resto en su moneda original. `DebtMovement` distingue dinero pagado
de importe aplicado. La diferencia de cambio es trazable y no operacional.

La liquidación se confirma junto con el movimiento, deudas, historial y
decisiones privadas en una transacción MongoDB. No se edita: se revierte de
forma explícita y se crea otra. Editar o anular un gasto previo no reescribe una
liquidación; el ledger deriva el nuevo saldo, incluso si queda invertido.

## 7. Interfaz y Mi Finp

Los agregados muestran el total en moneda de reporte junto con `Incluye…`. El
detalle desplegable explica importes originales, equivalencias, snapshots y
permite filtrar movimientos. En cada movimiento el importe original es
principal y la equivalencia de reporte es secundaria.

El encabezado ofrece una tira de referencias para los pares habilitados con la
moneda de reporte, su fuente, estado y antigüedad. Se desplaza sólo con overflow,
se pausa al interactuar, permite swipe y respeta movimiento reducido.

Los filtros por moneda original, pagada y de deuda se combinan en servidor antes
de paginar; el cursor incorpora la huella del filtro y todo subtotal se rotula
como filtrado.

Si Mi Finp no dispone de la moneda elegida, Espacios conserva autonomía.
`Agregar a Mi Finp` transfiere un borrador al flujo personal para elegir una
cuenta compatible y confirmar el dinero real. Nunca adopta automáticamente el
equivalente de reporte como movimiento personal.

## 8. Rollout

Los campos, índices y escrituras multimoneda se habilitan exclusivamente para
fixtures `contractVersion: 2` conectados a `finp-e2e`. Development continúa sin
cutover y producción sin backfill. Esta decisión no modifica el `NO-GO` de la
decisión 0008 ni cierra FINP-P0-006.

## 9. Consecuencias

Positivas:

- importes y repartos exactos para escalas 0, 2 y 3;
- historia estable y posiciones abiertas explicables;
- deudas por moneda sin compensaciones invisibles;
- pagos flexibles y atómicos con trazabilidad completa;
- una presentación agregada comprensible sin ocultar composición.

Costos:

- contratos y persistencia más explícitos;
- mayor matriz de pruebas para monedas, proveedores y liquidaciones;
- necesidad de resolver disponibilidad y antigüedad de proveedores;
- compatibilidad temporal con documentos legacy hasta el cutover.

## 10. Verificación

La decisión requiere:

- unitarias de exponentes, límites, redondeo, reparto, caminos y referencias;
- API de autenticación, aislamiento, permisos, filtros, cotización cambiada,
  mass assignment e idempotencia;
- integración MongoDB de deuda por moneda, liquidación multitramos, pagos
  parciales, reversión, rollback, replay y decisiones privadas;
- componentes accesibles para tira, composición, filtros y recuperación;
- E2E mobile y desktop para ARS/USD/EUR, referencias automáticas y manuales,
  totales, filtros, deudas, pagos ARS, USD y combinados, Mi Finp y proveedor
  caído;
- typecheck, lint, unitarias, integración, build, documentación y suite global
  en desarrollo y producción antes de publicar el checkpoint.

## 11. Referencias

- [DolarAPI — cotizaciones de Argentina](https://dolarapi.com/docs/argentina/operations/get-cotizaciones),
  consultada el 2026-08-24; API pública usada para la referencia oficial
  argentina.
- [Frankfurter — documentación](https://frankfurter.dev/), consultada el
  2026-08-24; referencias internacionales diarias sin credencial.
- [`0008 — Modelo y consistencia financiera de Espacios`](0008-modelo-consistencia-financiera-espacios.md).
- [`espacios.md`](../producto/espacios.md) y
  [`deudas.md`](../producto/deudas.md), contratos funcionales.
