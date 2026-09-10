# 0013 — Borrador privado persistente de movimiento de Espacio

> Estado: aceptada
> Fecha: 2026-08-30
> Última actualización: 2026-09-09
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
6. [Etapa 3: contrato ejecutable de adjuntos](#6-etapa-3-contrato-ejecutable-de-adjuntos)
7. [Experiencia y recuperación](#7-experiencia-y-recuperación)
8. [Consecuencias](#8-consecuencias)
9. [Verificación](#9-verificación)
10. [Referencias](#10-referencias)

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

## 6. Etapa 3: contrato ejecutable de adjuntos

### 6.1 Resultado, alcance y límites

La etapa 3 reemplaza la carga posterior a la creación por una preparación
privada e inmediata sobre `SpaceEntryDraft`. Al terminarla, un archivo elegido
en `Nuevo gasto` sobrevive al cierre, navegación, sesión, cambio de dispositivo,
error de publicación y respuesta perdida. Sólo se vuelve parte del movimiento
cuando la publicación de ese borrador se confirma.

Incluye carga, lectura, reintento, eliminación lógica, publicación, descarte,
limpieza, recuperación de huérfanos y los estados de interfaz asociados. Reutiliza
Vercel Blob privado y el límite existente de cinco archivos por gasto, 10 MB por
archivo y formatos JPEG, PNG, WebP o PDF.

No incluye OCR, antivirus de terceros, extracción de contenido, comentarios,
versiones de un mismo archivo, acceso público, nuevos formatos, cuotas, realtime
ni una cola externa. Tampoco mueve físicamente el Blob al publicar: la ruta de
almacenamiento no concede permisos y no es una fuente de verdad de pertenencia.

### 6.2 Autoridad, identidad y metadata

MongoDB es la autoridad sobre propiedad, estado y relación. Vercel Blob conserva
únicamente el binario privado. Una URL, `pathname` o `storageKey` nunca autoriza
una lectura y no se serializa en DTO públicos.

Cada elemento persistido en `SpaceEntryDraft.attachments` conserva:

- `_id` estable, `uploadedByUserId` e `uploadIdempotencyKey` único dentro del
  borrador;
- `status`, nombre de presentación saneado, MIME detectado y tamaño confirmado;
- `contentSha256` calculado por el servidor para integridad y replay equivalente;
- proveedor y clave interna determinista de almacenamiento;
- creación, último intento, confirmación y eliminación cuando correspondan;
- código técnico acotado del último fallo, sin texto libre ni datos del archivo.

La clave interna usa IDs y extensión normalizada, no el nombre original. El
nombre visible se sanea y limita a 160 caracteres. La metadata publicada conserva
el mismo `_id`, autor, nombre, MIME, tamaño, `contentSha256` y `storageKey`; no
duplica el binario.

El DTO del borrador expone sólo `id`, `fileName`, `mimeType`, `size`, `status`,
`createdAt` y, para un fallo recuperable, un código público. No expone
`storageKey`, token, error interno ni identidad de otra persona. Los estados
`cleanup_pending` y `deleted` no se listan como archivos disponibles.

```ts
interface SpaceEntryDraftAttachmentDto {
    id: string
    fileName: string
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
    size: number
    status: 'preparing' | 'ready' | 'upload_failed'
    createdAt: string
    errorCode?: 'UPLOAD_FAILED' | 'RECOVERY_REQUIRED'
}

interface SpaceEntryDraftAttachmentMutationDto {
    draftRevision: number
    attachment?: SpaceEntryDraftAttachmentDto
    cleanupPending?: boolean
}
```

### 6.3 Estados y transiciones

Los estados persistentes son:

| Estado | Significado | Acciones permitidas |
|---|---|---|
| `preparing` | MongoDB reservó identidad y ruta; Blob aún no fue confirmado. | Reconciliar, reintentar o quitar. |
| `ready` | Binario y metadata coinciden; puede leerse y publicarse. | Leer, quitar o publicar. |
| `upload_failed` | El último intento no dejó un archivo publicable. | Reintentar con el archivo o quitar. |
| `cleanup_pending` | Ya no es visible ni publicable; falta confirmar el borrado físico. | Reintentar limpieza. |
| `deleted` | La limpieza terminó; queda sólo un tombstone técnico. | Ninguna acción del usuario. |

Las transiciones válidas son `preparing → ready`, `preparing → upload_failed`,
`upload_failed → preparing`, cualquier estado no publicado `→ cleanup_pending`
y `cleanup_pending → deleted`. No se vuelve de `ready` a `preparing` ni se
reactiva un elemento eliminado.

Los cinco lugares disponibles cuentan `preparing`, `ready` y `upload_failed`.
Una limpieza pendiente no bloquea una nueva selección. Publicar exige que todos
los elementos visibles estén `ready`; `preparing` o `upload_failed` bloquean la
acción con una explicación y `cleanup_pending` se ignora.

La interfaz puede usar estados efímeros `seleccionado`, `subiendo`, `error` y
`quitando`, pero no los presenta como persistidos hasta recibir el DTO del
servidor. El binario no se guarda en `localStorage`, `sessionStorage` ni dentro
del borrador MongoDB.

### 6.4 Contrato HTTP

Las rutas infieren al autor desde la sesión y trabajan exclusivamente sobre su
borrador activo del Espacio:

| Operación | Ruta | Contrato |
|---|---|---|
| Preparar | `POST /api/spaces/{spaceId}/entry-draft/attachments` | `multipart/form-data` con `file`, `draftId`, `expectedRevision` e `idempotencyKey`; devuelve adjunto y nueva revisión. |
| Reintentar | `PUT /api/spaces/{spaceId}/entry-draft/attachments/{attachmentId}` | Mismo archivo o reemplazo explícito para un elemento incompleto, con revisión esperada y la identidad existente. |
| Leer | `GET /api/spaces/{spaceId}/entry-draft/attachments/{attachmentId}` | Sólo entrega un elemento `ready`, con `private, no-store` y `nosniff`. |
| Quitar | `DELETE /api/spaces/{spaceId}/entry-draft/attachments/{attachmentId}` | Recibe `draftId` y `expectedRevision`; niega acceso inmediatamente y devuelve la revisión y estado de limpieza. |

`GET /entry-draft` incluye la lista autorizada para poder reanudar sin una
segunda fuente de verdad. `POST /entry-draft/publish` conserva su contrato y
rechaza con conflicto tipado si hay adjuntos sin resolver.

Una mutación equivalente con la misma `idempotencyKey` devuelve el resultado ya
creado y no consume otro lugar. Una clave reutilizada con contenido distinto se
rechaza. Toda mutación de metadata incrementa `revision`; el cliente coordina
autosave, carga, reintento y eliminación mediante una única cola y siempre adopta
la revisión devuelta por el servidor.

Errores distinguibles:

- `400` para identidad o metadata inválida;
- `413` para más de 10 MB y `415` para formato o firma no permitidos;
- `401` sin sesión y `404` para recurso inexistente o ajeno, sin permitir
  enumeración;
- `409` para revisión obsoleta, límite alcanzado, clave idempotente incompatible
  o publicación con archivos sin resolver;
- `503` cuando Blob no está configurado o disponible y `500` para un fallo
  interno inesperado.

La forma de error es `{ error, code, details? }`. Los códigos públicos de esta
etapa son `INVALID_ATTACHMENT`, `ATTACHMENT_TOO_LARGE`,
`ATTACHMENT_TYPE_NOT_ALLOWED`, `DRAFT_NOT_FOUND`,
`DRAFT_REVISION_CONFLICT`, `ATTACHMENT_LIMIT_REACHED`,
`IDEMPOTENCY_KEY_REUSED`, `ATTACHMENT_NOT_READY`, `STORAGE_UNAVAILABLE` e
`INTERNAL_ERROR`. `details` no incluye nombre, hash, clave interna ni información
que permita distinguir un recurso ajeno de uno inexistente.

El servidor valida tamaño, extensión normalizada, MIME declarado, firma real y
hash del archivo; no confía en nombre ni `Content-Type` del cliente. En las rutas
de borrador y movimiento, las imágenes pueden servirse `inline` y PDF se entrega
como descarga. El nombre de respuesta se sanea y todas las lecturas pasan por la
aplicación, nunca por una URL pública.

### 6.5 Autorización y privacidad

| Actor o estado | Enumerar/leer | Preparar/reintentar | Quitar/descartar | Publicar |
|---|---:|---:|---:|---:|
| Autor con capacidad vigente | Sí | Sí | Sí | Sí |
| Autor sin membresía o con Espacio pausado/cerrado | Sí | No | Sí | No |
| Otro participante, `admin` u `owner` | No | No | No | No |
| Servicio interno de limpieza | No obtiene contenido | No | Sólo metadata marcada para limpieza | No |

Después de publicar, dejan de aplicar las rutas privadas del borrador. La lectura
usa permisos del movimiento y la eliminación conserva la regla vigente: autor
del archivo, `admin` u `owner`. Preparar o borrar antes de publicar no crea
actividad compartida ni revela nombre, cantidad o existencia a otras personas.

### 6.6 Frontera transaccional y matriz de fallos

Vercel Blob no participa de la transacción MongoDB. La operación se ordena para
que cualquier éxito parcial permanezca privado, identificable y recuperable:

1. MongoDB reserva el adjunto como `preparing`, con ID, clave idempotente y ruta
   determinista, y aumenta la revisión.
2. El servidor carga el binario privado.
3. MongoDB confirma tamaño, MIME detectado y estado `ready`, y devuelve la última
   revisión.
4. Publicar copia en la misma transacción MongoDB toda metadata `ready` al nuevo
   `SpaceEntry`, conserva los mismos IDs y marca el borrador `published`.
5. No hay escritura, movimiento ni borrado en Blob durante la publicación.

| Punto de fallo | Estado durable | Recuperación obligatoria |
|---|---|---|
| Falla la reserva | No existe adjunto ni Blob. | Reintentar sin consumir lugar. |
| Falla Blob después de reservar | `preparing` o `upload_failed`, nunca publicable. | Reintentar con la misma identidad o quitar. |
| Blob responde pero se pierde la respuesta | La reserva y ruta son estables. | El replay verifica Blob y devuelve el mismo adjunto. |
| Blob existe y falla la confirmación MongoDB | `preparing` conserva la ruta privada. | Reconciliar por ID; no crear otro Blob. |
| Cambia la revisión desde otro cliente | No se pisa la versión nueva. | Recargar borrador y repetir una intención explícita. |
| Falla la transacción de publicación | Borrador activo y adjuntos `ready`. | Reintentar con la clave estable de publicación. |
| Se pierde la respuesta de publicación | El movimiento puede existir una sola vez. | Replay devuelve el mismo movimiento. |
| Falla el borrado físico | `cleanup_pending`, ya inaccesible. | Reintentar limpieza sin reactivar el archivo. |

Quitar o descartar primero niega acceso en MongoDB y luego intenta borrar Blob;
un `404` del proveedor cuenta como éxito. El descarte del borrador no falla ni lo
reactiva porque una limpieza física quede pendiente. El archivo continúa privado
y ninguna ruta pública entrega metadata marcada para limpieza.

### 6.7 Reconciliación, observabilidad y retención

La etapa incluye un servicio idempotente y una ejecución operativa acotada para:

- revisar `preparing` con más de 15 minutos;
- confirmar como `ready` un Blob cuya metadata real coincida;
- marcar `upload_failed` cuando no exista;
- enviar a limpieza un Blob incompatible;
- borrar `cleanup_pending` y convertirlo en `deleted`;
- ejecutar en lotes, con `dry-run` por defecto y filtro por borrador para soporte.

La carga, reintento, eliminación y descarte invocan ese mismo servicio; no
implementan compensaciones paralelas. Los logs registran IDs, transición,
duración, proveedor y código de error, pero nunca nombre, URL, contenido, token
ni datos financieros. Deben existir contadores de preparaciones antiguas,
limpiezas pendientes y reintentos fallidos para que un huérfano no quede
silencioso.

Al confirmar una limpieza se elimina la clave de almacenamiento y la metadata de
presentación del tombstone. No se agrega TTL ni borrado automático de borradores
terminales en esta etapa; cualquier política de retención futura exige una
decisión separada.

### 6.8 Compatibilidad, rollback y recursos

Los adjuntos ya publicados continúan válidos y no se renombran ni migran. Los
campos nuevos son opcionales para metadata histórica y obligatorios sólo para un
archivo preparado desde un borrador. Los endpoints actuales del movimiento
conservan sus URLs, pero reutilizan el mismo adapter, validación de firma y
política de borrado seguro. El diálogo de creación retira su carga posterior a
publicar; detalle y edición mantienen la gestión del movimiento confirmado.

Un rollback de aplicación no borra metadata ni Blobs nuevos. Los adjuntos del
borrador quedan privados e inaccesibles hasta restaurar la versión compatible o
ejecutar el reconciliador; un movimiento ya publicado conserva sus relaciones.
La entrega debe probar convivencia con documentos sin `attachments`, adjuntos
históricos sin hash y borradores creados antes de la etapa 3.

El máximo durable por borrador activo es 50 MB. El cliente carga de a un archivo
para acotar memoria y conflictos de revisión; no usa polling ni mantiene cinco
buffers simultáneos. La API rechaza tamaño antes de persistir contenido cuando
la plataforma permite conocerlo y limita igualmente el cuerpo procesado. El
reconciliador trabaja en lotes configurables y no descarga binarios completos:
inspecciona metadata del proveedor. No se agrega dependencia, cola ni tarea
periódica obligatoria sin medir primero residuos, duración y costo de Blob.

### 6.9 Orden de implementación y criterio de cierre

El orden seguro es:

1. tipos, estados, validadores, adapter de almacenamiento e índices;
2. servicio de preparación, reintento, lectura y limpieza con fallos inyectables;
3. rutas privadas y DTO sin claves internas;
4. transferencia transaccional de metadata al publicar;
5. cola cliente única y estados accesibles del uploader;
6. reconciliador operativo y observabilidad;
7. integración, E2E mobile/desktop, documentación de evidencia y retiro del flujo
   posterior a la creación dentro de `Nuevo gasto`.

La etapa no está cerrada si publicar todavía requiere una carga posterior, si un
archivo ajeno puede enumerarse, si existe una ventana de acceso después de
descartar, si un fallo crea dos Blobs o dos movimientos, si una revisión puede
pisarse o si no existe forma verificable de reconciliar residuos.

## 7. Experiencia y recuperación

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

## 8. Consecuencias

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

La persistencia base se implementó el 2026-09-09: modelo separado, unicidad,
aislamiento por autor, autosave con revisión, reanudación, card privada,
descarte y publicación transaccional. Ese mismo día la etapa 3 retiró la carga
posterior del alta: el borrador prepara binarios privados mediante el adapter,
publica metadata `ready` en la transacción financiera y conserva revocación,
limpieza y reconciliación idempotentes.

El retiro de compatibilidad posterior al cutover v2 elimina las rutas de
escritura legacy y sus campos globales de `SpaceEntry`:
`linkedTransactionId`, `confirmationRequired`, `confirmedByUserId`,
`confirmedAt` y `rejectedAt`. La limpieza sólo actúa sobre documentos v2,
es idempotente y opera en `dry-run` por defecto; development exige confirmar
el nombre exacto de la base, `--cutover` y `--apply`. La auditoría legacy
conserva su acceso de sólo lectura para datos históricos y diagnóstico.

Nivel de aprendizaje: `no aplica`. Finp observa estados técnicos de guardado,
pero no aprende ni completa monto, moneda, fecha, pagador, reparto o impacto.

## 9. Verificación

- Modelo y API: unicidad, aislamiento horizontal, roles, validación parcial,
  revisión optimista, publicación idempotente y estados terminales.
- Integración: publicar confirma una sola unidad financiera; cualquier fallo
  revierte el movimiento y conserva el borrador activo.
- Adjuntos: tipo/tamaño/autorización, carga fallida, reintento, publicación,
  descarte y limpieza idempotente.
- Fallos inyectados: reserva, carga Blob, confirmación MongoDB, respuesta perdida,
  conflicto de revisión, publicación y borrado físico.
- Seguridad: firma real, límites, nombre saneado, DTO sin `storageKey`, descarga
  privada y no enumeración horizontal.
- Componentes: autosave, error recuperable, reanudación, descarte, foco, labels
  y estados anunciados accesiblemente.
- E2E mobile y desktop: cerrar y volver, cerrar sesión, cambiar de dispositivo,
  conflicto entre clientes, ver sólo el borrador propio y reemplazarlo por un
  único movimiento al publicar.
- Privacidad: participante, `admin` y `owner` ajenos no pueden enumerar, leer,
  editar, publicar ni descargar adjuntos del borrador.

Evidencia de cierre de etapa 3, 2026-09-09:

- unitarias de firma/hash, saneamiento, CLI y estados/accesibilidad del uploader;
- integración MongoDB real con replay, aislamiento entre autores, fallo de
  carga y borrado inyectados, reintento, reconciliación y transferencia de
  metadata sin duplicar movimiento;
- E2E independiente aprobado en Chromium desktop y Pixel 7 para preparación,
  bloqueo del CTA, cierre, reanudación, publicación y lectura autorizada;
- `typecheck`, `lint`, comprobación documental y preflight E2E aprobados antes
  del cierre; el build también quedó aprobado. La repetición de la suite de
  integración completa posterior al último endurecimiento no pudo abrir MongoDB
  Atlas desde este entorno (EACCES/whitelist); la prueba dirigida de servicios
  de esta etapa había quedado aprobada 13/13 y la limitación no deja un cambio
  financiero sin verificar en el código modificado.

## 10. Referencias

- [`AGENTS.md`](../../AGENTS.md), invariantes de privacidad, idempotencia y
  recuperación.
- [`0008 — Modelo y consistencia financiera de Espacios`](0008-modelo-consistencia-financiera-espacios.md).
- [`Espacios`](../producto/espacios.md), comportamiento y experiencia esperada.
- [`Arquitectura técnica`](../tecnico/arquitectura.md), capas, persistencia y
  autorización.
- [`Roadmap`](../producto/roadmap_finp.md), prioridad y etapas de implementación.
