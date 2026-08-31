# Especificación funcional de Finp

> Estado: vigente
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Última actualización: 2026-08-30
> Fuente de verdad: propósito, conceptos y comportamiento funcional esperado

## Índice

1. [Propósito](#1-propósito)
2. [Problema que resuelve](#2-problema-que-resuelve)
3. [Visión](#3-visión)
4. [Principios funcionales](#4-principios-funcionales)
5. [Conceptos fundamentales](#5-conceptos-fundamentales)
6. [Usuarios, privacidad y colaboración](#6-usuarios-privacidad-y-colaboración)
7. [Navegación y ciclo cotidiano](#7-navegación-y-ciclo-cotidiano)
8. [Finanzas personales](#8-finanzas-personales)
9. [Captura e ingreso de datos](#9-captura-e-ingreso-de-datos)
10. [Automatización y aprendizaje](#10-automatización-y-aprendizaje)
11. [Espacios](#11-espacios)
12. [Deudas](#12-deudas)
13. [Notificaciones, pendientes e insights](#13-notificaciones-pendientes-e-insights)
14. [Proyección y anticipación](#14-proyección-y-anticipación)
15. [Integraciones entre funciones](#15-integraciones-entre-funciones)
16. [Mobile y evolución de plataformas](#16-mobile-y-evolución-de-plataformas)
17. [Confianza y control](#17-confianza-y-control)
18. [Métricas de producto](#18-métricas-de-producto)
19. [Límites actuales de la visión](#19-límites-actuales-de-la-visión)
20. [Relación con estado y roadmap](#20-relación-con-estado-y-roadmap)

## 1. Propósito

Finp ayuda a una persona a registrar, entender y anticipar sus finanzas personales y compartidas.

Su objetivo no es maximizar el tiempo dentro de la aplicación. Debe minimizar el esfuerzo necesario para conservar información útil y transformar esa información en decisiones claras.

## 2. Problema que resuelve

Las aplicaciones de gestión financiera dependen de datos actualizados. Cuando no existe integración suficiente con bancos y billeteras:

- el ingreso manual se vuelve tedioso;
- varios días sin registrar generan omisiones;
- una base incompleta produce saldos y reportes poco confiables;
- la pérdida de confianza desmotiva el uso;
- registrar deja de sentirse útil.

Finp responde bajando el costo de registrar —captura rápida, varios caminos de
ingreso, importación asistida, reglas y aprendizaje personal— y devolviendo algo
útil de inmediato: saldos, contexto, proyección e insights.

La automatización debe reducir trabajo, no ocultar decisiones financieras.

## 3. Visión

Finp busca ser un compañero financiero:

- cotidiano, pero no demandante;
- personal, pero no invasivo;
- automático, pero no incontrolable;
- completo, pero progresivo;
- colaborativo, sin exponer la contabilidad privada;
- útil en mobile y profundo en web.

La dirección de plataformas está en [Mobile y evolución de plataformas](#16-mobile-y-evolución-de-plataformas).

## 4. Principios funcionales

### Exactitud antes que conveniencia

Un resultado simple no justifica clasificar mal una operación ni mezclar conceptos.

### Menor esfuerzo útil

Cada decisión pedida al usuario debe aportar exactitud o control. Los valores conocidos se reutilizan y los campos derivados se explican.

### Separación de contextos

El dinero personal, el dinero compartido y la deuda entre personas se relacionan, pero no son la misma contabilidad.

### Orientación

Una entrada simple puede revelar una intención compleja. Finp puede orientar y trasladar contexto, pero el módulo especializado confirma.

### Consentimiento

Una sugerencia nunca equivale a una acción completada. Las automatizaciones de impacto financiero necesitan autoridad explícita.

### Historia estable

Cambios futuros no reescriben períodos anteriores sin una decisión visible.

### Mobile-first

Los recorridos cotidianos se resuelven primero en mobile. Desktop permite más densidad, no reglas distintas.

## 5. Conceptos fundamentales

### Dinero real

Movimiento efectivo de fondos en una cuenta: débito, crédito, transferencia, cambio, pago o cobro.

### Dinero operacional

Monto que representa ingreso o gasto del período para análisis de hábitos y resultado.

Una operación puede mover dinero real sin ser ingreso o gasto operacional.

### Cuenta

Fuente o destino de dinero personal. Puede operar en ARS, USD o múltiples monedas según su configuración.

### Transacción

Registro financiero personal. Su tipo determina cuentas, moneda, efecto real y efecto operacional.

### Período financiero

Ventana de análisis configurada por usuario. `monthStartDay` define el inicio y debe usarse de manera uniforme.

### Compromiso

Plantilla recurrente o esperada. Una aplicación concreta genera o se vincula con una transacción y conserva snapshot.

La plantilla conserva monto inicial, agenda de vigencias, recurrencia, período
de actividad y recordatorio opcional. La interfaz muestra el monto resuelto para
el período, desde cuándo rige y cuándo se aplicó. Un compromiso finalizado o
desactivado conserva historia, pero no genera pendientes ni proyección.

### Espacio

Contexto compartido persistente con participantes, movimientos, reparto, balances y pagos.

### Deuda

Obligación pendiente entre personas o contrapartes. Puede ser manual o derivarse de un Espacio.

### Parte propia

Porción de un movimiento compartido que corresponde al usuario. No es necesariamente el monto pagado.

### Pendiente

Acción que requiere decisión. No es equivalente a una notificación informativa.

### Regla

Automatización explícita y administrable que clasifica movimientos bajo condiciones conocidas.

### Patrón aprendido

Preferencia inferida desde el historial del usuario. Tiene menor autoridad que texto explícito, alias y reglas.

## 6. Usuarios, privacidad y colaboración

### Cuenta de usuario

El usuario administra:

- perfil y acceso;
- preferencias;
- período financiero;
- privacidad visual;
- cuentas, categorías y transacciones;
- aprendizaje y alias.

### Aislamiento

Los datos personales sólo pueden consultarse o modificarse por su propietario autorizado.

### Colaboración

En un Espacio:

- los participantes comparten movimientos y balances del contexto;
- los permisos controlan administración y acciones;
- cuentas, categorías personales y decisiones de integración siguen privadas;
- cada participante decide cómo impactar su parte en Finp.

### Invitaciones

Un link de invitación:

- tiene expiración;
- puede revocarse;
- no expone detalles financieros antes de aceptar;
- permite onboarding directo al Espacio;
- no guarda el token plano.

## 7. Navegación y ciclo cotidiano

El ciclo principal es:

1. capturar o importar;
2. revisar lo interpretado;
3. confirmar;
4. entender impacto;
5. resolver pendientes;
6. anticipar próximos movimientos.

Superficies:

- Resumen/Dashboard;
- Transacciones;
- Cuentas;
- Categorías;
- Tarjetas y cuotas;
- Compromisos;
- Proyección;
- Reglas;
- Importación;
- Espacios;
- Deudas;
- Configuración;
- Notificaciones y pendientes.

La navegación debe mostrar señales accionables sin convertir cada novedad en una interrupción.

## 8. Finanzas personales

### Cuentas

El usuario puede:

- crear, editar y archivar cuentas;
- definir moneda o capacidad multi-moneda;
- establecer saldos iniciales;
- consultar saldo e historial;
- usar cuentas como origen o destino.

El saldo disponible es acumulado. El resultado del período mide otra cosa y no debe confundirse con el saldo.

### Categorías

- categorías por defecto y personalizadas;
- compatibilidad con ingreso o gasto;
- color semántico;
- ranking contextual;
- categorías automáticas de Espacios ocultas del CRUD normal cuando corresponda.

### Transacciones

Tipos principales:

- ingreso;
- gasto;
- gasto con tarjeta;
- transferencia;
- cambio;
- pago de tarjeta;
- ajuste.

Cada tipo tiene reglas propias de cuentas, monedas y efecto operacional. Editar o eliminar debe revertir relaciones derivadas de forma explícita.

### Cambios de moneda

El flujo distingue qué se entrega y qué se recibe, cuentas compatibles, cotización y ambos saldos resultantes. La cotización puede partir de una referencia externa y ser editada.

### Tarjetas y cuotas

- compras con tarjeta;
- planes de cuotas;
- resumen por período;
- deuda pendiente;
- pagos de tarjeta;
- estado del período por tarjeta y moneda: sin consumos, pagada, parcial, impaga
  o con saldo a favor, sin presentar un pago parcial como total ni sumar ARS y
  USD;
- alcance explícito al eliminar un pago dual: una parte o el grupo completo.

Una cuota no debe duplicar el impacto de la compra que la originó.

### Dashboard y reportes

El Dashboard muestra:

- saldos;
- resultado del período;
- ingresos y gastos operacionales;
- señales y comparaciones;
- compromisos o vencimientos relevantes;
- información por moneda o con conversión explícita.

No se mezclan monedas sin fuente y criterio de conversión.

## 9. Captura e ingreso de datos

### Formulario completo

Es la superficie de autoridad para operaciones detalladas y tipos especializados.

### Captura rápida

Permite expresar una operación cotidiana en texto. Interpreta, entre otros:

- tipo simple;
- monto;
- moneda;
- fecha;
- descripción;
- cuenta;
- categoría;
- comercio.

Antes de escribir:

- muestra resumen vivo;
- permite editar;
- indica regla o aprendizaje aplicado;
- anticipa impacto;
- detecta duplicados y fechas especiales.

Captura rápida también debe admitir consumos con tarjeta de crédito, porque son
una operación cotidiana de alta frecuencia:

- un consumo en un pago puede resolverse dentro del diálogo cuando tarjeta,
  monto, moneda, fecha y categoría son válidos; debe anticipar la deuda y el mes
  de impacto;
- un consumo en varias cuotas conserva lo interpretado y abre el flujo
  especializado para confirmar tarjeta, cantidad de cuotas, primer cierre y
  demás datos propios del plan;
- si la tarjeta no puede identificarse con suficiente confianza, Finp pregunta
  o deriva sin convertir el consumo en un gasto de cuenta común;
- un consumo con tarjeta y el pago del resumen son operaciones distintas y no
  se infieren una de otra;
- el pago del resumen transporta tarjeta, monto, moneda y fecha, pero exige que
  la persona elija la cuenta de origen;
- una referencia `cuota N de M` abre la revisión del plan existente y no crea
  otro;
- el primer mes propuesto es el próximo mes calendario y puede editarse antes de
  confirmar;
- una intención clasificada como tarjeta no ofrece salida como gasto simple.

### Orientación

Captura rápida distingue:

1. transacción independiente;
2. aplicación de un pendiente;
3. preparación de una función nueva.

Una intención explícita tiene prioridad. Las funciones complejas reciben un borrador tipado y versionado, con procedencia por campo.

Para recurrencias, el orden es: recurrencia explícita, compromiso pendiente,
candidato mensual aprendido y transacción simple. Captura rápida y Compromisos
comparten identidad, evidencia y descarte del candidato; crear la plantilla o
registrar sólo el gasto actual siempre requiere una elección.

### Importación

- plantilla o archivo;
- análisis;
- filas en borrador;
- reglas compartidas;
- revisión y corrección;
- confirmación.

Una importación no debe saltar validaciones disponibles en el ingreso manual.

### Bandeja de revisión

Una bandeja diaria puede agrupar borradores, imports, movimientos incompletos y sugerencias. Debe ser un complemento, no un requisito para registrar.

## 10. Automatización y aprendizaje

### Jerarquía

1. texto y selecciones explícitas;
2. alias;
3. reglas;
4. aprendizaje personal;
5. defaults de interfaz.

Una capa inferior no reemplaza una intención superior.

### Reglas

- condiciones normalizadas;
- acciones compatibles;
- prioridad y conflictos;
- simulación sin escritura;
- trazabilidad en la transacción;
- administración, pausa y eliminación;
- sugerencias de reglas sin creación automática.

### Aprendizaje

Puede aprender descripción, cuenta, categoría y comercio desde movimientos simples confirmados.

Debe:

- aplicar umbrales conservadores;
- explicar evidencia;
- aceptar correcciones;
- recordar descartes;
- permitir pausa, olvido, restauración y reinicio;
- retener sólo telemetría necesaria;
- aislar datos por usuario.

### Candidatos funcionales

El historial puede sugerir:

- compromiso recurrente;
- regla;
- frecuente;
- revisión.

Crear una entidad o automatización siempre requiere confirmación.

Un candidato de compromiso exige evidencia híbrida —duración, cobertura,
estabilidad del monto y afinidad de categoría— y es más estricto con montos
variables que con montos estables. La confianza es un umbral de presentación: no
se muestra como certeza ni autoriza una escritura.

El candidato explica período, cobertura, estabilidad, día y categoría, descarta
movimientos ya vinculados y recuerda rechazos. Abre el alta guiada con un
borrador; nunca crea la plantilla automáticamente.

Los umbrales exactos y las categorías que bonifican o penalizan la señal viven en
[`../decisiones/0002-criterio-hibrido-sugerencias-de-compromisos.md`](../decisiones/0002-criterio-hibrido-sugerencias-de-compromisos.md).

## 11. Espacios

Un Espacio permite:

- crear un contexto compartido;
- administrar participantes, roles y configuración;
- registrar movimientos;
- repartir por partes iguales, responsable único, porcentajes o montos;
- consultar balances;
- registrar settlements;
- ver actividad;
- adjuntar imágenes o PDF;
- editar o anular con trazabilidad;
- invitar por link.

Puede usarse sin configurar las finanzas personales. El movimiento, el reparto,
los balances y la actividad pertenecen al contexto compartido; cuentas,
categorías, transacciones e historia personal permanecen privadas. Cuando ambos
planos se relacionan, Mi Finp conserva autoridad absoluta sobre la contabilidad
del usuario.

### Deuda directa y simplificada

El Espacio puede mostrar deudas directas o una simplificación de pagos. La representación no cambia el historial de movimientos.

### Monedas y cotizaciones

Un Espacio puede operar integralmente con varias monedas. Cada gasto conserva
importe original, equivalente histórico de reporte y snapshot de la conversión.
Los agregados identifican las monedas incluidas y permiten abrir su composición;
las posiciones abiertas pueden mostrar además una equivalencia actual sin
reescribir historia.

La deuda y su simplificación mantienen saldos independientes por moneda. Una
liquidación puede elegir varios componentes y combinar varios tramos de pago;
primero aplica la misma moneda y luego las conversiones explícitas revisadas por
la persona. El dinero pagado, el aplicado y la diferencia de cambio no se
confunden con gasto operacional.

Las referencias automáticas pueden reemplazarse manualmente. Una cotización
vencida o cambiada exige revisión y conserva el borrador. La tira de referencias
y el detalle `Incluye…` informan fuente, antigüedad y composición sin sobrecargar
el monto principal.

### Impacto personal

Cada participante decide si registra su parte en Mi Finp. `Agregar a Mi Finp`
crea una transacción privada cuyo gasto operacional es la parte propia exacta:

- si pagó más que su parte, la cuenta refleja la salida real y la diferencia se
  conserva como adelanto recuperable, no como gasto;
- si no pagó, reconocer la parte propia no inventa una salida de cuenta; esa
  salida ocurre al liquidar;
- si no pagó y su parte es cero, se muestra de forma explícita y no se ofrece
  una acción financiera;
- si pagó por otras personas y su parte es cero, puede registrar la salida real
  como adelanto y deuda a favor con gasto operacional cero;
- la decisión privada no cambia el estado compartido ni el impacto de otra
  persona.

Si el usuario autenticado es el pagador y elige una tarjeta propia, Mi Finp
registra un consumo privado `1/1` sin plan de cuotas. El cargo de la tarjeta usa
el total real pagado y el gasto operacional conserva la parte propia; los pagos
de tarjeta reducen el pendiente de la tarjeta, no el gasto histórico ni el
balance compartido. Mi Finp mantiene ARS/USD y no convierte implícitamente un
movimiento de otra moneda. Espacios no admite todavía varias cuotas.

Si el movimiento compartido cambia materialmente, el impacto personal pasa a revisión.
Quitar el movimiento de Mi Finp elimina su transacción personal vinculada y
marca el impacto privado como removido; no modifica el movimiento compartido.
La acción identifica de forma explícita la transacción seleccionada y es
idempotente. Si falta el impacto privado porque un alta anterior falló después
de crear la transacción, puede quitar exclusivamente esa transacción huérfana
si todavía coincide con el usuario, el Espacio y el movimiento de origen.

### Configuración personal

Un participante puede:

- elegir categoría al impactar;
- usar una categoría automática del Espacio;
- usar una categoría fija;
- mapear categorías compartidas a personales.

Esta configuración no es pública para los demás participantes.

### Borrador de nuevo movimiento

Existe como máximo un borrador activo por usuario y Espacio. Es persistente,
privado y visible en Movimientos sólo para su autor con una etiqueta clara. No
participa en balances, actividad, deudas, impactos ni notificaciones hasta que
una publicación atómica e idempotente crea el movimiento compartido.

Cerrar el diálogo conserva el borrador. Abrir `Nuevo gasto` lo reanuda; el autor
puede descartarlo de forma explícita. Autosave, revisión optimista y adjuntos
recuperables evitan pérdida o sobrescritura silenciosa. Guardado, preview y
publicación usan el mismo contrato exacto de dinero, fecha y reparto.

El contrato completo de autoridad, recorridos y verificación vive en
[`espacios.md`](espacios.md) y en la decisión
[`0007`](../decisiones/0007-autoridad-espacios-finp-deudas.md). La solución
técnica integral se define en la decisión
[`0008`](../decisiones/0008-modelo-consistencia-financiera-espacios.md).
La autoridad por moneda, las cotizaciones y las liquidaciones multitramos se
definen en la decisión
[`0009`](../decisiones/0009-autoridad-multimoneda-espacios.md).
El consumo privado de tarjeta `1/1` y el borrador persistente se definen en las
decisiones [`0012`](../decisiones/0012-gasto-espacio-tarjeta-un-pago.md) y
[`0013`](../decisiones/0013-borrador-privado-persistente-movimiento-espacio.md).

## 12. Deudas

Deudas permite:

- registrar obligaciones manuales;
- consultar deudas derivadas de Espacios;
- distinguir “Debo” y “Me deben”;
- pagar o cobrar total o parcialmente;
- ignorar o restaurar deudas derivadas;
- consolidar por persona;
- consultar timeline;
- abrir una relación, profundizar en una deuda y volver sin perder contexto;
- completar alta, pago y cobro en mobile con acciones siempre visibles.

Pagar o cobrar:

- mueve dinero real;
- no se clasifica como gasto o ingreso operacional;
- actualiza deuda y movimiento de manera atómica;
- evita duplicar obligaciones provenientes de Espacios.

En deudas derivadas, el saldo permanece expresado por moneda. Un pago en otra
moneda sólo reduce la obligación mediante una aplicación y un snapshot
explícitos; los saldos restantes conservan la moneda original.

## 13. Notificaciones, pendientes e insights

### Notificación

Informa un evento. Puede leerse, archivarse o descartarse.

### Pendiente

Requiere una acción o decisión. Tiene estado propio y no se resuelve por marcar la notificación como leída.

### Review

Permite revisar impactos personales cuando cambia o se anula su origen.

### Insight

Resume una señal relevante y conduce a la superficie adecuada. No debe presentar una inferencia como certeza.

El sistema deduplica señales y resuelve estados obsoletos cuando la acción ya fue atendida.

## 14. Proyección y anticipación

### Proyección

La proyección combina:

- compromisos;
- consumos con tarjeta en un pago;
- consumos con tarjeta en cuotas;
- aplicaciones y montos por período;
- contexto habitual de cuenta o vencimiento cuando existe.

Debe distinguir:

- real;
- confirmado;
- calculado;
- estimado;
- pendiente de confirmación.

Los compromisos variables usan el monto efectivo del período. Ajustes porcentuales, índices oficiales, compromisos de Espacios y escenarios avanzados requieren etapas posteriores definidas en el roadmap.

Las fechas de compromiso se derivan desde una única regla de dominio. Los días
29–31 se ajustan al último día real del mes, la primera ocurrencia nunca precede
la fecha de inicio y el recordatorio puede cruzar al mes anterior. Una ocurrencia
anterior al inicio no es pendiente ni forma parte de la proyección.

La lectura de tarjetas separa `TC · un pago` de `TC · cuotas`. Un plan `1/1`
usa su primer cierre, se presenta como un pago y queda confirmado. Un consumo
histórico sin plan usa el período financiero de su fecha y también queda
confirmado. Un plan mayor a una cuota deriva sus períodos y queda calculado. La
transacción padre de un plan y los pagos de tarjeta no se suman como consumos.

La vista inicial usa próximos seis períodos y agrupación por tipo. Año
calendario es secundario y permite elegir año. Los períodos pasados distinguen
lo registrado de lo esperado. La moneda del gráfico parte de la moneda
consolidada del usuario, pero ARS y USD se leen y totalizan siempre por separado.

Las agrupaciones disponibles recorren:

- por tipo: fuente → tarjeta cuando corresponde → categoría → consumo;
- por tarjeta: Compromisos separados y tarjeta → tipo → categoría → consumo;
- por categoría: categoría → tipo → tarjeta cuando corresponde → consumo.

Cada consumo expone certeza, contexto de cuenta o vencimiento y un enlace a la
superficie responsable. Los enlaces pueden transportar período, tarjeta,
categoría y tipo, pero nunca montos. Una cuenta habitual de compromiso es
contexto; Finp no inventa la cuenta futura de pago de una tarjeta ni calcula
cashflow por cuenta en este cierre.

Los montos pendientes muestran “Monto a confirmar”, no `$0`. El resumen
advierte estimaciones y datos incompletos. Dentro de cada grupo, el recorrido
esperado conserva:

1. período;
2. tipo de proyección;
3. tarjeta;
4. categoría, con monto y porcentaje sobre esa tarjeta y ese tipo;
5. consumos individuales.

La agregación no modifica la contabilidad ni duplica consumos. Debe contemplar
tanto la representación vigente como datos históricos compatibles y conservar
una única fuente para período, moneda, categoría y monto.

La persona puede elegir vistas útiles —por tipo, tarjeta o categoría— y Finp
recuerda agrupación, modo, horizonte y moneda del gráfico por usuario. Esa
personalización cambia la presentación, no la inclusión de movimientos ni las
reglas financieras. Su nivel de aprendizaje es `personalizar`; ningún cálculo
financiero se aprende ni automatiza.

Escenarios, cashflow proyectado por cuenta y la parte propia o recuperable de
compromisos compartidos pertenecen a ítems separados del roadmap.

### Análisis y planificación

Proyección responde principalmente cómo pueden evolucionar los próximos
períodos. El análisis histórico y la administración de hábitos forman una
superficie relacionada, pero distinta, que debe permitir:

- consultar gastos por categoría y período;
- profundizar desde categoría a cuentas, tarjetas y movimientos;
- comparar categorías y métodos de pago;
- detectar patrones y montos fuera de lo habitual con evidencia explicable;
- definir objetivos y límites por categoría;
- revisar avance, desvíos y efecto esperado sobre la proyección.

Proyección y análisis pueden compartir agregaciones y ofrecer navegación entre
sí, pero no deben concentrar todos los recorridos en una sola pantalla. Un
límite u objetivo informa y orienta; no bloquea ni altera una transacción por
sí mismo.

## 15. Integraciones entre funciones

### Captura rápida → módulo especializado

La intención se interpreta, se muestra y se transporta. El destino conserva autoridad y confirmación final.

### Espacio → Finp personal

El movimiento compartido permanece compartido. Cada usuario crea o vincula su
impacto privado por su parte propia exacta. El total pagado sólo afecta su cuenta
real cuando corresponda y no infla el gasto operacional.

### Espacio → Deuda

Los balances pueden producir deudas derivadas idempotentes. Liquidar desde
Espacios o Deudas usa la misma operación; pagar o cobrar no altera el carácter
operacional del gasto original.

### Compromiso → Transacción

Aplicar genera o vincula una transacción y conserva origen, período y snapshot.
La aplicación es manual mientras no exista un scheduler con idempotencia,
reintentos y observabilidad. La interfaz no ofrece modos automáticos inertes.

### Regla → Puntos de ingreso

Nueva transacción, Captura rápida, importación, cuotas, compromisos e impactos autorizados deben usar el mismo motor.

### Eliminación

Eliminar una transacción debe identificar y resolver compromisos, impactos, notificaciones, cuotas u otras relaciones. Las cascadas ambiguas se reportan y requieren una decisión.
La eliminación lee primero la transacción con alcance de usuario, ejecuta el
teardown mientras existe y sólo después la borra. Las superficies que la
invocan comparten esa operación y no confirman éxito si el movimiento personal
continúa vigente.

## 16. Mobile y evolución de plataformas

Finp es hoy una aplicación web responsive y la web es el producto principal. Una
aplicación mobile nativa o multiplataforma es una evolución posible que requiere
discovery técnico y madurez funcional previa.

Dirección:

1. completar y estabilizar el producto web;
2. mejorar experiencia mobile web;
3. estudiar instalación, notificaciones y capacidades offline;
4. evaluar alternativas Android/iOS;
5. decidir con una ADR basada en requisitos reales.

No se ha decidido entre PWA, wrapper web, framework multiplataforma o aplicaciones nativas.

## 17. Confianza y control

Finp debe permitir:

- revisar antes de confirmar;
- entender procedencia;
- corregir;
- pausar automatismos;
- deshacer cuando sea seguro;
- identificar qué tuvo impacto financiero;
- distinguir error de operación fallida frente a error posterior de sincronización;
- conservar historia.

Una función que calcula correctamente pero no puede descubrirse, entenderse, controlarse o verificarse no está completa.

## 18. Métricas de producto

Métricas orientativas:

- tiempo y decisiones para registrar;
- días con información actualizada;
- proporción de capturas completadas;
- correcciones posteriores;
- sugerencias aceptadas y realmente completadas;
- automatizaciones pausadas o revertidas;
- pendientes resueltos;
- uso mobile;
- reducción de movimientos omitidos;
- continuidad de uso sin aumentar carga.

No se optimiza cantidad de sugerencias ni tiempo dentro de la aplicación como fines propios.

## 19. Límites actuales de la visión

- Finp no reemplaza una cuenta bancaria.
- No ejecuta transferencias bancarias.
- No crea operaciones financieras complejas sólo por inferencia.
- No comparte cuentas o categorías personales entre participantes.
- No promete sincronización bancaria universal.
- No eligió todavía una arquitectura mobile/offline.
- No recalcula historia mediante índices nuevos sin snapshot y política explícita.

## 20. Relación con estado y roadmap

- [`estado_actual_finp.md`](estado_actual_finp.md) indica qué parte de esta especificación existe y fue verificada.
- [`roadmap_finp.md`](roadmap_finp.md) es el único lugar para prioridades y pendientes.
- Los documentos de dominio profundizan contratos.
- [`../tecnico/arquitectura.md`](../tecnico/arquitectura.md) describe cómo se implementan los límites.
