# Compromisos, Espacios y proyección

Última actualización: 2026-07-24

Estado: diseño funcional para revisión. No representa todavía un contrato técnico cerrado.

## 1. Problema

Los compromisos actuales son personales, tienen un monto base fijo y se aplican como transacciones privadas. Este modelo no cubre correctamente dos necesidades centrales:

1. Compromisos compartidos que pertenecen a un Espacio, como alquiler, expensas, luz, gas, internet o compras habituales del hogar.
2. Compromisos cuyos montos cambian periódicamente por ajustes manuales, porcentajes pautados o índices externos.

Sin estas capacidades:

- el usuario vuelve a cargar cada mes movimientos previsibles;
- los compromisos del hogar quedan separados de Espacios;
- la proyección repite montos que pueden haber quedado desactualizados;
- cada participante puede proyectar información distinta sobre una misma obligación compartida;
- se desperdicia información contractual conocida de antemano.

### Estado real auditado el 2026-07-24

- `ScheduledCommitment` modela solamente compromisos personales con monto fijo.
- Ya existe una entidad separada `CommitmentApplication`, única por usuario, compromiso y período, que enlaza el movimiento generado.
- La aplicación manual valida el período financiero, evita duplicados y revierte el movimiento nuevo si falla el registro de la aplicación.
- Desde el 2026-07-24 el movimiento generado atraviesa el motor unificado de reglas y conserva su trazabilidad.
- Todavía no existen contexto `space`, políticas de monto, historial de importes, estados de aplicación ni snapshots de cálculo/reparto.

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

La proyección futura debería combinar:

- compromisos personales;
- parte propia de compromisos de Espacios;
- cuotas de tarjetas;
- consumos de tarjeta en un pago;
- ajustes de monto programados;
- estimaciones variables;
- obligaciones pendientes de confirmación.

Cada monto proyectado necesita un nivel de certeza:

- confirmado;
- calculado por regla;
- estimado;
- pendiente de índice;
- pendiente de monto real.

La interfaz debe permitir distinguir:

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

El aprendizaje puede proponer un compromiso cuando existen al menos tres períodos mensuales consistentes bajo una descripción, comercio o nominaciones similares.

El candidato debe:

- explicar coincidencias, meses observados y variación de montos;
- excluir cuotas, transferencias, deudas, movimientos de Espacios y aplicaciones ya vinculadas;
- comprobar que no exista un compromiso equivalente;
- proponer monto fijo cuando es estable o monto a confirmar cuando varía;
- recordar descartes y no insistir sin nueva evidencia;
- abrir Compromisos con un borrador, nunca crear la plantilla automáticamente.

Los candidatos funcionales reutilizan eventos y feedback del aprendizaje personal, pero se modelan separados de las personalizaciones de cuenta, categoría o comercio.

## 12. Fases sugeridas

### Fase 1: compromisos personales variables

- historial de montos;
- cambios efectivos desde una fecha;
- monto variable a confirmar;
- proyección usando el monto correcto por período.
- snapshots y estados de aplicación;
- procedencia visible en la transacción generada.

### Fase 2: Captura rápida y orientación

- compromisos pendientes en el contexto de Captura rápida;
- aplicación segura desde el diálogo;
- derivación de nuevas plantillas con borrador precargado;
- onboarding contextual;
- vínculo reversible entre transacción y aplicación.

### Fase 3: recurrencia aprendida

- candidatos mensuales desde historial vigente;
- explicación de evidencia y política de monto propuesta;
- feedback, descarte persistente y recuperación con nueva evidencia;
- sugerencias coordinadas entre Captura rápida y Compromisos.

### Fase 4: compromisos en Espacios

- contexto `space`;
- categoría y reparto;
- aplicación idempotente a un movimiento;
- impacto privado mediante el flujo existente.

### Fase 5: ajustes pautados

- agenda de montos;
- porcentajes por fecha;
- redondeo;
- vista de próximos aumentos.

### Fase 6: índices

- fuentes oficiales;
- cálculo por índice;
- rezagos;
- fallback manual;
- trazabilidad del dato.

### Fase 7: proyección avanzada

- certeza de cada monto;
- parte propia y salida de cuenta;
- escenarios;
- alertas por cambios;
- conexión con límites y objetivos de ahorro.

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
