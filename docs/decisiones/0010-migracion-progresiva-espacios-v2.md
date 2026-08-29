# 0010 — Migración progresiva de Espacios v2

> Estado: aceptada
> Fecha: 2026-08-25
> Audiencia: producto, desarrollo, arquitectura, calidad y agentes
> Fuente de verdad: decisión 0010
> Responsables: prompter y equipo Finp
> Ámbito: compatibilidad, privacidad, backfill, rollback y cutover de Espacios

## Índice

1. [Contexto](#1-contexto)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Clasificación y resoluciones](#5-clasificación-y-resoluciones)
6. [Copia, aplicación y rollback](#6-copia-aplicación-y-rollback)
7. [Habilitación progresiva](#7-habilitación-progresiva)
8. [Consecuencias](#8-consecuencias)
9. [Verificación](#9-verificación)

## 1. Contexto

El contrato financiero v2 y su soporte multimoneda ya funcionan sobre fixtures
aislados, pero development conserva 11 Espacios legacy con 337 hallazgos. Los
97 críticos o altos no admiten una transformación única: 56 se pueden derivar
del ledger, 33 necesitan una representación privada en revisión y 8 requieren
una resolución explícita.

La migración debe demostrar que conserva dinero, historia y privacidad antes de
habilitar una sola escritura fuera de E2E. Un backfill global o una corrección
ambigua podría convertir un defecto histórico en nueva autoridad financiera.

## 2. Restricciones

- Development se abre sólo mediante snapshot read-only y con confirmación
  exacta de base; producción queda rechazada.
- Los importes, monedas, fechas, relaciones y propietarios no se inventan ni se
  corrigen por conveniencia.
- Los datos personales y el texto financiero libre no salen de la fuente real.
- Cada Espacio se aplica en su propia transacción y puede fallar sin afectar a
  otro.
- Una resolución manual necesita acción, justificación, aprobación y
  fingerprint del plan.
- No se agregan dependencias, colas, cache ni infraestructura externa.

## 3. Opciones consideradas

### A — Backfill global y corte único

Reduce estados de convivencia, pero un caso ambiguo bloquea todos los Espacios
y el rollback tiene un radio innecesariamente grande. Se rechaza.

### B — Mantener el fallback legacy indefinidamente

Evita migrar, pero conserva dos autoridades de escritura y no cierra la deuda
de exactitud. Se rechaza.

### C — Plan inmutable y cutover progresivo por Espacio

Permite verificar, aplicar y revertir cada agregado de forma independiente. Los
casos no demostrables quedan en sólo lectura sin exponer balances parciales. Se
acepta.

## 4. Decisión

Se adopta la opción C mediante un único CLI `migrate:spaces:v2` con subcomandos
`plan`, `clone`, `apply`, `verify` y `rollback`. Todos son `dry-run` por defecto;
las escrituras exigen `--execute` y un destino nuevo cuyo nombre contenga
`e2e-migration`.

El plan queda ligado al commit, fingerprint financiero/estructural del snapshot,
resultado de auditoría y manifiesto privado. Si cualquiera cambia, `apply`
aborta antes de escribir. Repetir un run confirmado no vuelve a transformar
documentos.

`ConversionSnapshot` admite fuente `legacy`: conserva la referencia histórica
sin atribuirla a DolarAPI, Frankfurter o una decisión manual actual. Un importe
no representable en su escala ISO, una diferencia superior a una unidad menor o
un reparto no demostrable bloquean sólo al Espacio afectado.

## 5. Clasificación y resoluciones

Los 97 hallazgos críticos o altos del snapshot 2026-08-25 se clasifican así:

- automáticos, 56: deuda derivada o faltante, anulación contradictoria, pagador
  con parte cero, pendiente faltante y settlement doblemente aplicado;
- revisión privada, 33: vínculo personal global, semántica monetaria legacy,
  impactos duplicados o sin transacción y transacciones personales huérfanas;
- manuales, 8: siete vínculos incompatibles entre usuario y movimiento y un
  huérfano global sin Espacio padre.

Un código crítico o alto desconocido queda manual por defecto. Las revisiones
crean una representación v2 `needs_review` sin alterar dinero ni cuentas; la
preimagen legacy permanece en historia privada del ensayo.

Para un vínculo cross-user se adopta
`detach_preserve_personal_transaction`: la transacción conserva propietario y
dinero, se quita sólo la relación inválida y la decisión vuelve a revisión. El
huérfano global usa `retain_legacy_quarantine`: se conserva fuera del conjunto
activo sin inventar un Espacio padre.

## 6. Copia, aplicación y rollback

La copia conserva identificadores, dinero, monedas, fechas y relaciones, y
anonimiza nombres, emails, texto libre, credenciales, tokens, adjuntos y URLs.
Los artefactos privados viven bajo `test-results/migrations/spaces/`, fuera de
Git, y la consola sólo muestra conteos sanitizados.

Antes de modificar un documento se guarda su preimagen y checksum en una
colección interna del destino. Los documentos nuevos llevan `runId`. El
rollback elimina exclusivamente documentos del run y restaura preimágenes por
lotes; termina únicamente cuando recupera el fingerprint previo exacto.

La migración recalcula dinero, día financiero, repartos, impactos y deuda por
moneda desde el ledger. Los settlements históricos se representan como tramos
legacy explícitos y no vuelven a descontarse. Una actividad faltante genera un
evento de migración actual, nunca una acción histórica ficticia.

## 7. Habilitación progresiva

`contractVersion: 2` se confirma al final de la transacción del Espacio, después
de transformar y verificar. Desde ese momento el documento no puede caer en una
escritura legacy.

Un Espacio sólo es elegible si tiene cero manuales pendientes, cero críticos o
altos v2, balances exactos por moneda, deuda igual al ledger, ninguna relación
cross-user, cuentas y reporting personal invariantes, replay sin cambios y
rollback comprobado. Si no es elegible, durante el cutover queda legacy en sólo
lectura y no presenta totales parciales.

Esta decisión prepara el mecanismo, pero no autoriza development ni producción.
El fallback se retira por Espacio al migrarlo y globalmente sólo después de que
todos hayan migrado y una ventana observada no registre usos legacy.

## 8. Consecuencias

Positivas:

- radio de fallo y rollback acotado por Espacio;
- dinero y decisiones privadas comparables antes y después;
- casos ambiguos visibles sin bloquear agregados sanos;
- procedimiento repetible y evidencia sanitizada.

Costos:

- convivencia temporal de estados legacy, bloqueado y migrado;
- almacenamiento transitorio de preimágenes e historia en el destino aislado;
- aprobación humana para relaciones que no pueden demostrarse.

## 9. Verificación

El ensayo aislado del 2026-08-25 migró 11 de 11 Espacios, dejó cero balances,
deudas o vínculos privados incompatibles, conservó el fingerprint del ledger
personal y produjo replay sin cambios. Apply quedó bajo 30 segundos y verify en
aproximadamente 3,3 segundos. Un ensayo sintético de 1.000 movimientos ejecuta
apply, verify y rollback por debajo de 30 segundos por fase.

El rollback restauró exactamente el fingerprint previo. Esta evidencia mantiene
FINP-P0-006 `en curso`: aún faltan revisión del checkpoint, ventana de cutover y
autorización explícita antes de escribir development o producción.
