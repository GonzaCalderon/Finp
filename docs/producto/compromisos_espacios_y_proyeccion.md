# Compromisos, Espacios y proyección

> Estado: vigente
> Audiencia: producto, diseño, desarrollo y agentes
> Última actualización: 2026-07-31
> Fuente de verdad: diseño funcional de compromisos y su evolución

## Índice

1. [Problema y estado](#1-problema)
2. [Principio y casos](#2-principio-funcional)
3. [Modelo](#4-modelo-funcional-propuesto)
4. [Políticas de monto](#5-políticas-de-monto)
5. [Espacios](#6-integración-con-espacios)
6. [Proyección e índices](#7-proyección)
7. [Permisos, notificaciones e historia](#9-permisos-y-colaboración)
8. [Captura y recurrencia](#111-integración-con-captura-rápida)
9. [Evolución, riesgos y decisiones](#12-dependencias-de-evolución)

Las fases describen dependencias funcionales. La prioridad vive únicamente en [`roadmap_finp.md`](roadmap_finp.md).

## 1. Problema

Desde el 2026-07-25, los compromisos personales admiten monto fijo, monto variable a confirmar y una agenda manual de montos por fecha. Conservan snapshot de cada aplicación. El modelo todavía no cubre correctamente dos necesidades centrales:

1. Compromisos compartidos que pertenecen a un Espacio, como alquiler, expensas, luz, gas, internet o compras habituales del hogar.
2. Compromisos cuyos montos cambian periódicamente por ajustes manuales, porcentajes pautados o índices externos.

Sin estas capacidades:

- el usuario vuelve a cargar cada mes movimientos previsibles;
- los compromisos del hogar quedan separados de Espacios;
- la proyección repite montos que pueden haber quedado desactualizados;
- cada participante puede proyectar información distinta sobre una misma obligación compartida;
- se desperdicia información contractual conocida de antemano.

### Estado real al 2026-07-31

Documentación técnica de la implementación: `docs/tecnico/compromisos_variables_y_orientacion.md`.

Implementado (Fases 1 y 2):

- `amountPolicy` (`fixed` | `variable`), `estimationMode` y agenda de montos efectivos por fecha (`amountSchedule`).
- `resolveCommitmentAmountForPeriod` como única fuente de verdad del monto vigente, con nivel de certeza (`confirmed`, `calculated`, `estimated`, `pending_amount`), consumido por el apply, la proyección, el dashboard y Captura rápida.
- Estados de aplicación: `registered`, `skipped`, `cancelled` y `reverted` se persisten; `scheduled`, `awaiting_amount` y `ready` se derivan al leer, sin filas fantasma.
- Snapshot financiero por aplicación: monto, moneda, descripción, categoría, cuenta y origen del monto.
- Procedencia bidireccional: la transacción guarda `commitmentId`, `commitmentApplicationId`, `commitmentPeriod` y `commitmentNameSnapshot`, y la lista la muestra.
- Editar la transacción actualiza el snapshot pero **no** la plantilla; propagar a próximos períodos es una acción explícita que agrega un tramo a la agenda.
- Eliminar la transacción deja la aplicación en `reverted`, reabre el período y conserva el compromiso.
- Proyección extraída a `src/lib/server/projection.ts`: incluye `weekly` y
  `once`, honra `monthStartDay` e inicio operativo, usa el monto correcto por
  período e integra compras `1/1`, históricos sin plan y cuotas sin doble
  conteo.
- Contrato compartido con certeza, contexto, enlace y totales separados; las
  agrupaciones por tipo, tarjeta y categoría reutilizan una lista canónica.
- Cuenta habitual (`accountId`) y validación zod en el servidor de las rutas de compromisos.
- UX mobile-first en tres pasos, agenda separada e historial colapsable.
- Monto vigente, fecha efectiva y aplicación actual visibles en la lista.
- Recordatorio relativo al vencimiento dentro de Finp.
- Ciclo de vida derivado y conservación de finalizados/desactivados.
- Candidatos mensuales calculados desde historial, explicables y descartables.

Pendiente:

- contexto `space`, reparto y pagador habitual;
- ajustes porcentuales pautados e índices oficiales;
- ejecución automática (`auto_month_start`) y scheduler.
- notificaciones push o fuera de la sesión web.

## 2. Principio funcional

Un compromiso representa una obligación o movimiento esperado. Su aplicación genera el movimiento real en el contexto al que pertenece.

- Compromiso personal: al aplicarse genera una transacción personal.
- Compromiso de Espacio: al aplicarse genera un movimiento del Espacio.
- El impacto privado de un compromiso compartido debe derivarse del movimiento de Espacio y de la configuración personal de cada participante.

No se debe crear simultáneamente un compromiso personal y uno compartido para representar la misma obligación.

## 3. Casos de uso

### Hogar o pareja

- Alquiler.
- Expensas.
- Luz.
- Gas.
- Agua.
- Internet.
- Seguro.
- Servicio doméstico.
- Supermercado estimado.

### Viaje o proyecto

- Alojamiento.
- Alquiler de vehículo.
- Suscripciones del proyecto.
- Cuotas de una compra compartida.
- Pagos programados a proveedores.

### Personal

- Alquiler individual.
- Suscripciones.
- Servicios.
- Cuotas no modeladas como tarjeta.
- Aportes o transferencias periódicas.

## 4. Modelo funcional propuesto

### 4.1 Contexto

Cada compromiso debe pertenecer a uno de estos contextos:

- `personal`;
- `space`.

Cuando pertenece a un Espacio debe incluir:

- Espacio;
- categoría interna;
- moneda;
- regla de reparto;
- pagador habitual opcional;
- participantes incluidos;
- permisos de creación y edición;
- estrategia de confirmación mensual.

### 4.2 Plantilla y aplicación

Separar:

- Plantilla: define recurrencia, reglas de monto, reparto y fechas.
- Aplicación: representa qué ocurrió en un período concreto.

La separación de entidades y la unicidad por período ya existen como base técnica. Falta ampliar la aplicación para representar estados y conservar la foto financiera propuesta a continuación.

Estados sugeridos para una aplicación:

- próxima;
- pendiente de monto;
- lista para registrar;
- registrada;
- omitida;
- cancelada.

Cada aplicación debe guardar una foto de:

- monto usado;
- regla de cálculo;
- reparto;
- participantes;
- categoría;
- origen del monto;
- fecha de cálculo;
- movimiento generado.

La unicidad debe impedir dos aplicaciones del mismo compromiso para el mismo período y contexto.

## 5. Políticas de monto

### Monto fijo

El mismo valor continúa vigente hasta que el usuario lo modifica.

Ejemplo: internet con precio estable durante algunos meses.

### Monto variable a confirmar

Finp genera el pendiente del mes, pero pide ingresar o confirmar el valor real antes de registrar.

Ejemplos:

- luz;
- gas;
- expensas variables;
- supermercado estimado.

La proyección puede usar el último monto, un promedio reciente o una estimación configurada, siempre indicando que no es definitivo.

### Montos pautados por fecha

Permitir una agenda explícita:

- $500.000 desde enero;
- $575.000 desde abril;
- $650.000 desde julio.

El cambio debe aplicarse desde una fecha efectiva sin modificar las aplicaciones históricas.

### Aumento porcentual pautado

Ejemplo:

- aumentar 10% cada tres meses;
- aplicar 15% desde una fecha determinada;
- aplicar varios aumentos manuales programados.

Debe definirse:

- fecha efectiva;
- porcentaje;
- base sobre la que se calcula;
- acumulación;
- criterio de redondeo.

### Ajuste por índice

Posibles referencias:

- IPC;
- ICL;
- UVA;
- CER;
- otro índice configurable.

El producto no debe asumir qué índice corresponde legalmente. El usuario elige el mecanismo definido por su obligación o contrato.

Datos necesarios:

- índice;
- valor o fecha base;
- frecuencia de ajuste;
- fecha del próximo ajuste;
- rezago de publicación;
- redondeo;
- piso o techo opcional;
- fuente;
- posibilidad de ajuste manual.

El valor aplicado debe quedar guardado. Una corrección posterior de la fuente no debe reescribir movimientos ya registrados silenciosamente.

### Ajuste manual extraordinario

Permitir cambiar el monto desde una fecha sin alterar la política principal.

Ejemplo: una bonificación, recargo o renegociación temporal.

## 6. Integración con Espacios

### Creación

Desde un Espacio se podría crear un compromiso indicando:

- nombre;
- frecuencia;
- monto o política;
- vencimiento;
- categoría interna;
- reparto;
- pagador habitual;
- si requiere confirmación.

También debería poder convertirse un movimiento existente en compromiso:

> Repetir este movimiento todos los meses.

### Aplicación mensual

1. Finp prepara la aplicación del período.
2. Calcula o solicita el monto.
3. Muestra el reparto estimado.
4. Un participante autorizado confirma.
5. Se crea un único movimiento en el Espacio.
6. Los balances y deudas del Espacio se actualizan.
7. Cada participante recibe su impacto privado según su configuración de “Mi Finp”.

### Impacto personal

La proyección personal debe considerar solamente la parte propia estimada, no el total del compromiso del Espacio.

Si el usuario suele pagar el total, conviene distinguir:

- salida de dinero estimada de su cuenta;
- gasto operacional propio;
- monto recuperable de otros participantes.

### Categorías

El compromiso compartido usa una categoría interna del Espacio. Cada participante conserva su estrategia personal:

- categoría automática del Espacio;
- categoría fija;
- mapeo por categoría interna;
- elección al impactar.

## 7. Proyección

La proyección operativa combina hoy:

- compromisos personales registrados, calculados, estimados o con monto a
  confirmar;
- compras modernas `1/1` en su primer cierre;
- consumos históricos sin plan en el período financiero de su fecha;
- planes mayores a una cuota en los períodos derivados del plan.

El plan es la fuente de verdad cuando existe: su transacción padre no se vuelve
a sumar. Los pagos de tarjeta no reducen el consumo proyectado. ARS y USD se
mantienen separados. La cuenta habitual y el vencimiento sólo aportan contexto;
no se infiere una cuenta de pago para tarjetas.

La vista parte de próximos seis períodos agrupados por tipo, ofrece Año
calendario y permite agrupar por tarjeta o categoría sin modificar ítems ni
totales. Cada detalle conserva certeza y enlace navegable. Las preferencias
recordadas personalizan la presentación; ningún cálculo se aprende.

La evolución futura puede combinar además:

- parte propia de compromisos de Espacios;
- ajustes porcentuales e índices oficiales;
- adelantos y montos recuperables;
- escenarios y cashflow por cuenta cuando sus reglas estén definidas.

Los niveles vigentes son:

- confirmado;
- calculado por regla;
- estimado;
- pendiente de monto real.

Un índice futuro debe agregar su estado pendiente sin degradar los niveles ya
implementados.

La evolución compartida debe permitir distinguir:

- total del compromiso;
- parte propia;
- salida de cuenta probable;
- monto recuperable;
- fecha de vencimiento;
- origen del cálculo.

## 8. Fuentes argentinas

Para automatizaciones futuras se pueden evaluar fuentes oficiales:

- IPC publicado por INDEC: <https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31>
- APIs del BCRA: <https://www.bcra.gob.ar/apis-banco-central/>
- Principales variables del BCRA, donde se publican series como UVA, CER e ICL: <https://www.bcra.gob.ar/catalogo_de_datos/principales-variables-monetarias-y-financieras/>

La integración debe usar adaptadores por fuente y conservar:

- identificador de serie;
- fecha del dato;
- valor;
- fuente;
- fecha de consulta;
- versión o metodología cuando esté disponible.

Debe existir carga manual si la fuente no está disponible o el contrato utiliza otro criterio.

## 9. Permisos y colaboración

Decisiones a definir:

- quién puede crear compromisos del Espacio;
- quién puede cambiar monto o política;
- si un cambio requiere confirmación;
- qué ocurre si cambia el reparto;
- cómo se notifica a participantes;
- quién puede omitir una aplicación;
- cómo se corrige un movimiento ya generado.

Recomendación inicial:

- owner/admin configura;
- participantes pueden proponer o completar el monto;
- cambios materiales quedan en actividad;
- cada aplicación muestra quién confirmó.

## 10. Notificaciones

Señales útiles:

- compromiso próximo;
- monto pendiente;
- índice publicado y ajuste calculado;
- aumento que entra en vigencia;
- aplicación lista para confirmar;
- compromiso registrado;
- compromiso vencido;
- cambio de reparto o monto.

Las notificaciones deben llevar directamente a la acción necesaria.

La primera versión implementada es in-app. El usuario elige el mismo día o una
anticipación en días; Finp deriva la fecha desde el vencimiento y prioriza el
insight cuando entra en ventana o queda vencido. No existe push, service worker
ni ejecución en segundo plano.

## 11. Historial y auditoría

Conservar:

- historial de montos;
- políticas anteriores;
- aumentos programados;
- valores de índices usados;
- overrides manuales;
- aplicaciones omitidas;
- movimientos generados;
- usuario que confirmó;
- cambios de reparto.

Editar una plantilla no debe modificar aplicaciones pasadas.

## 11.1 Integración con Captura rápida

Captura rápida funciona como puerta de entrada y orientador, pero la página de Compromisos conserva la responsabilidad de configurar plantillas.

Debe distinguir tres intenciones:

- registrar una transacción independiente;
- aplicar un compromiso pendiente;
- preparar un compromiso nuevo.

Una aplicación clara puede confirmarse desde Captura rápida reutilizando las mismas validaciones financieras y de período del servicio de Compromisos. Crear una plantilla nueva deriva a la página dedicada con un borrador precargado.

Ejemplos:

- `Pagué alquiler 675000 hoy mp`: propone aplicar el compromiso Alquiler del período actual.
- `Alquiler 650000 el 5 de cada mes`: prepara un compromiso mensual y abre su configuración.
- `Luz mensual monto variable`: prepara la recurrencia y la política de monto, pero requiere completar cuenta, vencimiento y demás datos obligatorios.
- `Alquiler 650000 ajusta por ICL cada 3 meses`: puede reconocer un posible índice y frecuencia, pero no debe inventar base contractual, primera fecha, rezago ni redondeo.

La transacción generada debe conservar vínculo y procedencia visibles. Editar el movimiento no altera la plantilla salvo confirmación explícita. Eliminarlo reabre la aplicación del período y no elimina el compromiso.

### Sugerencias desde recurrencia

El aprendizaje puede proponer un compromiso cuando existe evidencia mensual
suficiente bajo una descripción, comercio o nominaciones similares. El criterio
es híbrido: tres meses para un monto estable con variación de hasta 10 %, cinco
para un monto variable, cobertura temporal mínima de 75 %, una sola coincidencia
por mes y confianza mínima de 0,82.

El candidato debe:

- explicar coincidencias, meses observados y variación de montos;
- excluir cuotas, transferencias, deudas, movimientos de Espacios y aplicaciones ya vinculadas;
- comprobar que no exista un compromiso equivalente;
- proponer monto fijo cuando es estable o monto a confirmar cuando varía;
- recordar descartes y no insistir sin nueva evidencia;
- abrir Compromisos con un borrador, nunca crear la plantilla automáticamente.
- bonificar categorías habitualmente recurrentes y penalizar las ocasionales;
- permitir que seis o más repeticiones compensen la penalización de categoría.

Los candidatos funcionales reutilizan eventos y feedback del aprendizaje personal, pero se modelan separados de las personalizaciones de cuenta, categoría o comercio.

Estado implementado: `GET /api/commitments/suggestions` analiza hasta 18 meses
de movimientos compatibles y aplica el criterio híbrido definido en el ADR
0002. Excluye cuotas, Espacios, aplicaciones de compromiso y grupos de pago.
La tarjeta explica evidencia, abre la misma alta guiada y usa
`FunctionalSuggestionDismissal` para recordar `No es un compromiso`.

Caso de control: `Pizza`, tres meses y 52 % de variación no debe mostrarse. No
alcanza la evidencia de cinco meses requerida para un monto variable y su
categoría ocasional reduce la confianza.

## 12. Dependencias de evolución

La evolución funcional debe respetar estas dependencias:

1. compromisos personales con historia y snapshot;
2. orientación segura desde Captura rápida;
3. recurrencia explicable;
4. contexto compartido e impacto personal;
5. ajustes pautados;
6. índices con snapshot y fallback;
7. proyección por niveles de certeza.

Los dos primeros niveles están implementados. Los demás describen dependencias del diseño, no un backlog paralelo. Sus ítems, estados y prioridades viven únicamente en [`roadmap_finp.md`](roadmap_finp.md).

## 13. Riesgos

- Duplicar el compromiso como personal y compartido.
- Proyectar el total del Espacio como gasto propio.
- Recalcular historia con un índice nuevo.
- Automatizar un aumento antes de que el dato esté disponible.
- Confundir gasto propio con adelanto recuperable.
- Cambiar reparto histórico al editar la plantilla.
- Aplicar automáticamente servicios cuyo monto requiere factura.
- Acoplar el dominio a una norma o índice que puede cambiar.
- Confundir una transacción similar con la aplicación pendiente de un compromiso.
- Crear compromisos por inferencia sin confirmación.
- Repetir sugerencias funcionales hasta volver invasiva la captura.

## 14. Decisiones abiertas

- Si el compromiso es una entidad común con contexto o dos entidades especializadas.
- Cómo modelar compromisos semanales dentro de períodos financieros.
- Si una aplicación pendiente afecta proyección, balances o ambos.
- Cómo resolver un pagador distinto al habitual.
- Qué ocurre si algunos participantes no integran su parte con Finp.
- Cómo migrar compromisos personales existentes hacia un Espacio.
- Qué índices se habilitan inicialmente.
- Qué política usar cuando falta el dato oficial.
