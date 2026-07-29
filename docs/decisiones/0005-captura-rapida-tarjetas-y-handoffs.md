# 0005 — Captura rápida, tarjetas y handoffs tipados

> Estado: aceptada
> Fecha: 2026-07-28
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0005
> Responsables: Finp
> Ámbito: Captura rápida, Tarjetas, Compromisos y aprendizaje

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Jerarquía y contratos](#5-jerarquía-y-contratos)
6. [Consecuencias](#6-consecuencias)
7. [Verificación](#7-verificación)

## 1. Contexto y problema

Captura rápida podía orientar hacia Compromisos, pero no compartía sus
candidatos aprendidos ni distinguía compras con tarjeta, cuotas, pagos del
resumen y referencias a planes existentes. Tratar cualquiera de esas intenciones
como un gasto simple produciría un impacto financiero incorrecto.

## 2. Restricciones

- El motor mensual y los umbrales de la decisión 0002 no cambian.
- ARS y USD se mantienen separados.
- La tarjeta debe pertenecer al usuario y admitir la moneda.
- Un pago de resumen nunca crea un consumo.
- Una referencia a una cuota existente nunca crea otro plan.
- El texto financiero ingresado no se persiste en telemetría.
- El aprendizaje no elige ni automatiza tarjetas.

## 3. Opciones consideradas

### Opción A — Derivar toda intención de tarjeta

Reduce lógica en Captura rápida, pero agrega fricción incluso a una compra en un
pago cuyos datos pueden revisarse de forma segura en el diálogo.

### Opción B — Registrar todo dentro de Captura rápida

Acorta el recorrido, pero duplica validaciones y oculta decisiones propias de
cuotas y pagos.

### Opción C — Resolver lo simple y transportar lo especializado

Captura rápida clasifica de forma determinista, confirma una compra en un pago y
entrega borradores discriminados a la superficie responsable para cuotas y
pagos.

## 4. Decisión

Se adopta la opción C:

- las compras en un pago se previsualizan y confirman dentro de Captura rápida;
- las compras en cuotas abren el formulario completo con tarjeta, monto, moneda,
  fecha, categoría, cantidad y primer mes;
- los pagos abren el flujo completo con tarjeta, monto, moneda y fecha, pero la
  cuenta de origen queda obligatoriamente sin seleccionar;
- `cuota N de M` abre la revisión de Tarjetas;
- una intención de tarjeta no ofrece gasto simple ni descarte persistente;
- el primer mes predeterminado es el próximo mes calendario y permanece
  editable;
- la creación de planes conserva `quick_capture`, controla duplicados y devuelve
  plan y transacción padre para trazabilidad y Deshacer.

## 5. Jerarquía y contratos

Las intenciones financieras especializadas se clasifican antes de ofrecer una
escritura simple. Dentro de recurrencias se respeta:

1. recurrencia explícita;
2. compromiso pendiente;
3. candidato mensual aprendido;
4. transacción simple.

Los borradores de orientación son contratos discriminados para compromiso,
compra con tarjeta, pago de tarjeta y revisión de cuota. Captura rápida y
Compromisos comparten `subjectKey`, evidencia, procedencia y descarte para un
mismo candidato mensual.

La telemetría separa detección, aceptación y finalización. Sólo conserva el tipo
de intención, la sesión y metadatos estructurados necesarios; no el texto
financiero.

## 6. Consecuencias

### Positivas

- Una frase de tarjeta no puede degradarse silenciosamente a gasto común.
- Cada superficie conserva autoridad sobre sus validaciones.
- Los borradores sobreviven al handoff y mantienen procedencia.
- Los candidatos recurrentes no divergen entre superficies.

### Costos y límites

- Captura rápida carga candidatos mensuales una vez por apertura y sólo con
  texto útil; un fallo no bloquea la captura manual.
- La clasificación de tarjetas es determinista y exige nombre o alias
  inequívoco; las coincidencias múltiples requieren selección.
- No se aprende todavía qué tarjeta elegir.

## 7. Verificación

- Matriz unitaria de frases, falsos positivos, ambigüedad, monedas, prioridades y
  primer mes.
- APIs con autenticación, propiedad, moneda, duplicados, procedencia y rollback.
- Componentes con selector, impacto, foco, errores y ausencia de salida simple.
- E2E aislado en desktop y mobile para recurrencias, compra en un pago, cuotas,
  pago de resumen, revisión de cuota y Deshacer.
