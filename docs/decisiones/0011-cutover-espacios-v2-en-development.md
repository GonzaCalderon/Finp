# 0011 — Cutover de Espacios v2 en development

> Estado: aceptada
> Fecha: 2026-08-29
> Audiencia: producto, arquitectura, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0011
> Responsables: Gonzalo Calderon (prompter)
> Ámbito: datos y operaciones
> Relación: autoriza la etapa que [`0010`](0010-migracion-progresiva-espacios-v2.md) dejó pendiente

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Consecuencias](#5-consecuencias)
6. [Verificación](#6-verificación)
7. [Referencias](#7-referencias)

## 1. Contexto y problema

La decisión 0010 construyó y demostró el mecanismo de migración a Espacios v2,
pero cerró sin autorizar una sola escritura fuera de E2E. El CLI
`migrate:spaces:v2` sólo admite destinos cuyo nombre contenga el marcador
`e2e-migration`, exige que fuente y destino sean distintos y registra toda
corrida como ensayo. Escribir en `finm` es hoy estructuralmente imposible.

El ensayo se reprodujo de punta a punta el 2026-08-29 sobre
`finp-e2e-migration-checkpoint`, en una máquina distinta a la del checkpoint
original: plan idéntico (11 Espacios; 56 automáticos, 33 de revisión, 8
manuales), clone de 1.660 documentos, apply de 11 Espacios con 0 bloqueados,
verify válido con ledger personal invariante y rollback que restauró 354
documentos recuperando el fingerprint previo exacto. El mecanismo está probado;
falta la autorización y la conexión con la base real.

El volumen real de `finm` se midió sobre la copia estructural del ensayo: 11
Espacios, 27 participantes, 91 movimientos compartidos, 100 impactos
personales, 112 eventos de actividad, 15 deudas y 147 movimientos de deuda.
Siete Espacios no tienen ningún movimiento; uno concentra 49, otro 33 y está
cerrado, y un tercero tiene 7. Las 736 transacciones personales y las 33
cuentas son el dato con valor real y la migración debe dejarlas intactas.

Los ocho casos manuales se concentran así: siete vínculos cross-user en el
Espacio `69ef9163b172817764296a2e` y un huérfano global que referencia al
Espacio `69ea7c7a04701b4b2e7b8285`, inexistente en la colección `spaces`, lo
que confirma que no hay Espacio padre que reconstruir.

## 2. Restricciones

- Finp no tiene uso concurrente: el prompter es el único operador durante la
  ventana y no hay más escrituras que las suyas.
- No existe infraestructura para una base de respaldo separada. El único
  respaldo externo posible es un volcado local con MongoDB Database Tools.
- El ledger personal, las cuentas y el reporting personal deben quedar
  invariantes, verificados por fingerprint antes y después.
- Producción sigue fuera de alcance y los nombres de base productivos siguen
  rechazados por `isProductionLikeDatabaseName`.
- La sanitización de la copia de ensayo es un invariante de privacidad: la base
  de ensayo migrada está anonimizada por diseño y nunca puede promoverse a
  development.
- Los índices únicos de v2 respaldan las claves de idempotencia del contrato y
  deben existir antes de que un Espacio pase a `contractVersion: 2`.

## 3. Opciones consideradas

### A — Borrar los Espacios legacy y empezar de cero en v2

Con 91 movimientos compartidos es tentador. Se rechaza: los impactos personales
enlazan los Espacios con transacciones y deudas personales reales, de modo que
borrar sin dañar el ledger personal exige exactamente el mismo razonamiento que
la migración ya implementa y verificó dos veces. Sería menos código y más riesgo
sobre el único dato con valor.

### B — Copiar, migrar y promover la copia

Imposible sin violar la privacidad: la copia se anonimiza al clonarse. Promover
esa base destruiría nombres, emails y texto libre reales. Se rechaza.

### C — Transformación in-place sobre `finm` con preimágenes

Reutiliza el mecanismo probado. La fase de clonado se sustituye por un registro
in-place, porque el fingerprint del clon sanitizado ya coincide por diseño con
el de la fuente. El radio de fallo sigue acotado por Espacio y el rollback
sigue apoyado en preimágenes. Se acepta.

### D — Seguir ensayando sin cutover

Conserva dos autoridades de escritura y no cierra la deuda de exactitud, sin
aportar evidencia nueva: el ensayo ya se reprodujo dos veces con resultado
idéntico. Se rechaza.

## 4. Decisión

Se autoriza el cutover de Espacios v2 sobre la base de development `finm`,
mediante transformación in-place, con este alcance exacto:

- los 11 Espacios en un único corte, sin cadencia por Espacio;
- sin ventana de mantenimiento ni bloqueo de escritura, porque no hay uso
  concurrente. La regla operativa es no usar la aplicación durante la corrida, y
  el guard existente ya la hace cumplir: si la base se mueve entre el registro y
  el apply, la corrida aborta con `SPACE_MIGRATION_CLONE_FINGERPRINT_CHANGED`
  antes de escribir;
- respaldo previo con `mongodump` como único plan de recuperación externo;
- preimágenes, historia legacy y cuarentena conservadas dentro de `finm`, sin
  purga programada: su volumen es marginal y borrarlas equivale a renunciar al
  rollback.

Para habilitarlo se levantan cuatro barreras, todas con una segunda puerta
explícita y ninguna relajando la del ensayo:

1. un modo de cutover en `migrate:spaces:v2`, distinto del ensayo, que admita
   `finm` como destino con confirmación exacta del nombre;
2. la igualdad de fuente y destino, permitida sólo en ese modo;
3. el registro de corrida como no-ensayo (`rehearsal: false`);
4. la creación de los índices v2 en development, hoy rechazada fuera de E2E.

El resolutor de destino reutiliza `resolveDevelopmentAuditTarget`, que ya exige
nombre exacto, rechaza bases productivas y rechaza la ejecución desde CI.

Esta decisión **no** autoriza producción, y **no** autoriza el retiro global del
fallback legacy: eso sigue condicionado por 0010 §7 a una ventana observada sin
usos legacy, que hoy no puede medirse porque el cruce de
`enterLegacySpaceWriteFacade` no está instrumentado. El fallback se retira por
Espacio al migrarlo, como ya ocurre.

## 5. Consecuencias

### Positivas

- Cierra la etapa 4 de FINP-P0-006 sobre datos reales y desbloquea la etapa 5.
- Elimina la convivencia de autoridades de escritura en development.
- Reutiliza un mecanismo verificado en lugar de construir un camino paralelo.

### Negativas o costos

- El rollback deja de ser seguro en cuanto la aplicación se use después del
  apply: restaura las preimágenes, comprueba el fingerprint recién después de
  confirmar la transacción y aborta con
  `SPACE_MIGRATION_ROLLBACK_FINGERPRINT_MISMATCH` dejando la base en un estado
  mezclado. La recuperación pasa entonces al volcado local.
- `finm` conserva colecciones internas de migración sin fecha de purga.
- Se agrega una superficie de escritura sobre development que antes no existía.

### Seguimiento

- Instrumentar el uso del camino legacy antes de abrir la ventana de
  observación que permita retirar el fallback global.
- Decidir la purga de preimágenes sólo después de usar la aplicación sobre datos
  migrados con resultado satisfactorio.

## 6. Verificación

El cutover se considera correcto cuando, sobre `finm`:

- los 11 Espacios quedan migrados y ninguno bloqueado, o los bloqueados quedan
  en sólo lectura sin exponer totales parciales;
- `verify` devuelve válido, con cero incompatibilidades de balance, deuda o
  vínculo privado y cero manuales sin resolver;
- el fingerprint del ledger personal es idéntico antes y después;
- los 10 índices v2 existen y ninguno de los 6 únicos falló por duplicados.

Criterios de aborto, cualquiera de ellos suficiente:

- el fingerprint previo cambió entre el registro y el apply;
- un índice único falla al crearse, señal de un duplicado no clasificado;
- `verify` no es válido;
- el volcado previo no se completó o no se puede leer.

## 7. Referencias

- [`0010 — Migración progresiva de Espacios v2`](0010-migracion-progresiva-espacios-v2.md),
  2026-08-25: define el mecanismo, la clasificación y la exigencia de
  autorización separada que esta decisión satisface.
- Ensayo `checkpoint-20260829` sobre `finp-e2e-migration-checkpoint`,
  2026-08-29: evidencia de reproducibilidad y de rollback exacto.
