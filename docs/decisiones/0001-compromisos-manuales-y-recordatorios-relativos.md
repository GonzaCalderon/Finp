# 0001 — Compromisos manuales y recordatorios relativos

> Estado: aceptada
> Fecha: 2026-07-25
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0001
> Responsables: Finp
> Ámbito: producto, diseño, arquitectura y datos

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Consecuencias](#5-consecuencias)
6. [Verificación](#6-verificación)
7. [Referencias](#7-referencias)

## 1. Contexto y problema

Compromisos exponía `Preparado para automatización` aunque no existía scheduler.
El día mensual aceptaba texto numérico libre, el formulario mezclaba
configuración e historia, y no había una regla clara para recordar vencimientos
o conservar compromisos terminados.

## 2. Restricciones

- Ningún gasto se registra sin confirmación mientras no exista automatización completa.
- Las aplicaciones históricas conservan snapshot.
- Mobile web es la superficie principal.
- Los recordatorios no pueden depender de push, service worker ni jobs inexistentes.
- Los datos legacy con `auto_month_start` deben seguir siendo legibles.

## 3. Opciones consideradas

### Opción A — Mantener el modo futuro visible

Conserva la configuración anticipada, pero promete una capacidad inexistente y
deja compromisos esperando una ejecución que nunca ocurre.

### Opción B — Aplicación manual y recordatorio absoluto

Evita la promesa falsa, pero elegir otro día del mes duplica la regla de
vencimiento y falla para meses cortos.

### Opción C — Aplicación manual y recordatorio relativo

Oculta la automatización hasta que sea entregable. El usuario elige cuántos días
antes quiere ser avisado y Finp deriva la fecha desde el vencimiento compartido.

## 4. Decisión

Se adopta la opción C:

- toda alta nueva usa aplicación manual;
- valores legacy se presentan como manuales sin migración destructiva;
- el vencimiento mensual usa selector 1–31 y se ajusta al último día del mes;
- la primera ocurrencia siempre es igual o posterior a `startDate`: por ejemplo,
  inicio 25/07 y día 3 produce vencimiento 03/08;
- el recordatorio persiste `reminderLeadDays` y se deriva al leer; puede caer en
  el mes anterior y, sólo para la primera ocurrencia, se limita a `startDate`;
- una ocurrencia anterior al inicio no se proyecta ni se presenta como pendiente;
- la primera entrega es in-app mediante Compromisos y `nav-insights`;
- alta y edición usan tres pasos;
- la agenda de montos es una superficie separada;
- el ciclo de vida se deriva y la historia no se elimina al finalizar.

## 5. Consecuencias

### Positivas

- La interfaz no promete automatización inexistente.
- Vencimiento, próxima ocurrencia y recordatorio comparten una única utilidad de
  dominio; las APIs sólo exponen fechas derivadas.
- No se crean jobs, polling ni costo operativo nuevo.
- Finalizados y desactivados siguen auditables.
- El formulario mobile reduce carga cognitiva.

### Negativas o costos

- Los recordatorios sólo aparecen cuando el usuario entra a Finp.
- `auto_month_start` permanece temporalmente en contratos legacy.
- Los compromisos semanales no tienen recordatorio relativo en esta versión.

### Seguimiento

- `FINP-P4-002` define las condiciones para reintroducir automatización.
- Push/PWA se evalúa sólo con la estrategia de plataforma correspondiente.

## 6. Verificación

- Unit tests de meses cortos, año bisiesto, primera ocurrencia, recordatorios
  entre meses y candidatos.
- Tests de API para validación, modo manual y sugerencias autenticadas.
- Test de componente para monto vigente, historial y acción de actualización.
- E2E existente de Captura rápida actualizado para el flujo guiado mobile/desktop.

## 7. Referencias

- [`../../design.md`](../../design.md), formularios financieros y mobile-first.
- [`../producto/criterio_entrega_motores_y_automatizaciones.md`](../producto/criterio_entrega_motores_y_automatizaciones.md), control y llegada completa.
- [`../tecnico/arquitectura.md`](../tecnico/arquitectura.md), snapshots, estados derivados y automatización.
