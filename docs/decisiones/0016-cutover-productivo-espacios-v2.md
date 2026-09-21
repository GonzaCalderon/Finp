# 0016 — Cutover productivo de Espacios v2

> Estado: aceptada
> Fecha: 2026-09-21
> Audiencia: producto, arquitectura, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0016
> Responsables: Gonzalo Calderon (prompter)
> Ámbito: datos y operaciones
> Relación: levanta el límite productivo conservado por la decisión 0011

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Consecuencias](#5-consecuencias)
6. [Verificación](#6-verificación)
7. [Referencias](#7-referencias)

## 1. Contexto y problema

La documentación conservaba el `NO-GO` productivo de la decisión 0011 aunque
el cutover productivo ya fue ejecutado. El código también reconoce `finm` como
destino escribible de Espacios v2. Mantener la restricción documental hacía
aparecer una migración futura que ya no existe y bloqueaba artificialmente la
promoción de `dev` a `main`.

El 2026-09-21 el prompter confirmó el estado operativo externo: el cutover
productivo está realizado. Esta decisión registra ese hecho sin volver a
ejecutar migraciones ni efectuar escrituras sobre producción.

## 2. Restricciones

- No se incorporan secretos, URIs, identificadores ni reportes privados al
  repositorio.
- La promoción de código no repite el cutover ni modifica datos productivos.
- El aislamiento de `finp-e2e` y sus barreras contra bases no exclusivas se
  mantienen sin cambios.
- La decisión 0011 conserva el historial y la evidencia del mecanismo de
  migración; sólo queda reemplazado su límite frente a producción.

## 3. Opciones consideradas

### A — Mantener el `NO-GO` documental

Se rechaza porque contradice el estado operativo confirmado y crea un pendiente
inexistente antes de cada promoción.

### B — Reconocer el cutover ya ejecutado

Se acepta. Alinea roadmap, estado actual y operación sin repetir una acción
destructiva ni inventar evidencia que no está versionada.

## 4. Decisión

Se reconoce como ejecutado el cutover productivo de Espacios v2. Desde esta
decisión:

- una promoción `dev` → `main` no requiere otro cutover;
- producción puede usar el contrato v2 ya migrado;
- CI E2E continúa requiriendo una credencial separada y limitada a `finp-e2e`,
  configurada directamente como `MONGODB_URI_TEST`.

## 5. Consecuencias

### Positivas

- La documentación vuelve a representar el estado operativo real.
- La promoción queda condicionada por calidad del código y CI, no por una
  migración ya realizada.
- No se amplía la lista de bases admitidas ni se debilitan las barreras E2E.

### Negativas o costos

- La evidencia detallada de la ejecución productiva permanece fuera del
  repositorio; esta decisión registra la confirmación del responsable, no un
  nuevo ensayo.

### Seguimiento

- Conservar verdes los recorridos financieros y el build antes de promover.
- Mantener rollback y observabilidad como prácticas operativas permanentes.

## 6. Verificación

- Confirmación del prompter el 2026-09-21 de que el cutover productivo ya está
  ejecutado.
- `space-v2-write-gate.ts` reconoce `finm` y falla cerrado para destinos no
  enumerados.
- Esta entrega no conecta ni escribe sobre producción.

## 7. Referencias

- [`0010 — Migración progresiva de Espacios v2`](0010-migracion-progresiva-espacios-v2.md).
- [`0011 — Cutover de Espacios v2 en development`](0011-cutover-espacios-v2-en-development.md).
