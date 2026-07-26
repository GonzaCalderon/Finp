# 0003 — Borrado explícito de pagos duales

> Estado: aceptada
> Fecha: 2026-07-26
> Audiencia: producto, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0003
> Responsables: Finp
> Ámbito: transacciones, tarjetas, persistencia y experiencia

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Consecuencias](#5-consecuencias)
6. [Compatibilidad y reparación](#6-compatibilidad-y-reparación)
7. [Verificación](#7-verificación)

## 1. Contexto y problema

Un pago de tarjeta puede registrar una parte en ARS y otra en USD. Ambas
transacciones comparten `paymentGroupId`, pero cada una conserva su moneda,
cuenta y efecto. Borrar una parte sin explicar el alcance podía dejar un grupo
huérfano; borrar ambas por inferencia podía eliminar dinero que el usuario
quería conservar.

## 2. Restricciones

- ARS y USD no se convierten ni se suman para decidir.
- Cada transacción mantiene su historial y efecto de cuenta.
- El comportamiento anterior de borrado individual debe seguir disponible.
- Una relación ambigua no autoriza una eliminación implícita.
- La reparación de datos existentes no se ejecuta automáticamente.

## 3. Opciones consideradas

### Opción A — Borrar siempre una sola parte

Es compatible, pero no permite expresar la intención habitual de eliminar el
pago completo y deja vínculos sin significado.

### Opción B — Borrar siempre el grupo

Mantiene el vínculo, pero amplía una acción destructiva sin consentimiento.

### Opción C — Elegir el alcance

La confirmación presenta las partes y permite `Sólo esta parte` o `El pago
completo (ARS + USD)`.

## 4. Decisión

Se adopta la opción C:

- `DELETE /api/transactions/:id` acepta `scope=single|group`;
- el valor por defecto es `single` para preservar compatibilidad;
- `GET /api/transactions/:id` devuelve, cuando corresponde,
  `paymentGroup: { id, members }`;
- la interfaz muestra monto y moneda de cada parte antes de confirmar;
- borrar una sola parte conserva la otra y normaliza el grupo restante;
- borrar el grupo procesa el teardown de cada miembro y elimina sólo recursos
  del usuario autenticado.

## 5. Consecuencias

### Positivas

- La acción destructiva coincide con una intención explícita.
- Un pago dual deja de depender de inferencias ocultas.
- Los grupos con menos de dos miembros no persisten como relaciones válidas.
- La API sigue aceptando clientes que no envían `scope`.

### Costos y límites

- La confirmación requiere una lectura adicional del grupo.
- El borrado grupal actual coordina varias escrituras sin una sesión MongoDB
  transaccional; cada teardown es idempotente, pero un fallo intermedio debe ser
  observable y reintentable.

## 6. Compatibilidad y reparación

Los datos existentes no se migran al desplegar. `npm run
repair:payment-groups` detecta grupos con menos de dos miembros y propone
limpiar el identificador. Es `dry-run` por defecto; `--apply` requiere base
identificada, revisión del resultado y autorización.

## 7. Verificación

- Tests del copy y composición de miembros.
- Tests de normalización con cero, uno y dos miembros.
- Pruebas del teardown de relaciones derivadas.
- Typecheck, lint, suite unitaria y build.

