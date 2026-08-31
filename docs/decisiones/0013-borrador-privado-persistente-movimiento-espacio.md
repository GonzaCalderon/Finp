# 0013 — Borrador privado persistente de movimiento de Espacio

> Estado: aceptada
> Fecha: 2026-08-30
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0013
> Responsables: prompter y equipo Finp
> Ámbito: producto, arquitectura, datos, privacidad y experiencia

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Modelo y ciclo de vida](#5-modelo-y-ciclo-de-vida)
6. [Experiencia y recuperación](#6-experiencia-y-recuperación)
7. [Consecuencias](#7-consecuencias)
8. [Verificación](#8-verificación)
9. [Referencias](#9-referencias)

## 1. Contexto y problema

Completar un gasto compartido puede requerir participantes, reparto,
cotizaciones, categoría, impacto personal y adjuntos. Cerrar el diálogo, cambiar
de dispositivo o sufrir un error no debe obligar a repetir esa carga.

El borrador actual vive en almacenamiento de sesión y sus variantes no comparten
una identidad canónica. No aparece en Movimientos, puede perderse al cerrar la
sesión y no permite recuperar adjuntos ni coordinar ediciones desde más de un
cliente. Como contiene información financiera incompleta, tampoco puede
tratarse como un movimiento colaborativo visible para el resto del Espacio.

## 2. Restricciones

- El borrador pertenece sólo a su autor, aunque un `owner` administre el Espacio.
- Debe sobrevivir al cierre del diálogo, navegación, sesión y cambio de
  dispositivo.
- Existe como máximo un borrador activo de nuevo gasto por usuario y Espacio.
- Debe verse en Movimientos únicamente para su autor y con estado inequívoco.
- No modifica balances, actividad, deudas, impactos, pendientes ni
  notificaciones hasta publicarse.
- Los importes, monedas, fecha, reparto y cotizaciones usan el mismo contrato v2
  que la confirmación; no existe un segundo formato financiero.
- Los adjuntos deben ser privados, autorizados y recuperables ante fallos.
- Publicar debe ser atómico e idempotente para todos los efectos financieros.
- La solución debe reutilizar MongoDB, Vercel Blob y servicios existentes; no
  introduce cola, realtime ni una dependencia nueva sin necesidad demostrada.

## 3. Opciones consideradas

### Opción A — Conservar `sessionStorage`

Es simple y rápido, pero no cumple persistencia, multi-dispositivo, listado ni
recuperación de adjuntos. Se rechaza para este recorrido.

### Opción B — Guardar un `SpaceEntry` incompleto

Permite reutilizar la colección y el listado, pero mezcla estados privados con
la fuente compartida, obliga a excluir borradores de todos los cálculos y puede
exponer información incompleta. Se rechaza.

### Opción C — Recurso privado `SpaceEntryDraft`

Una entidad separada, autorizada por autor y Espacio, conserva la intención
incompleta. Al publicar, el servicio valida la última revisión, crea el
movimiento compartido y cierra el borrador. Se acepta.

## 4. Decisión

Se adopta la opción C.

1. `SpaceEntryDraft` es la única fuente persistente del borrador de un nuevo
   gasto de Espacio.
2. La clave única de borrador activo cubre `creatorUserId + spaceId + intent`.
   En esta etapa `intent` es `new_expense`.
3. La lectura, edición, descarte, adjuntos y publicación requieren al autor
   autenticado. La pertenencia o rol en el Espacio no concede lectura a otra
   persona.
4. Movimientos combina el historial compartido con el borrador privado sólo en
   el DTO del autor. El borrador se etiqueta `Borrador`, no parece confirmado y
   no se incluye en totales, filtros financieros ni actividad.
5. Abrir `Nuevo gasto` cuando ya existe uno activo lo reanuda. El usuario puede
   descartarlo con confirmación y empezar otro; no se crean dos en paralelo.
6. Cerrar el diálogo conserva el borrador. Publicar o descartarlo termina su
   estado activo de forma explícita; no hay vencimiento ni borrado silencioso.

## 5. Modelo y ciclo de vida

El recurso conserva, como mínimo:

- identidad, autor, Espacio e intención;
- `contractVersion`, `revision`, creación y última modificación;
- paso actual y campos parciales del contrato v2;
- `dateKey` civil y zona horaria del Espacio;
- importes mediante `MoneyDto` y cotizaciones mediante snapshots o referencias
  revisables;
- pagador, participantes, reparto, categoría compartida y opciones avanzadas;
- intención privada del autor para Mi Finp, sin exponer cuenta o categoría;
- metadata autorizada de adjuntos en preparación;
- estado `active`, `publishing`, `published` o `discarded`;
- clave estable de publicación e identidad del movimiento resultante.

Un borrador puede ser parcial e inválido para publicar. El guardado valida forma,
propiedad y límites seguros, pero la publicación ejecuta todas las reglas de
dominio sobre la última `revision` esperada. Si otro cliente guardó una revisión
nueva, devuelve conflicto y obliga a recargar; no aplica último escritor.

La publicación:

1. autoriza al creador y su capacidad vigente en el Espacio;
2. valida contrato, referencias, archivos y revisión esperada;
3. usa una clave idempotente estable del borrador;
4. crea en una sesión MongoDB el movimiento, actividad, balances, deudas,
   impacto/transacción privada y pendientes que correspondan;
5. enlaza el resultado y marca el borrador como `published`;
6. devuelve el mismo resultado ante un reintento equivalente.

La preparación del archivo puede ocurrir antes de la sesión financiera porque
el binario vive en Blob. Su metadata permanece asociada al borrador hasta que la
publicación confirme el movimiento. Si la carga o la confirmación falla, el
archivo sigue recuperable desde el borrador; publicar o descartar finaliza o
limpia la relación de forma idempotente. Un archivo huérfano nunca convierte un
movimiento parcial en éxito.

## 6. Experiencia y recuperación

- El diálogo muestra `Guardando…`, `Guardado` o `No se pudo guardar` sin ocultar
  los datos locales todavía editables.
- El autosave agrupa cambios razonablemente y nunca bloquea escritura por cada
  tecla. Cambiar de paso y cerrar fuerza un intento final seguro.
- Ante un fallo, ofrece reintentar y conserva la última versión local hasta
  confirmar la persistida.
- La card privada de Movimientos muestra descripción disponible, importe si es
  válido, última edición y acción `Continuar`.
- Si falta permiso para publicar porque el Espacio se pausó, cerró o cambió la
  membresía, el autor puede ver o descartar el borrador y recibe una explicación;
  no se fuerza una publicación ni se expone a administradores.
- Una confirmación exitosa reemplaza la card de borrador por el movimiento
  compartido sin duplicar ambos elementos.
- Mobile y desktop recuperan el mismo recurso y el mismo paso, con foco útil,
  CTA sobre `safe area` y monto final sin abreviación.

## 7. Consecuencias

### Positivas

- La carga sobrevive a cierres, errores y cambio de dispositivo.
- La privacidad no depende de filtros visuales sobre movimientos incompletos.
- Publicación, reintento y adjuntos tienen una identidad recuperable.
- El mismo contrato exacto alimenta guardado, preview y confirmación.

### Negativas o costos

- Se agrega una colección, índices, endpoints y política de autorización.
- Autosave y multi-cliente requieren revisión optimista y estados visibles.
- Los adjuntos necesitan ciclo de preparación, finalización y limpieza.
- El listado debe componer una card privada sin alterar paginación ni totales
  compartidos.

### Seguimiento

La implementación se divide entre persistencia del borrador, adjuntos
recuperables y cierre de experiencia dentro de FINP-P1-013. FINP-P2-007 puede
mostrar borradores en una futura bandeja diaria, pero no es dependencia ni
fuente de verdad de este recorrido.

Nivel de aprendizaje: `no aplica`. Finp observa estados técnicos de guardado,
pero no aprende ni completa monto, moneda, fecha, pagador, reparto o impacto.

## 8. Verificación

- Modelo y API: unicidad, aislamiento horizontal, roles, validación parcial,
  revisión optimista, publicación idempotente y estados terminales.
- Integración: publicar confirma una sola unidad financiera; cualquier fallo
  revierte el movimiento y conserva el borrador activo.
- Adjuntos: tipo/tamaño/autorización, carga fallida, reintento, publicación,
  descarte y limpieza idempotente.
- Componentes: autosave, error recuperable, reanudación, descarte, foco, labels
  y estados anunciados accesiblemente.
- E2E mobile y desktop: cerrar y volver, cerrar sesión, cambiar de dispositivo,
  conflicto entre clientes, ver sólo el borrador propio y reemplazarlo por un
  único movimiento al publicar.
- Privacidad: participante, `admin` y `owner` ajenos no pueden enumerar, leer,
  editar, publicar ni descargar adjuntos del borrador.

## 9. Referencias

- [`AGENTS.md`](../../AGENTS.md), invariantes de privacidad, idempotencia y
  recuperación.
- [`0008 — Modelo y consistencia financiera de Espacios`](0008-modelo-consistencia-financiera-espacios.md).
- [`Espacios`](../producto/espacios.md), comportamiento y experiencia esperada.
- [`Arquitectura técnica`](../tecnico/arquitectura.md), capas, persistencia y
  autorización.
- [`Roadmap`](../producto/roadmap_finp.md), prioridad y etapas de implementación.
