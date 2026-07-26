# Estándar de documentación de Finp

> Estado: vigente
> Audiencia: personas y agentes que crean o modifican documentación
> Última actualización: 2026-07-26
> Fuente de verdad: proceso documental

## Índice

1. [Objetivo](#1-objetivo)
2. [Principios](#2-principios)
3. [Tipos de documento](#3-tipos-de-documento)
4. [Estructura obligatoria](#4-estructura-obligatoria)
5. [Índices y navegación](#5-índices-y-navegación)
6. [Fuentes de verdad](#6-fuentes-de-verdad)
7. [Estados y ciclo de vida](#7-estados-y-ciclo-de-vida)
8. [Cómo escribir](#8-cómo-escribir)
9. [Fuentes externas](#9-fuentes-externas)
10. [Decisiones de otros sistemas](#10-decisiones-de-otros-sistemas)
11. [Documentación en una entrega](#11-documentación-en-una-entrega)
12. [Costo de contexto](#12-costo-de-contexto)
13. [Comprobación](#13-comprobación)
14. [Referencias adoptadas](#14-referencias-adoptadas)

## 1. Objetivo

La documentación de Finp debe permitir:

- encontrar rápidamente la fuente correcta;
- entender el comportamiento actual y esperado;
- desarrollar sin romper decisiones previas;
- distinguir realidad, propuesta, prioridad e historia;
- conservar el porqué de decisiones importantes;
- reducir el contexto que necesita cargar una persona o agente.

Documentar no es copiar el código. Es explicar propósito, contratos, decisiones, invariantes, operación y límites.

## 2. Principios

### Una fuente de verdad

Cada tema tiene un único documento canónico. Otros documentos resumen y enlazan; no mantienen versiones paralelas.

### Documentación junto al cambio

La documentación se actualiza en la misma entrega que modifica el comportamiento. Una tarea no está terminada si deja su fuente canónica desactualizada.

### Presente separado de futuro

- Especificación: qué debe hacer el producto.
- Estado actual: qué existe y está validado.
- Roadmap: qué falta, prioridad y criterio de cierre.
- Decisiones: por qué se eligió un camino.
- Archivo: qué se pensaba o hacía antes.

### Precisión antes que volumen

Preferir una definición clara y enlazada a repetir la misma explicación en varios lugares. Eliminar texto que ya no ayuda a tomar una decisión o ejecutar una tarea.

### Progresión de detalle

El lector empieza en `docs/README.md`, recibe una síntesis y profundiza sólo en el documento necesario.

### Declarar la excepción, no el valor por defecto

Cuando una regla tiene un caso mayoritario, se documenta sólo lo que se aparta de
él. Un campo repetido en todos los ítems de una lista cuesta contexto en cada
lectura y no informa nada; la ausencia del campo debe significar el caso normal.
El roadmap aplica esto con `Requiere:`.

## 3. Tipos de documento

Finp adapta el marco Diátaxis:

| Tipo | Responde | Ejemplo en Finp |
|---|---|---|
| Tutorial | ¿Cómo aprendo mediante un recorrido guiado? | Onboarding técnico futuro. |
| Procedimiento | ¿Cómo ejecuto una tarea concreta? | Backfill o preparación E2E. |
| Referencia | ¿Cuál es el contrato exacto? | Modelo, API, estados o validación. |
| Explicación | ¿Por qué funciona así? | Arquitectura funcional o decisión. |

Un documento puede enlazar otro tipo, pero debe declarar su propósito principal y evitar mezclar instrucciones operativas con visión o backlog.

## 4. Estructura obligatoria

Todo documento vigente incluye:

```markdown
# Título

> Estado: vigente | borrador | reemplazado | archivado
> Audiencia: ...
> Última actualización: YYYY-MM-DD
> Fuente de verdad: tema o "no"

## Índice
...
```

Después:

1. objetivo y alcance;
2. contenido propio del documento;
3. límites o fuera de alcance cuando sean relevantes;
4. documentos relacionados;
5. fuentes externas, si se usaron.

Un documento histórico conserva su fecha original y agrega cuándo y por qué fue archivado.

## 5. Índices y navegación

### Índice general

`docs/README.md` lista todos los documentos vigentes con:

- propósito;
- audiencia o tarea;
- estado;
- ruta.

Agregar, mover, reemplazar o archivar un documento exige actualizar ese índice.

### Índice interno

Todo documento tiene una tabla de contenidos que refleja sus encabezados principales. Debe actualizarse al cambiar la estructura.

### Enlaces

- Usar enlaces relativos dentro del repositorio.
- Enlazar la fuente canónica, no un redirect.
- Evitar enlaces a líneas porque cambian con frecuencia.
- El texto del enlace debe explicar el destino.
- No enlazar documentos archivados como instrucción vigente.

## 6. Fuentes de verdad

Antes de escribir:

1. identificar el documento canónico;
2. revisar código y pruebas;
3. verificar si existe una decisión relacionada;
4. determinar qué parte es realidad y cuál es intención.

Si no existe fuente canónica, crearla en la categoría correcta y registrarla en el índice. No crear un documento temporal por fecha salvo que sea un informe histórico destinado a archivarse.

Los números volátiles —cantidad de tests, versiones, rutas o métricas— deben derivarse del repositorio cuando sea posible o indicar fecha de verificación.

## 7. Estados y ciclo de vida

### Vigente

Fuente activa que debe mantenerse con el producto.

### Borrador

Propuesta aún no aprobada o no implementada. No puede presentarse como comportamiento disponible.

### Reemplazado

Contenido sustituido por otra fuente. Conserva un enlace claro al reemplazo y luego puede archivarse.

### Archivado

Material histórico. No dirige desarrollo ni prioridad.

Proceso:

```text
borrador → vigente → reemplazado → archivado
```

No mantener dos documentos vigentes con el mismo alcance.

## 8. Cómo escribir

- Español claro, directo y consistente.
- Una idea por párrafo.
- Encabezados descriptivos.
- Listas para criterios verificables, no para fragmentar prosa innecesariamente.
- Términos del producto con la misma capitalización: Finp, Espacios, Deudas, Captura rápida y Compromisos.
- Explicar resultado y regla antes que detalles de implementación.
- Usar ejemplos cuando eliminen ambigüedad.
- Distinguir `implementado`, `validado`, `diseñado`, `priorizado`, `diferido` y `fuera de alcance`.
- Evitar “pronto”, “después” o “actualmente” sin fecha o estado.
- No usar comentarios de código para reemplazar documentación de arquitectura.
- No documentar líneas obvias; documentar contratos, límites y motivos.

## 9. Fuentes externas

Se permiten y promueven fuentes externas cuando:

- la información puede haber cambiado;
- se evalúa una librería, plataforma o estándar;
- seguridad, accesibilidad, rendimiento o normativa requieren precisión;
- se compara una decisión de producto o arquitectura.

Orden de preferencia:

1. estándar u organismo responsable;
2. documentación oficial del producto o biblioteca;
3. publicación técnica del autor o mantenedor;
4. investigación académica relevante;
5. caso de estudio reputado y verificable;
6. fuente secundaria, sólo como complemento.

Toda referencia incluye:

- enlace directo;
- fecha de consulta si el contenido es cambiante;
- qué afirmación respalda;
- versión cuando corresponda;
- aplicación concreta a Finp.

No copiar fragmentos extensos. Resumir y atribuir.

## 10. Decisiones de otros sistemas

Una práctica exitosa de otro sistema puede orientar, pero no decidir por Finp.

Registrar:

1. sistema y fuente;
2. problema resuelto;
3. evidencia disponible;
4. similitudes con Finp;
5. diferencias y restricciones;
6. alternativas locales;
7. riesgos de adopción;
8. decisión de Finp y consecuencias.

Las comparaciones duraderas se guardan como decisión en `docs/decisiones/`.

## 11. Documentación en una entrega

Antes de cerrar un cambio:

| Cambio | Documentación mínima |
|---|---|
| Nueva función | Especificación, estado actual, dominio y roadmap |
| Cambio visual | `design.md` si crea o modifica un patrón |
| Nuevo patrón técnico | Arquitectura, guía o decisión |
| Cambio de prioridad | Roadmap |
| Migración o backfill | Guía técnica u operativa |
| Nueva dependencia relevante | Decisión y guía técnica si crea precedente |
| Corrección sin cambio contractual | Estado o backlog sólo si modifica un pendiente declarado |
| Eliminación o reemplazo | Fuente canónica, índice y archivo histórico |

La descripción de una entrega debe indicar:

- documentos actualizados;
- decisiones nuevas;
- fuentes externas usadas;
- pendientes agregados, modificados o cerrados en el roadmap.

## 12. Costo de contexto

La documentación se paga en cada lectura. Un documento que nadie puede permitirse
cargar no cumple su función, así que el costo es parte de la calidad y no una
optimización posterior.

### Camino obligatorio y camino opcional

No todos los documentos cuestan lo mismo:

| Camino | Documentos | Regla |
|---|---|---|
| Obligatorio | [`../../AGENTS.md`](../../AGENTS.md), [`../README.md`](../README.md) y [`../producto/roadmap_finp.md`](../producto/roadmap_finp.md) | Se leen en toda tarea. Todo agregado se paga siempre: exigir justificación y compensar recortando. |
| Opcional | dominio, técnico, calidad y decisiones | Se leen sólo cuando la tarea los toca. Pueden ser extensos si están bien indexados. |

Medir antes de recortar. `Get-ChildItem docs -Recurse -Filter *.md` con el tamaño
de cada archivo alcanza para saber dónde está el costo; recortar por intuición
suele borrar lo valioso y dejar lo repetido.

### Qué se borra

Se elimina el contenido que ya no cambia una decisión ni habilita una tarea:

- lo que Git o `docs/archivados/` ya conservan, en especial historial cerrado;
- lo que el código expresa mejor, salvo el contrato, el límite y el motivo;
- la misma explicación repetida en dos documentos vigentes: queda en el canónico y
  el otro enlaza;
- una intención diferida sin dueño ni disparador: o se convierte en ítem del
  roadmap con criterio, o se borra;
- una nota fechada cuyo plazo ya pasó.

Borrar de un archivo versionado no pierde información: Git la conserva. Dejar
contenido muerto en el camino obligatorio, en cambio, se paga en cada sesión.

### Mejora continua

Toda entrega deja la documentación al menos tan barata de leer como estaba. Si
agrega texto al camino obligatorio, compensa recortando ahí mismo o justifica por
qué ese costo permanente se gana.

Cuando trabajar desde la documentación cueste esfuerzo evitable, la fricción se
corrige en la misma entrega en lugar de anotarse para después. Los síntomas que
obligan a revisar el proceso, no sólo el texto, son:

- el ejecutor tuvo que deducir el alcance, la prioridad o el próximo paso;
- un documento prometía trabajo que no se podía tomar;
- una condición de cierre pedía algo que el repositorio no puede correr;
- dos fuentes vigentes decían cosas distintas;
- hizo falta explorar el código para responder algo que la documentación debía
  contestar.

Quien detecta el síntoma corrige la regla que lo permitió, no sólo el caso. Si la
corrección cambia cómo se trabaja, se registra en este documento o en
[`../../AGENTS.md`](../../AGENTS.md) según corresponda; si tiene alternativas
relevantes, se registra como decisión.

## 13. Comprobación

Revisión mínima:

- el documento está en el índice general;
- su índice interno coincide con los encabezados;
- los enlaces relativos existen;
- no duplica backlog;
- estados actuales y futuros están separados;
- no contradice otra fuente vigente;
- las afirmaciones técnicas coinciden con código y pruebas;
- las fuentes externas son directas y confiables;
- el documento reemplazado fue marcado o archivado.

Cuando exista automatización documental, debe verificar como mínimo enlaces, archivos indexados, metadatos y estructura Markdown.

## 14. Referencias adoptadas

- [Diátaxis](https://diataxis.fr/): separación entre tutoriales, procedimientos, referencia y explicación.
- [Google Developer Documentation Style Guide](https://developers.google.com/style): claridad y consistencia para documentación técnica.
- [GitLab Documentation Style Guide](https://docs.gitlab.com/development/documentation/styleguide/): documentación como fuente única de verdad mantenida con el producto.
- [arc42](https://arc42.org/): estructura pragmática para comunicar arquitectura.
- [C4 Model](https://c4model.info/): diagramas en niveles de contexto, contenedores y componentes.
- [MADR](https://adr.github.io/madr/): decisiones breves con contexto, alternativas y consecuencias.

Consulta de referencias: 2026-07-25.
