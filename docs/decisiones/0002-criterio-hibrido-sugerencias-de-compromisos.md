# 0002 — Criterio híbrido para sugerencias de compromisos

> Estado: aceptada
> Fecha: 2026-07-25
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0002
> Responsables: Finp
> Ámbito: producto, aprendizaje, arquitectura y datos

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Consecuencias](#5-consecuencias)
6. [Caso de control](#6-caso-de-control)
7. [Verificación](#7-verificación)
8. [Referencias](#8-referencias)

## 1. Contexto y problema

Una regla basada sólo en tres meses similares produce falsos positivos cuando
el gasto es ocasional o el monto varía demasiado. El caso observado fue
`Pizza`: tres meses, un movimiento por mes y 52 % de variación. La recurrencia
temporal existía, pero la señal no era suficiente para tratarla como compromiso.

## 2. Restricciones

- Una sugerencia nunca crea un compromiso automáticamente.
- Los descartes deben persistir.
- El criterio tiene que ser explicable y determinista.
- No se incorporan modelos externos, jobs ni costo operativo adicional.
- La categoría aporta contexto, pero no reemplaza la evidencia temporal.

## 3. Opciones consideradas

### Opción A — Tres meses para todos los patrones

Es simple, pero confunde coincidencia con recurrencia y acepta demasiados gastos
ocasionales.

### Opción B — Aumentar el mínimo para todos

Reduce falsos positivos, pero demora innecesariamente servicios y suscripciones
con monto estable.

### Opción C — Evidencia híbrida

Combina duración, cobertura, estabilidad, categoría y recurrencia mensual. Es
más estricta con montos variables y gastos ocasionales sin ocultar patrones
estables de alta afinidad.

## 4. Decisión

Se adopta la opción C:

- monto estable, con variación de hasta 10 %: al menos tres meses;
- monto variable: al menos cinco meses;
- cobertura mínima de 75 % entre el primer y el último mes observados;
- como máximo un movimiento coincidente por mes;
- confianza mínima de 0,82, calculada con recurrencia, estabilidad y categoría;
- Servicios, Suscripciones, Educación, Hogar, Impuestos y Préstamos reciben una
  bonificación de afinidad;
- Restaurantes y delivery, Supermercado, Indumentaria, Viajes y Otros gastos
  reciben una penalización;
- seis o más repeticiones pueden compensar la penalización de categoría;
- el rechazo se presenta como `No es un compromiso` y se conserva de forma
  persistente.

La confianza sirve como umbral de presentación. No se expone como una certeza
ni autoriza una escritura.

## 5. Consecuencias

### Positivas

- Disminuyen los falsos positivos de hábitos ocasionales.
- Los servicios estables continúan apareciendo desde el tercer mes.
- Las sugerencias variables necesitan evidencia más prolongada.
- La explicación conserva cantidad, cobertura, variación, día y categoría.

### Negativas o costos

- Algunos compromisos nuevos se sugerirán más tarde.
- La clasificación de categorías requiere mantenimiento si cambia el catálogo.
- El umbral necesita validación con datos reales antes de considerarse definitivo.

## 6. Caso de control

`Pizza`, tres meses, 52 % de variación y categoría Restaurantes y delivery no
debe mostrarse. Falla el mínimo de cinco meses para monto variable y además
recibe penalización de categoría.

## 7. Verificación

- Unit test del caso Pizza.
- Unit test de un servicio estable durante tres meses.
- Unit test de una recurrencia variable durante cinco meses.
- Tests de cobertura insuficiente, categoría penalizada y descarte persistente.
- Endpoint autenticado, sin caché y sin creación automática.

## 8. Referencias

- [`../producto/especificacion_funcional.md`](../producto/especificacion_funcional.md), aprendizaje y consentimiento.
- [`../producto/compromisos_espacios_y_proyeccion.md`](../producto/compromisos_espacios_y_proyeccion.md), recurrencia y proyección.
- [`../producto/criterio_entrega_motores_y_automatizaciones.md`](../producto/criterio_entrega_motores_y_automatizaciones.md), condiciones de entrega.
