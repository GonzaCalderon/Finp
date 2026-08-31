# 0012 — Gasto de Espacio pagado con tarjeta en un pago

> Estado: aceptada
> Fecha: 2026-08-30
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0012
> Responsables: prompter y equipo Finp
> Ámbito: producto, arquitectura, datos, privacidad y experiencia

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Contrato financiero](#5-contrato-financiero)
6. [Consecuencias](#6-consecuencias)
7. [Verificación](#7-verificación)
8. [Referencias](#8-referencias)

## 1. Contexto y problema

Un gasto compartido puede haber sido pagado con una tarjeta privada del
participante que adelantó el dinero. El movimiento del Espacio debe conservar el
total, pagador y reparto compartidos, mientras Mi Finp necesita reflejar el cargo
real de la tarjeta sin convertir todo el adelanto en gasto propio.

El diálogo ofrece cuentas especiales, pero el contrato de Espacios todavía no
distingue de extremo a extremo una compra con tarjeta en un pago. Rechazar la
cuenta después de ofrecerla, registrar sólo la parte propia como cargo o crear un
plan de cuotas implícito producen lecturas financieras distintas e incorrectas.

## 2. Restricciones

- El método de pago, la tarjeta y su deuda pertenecen a Mi Finp y son privados.
- El movimiento compartido sigue siendo utilizable sin configurar Mi Finp.
- La cuenta refleja el total realmente pagado; el reporting, la parte propia.
- El adelanto recuperable no es gasto operacional.
- Un pago de tarjeta reduce el pendiente de la tarjeta, pero no borra ni reduce
  el gasto histórico ni el balance del Espacio.
- Mi Finp mantiene soporte de cuentas y tarjetas sólo en ARS y USD.
- Espacios no admite todavía gastos compartidos en varias cuotas.
- Fecha financiera, moneda e importes usan el contrato exacto v2.
- Alta e impacto privado deben ser autorizados, atómicos e idempotentes.

## 3. Opciones consideradas

### Opción A — No admitir tarjetas desde Espacios

Evita adaptar el contrato, pero obliga a duplicar el registro o a elegir una
cuenta que no representa el medio de pago real. Se rechaza.

### Opción B — Crear siempre un `InstallmentPlan` de una cuota

Reutiliza la estructura de cuotas, pero introduce una entidad innecesaria y
acopla el cierre actual a la evolución futura de cuotas compartidas. Además,
Finp ya reconoce consumos históricos sin plan como `TC · un pago`. Se rechaza.

### Opción C — Crear un consumo privado de tarjeta `1/1` sin plan

El Espacio conserva el gasto compartido normal y Mi Finp crea, sólo para el
pagador autenticado, una transacción privada de tarjeta por el impacto real. La
clasificación existente la trata como un pago y los pagos de resumen saldan el
pendiente de la tarjeta. Se acepta.

## 4. Decisión

Se adopta la opción C.

1. El movimiento compartido no guarda tarjeta, cuenta ni método de pago
   privados. Conserva total, moneda, fecha, pagador y reparto.
2. Al registrar el impacto personal, sólo el participante autenticado que figura
   como pagador puede elegir una tarjeta propia y autorizada.
3. La transacción privada usa el tipo `credit_card_expense`, referencia el
   `spaceId` y el `spaceEntryId`, y no crea `InstallmentPlan`.
4. La compra se clasifica como `TC · un pago`. No se presenta un selector de
   cantidad de cuotas ni se aceptan campos de cuotas en este recorrido.
5. Un intento de enviar más de una cuota falla como validación explícita. Las
   cuotas reales permanecen diferidas en FINP-P3-007.
6. Si la moneda del movimiento no es ARS o USD, el Espacio puede registrar el
   gasto, pero Mi Finp no ofrece una tarjeta incompatible ni convierte el cargo
   implícitamente. Explica el límite antes de la revisión final.

## 5. Contrato financiero

Para el pagador que agrega el movimiento a Mi Finp:

| Magnitud | Valor |
|---|---:|
| Movimiento compartido | total del gasto del Espacio |
| Impacto real de cuenta | total pagado con la tarjeta |
| Gasto operacional | parte propia vigente del usuario |
| Recuperable | total pagado menos parte propia, cuando sea positivo |

La transacción personal conserva:

- `amount`: total real cargado en la tarjeta;
- `operationalAmount`: parte propia exacta;
- cuenta origen: tarjeta privada elegida;
- moneda: la moneda real del cargo, sin conversión implícita;
- día financiero: el mismo `dateKey` civil del movimiento;
- procedencia: usuario, Espacio, movimiento y versión del contrato;
- idempotencia: una misma intención no crea otro cargo.

Un pago total o parcial mediante `credit_card_payment` dirigido a esa tarjeta
reduce el pendiente derivado de la tarjeta en su período y moneda. No modifica
`amount`, `operationalAmount`, el gasto compartido, el reparto ni el recuperable;
son historia y obligaciones diferentes.

Si el movimiento se edita o anula después de vincularse, el impacto pasa a
`needs_review`. Finp no reescribe silenciosamente el cargo histórico de la
tarjeta ni el pago de resumen ya registrado.

## 6. Consecuencias

### Positivas

- Cuenta, reporting y adelanto representan magnitudes distintas y correctas.
- Tarjetas, Dashboard y Proyección reutilizan la clasificación `1/1` existente.
- El Espacio no expone cuentas ni medios de pago privados.
- No se introduce un plan artificial ni una segunda lógica de cuotas.

### Negativas o costos

- El contrato de alta e impacto debe aceptar cuentas especiales autorizadas sin
  relajar la validación de cuentas generales.
- La revisión debe explicar total, parte propia, cargo y recuperable por
  separado.
- Edición, anulación y reintento necesitan casos específicos de integración.
- Una moneda del Espacio fuera de ARS/USD limita la registración privada con
  tarjeta hasta que Mi Finp amplíe su soporte.

### Seguimiento

La exactitud `1/1` se implementa dentro de FINP-P0-006. La experiencia del
diálogo se completa dentro de FINP-P1-013. Las cuotas compartidas continúan
separadas como FINP-P3-007 y requerirán una decisión nueva antes de ampliar este
contrato.

Nivel de aprendizaje: `no aplica`. Monto, moneda, fecha, tarjeta, pagador, parte
propia y clasificación financiera no se infieren ni automatizan.

## 7. Verificación

- Unitarias para total, parte propia, adelanto y clasificación `1/1` sin plan.
- Servicio y API para propiedad de tarjeta, rol, ARS/USD, rechazo de cuotas,
  fecha civil, dinero exacto, idempotencia y rollback.
- Integración para cargo total, pago parcial/total de tarjeta y ausencia de
  cambios en el gasto o balance compartido.
- Edición y anulación que producen `needs_review` sin reescribir historia.
- E2E mobile y desktop que comparan Espacios, cuenta de tarjeta, Dashboard,
  Tarjetas y reporting personal.
- Prueba de privacidad: ningún participante recibe tarjeta, cuenta, categoría o
  estado de pago de otra persona.

## 8. Referencias

- [`AGENTS.md`](../../AGENTS.md), invariantes financieros y de privacidad.
- [`0004 — Resumen bimonetario de tarjetas`](0004-resumen-bimonetario-de-tarjetas.md).
- [`0006 — Período, clasificación y lectura de Proyección`](0006-periodo-clasificacion-y-lectura-de-proyeccion.md).
- [`0007 — Autoridad entre Espacios, Mi Finp y Deudas`](0007-autoridad-espacios-finp-deudas.md).
- [`0008 — Modelo y consistencia financiera de Espacios`](0008-modelo-consistencia-financiera-espacios.md).
- [`Espacios`](../producto/espacios.md), contrato funcional completo.
- [`Roadmap`](../producto/roadmap_finp.md), prioridad y etapas de implementación.
