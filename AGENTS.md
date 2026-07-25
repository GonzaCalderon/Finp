# Estatuto de desarrollo de Finp

> Estado: vigente
> Audiencia: agentes de IA y personas que desarrollan Finp
> Última actualización: 2026-07-25
> Fuente de verdad: reglas obligatorias de trabajo para todo el repositorio

## Índice

1. [Propósito](#1-propósito)
2. [Camino de entrada obligatorio](#2-camino-de-entrada-obligatorio)
3. [Jerarquía documental](#3-jerarquía-documental)
4. [Principios de producto](#4-principios-de-producto)
5. [Invariantes financieros y de privacidad](#5-invariantes-financieros-y-de-privacidad)
6. [Forma de desarrollar](#6-forma-de-desarrollar)
7. [Diseño y experiencia](#7-diseño-y-experiencia)
8. [Aprendizaje y automatización](#8-aprendizaje-y-automatización)
9. [Rendimiento y uso de recursos](#9-rendimiento-y-uso-de-recursos)
10. [Seguridad y errores](#10-seguridad-y-errores)
11. [Dependencias](#11-dependencias)
12. [Calidad y verificación](#12-calidad-y-verificación)
13. [Documentación obligatoria](#13-documentación-obligatoria)
14. [Git y ramas](#14-git-y-ramas)
15. [Uso eficiente del contexto](#15-uso-eficiente-del-contexto)
16. [Definición de terminado](#16-definición-de-terminado)

## 1. Propósito

Este archivo es el punto de entrada obligatorio para cualquier agente que revise, diseñe o modifique Finp.

Finp es un compañero de finanzas personales y compartidas. Debe ayudar a registrar, entender y anticipar el dinero cotidiano con el menor esfuerzo razonable, sin sacrificar exactitud, privacidad ni control.

Las reglas de este documento se aplican a todo el repositorio. Un `AGENTS.md` más específico puede agregar restricciones dentro de un subdirectorio, pero no contradecir este estatuto.

## 2. Camino de entrada obligatorio

Antes de actuar:

1. Leer este archivo completo.
2. Abrir [`docs/README.md`](docs/README.md) y elegir la ruta de lectura según la tarea.
3. Consultar sólo los documentos indicados para ese tipo de trabajo.
4. Revisar el estado y la prioridad correspondiente en [`docs/producto/roadmap_finp.md`](docs/producto/roadmap_finp.md).
5. Inspeccionar el código real antes de asumir que la documentación refleja toda la implementación.
6. Si código y documentación difieren, informar la diferencia y corregir la fuente canónica dentro del alcance autorizado.

Lecturas mínimas por tipo:

| Tarea | Lecturas obligatorias |
|---|---|
| Interfaz, responsive, animación o copy | `design.md`, especificación funcional y dominio afectado |
| Lógica financiera | especificación funcional, arquitectura, dominio afectado y estrategia de calidad |
| API, modelo o migración | arquitectura, guía de desarrollo, dominio afectado y decisiones relacionadas |
| Automatización o aprendizaje | estrategia de automatización, arquitectura y criterio de entrega |
| Priorización o producto | especificación funcional, estado actual y roadmap |
| Documentación | guía de documentación y documento canónico afectado |

Los documentos archivados no se leen salvo que haga falta reconstruir una decisión histórica.

## 3. Jerarquía documental

Cuando dos fuentes discrepan, prevalece este orden:

1. Código y pruebas que describen el comportamiento real.
2. `AGENTS.md` para reglas de trabajo.
3. Especificación funcional para comportamiento esperado.
4. `design.md` para experiencia visual e interacción.
5. Arquitectura y decisiones aceptadas para estructura técnica.
6. Estado actual para alcance verificado.
7. Roadmap para prioridad y trabajo futuro.
8. Documentos históricos.

Una diferencia entre código y especificación no se resuelve silenciosamente. Se determina si es un defecto de código, deuda documental o decisión pendiente.

## 4. Principios de producto

- Reducir el costo de mantener las finanzas al día.
- Priorizar claridad y acción sobre complejidad contable.
- Capturar rápido y permitir completar en la superficie adecuada.
- Automatizar sólo cuando sea seguro, explicable y controlable.
- Mantener trazabilidad de las decisiones con impacto financiero.
- Favorecer reconocimiento y sugerencias sobre memoria y carga manual.
- Preservar una experiencia serena, útil y mobile-first.
- No añadir funciones por novedad si no reducen trabajo o mejoran una decisión.
- Mantener la web como producto principal. Una aplicación Android/iOS es una línea futura de investigación, no una decisión tecnológica tomada.

## 5. Invariantes financieros y de privacidad

- Dinero real y dinero operacional son conceptos distintos.
- Transferencias, cambios, pagos de tarjeta, pagos/cobros de deuda y settlements no se convierten por conveniencia en ingreso o gasto operacional.
- La contabilidad personal no se mezcla automáticamente con la compartida.
- El impacto de un movimiento de Espacios sobre el Finp personal es privado por usuario.
- La parte propia debe distinguirse del total compartido y de un adelanto recuperable.
- Una edición no reescribe historia financiera sin una política explícita.
- Una aplicación de compromiso conserva snapshot del monto usado.
- Moneda, período financiero y zona horaria forman parte de la regla, no son detalles de presentación.
- Las operaciones derivadas deben ser idempotentes cuando puedan reintentarse.
- Toda lectura y escritura debe estar aislada por el usuario autenticado y, cuando corresponda, por permisos del Espacio.

## 6. Forma de desarrollar

1. Entender el recorrido completo y sus fuentes de verdad.
2. Identificar invariantes, entradas, salidas, permisos y fallos.
3. Reutilizar servicios existentes antes de crear lógica paralela.
4. Diseñar el cambio como una entrega vertical: dominio, API, UI, responsive, errores, pruebas y documentación.
5. Mantener funciones y componentes con una responsabilidad clara.
6. Extraer código reutilizable cuando exista una regla compartida real; no crear abstracciones especulativas.
7. Usar nombres que expresen intención y tipos que reduzcan estados inválidos.
8. Comentar el porqué, los invariantes, las excepciones y los compromisos; no narrar código obvio.
9. Mantener compatibilidad o incluir una migración explícita, idempotente y verificable.
10. No ampliar materialmente el alcance ni tomar decisiones de producto reservadas al prompter.

Una función especializada conserva la autoridad final sobre su dominio. Otra superficie puede interpretar una intención y transferir un borrador, pero no duplicar sus validaciones.

## 7. Diseño y experiencia

- [`design.md`](design.md) es la fuente visual canónica.
- Mobile es la superficie principal; desktop es la segunda verificación obligatoria.
- Reutilizar componentes, tokens, patrones, animaciones y lenguaje existentes.
- No introducir una variante visual local cuando existe un patrón compartido adecuado.
- Todo flujo debe cubrir carga, vacío, error, éxito, confirmación y recuperación.
- Las acciones financieras deben anticipar su impacto antes de confirmar.
- La animación debe comunicar continuidad o estado; nunca bloquear ni decorar sin propósito.
- Mantener accesibilidad de teclado, foco, contraste, etiquetas y áreas táctiles.

## 8. Aprendizaje y automatización

Toda función nueva o modificada debe evaluar si puede beneficiarse del aprendizaje personal de Finp:

1. No aplica.
2. Observar sin intervenir.
3. Sugerir.
4. Personalizar.
5. Automatizar con autorización explícita.

La decisión y su justificación deben quedar en la implementación o documentación correspondiente.

El aprendizaje:

- usa sólo datos del usuario autorizado;
- no decide monto, moneda, fecha u operación financiera riesgosa sin confirmación;
- explica procedencia y evidencia;
- registra aceptación, corrección y descarte como señales distintas;
- recuerda rechazos y no insiste sin evidencia nueva;
- puede pausarse, corregirse, olvidarse o revertirse;
- evita almacenar texto financiero libre innecesario.

## 9. Rendimiento y uso de recursos

Antes de adoptar una solución costosa, evaluar:

- CPU y memoria en cliente y servidor;
- tamaño del bundle y trabajo en el hilo principal;
- consultas, agregaciones e índices de base de datos;
- polling, red y servicios externos;
- almacenamiento y retención;
- batería y datos móviles;
- costo económico y crecimiento esperado;
- tokens y contexto consumidos por agentes o modelos.

Si el impacto puede ser material, el agente no decide solo. Debe presentar al prompter:

1. alcance e impacto estimado;
2. alternativa simple;
3. alternativa escalable;
4. costos, riesgos y límites;
5. recomendación razonada.

La optimización debe basarse en mediciones o en un riesgo demostrable. No sacrificar claridad por microoptimizaciones sin evidencia.

## 10. Seguridad y errores

- Validar entradas en el servidor aunque exista validación cliente.
- Autorizar cada recurso; autenticación no equivale a autorización.
- No exponer secretos, tokens, datos financieros o identificadores sensibles.
- Fallar de forma segura y evitar estados parcialmente confirmados.
- Usar transacciones de base de datos cuando varias escrituras financieras deban ser atómicas.
- Distinguir errores esperables, validación, permisos, conflictos y fallos internos.
- Mostrar al usuario un mensaje útil sin filtrar detalles internos.
- Registrar contexto técnico suficiente sin información financiera innecesaria.
- No silenciar excepciones. Un fallback debe ser explícito, observable y seguro.
- Revisar riesgos de inyección, acceso indebido, enumeración, carga de archivos, dependencias y abuso de endpoints.

## 11. Dependencias

Antes de agregar una librería:

- comprobar si la plataforma o una dependencia existente ya resuelve el problema;
- evaluar mantenimiento, documentación, comunidad, compatibilidad y licencia;
- revisar tamaño, costo de ejecución y efecto en el bundle;
- revisar vulnerabilidades e historial de seguridad;
- preferir APIs estables y proyectos con buena reputación;
- justificar una dependencia grande o crítica frente a alternativas;
- fijar versiones mediante el lockfile y verificar la instalación.

Popularidad no equivale a seguridad ni a adecuación.

## 12. Calidad y verificación

La verificación es proporcional al riesgo:

- lógica pura: unit tests;
- servicio o persistencia: integración y casos de aislamiento;
- API: autenticación, autorización, validación, errores e idempotencia;
- componente: recorrido, estados y accesibilidad básica;
- flujo crítico: E2E mobile primero y desktop después;
- dominio financiero: casos multi-moneda, períodos, edición, eliminación y reversión;
- cambio transversal: lint, typecheck, unit y build.

Comandos base:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Los E2E requieren un entorno y una base de prueba aislados.

## 13. Documentación obligatoria

- La documentación es parte de la entrega.
- El backlog vive sólo en `docs/producto/roadmap_finp.md`.
- No crear listas paralelas de pendientes.
- Actualizar el documento canónico cuando cambie comportamiento, arquitectura, diseño, operación o prioridad.
- Agregar una decisión en `docs/decisiones/` cuando haya alternativas relevantes o una consecuencia duradera.
- Mantener el índice general y el índice interno del documento.
- Marcar como reemplazado o archivar contenido obsoleto; no dejar dos fuentes vigentes.
- Las fuentes externas apoyan una decisión, no reemplazan el análisis de Finp.
- Seguir [`docs/estandares/documentacion.md`](docs/estandares/documentacion.md).

## 14. Git y ramas

- `main` representa producción.
- `dev` representa el próximo estado de producción.
- `main` debe ser ancestro de `dev` o ambas ramas pueden estar iguales después de una promoción.
- Si `main` contiene commits ausentes en `dev`, detenerse y resolver la divergencia.
- Los hotfixes de `main` deben reintegrarse inmediatamente en `dev`.
- El trabajo relevante se hace en ramas cortas nacidas de `dev`.
- Los agentes usan por defecto `codex/<alcance>`.
- Los cambios normales se integran a `dev`; la promoción productiva es de `dev` a `main`.
- No mezclar cambios no relacionados en una misma entrega.
- No sobrescribir ni descartar cambios locales ajenos.

## 15. Uso eficiente del contexto

- Empezar por `docs/README.md`; no cargar todos los documentos.
- Leer sólo el dominio y las guías relacionadas con la tarea.
- Preferir índices, resúmenes y enlaces canónicos a repetir contenido.
- No leer archivos archivados salvo necesidad histórica.
- Buscar primero por nombre, símbolo o término concreto.
- Mantener planes y reportes concisos, sin perder decisiones ni riesgos.
- Sugerir al prompter dividir trabajos grandes en bloques verificables cuando reduzca contexto y retrabajo.

La reducción de tokens nunca justifica omitir seguridad, exactitud financiera, verificación o una decisión material.

## 16. Definición de terminado

Una tarea está terminada cuando:

- resuelve el objetivo acordado;
- respeta los invariantes del dominio;
- reutiliza las fuentes de verdad existentes;
- funciona en mobile y desktop cuando tiene interfaz;
- maneja carga, vacío, error y recuperación;
- considera seguridad, rendimiento y privacidad;
- tiene pruebas proporcionales al riesgo;
- pasa los chequeos aplicables;
- actualiza documentación, índice, decisión y roadmap cuando corresponde;
- declara límites y pendientes reales;
- no deja una fuente documental contradictoria.
