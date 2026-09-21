# 0007 — Autoridad entre Espacios, Mi Finp y Deudas

> Estado: aceptada
> Fecha: 2026-08-24
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0007
> Responsables: prompter y equipo Finp
> Ámbito: producto, arquitectura, datos y privacidad

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Consecuencias](#5-consecuencias)
6. [Verificación](#6-verificación)
7. [Referencias](#7-referencias)

## 1. Contexto y problema

Espacios debe funcionar tanto para alguien que sólo participa de gastos
compartidos como para quien también mantiene sus finanzas personales en Finp.
La integración existente permite crear impactos privados y deudas derivadas,
pero mezclar el estado compartido, la decisión personal y la obligación entre
personas vuelve la experiencia ambigua y puede distorsionar cuentas o reporting.

La decisión debe responder quién tiene autoridad sobre cada dato y qué significa
`Agregar a Mi Finp`, sin convertir Espacios en una dependencia obligatoria de
las finanzas personales ni subordinar Mi Finp al modelo compartido.

## 2. Restricciones

- Mi Finp es la función principal y conserva autoridad sobre cuentas,
  categorías, transacciones, reporting e historia personal.
- Espacios debe ser utilizable sin configurar Mi Finp.
- La contabilidad personal no se comparte ni se modifica por decisiones ajenas.
- Cuentas reflejan dinero real; reporting refleja gasto operacional propio.
- Total pagado, parte propia y adelanto recuperable son conceptos distintos.
- Pagos, cobros y liquidaciones no son gasto ni ingreso operacional nuevo.
- Ediciones y anulaciones no reescriben historia privada sin decisión explícita.
- Escrituras derivadas deben ser autorizadas, atómicas e idempotentes.
- El comportamiento existente necesita compatibilidad o migración verificable.

## 3. Opciones consideradas

### Opción A — Sincronización compartida automática

El movimiento del Espacio crea o actualiza automáticamente las transacciones de
todos y usa su estado como confirmación global. Reduce acciones visibles, pero
expone decisiones privadas, fuerza la configuración personal y permite que una
persona altere indirectamente la contabilidad de otra. Se rechaza.

### Opción B — Módulos completamente aislados

Espacios, Mi Finp y Deudas no conservan vínculos y cada persona replica
manualmente gastos y liquidaciones. Es simple localmente, pero duplica trabajo,
pierde trazabilidad y facilita inconsistencias. Se rechaza.

### Opción C — Origen compartido con proyecciones privadas coordinadas

Espacios conserva el hecho compartido; cada usuario decide un impacto privado y
Deudas refleja la obligación resultante. Las superficies comparten operaciones
de dominio cuando representan la misma intención, sin compartir configuración
personal. Se acepta.

## 4. Decisión

Se adopta la opción C con este contrato:

1. El movimiento del Espacio es la única fuente del total, pagador, moneda,
   fecha y reparto compartidos.
2. Cada usuario tiene un impacto personal privado e independiente. Su acción no
   cambia el estado compartido ni el impacto de otra persona.
3. `Agregar a Mi Finp` crea una transacción personal cuyo gasto operacional es
   la parte propia exacta del usuario.
4. Si pagó más que su parte, su cuenta registra la salida real, el reporting
   sólo su parte y la diferencia queda como adelanto recuperable o deuda a favor.
5. Si no pagó, puede reconocer su parte sin inventar una salida de cuenta; la
   cuenta se mueve al liquidar.
6. Una parte propia igual a cero se informa. Si la persona no pagó, no genera
   una acción financiera; si pagó por otras, permite registrar el adelanto real
   y la deuda a favor sin presentarlo como gasto propio.
7. Deudas refleja obligaciones positivas derivadas. Liquidar desde Espacios o
   Deudas invoca la misma operación atómica e idempotente.
8. Un pendiente privado no aprueba el gasto compartido y una notificación no es
   fuente de verdad.
9. Una edición puede reconciliar pendientes sin historia. Si ya existe una
   transacción vinculada, la marca para revisión y nunca la reescribe en silencio.
10. Toda relación conserva origen e identidad exacta; un reintento no duplica
    transacciones, deudas, liquidaciones ni notificaciones.

## 5. Consecuencias

### Positivas

- Espacios sigue siendo útil de forma autónoma.
- Mi Finp mantiene exactitud, privacidad y protagonismo.
- El usuario puede distinguir gasto propio, salida real y dinero recuperable.
- Espacios y Deudas ofrecen dos entradas coherentes a una misma liquidación.
- La trazabilidad permite explicar y revisar cambios posteriores.

### Negativas o costos

- La implementación necesita separar estados que hoy pueden aparecer
  acoplados.
- El impacto del pagador requiere representar por separado monto real y
  operacional.
- Ediciones, anulaciones, cambios de participantes y fallos parciales exigen
  reconciliación explícita.
- La compatibilidad con registros anteriores puede requerir reparación o
  migración idempotente.
- Los recorridos y las pruebas abarcan más combinaciones de rol, parte y origen.

### Seguimiento

La implementación y el rediseño se priorizan exclusivamente mediante
[`roadmap_finp.md`](../producto/roadmap_finp.md). La especificación detallada de
experiencia y casos vive en [`espacios.md`](../producto/espacios.md). El modelo,
la atomicidad, la migración y el retiro del legado se rigen por la decisión
[`0008`](0008-modelo-consistencia-financiera-espacios.md).

## 6. Verificación

La decisión se considera aplicada cuando:

- unit tests cubren cálculo de parte propia, adelanto y liquidación;
- integración y API cubren autorización, aislamiento, atomicidad, idempotencia,
  edición, anulación y fallos parciales;
- E2E mobile y desktop comparan Espacios, Mi Finp, cuentas, reportes y Deudas;
- los casos incluyen pagador total, pagador con adelanto, pagador con parte cero,
  no pagador con parte positiva o cero, liquidación parcial y total y origen
  editado o anulado;
- ninguna configuración o transacción privada se expone a otro participante;
- los registros anteriores quedan compatibles o migrados sin perder historia.

## 7. Referencias

- [`AGENTS.md`](../../AGENTS.md), invariantes financieros y de privacidad.
- [`especificacion_funcional.md`](../producto/especificacion_funcional.md),
  comportamiento esperado de Espacios, Deudas e integraciones.
- [`arquitectura_funcional.md`](../producto/arquitectura_funcional.md), separación
  entre dinero real, operacional, parte propia y deuda.
- [`espacios.md`](../producto/espacios.md), contrato funcional y de experiencia.
- [`deudas.md`](../producto/deudas.md), obligaciones y liquidaciones.
- [`notificaciones.md`](../producto/notificaciones.md), pendientes y revisión.
- [`0008 — Modelo y consistencia financiera de Espacios`](0008-modelo-consistencia-financiera-espacios.md),
  solución técnica, migración y verificación integral.
