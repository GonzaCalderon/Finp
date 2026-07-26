# Captura rápida como orientador de Finp

> Estado: vigente
> Audiencia: producto, diseño, desarrollo y agentes
> Última actualización: 2026-07-26
> Fuente de verdad: contrato funcional de orientación

## Índice

1. [Visión y límites](#1-visión)
2. [Ciclo y contrato](#3-ciclo-común-de-orientación)
3. [Jerarquía](#5-jerarquía-y-resguardos)
4. [Experiencia](#6-experiencia-propuesta)
5. [Onboarding](#7-onboarding-y-descubrimiento)
6. [Compromisos](#8-integración-con-compromisos)
7. [Evolución](#9-adopción-gradual)
8. [Métricas y límites](#10-métricas-de-éxito)

Documentación técnica de la implementación: `docs/tecnico/compromisos_variables_y_orientacion.md`.

Las Etapas 1 y 2 están implementadas. Las siguientes etapas describen el contrato de evolución; su prioridad vive únicamente en [`roadmap_finp.md`](roadmap_finp.md).

## 1. Visión

Captura rápida debe ser la puerta de entrada inteligente a Finp, no un formulario universal que replique todos sus módulos.

El usuario puede expresar qué quiere hacer sin conocer previamente dónde vive cada función. Finp interpreta la intención y:

1. resuelve la acción dentro del diálogo cuando es simple y financieramente segura;
2. sugiere la función adecuada cuando existe un flujo especializado;
3. transporta lo ya interpretado como borrador;
4. deja la configuración y confirmación final en la superficie responsable.

La promesa de producto es:

> No necesitás conocer toda Finp para aprovecharla. Empezá escribiendo y Finp te guía hacia la herramienta correcta.

Las sugerencias de funciones son también una forma de descubrimiento progresivo. Deben invitar a usar mejor el producto en el momento en que la necesidad aparece, en lugar de depender de tours genéricos o de que el usuario recuerde todas las opciones disponibles.

## 2. Límite de responsabilidad

Captura rápida puede resolver directamente:

- gastos e ingresos simples;
- consumos con tarjeta en un pago cuando la tarjeta y los datos obligatorios
  son explícitos o pueden confirmarse dentro del diálogo;
- aplicación de un compromiso existente cuando la coincidencia es clara;
- correcciones mínimas de monto, fecha, cuenta, categoría o comercio;
- confirmación o descarte de una sugerencia.

Captura rápida debe derivar con un borrador:

- creación o configuración avanzada de compromisos;
- consumos con tarjeta en varias cuotas;
- consumos con tarjeta cuya tarjeta, moneda o configuración necesaria siga
  siendo ambigua;
- transferencias y cambios de moneda;
- deudas, préstamos y cobros;
- movimientos compartidos de Espacios;
- importaciones;
- creación de reglas.

La derivación no se considera un fallo de interpretación. Es el resultado correcto cuando la intención pertenece a un dominio con decisiones adicionales.

Captura rápida debe distinguir un consumo con tarjeta del pago del resumen. No
puede registrar el primero como gasto de una cuenta común ni convertir el
segundo en un nuevo consumo. En ambos casos reutiliza las validaciones y reglas
del dominio de Tarjetas.

## 3. Ciclo común de orientación

Toda orientación debe seguir el mismo ciclo:

1. **Detectar intención:** interpretar texto explícito, contexto actual y evidencia histórica.
2. **Explicar:** mostrar qué entendió Finp y por qué propone una función.
3. **Ofrecer alternativas:** acción recomendada, registrar como movimiento simple o descartar.
4. **Transportar contexto:** abrir el destino con los campos confiables ya completados.
5. **Confirmar en el módulo responsable:** ninguna sugerencia crea por sí sola una regla, deuda, compromiso o movimiento compartido.
6. **Conservar procedencia:** la entidad creada debe saber que nació desde Captura rápida y la captura debe poder explicar el resultado.
7. **Aprender del resultado:** registrar de forma best-effort si la propuesta fue mostrada, aceptada, descartada, corregida o completada.

## 4. Contrato transversal de sugerencias

Conviene modelar una sugerencia de función separada de una sugerencia semántica de cuenta, categoría o comercio.

Una sugerencia funcional debe contener como mínimo:

- tipo de función sugerida;
- intención detectada;
- motivo legible;
- evidencia resumida;
- confianza;
- destino;
- borrador transportable y versionado;
- acciones disponibles;
- estado de interacción;
- sesión y procedencia;
- caducidad o criterio de obsolescencia.

Tipos iniciales:

- `apply_commitment`;
- `create_commitment`;
- `create_rule`;
- `use_space`;
- `record_debt`;
- `use_installments`;
- `import_transactions`.

Estados:

- mostrada;
- aceptada;
- descartada;
- pospuesta;
- completada;
- vencida.

La infraestructura de eventos, privacidad, feedback e idempotencia del aprendizaje personal puede reutilizarse. El ranking y la persistencia de candidatos funcionales deben permanecer separados de los patrones que completan campos: recomendar un módulo tiene consecuencias y umbrales distintos.

## 5. Jerarquía y resguardos

- Intención explícita: mostrar la recomendación inmediatamente.
- Evidencia histórica fuerte: mostrar una tarjeta accionable no bloqueante.
- Evidencia media: llevar la propuesta a la superficie especializada o a una bandeja de sugerencias.
- Confianza baja: no interrumpir.

Resguardos:

- nunca ejecutar una operación financiera especializada por inferencia;
- no reemplazar una intención explícita por un patrón histórico;
- recordar descartes y ofrecer `No volver a sugerir esto`;
- no mostrar simultáneamente la misma propuesta en varias superficies;
- no repetir una propuesta descartada sin nueva evidencia relevante;
- conservar el texto y el borrador si la derivación falla;
- validar nuevamente propiedad, permisos, moneda, cuenta y fondos en el módulo final;
- distinguir claramente sugerencia, plantilla y movimiento real.

## 6. Experiencia propuesta

### Intención explícita

Entrada:

`Alquiler 650000 el 5 de cada mes`

Respuesta:

> Esto parece un compromiso mensual. Preparamos “Alquiler”, por $650.000 ARS, con vencimiento el día 5.

Acciones:

- `Configurar compromiso`;
- `Registrar sólo este gasto`;
- `Ahora no`.

El flujo dedicado recibe descripción, monto, moneda, frecuencia, día, cuenta y categoría que se hayan interpretado con suficiente confianza. Las políticas de monto, índices, reparto y otras decisiones avanzadas se completan allí.

### Aplicación de un compromiso

Entrada:

`Pagué alquiler 675000 hoy mp`

Respuesta:

> Encontramos “Alquiler” pendiente de julio. Vas a confirmarlo por $675.000 desde Mercado Pago.

Acciones:

- `Aplicar compromiso`;
- `Registrar aparte`;
- `Revisar detalles`.

### Otros destinos

- `Cena 60000 con Ana y Juan` puede sugerir un movimiento en un Espacio.
- `Le presté 50000 a Pedro` puede derivar a Deudas.
- `Supermercado 45000 con Visa` puede resolverse como consumo con tarjeta en un
  pago si la tarjeta queda identificada.
- `Notebook 1200 USD en 6 cuotas` debe abrir el flujo de tarjeta y cuotas.
- `Siempre que diga Uber ponelo en Transporte` puede abrir una regla precargada.
- texto tabular o varias líneas estructuradas puede sugerir Importación.

## 7. Onboarding y descubrimiento

El onboarding debe enseñar posibilidades sin exigir que el usuario memorice una sintaxis.

### Primera apertura

Mostrar una introducción breve y descartable:

> Escribí como hablás. Finp puede registrar un movimiento o guiarte hacia compromisos, cuotas, reglas, deudas y Espacios.

Incluir tres ejemplos rotativos y accionables, adaptados al dispositivo:

- `Café 1500 ayer mp`;
- `Alquiler 650000 el 5 de cada mes`;
- `Notebook 1200 USD en 6 cuotas`.

### Descubrimiento contextual

- Después de la primera captura simple: mencionar que también reconoce fechas, cuentas y categorías.
- Ante una frase recurrente: explicar por primera vez que puede preparar compromisos.
- Al detectar una función especializada: mostrar una explicación de una línea junto al CTA.
- En Configuración o Ayuda: incluir una galería buscable de ejemplos por objetivo, no sólo una lista de comandos.
- Permitir recuperar el onboarding desde `¿Qué puedo escribir?`.

El onboarding introductorio se muestra una sola vez. Las ayudas contextuales tienen frecuencia limitada, recuerdan descartes y desaparecen cuando el usuario ya utilizó la función.

## 8. Integración con Compromisos

Captura rápida debe diferenciar tres intenciones:

- registrar una transacción independiente;
- aplicar una aplicación pendiente de un compromiso;
- preparar un compromiso nuevo.

Los compromisos activos y sus aplicaciones pendientes deben formar parte del contexto aplicable de Captura rápida. Una coincidencia debe considerar:

- descripción y comercio normalizados;
- tipo y moneda;
- período y vencimiento;
- categoría y cuenta habitual;
- estado de la aplicación;
- aliases o denominaciones conocidas;
- similitud prudente.

Una transacción aplicada debe mostrar su procedencia, por ejemplo:

`Compromiso: Alquiler · julio 2026`

Editar esa transacción no modifica automáticamente la plantilla ni períodos futuros. El usuario debe elegir explícitamente `Actualizar próximos períodos`. Eliminarla reabre o revierte la aplicación del período; no elimina el compromiso.

### Candidatos recurrentes

Finp puede sugerir un compromiso cuando encuentra pagos mensuales consistentes bajo la misma denominación o nombres similares.

La evidencia inicial debe exigir:

- al menos tres períodos observados;
- cadencia mensual razonablemente consistente;
- mismo tipo y moneda;
- comercio o descripción normalizados compatibles;
- ausencia de cuotas, transferencias, deudas, aplicaciones existentes o movimientos especializados;
- inexistencia de un compromiso equivalente.

La estabilidad del monto orienta la política propuesta:

- monto estable: sugerir monto fijo;
- monto variable: sugerir monto a confirmar;
- evolución con fechas claras: ofrecer revisar un historial, sin inferir automáticamente una política contractual.

La propuesta explica cantidad de coincidencias, período observado y variación de montos. Crear el compromiso siempre requiere confirmación en su página dedicada.

## 9. Adopción gradual

### Etapa 1: base común — implementada el 2026-07-25

- tipos de intención y sugerencia funcional en `src/types/capture-intent.ts`;
- borrador transportable versionado (`CAPTURE_DRAFT_VERSION`), en `sessionStorage`, con sólo el id en la URL para no exponer datos financieros;
- procedencia por campo (`provenance`), que permite al destino distinguir lo interpretado de un valor por defecto;
- onboarding inicial con campo propio `captureIntroSeenAt` y galería recuperable desde `¿Qué puedo escribir?`;
- eventos `intent_detected`, `intent_accepted`, `intent_dismissed` e `intent_completed`: aceptar el CTA y completar la función son estados distintos.

### Etapa 2: Compromisos — implementada el 2026-07-25

- compromisos pendientes en `GET /api/quick-capture/context`, con monto vigente y estado derivado;
- las tres intenciones se distinguen; una intención explícita nunca se reemplaza por evidencia histórica;
- aplicación desde el diálogo reutilizando las validaciones del servicio de Compromisos, con `origin: quick_capture`;
- derivación de altas con borrador precargado hacia `/commitments?draft=<id>`;
- cierre del embudo: Compromisos emite `intent_completed` al crear la plantilla,
  una sola vez por borrador derivado;
- procedencia visible en Transacciones (`Compromiso: <nombre> · <período>`);
- descarte persistente mediante `FunctionalSuggestionDismissal`.

### Etapa 3: recurrencia aprendida

- construir candidatos mensuales desde historial vigente;
- mostrar propuestas en Captura rápida y Compromisos sin duplicarlas;
- recordar descartes y correcciones;
- diferenciar monto fijo y variable.

### Etapa 4: otros módulos

- reglas;
- tarjetas: consumo en un pago dentro de Captura rápida y derivación de cuotas
  con borrador;
- Deudas;
- Espacios;
- Importación.

Cada integración se entrega de punta a punta antes de incorporar el siguiente destino.

## 10. Métricas de éxito

- porcentaje de orientaciones que terminan en la función sugerida;
- abandono durante la derivación;
- campos precargados que el usuario conserva o corrige;
- tiempo desde el texto inicial hasta la confirmación final;
- sugerencias descartadas o silenciadas;
- compromisos sugeridos que continúan activos después de varios períodos;
- reducción de movimientos recurrentes registrados como transacciones aisladas;
- descubrimiento de módulos por usuarios que nunca los habían utilizado.

La métrica principal no es cuántas sugerencias se muestran, sino cuántas ayudan a completar correctamente una intención con menos esfuerzo.

## 11. Fuera de alcance inicial

- lenguaje libre capaz de configurar todos los campos avanzados;
- elección automática de índices contractuales;
- creación automática de compromisos desde el historial;
- ejecución automática de movimientos de Espacios o deudas;
- IA generativa para decidir intención financiera;
- un asistente conversacional que sustituya las superficies especializadas.
