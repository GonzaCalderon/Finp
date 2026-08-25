# Guía de desarrollo de Finp

> Estado: vigente
> Audiencia: desarrollo y agentes
> Última actualización: 2026-08-25
> Fuente de verdad: prácticas técnicas de implementación

## Índice

1. [Antes de empezar](#1-antes-de-empezar)
2. [Flujo de trabajo](#2-flujo-de-trabajo)
3. [Código legible](#3-código-legible)
4. [Reutilización y patrones](#4-reutilización-y-patrones)
5. [TypeScript y contratos](#5-typescript-y-contratos)
6. [React y componentes](#6-react-y-componentes)
7. [API y servicios](#7-api-y-servicios)
8. [Datos y migraciones](#8-datos-y-migraciones)
9. [Errores](#9-errores)
10. [Seguridad](#10-seguridad)
11. [Rendimiento y recursos](#11-rendimiento-y-recursos)
12. [Dependencias](#12-dependencias)
13. [Comentarios](#13-comentarios)
14. [Git y ramas](#14-git-y-ramas)
15. [Pruebas](#15-pruebas)
16. [Documentación](#16-documentación)
17. [Checklist](#17-checklist)

## 1. Antes de empezar

1. Leer [`../../AGENTS.md`](../../AGENTS.md).
2. Elegir ruta en [`../README.md`](../README.md).
3. Revisar [`../producto/roadmap_finp.md`](../producto/roadmap_finp.md).
4. Inspeccionar código, pruebas y cambios locales.
5. Identificar fuente de verdad y efectos derivados.
6. Definir cómo se verificará antes de editar.

No asumir que un documento antiguo describe el código actual.

## 2. Flujo de trabajo

```text
entender → diseñar → implementar → verificar → documentar → cerrar
```

### Entender

- recorrido del usuario;
- entradas y salidas;
- permisos;
- monedas y períodos;
- relaciones y cascadas;
- estados de error.

### Diseñar

- responsabilidad de cada capa;
- reutilización;
- migración;
- impacto de recursos;
- pruebas.

### Implementar

- cambios pequeños y cohesivos;
- fuente de verdad común;
- estados completos;
- sin ampliar alcance innecesariamente.

### Verificar

- casos felices y bordes;
- mobile primero;
- seguridad y aislamiento;
- chequeos automatizados.

### Documentar

- comportamiento;
- arquitectura o decisión;
- estado;
- backlog.

## 3. Código legible

- Nombres orientados a intención.
- Funciones pequeñas con responsabilidad coherente.
- Early returns para errores y precondiciones.
- Evitar anidación profunda.
- Separar transformación pura de I/O.
- Agrupar por dominio, no por conveniencia temporal.
- Eliminar código muerto y compatibilidad sólo cuando la migración esté cerrada.
- No usar valores mágicos: constantes o configuración con significado.
- Evitar archivos gigantes; extraer por responsabilidad, no por cantidad arbitraria.

La legibilidad no se sustituye con comentarios.

## 4. Reutilización y patrones

### Reutilizar dominio

Si varias entradas crean transacciones, todas deben atravesar el servicio común. No copiar reglas a Captura rápida, Importación o Espacios.

### Reutilizar UI

Extender una primitiva o composición cuando el comportamiento es el mismo. Crear un componente de dominio cuando cambia la responsabilidad.

### Extraer en el momento correcto

Extraer cuando:

- hay al menos dos usos reales;
- existe una regla importante compartida;
- la divergencia sería riesgosa.

No extraer por anticipación.

### Patrones preferidos

- utilidades puras para cálculos;
- servicios para casos de uso;
- validaciones para contratos;
- hooks para acceso cliente;
- composición sobre variantes copiadas;
- estado derivado en lugar de duplicado;
- discriminated unions para flujos con tipos distintos;
- borradores tipados/versionados para derivación entre funciones.

Los handoffs financieros usan contratos discriminados. La superficie de origen
transporta sólo campos interpretados y procedencia; la de destino vuelve a
validar autenticación, propiedad, tipo de cuenta, moneda y duplicados. Si una
clasificación especializada no tiene una degradación financieramente correcta,
no se ofrece una salida simple.

## 5. TypeScript y contratos

- Evitar `any`.
- Validar datos externos en runtime.
- No confiar en un cast para convertir datos inseguros.
- Representar monedas, tipos y estados con unions/enums existentes.
- Reducir combinaciones inválidas.
- Separar contratos públicos de documentos Mongoose.
- Mantener tipos serializables entre servidor y cliente.
- Al cambiar un contrato, revisar consumidores, migración y compatibilidad.

## 6. React y componentes

- Mantener reglas financieras fuera de componentes.
- Preferir estado derivado sobre efectos de sincronización.
- Efectos que consumen recursos o borradores deben ser idempotentes bajo StrictMode.
- No usar `setState` en efectos para corregir arquitectura evitable.
- Evitar pasar objetos históricos completos si alcanza un resumen seguro.
- Mantener accesibilidad, foco y teclado.
- Lazy-load de funciones pesadas o infrecuentes cuando la medición lo justifique.
- No crear una versión mobile con lógica distinta.

## 7. API y servicios

Un Route Handler:

1. autentica;
2. parsea y valida;
3. invoca un servicio;
4. traduce resultado/error;
5. no reimplementa dominio.

Un servicio:

- autoriza el recurso;
- resuelve invariantes;
- coordina modelos;
- usa transacción si el fallo parcial es peligroso;
- retorna un resultado seguro.

Cada endpoint debe considerar:

- no autenticado;
- recurso de otro usuario;
- recurso inexistente;
- input inválido;
- conflicto;
- retry;
- respuesta sin datos sensibles.

## 8. Datos y migraciones

- Diseñar índices a partir de consultas.
- Evitar búsquedas sin límite sobre historia completa.
- Usar `[start, end)` para períodos.
- No modificar historia sin snapshot.
- No usar producción para pruebas.
- Script de escritura: `dry-run`, `--apply`, conteos, anomalías e idempotencia.
- Antes de aplicar: ambiente, backup y aprobación.
- Después: verificación y plan de retiro legacy.

### Auditoría legacy de Espacios

Antes de modificar el modelo o preparar el backfill de FINP-P0-006:

```bash
npm run audit:spaces:legacy -- --env test
npm run audit:spaces:legacy -- --env development --confirm-database <nombre>
```

Garantías:

- `test` carga `.env.test.local` y atraviesa el mismo preflight de aislamiento
  que Playwright y el seed;
- `development` carga `.env.local`, se rechaza en CI y exige que
  `--confirm-database` coincida exactamente con la URI;
- producción y bases reservadas se rechazan;
- la lectura ocurre dentro de una transacción MongoDB con `readConcern:
  snapshot` que se aborta al terminar;
- el CLI no tiene modo `apply` y rechaza argumentos de escritura;
- `--fail-on never|high|critical` controla sólo el código de salida, no cambia
  el contenido de la auditoría;
- `summary.md`, `details.json` y `manifest.json` se escriben bajo
  `test-results/audits/spaces/<entorno>-<timestamp>/`, que está excluido de Git;
- consola y resumen no contienen identificadores, datos personales, URI,
  secretos ni montos; el detalle técnico local conserva únicamente ids,
  relaciones, códigos estables y evidencia mínima.

Un `GO` habilita preparar el modelo compatible; nunca autoriza por sí solo un
backfill. Cualquier escritura mantiene el protocolo de migración, aprobación y
rollback de esta sección.

### Ensayo de migración de Espacios v2

El CLI canónico usa siempre la misma identidad de run y un destino nuevo con
marcador `e2e-migration`:

```bash
npm run migrate:spaces:v2 -- plan --run-id <id> --confirm-database <development> --target-database <e2e-migration> \
  --approve-safe-defaults --approved-by <identidad>
npm run migrate:spaces:v2 -- clone --run-id <id> --confirm-database <development> --target-database <e2e-migration>
npm run migrate:spaces:v2 -- clone --run-id <id> --confirm-database <development> --target-database <e2e-migration> --execute
npm run migrate:spaces:v2 -- apply --run-id <id> --confirm-database <development> --target-database <e2e-migration> --execute
npm run migrate:spaces:v2 -- verify --run-id <id> --confirm-database <development> --target-database <e2e-migration> --execute
npm run migrate:spaces:v2 -- rollback --run-id <id> --confirm-database <development> --target-database <e2e-migration> --execute
```

Garantías:

- todos los subcomandos son `dry-run` salvo `--execute`; `plan` nunca escribe;
- development se abre sólo con snapshot read-only y confirmación exacta;
- fuente, auditoría, plan, manifiesto y copia deben conservar sus fingerprints;
- el manifiesto privado exige acción, justificación, aprobación y fingerprint
  por cada caso manual, y vive bajo `test-results/`, fuera de Git;
- `clone` usa lotes de hasta 100 y anonimiza identidad, texto libre, secretos,
  tokens, adjuntos y URLs sin cambiar dinero ni relaciones;
- `apply` usa una transacción por Espacio, conserva preimágenes con checksum y
  puede reanudarse sin repetir un Espacio confirmado;
- `verify` compara compatibilidad, deudas, vínculos privados, ledger personal y
  replay; `rollback` debe recuperar el fingerprint previo exacto;
- una fase con 1.000 movimientos debe terminar en menos de 30 segundos;
- el ensayo no habilita escrituras en development o producción.

No versionar `plan.private.json`, `resolutions.private.json`, backups ni reportes
del run. La política completa está en la
[`decisión 0010`](../decisiones/0010-migracion-progresiva-espacios-v2.md).

### Índices compatibles de Espacios v2

La etapa de modelo de FINP-P0-006 usa un manifiesto independiente de
`autoIndex`:

```bash
npm run indexes:spaces:v2 -- --env test
npm run indexes:spaces:v2 -- --env test --apply
npm run indexes:spaces:v2 -- --env development --confirm-database <nombre>
```

Garantías:

- el comando es `dry-run` por defecto y muestra colección, nombre y propósito;
- `--apply` sólo se admite contra la base aislada `finp-e2e` después del mismo
  preflight que Playwright;
- development exige coincidencia exacta de base y permanece siempre read-only;
- producción, CI sin entorno E2E y bases reservadas se rechazan;
- crear nuevamente el mismo manifiesto es idempotente;
- los índices únicos v2 son parciales por versión o procedencia y conviven con
  documentos legacy;
- aplicar índices no autoriza backfill, activación de rutas ni cutover.

La integración transaccional canónica de esta base se ejecuta con:

```bash
npm run test:integration:spaces:v2
```

El recorrido crea datos identificables sólo en `finp-e2e`, valida operaciones
con sesión real y elimina exclusivamente esos fixtures al terminar.

## 9. Errores

### Principios

- No silenciar.
- No filtrar detalles internos.
- No perder el borrador.
- No dejar duda sobre el impacto financiero.
- No usar el mismo mensaje para validación y fallo interno.

### Contrato

Los errores de dominio deben poder mapearse a:

- código estable;
- estado HTTP;
- mensaje para usuario;
- contexto técnico seguro;
- opción de recuperación.

### Fallos externos

Una cotización o servicio externo:

- tiene timeout;
- valida respuesta;
- ofrece fallback seguro;
- indica antigüedad o fuente;
- no bloquea una operación que admite dato manual.

## 10. Seguridad

Checklist mínimo:

- sesión;
- propiedad o rol;
- validación de servidor;
- control de campos editables;
- consultas filtradas;
- tokens no almacenados en claro;
- secretos fuera del repositorio;
- archivos con tipo/tamaño controlados;
- logs sin datos sensibles;
- errores sin stack al cliente;
- dependencias auditadas;
- rate limiting o mitigación si existe abuso probable;
- fallar cerrado en autorización.

OWASP es referencia de seguridad, no reemplazo de threat modeling local.

## 11. Rendimiento y recursos

### Evaluar

- bundle;
- render;
- CPU cliente;
- CPU/memoria servidor;
- consultas e índices;
- red y polling;
- almacenamiento;
- servicios pagos;
- batería/datos mobile;
- contexto de agentes.

### Protocolo de decisión

Si el cambio puede ser costoso:

1. medir o estimar;
2. describir escala esperada;
3. presentar alternativa simple;
4. presentar alternativa escalable;
5. explicar costo y riesgo;
6. pedir decisión al prompter.

No introducir cache, cola, realtime o procesamiento externo sin estrategia de invalidación, recuperación, observabilidad y costo.

Para bundles, usar herramientas oficiales de Next.js cuando exista una regresión o dependencia grande.

## 12. Dependencias

Evaluar:

- necesidad;
- mantenimiento;
- versión estable;
- adopción y documentación;
- licencia;
- vulnerabilidades;
- OpenSSF Scorecard como señal;
- tamaño y dependencias transitivas;
- soporte de Next.js/React;
- reemplazabilidad;
- scripts de instalación;
- actividad y respuesta de mantenedores.

Pasos:

1. buscar solución nativa o ya instalada;
2. comparar al menos una alternativa para dependencias relevantes;
3. revisar documentación oficial;
4. verificar `npm audit`;
5. instalar conservando lockfile;
6. ejecutar build y pruebas;
7. registrar decisión si es estructural.

## 13. Comentarios

Comentar:

- invariantes financieras;
- decisiones no obvias;
- rangos de fechas;
- idempotencia;
- fallback;
- compatibilidad legacy;
- razones de seguridad o rendimiento;
- comportamiento contraintuitivo.

No comentar:

- sintaxis evidente;
- nombres claros;
- historial de la tarea;
- código deshabilitado;
- una explicación que pertenece a arquitectura o decisión.

Los comentarios deben actualizarse con el código.

## 14. Git y ramas

### Modelo

```text
main ← promoción desde dev
dev  ← integración de trabajo
codex/*, feature/*, fix/*, docs/* ← ramas cortas desde dev
```

Invariante:

- `main` es ancestro de `dev`, o ambas están iguales después de liberar;
- un hotfix de `main` vuelve a `dev`;
- no desarrollar directamente en `main`;
- usar rama corta para cambios relevantes;
- PR de trabajo hacia `dev`;
- PR de release de `dev` hacia `main`.

Antes de comenzar:

```bash
git status
git log --oneline --decorate -n 10
git rev-list --left-right --count main...dev
```

No descartar cambios locales ajenos ni mezclar temas no relacionados.

## 15. Pruebas

Seguir [`../calidad/plan_calidad_estabilizacion_finp.md`](../calidad/plan_calidad_estabilizacion_finp.md).

Base:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Agregar E2E para recorridos críticos o integración entre módulos. Usar base aislada.

## 16. Documentación

Seguir [`../estandares/documentacion.md`](../estandares/documentacion.md).

Preguntas de cierre:

- ¿Cambió lo que puede hacer el usuario?
- ¿Cambió un contrato?
- ¿Cambió una decisión visual?
- ¿Cambió una fuente de verdad?
- ¿Se cerró o descubrió un pendiente?
- ¿Se agregó una dependencia o costo?

Actualizar la fuente correspondiente y el índice.

## 17. Checklist

- [ ] Leí el estatuto y la ruta documental.
- [ ] Revisé estado, roadmap y código real.
- [ ] Identifiqué fuente de verdad e invariantes.
- [ ] Reutilicé servicios y componentes.
- [ ] Separé dominio, transporte y presentación.
- [ ] Cubrí permisos y datos de otro usuario.
- [ ] Manejo errores y recuperación.
- [ ] Evalué recursos y dependencias.
- [ ] Verifiqué mobile y desktop.
- [ ] Agregué pruebas proporcionales.
- [ ] Ejecuté chequeos aplicables.
- [ ] Actualicé documentación y backlog.
- [ ] Informé límites y decisiones pendientes.
