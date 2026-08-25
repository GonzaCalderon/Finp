# Documentación de Finp

> Estado: vigente
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Última actualización: 2026-08-24
> Fuente de verdad: índice canónico de documentación

## Índice

1. [Cómo usar este índice](#1-cómo-usar-este-índice)
2. [Rutas de lectura](#2-rutas-de-lectura)
3. [Documentos canónicos](#3-documentos-canónicos)
4. [Documentos de dominio y funciones](#4-documentos-de-dominio-y-funciones)
5. [Decisiones](#5-decisiones)
6. [Documentación histórica](#6-documentación-histórica)
7. [Reglas de mantenimiento](#7-reglas-de-mantenimiento)

## 1. Cómo usar este índice

Este es el único punto de entrada a la documentación interna. No hace falta leer todo:

1. Elegir una ruta según la tarea.
2. Leer los documentos obligatorios de esa ruta.
3. Seguir enlaces sólo si el cambio afecta ese dominio.
4. Consultar el archivo histórico únicamente para reconstruir contexto.

Antes de modificar el repositorio, los agentes también deben leer [`../AGENTS.md`](../AGENTS.md).

## 2. Rutas de lectura

### Entender qué es Finp

1. [`producto/especificacion_funcional.md`](producto/especificacion_funcional.md)
2. [`producto/estado_actual_finp.md`](producto/estado_actual_finp.md)
3. [`producto/roadmap_finp.md`](producto/roadmap_finp.md)

### Diseñar o modificar una interfaz

1. [`../design.md`](../design.md)
2. [`producto/especificacion_funcional.md`](producto/especificacion_funcional.md)
3. Documento del dominio afectado.
4. [`calidad/plan_calidad_estabilizacion_finp.md`](calidad/plan_calidad_estabilizacion_finp.md)

### Modificar dominio, API, modelos o persistencia

1. [`tecnico/arquitectura.md`](tecnico/arquitectura.md)
2. [`tecnico/guia_desarrollo.md`](tecnico/guia_desarrollo.md)
3. Documento funcional del dominio.
4. Decisiones relacionadas.
5. [`calidad/plan_calidad_estabilizacion_finp.md`](calidad/plan_calidad_estabilizacion_finp.md)

### Trabajar con automatización o aprendizaje

1. [`producto/estrategia_ingreso_datos_y_automatizacion.md`](producto/estrategia_ingreso_datos_y_automatizacion.md)
2. [`producto/criterio_entrega_motores_y_automatizaciones.md`](producto/criterio_entrega_motores_y_automatizaciones.md)
3. [`producto/captura_rapida_como_orientador.md`](producto/captura_rapida_como_orientador.md), si afecta Captura rápida.
4. [`tecnico/arquitectura.md`](tecnico/arquitectura.md)

### Priorizar trabajo

1. [`producto/estado_actual_finp.md`](producto/estado_actual_finp.md)
2. [`producto/roadmap_finp.md`](producto/roadmap_finp.md)

No crear otro backlog.

### Crear o actualizar documentación

1. [`estandares/documentacion.md`](estandares/documentacion.md)
2. Documento canónico afectado.
3. [`decisiones/README.md`](decisiones/README.md), si se toma una decisión duradera.

## 3. Documentos canónicos

| Documento | Propósito | Cuándo leerlo |
|---|---|---|
| [`../AGENTS.md`](../AGENTS.md) | Estatuto obligatorio de desarrollo. | Antes de cualquier tarea. |
| [`../README.md`](../README.md) | Presentación, instalación y acceso a documentación. | Al ingresar al repositorio. |
| [`../design.md`](../design.md) | Sistema visual, interacción, responsive, animación y copy. | Todo cambio de interfaz. |
| [`producto/especificacion_funcional.md`](producto/especificacion_funcional.md) | Visión, conceptos, módulos, reglas y experiencia esperada. | Producto y comportamiento. |
| [`producto/estado_actual_finp.md`](producto/estado_actual_finp.md) | Alcance realmente implementado y validado. | Antes de diseñar o priorizar. |
| [`producto/roadmap_finp.md`](producto/roadmap_finp.md) | Backlog único, prioridades y dirección. | Planificación y cierre de tareas. |
| [`tecnico/arquitectura.md`](tecnico/arquitectura.md) | Estructura técnica, límites y fuentes de verdad. | Cambios técnicos o transversales. |
| [`tecnico/guia_desarrollo.md`](tecnico/guia_desarrollo.md) | Patrones de código, seguridad, errores, recursos, dependencias y Git. | Antes de implementar. |
| [`calidad/plan_calidad_estabilizacion_finp.md`](calidad/plan_calidad_estabilizacion_finp.md) | Estrategia de pruebas y criterios de entrega. | Al planificar verificación. |
| [`estandares/documentacion.md`](estandares/documentacion.md) | Estándar de documentación y uso de fuentes. | Al crear o editar documentos. |

## 4. Documentos de dominio y funciones

| Documento | Alcance | Estado |
|---|---|---|
| [`producto/arquitectura_funcional.md`](producto/arquitectura_funcional.md) | Relaciones entre dinero real, operacional, Espacios, Deudas y seguimiento. | Vigente; complemento conceptual. |
| [`producto/espacios.md`](producto/espacios.md) | Espacios, splits, balances, settlements, invitaciones e impacto personal. | Vigente. |
| [`producto/deudas.md`](producto/deudas.md) | Deudas manuales y derivadas, pagos, cobros y reporting. | Vigente. |
| [`producto/notificaciones.md`](producto/notificaciones.md) | Notificaciones, pendientes, revisión e insights. | Vigente. |
| [`producto/estrategia_ingreso_datos_y_automatizacion.md`](producto/estrategia_ingreso_datos_y_automatizacion.md) | Captura, reglas, aprendizaje, revisión y automatización. | Vigente. |
| [`producto/captura_rapida_como_orientador.md`](producto/captura_rapida_como_orientador.md) | Interpretación, orientación y transporte de intención. | Vigente. |
| [`producto/compromisos_espacios_y_proyeccion.md`](producto/compromisos_espacios_y_proyeccion.md) | Compromisos variables, Espacios, ajustes e impacto en proyección. | Vigente; contiene evolución futura. |
| [`producto/criterio_entrega_motores_y_automatizaciones.md`](producto/criterio_entrega_motores_y_automatizaciones.md) | Condiciones de entrega para motores y sugerencias. | Vigente. |
| [`tecnico/compromisos_variables_y_orientacion.md`](tecnico/compromisos_variables_y_orientacion.md) | Implementación de compromisos variables, orientación y Proyección. | Referencia técnica vigente. |

Los estados futuros de estos documentos no constituyen backlog. Toda prioridad debe registrarse en el roadmap.

## 5. Decisiones

[`decisiones/README.md`](decisiones/README.md) explica cuándo registrar una decisión y cómo usar referencias externas.

Decisiones vigentes:

- [`0001 — Compromisos manuales y recordatorios relativos`](decisiones/0001-compromisos-manuales-y-recordatorios-relativos.md).
- [`0002 — Criterio híbrido para sugerencias de compromisos`](decisiones/0002-criterio-hibrido-sugerencias-de-compromisos.md).
- [`0003 — Borrado explícito de pagos duales`](decisiones/0003-borrado-explicito-de-pagos-duales.md).
- [`0004 — Resumen bimonetario de tarjetas`](decisiones/0004-resumen-bimonetario-de-tarjetas.md).
- [`0005 — Captura rápida, tarjetas y handoffs tipados`](decisiones/0005-captura-rapida-tarjetas-y-handoffs.md).
- [`0006 — Período, clasificación y lectura de Proyección`](decisiones/0006-periodo-clasificacion-y-lectura-de-proyeccion.md).
- [`0007 — Autoridad entre Espacios, Mi Finp y Deudas`](decisiones/0007-autoridad-espacios-finp-deudas.md).
- [`0008 — Modelo y consistencia financiera de Espacios`](decisiones/0008-modelo-consistencia-financiera-espacios.md).
- [`0009 — Autoridad multimoneda de Espacios`](decisiones/0009-autoridad-multimoneda-espacios.md).

Una decisión se documenta cuando:

- cambia una fuente de verdad;
- elige entre alternativas con compromisos relevantes;
- agrega una dependencia estructural;
- modifica seguridad, privacidad o persistencia;
- establece un patrón que otros módulos deberán seguir;
- adopta o rechaza una tecnología.

## 6. Documentación histórica

[`archivados/`](archivados/) conserva planes, relevamientos y diseños reemplazados. Sirve para contexto histórico, no para determinar comportamiento ni prioridad.

## 7. Reglas de mantenimiento

- Todo documento tiene estado, audiencia, fecha, fuente de verdad e índice.
- Un concepto tiene una fuente canónica; los demás documentos enlazan.
- El roadmap es el único backlog.
- Una función nueva actualiza especificación, estado, roadmap y documentación técnica según corresponda.
- Una decisión duradera crea o actualiza un registro en `decisiones/`.
- Un documento reemplazado se archiva y deja un enlace desde el índice sólo si conserva valor histórico.
- No duplicar listas de pendientes en documentos de dominio.
- Ejecutar las comprobaciones documentales disponibles antes de cerrar una entrega.
