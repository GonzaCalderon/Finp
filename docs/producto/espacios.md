# Espacios en Finp

> Estado: vigente
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Última actualización: 2026-08-30
> Fuente de verdad: reglas funcionales y experiencia esperada de Espacios

## Índice

1. [Propósito y autonomía](#1-propósito-y-autonomía)
2. [Planos de autoridad](#2-planos-de-autoridad)
3. [Tipos y ciclo de vida](#3-tipos-y-ciclo-de-vida)
4. [Participantes, permisos e invitaciones](#4-participantes-permisos-e-invitaciones)
5. [Movimientos, reparto y balances](#5-movimientos-reparto-y-balances)
6. [Deudas y liquidaciones](#6-deudas-y-liquidaciones)
7. [Impacto personal en Mi Finp](#7-impacto-personal-en-mi-finp)
8. [Pendientes, notificaciones y revisión](#8-pendientes-notificaciones-y-revisión)
9. [Categorías y configuración](#9-categorías-y-configuración)
10. [Recorridos e interfaz](#10-recorridos-e-interfaz)
11. [Estados, errores y accesibilidad](#11-estados-errores-y-accesibilidad)
12. [Aprendizaje y automatización](#12-aprendizaje-y-automatización)
13. [Multimoneda integral](#13-multimoneda-integral)
14. [Migración progresiva](#14-migración-progresiva)
15. [Verificación obligatoria](#15-verificación-obligatoria)
16. [Decisiones y evolución](#16-decisiones-y-evolución)

Las posibilidades futuras descritas aquí no establecen prioridad. El backlog
único es [`roadmap_finp.md`](roadmap_finp.md).

## 1. Propósito y autonomía

Un Espacio es el contexto compartido donde Finp organiza gastos, balances,
pagos entre participantes y trazabilidad colaborativa. Sirve para casos
persistentes o coordinados, como una pareja, un hogar, un viaje o un proyecto.

Espacios puede usarse de forma autónoma:

- una persona puede participar sin configurar cuentas, categorías, dashboard o
  saldo inicial en Mi Finp;
- registrar y liquidar movimientos compartidos no depende de crear una
  transacción personal;
- la información privada de Mi Finp nunca se expone a los demás participantes.

Cuando una persona decide relacionar un movimiento con Mi Finp, la contabilidad
personal tiene autoridad absoluta sobre su cuenta, categoría, historia y
reporting. El Espacio aporta el origen, el total y el reparto; no reemplaza las
reglas financieras de Mi Finp.

## 2. Planos de autoridad

Finp mantiene tres planos coordinados, pero no intercambiables:

| Plano | Fuente de verdad | Puede modificar | No puede modificar |
|---|---|---|---|
| Espacio compartido | Movimiento, pagador, total, moneda, reparto, balances y actividad | Estado colaborativo y saldos del Espacio | Cuentas, categorías o decisiones privadas |
| Mi Finp | Transacción e impacto personal del usuario actual | Cuenta propia, categoría personal, reporting e historia privada | Movimiento compartido o impacto de otra persona |
| Deudas | Obligación pendiente y sus pagos o cobros | Saldo derivado y movimientos reales de liquidación | Gasto operacional original o historial compartido |

Reglas obligatorias:

- existe un único movimiento compartido como origen;
- cada participante tiene, como máximo, un impacto personal activo por
  movimiento;
- una acción privada nunca aprueba, rechaza, completa ni reabre el movimiento
  para los demás;
- la parte propia se distingue del total pagado y del adelanto recuperable;
- las operaciones derivadas son idempotentes y conservan referencias al origen;
- una acción iniciada desde Espacios o Deudas invoca la misma operación de
  dominio cuando representa la misma intención financiera.

La decisión estructural está registrada en
[`0007 — Autoridad entre Espacios, Mi Finp y Deudas`](../decisiones/0007-autoridad-espacios-finp-deudas.md).
El modelo, la atomicidad y la migración se rigen por
[`0008 — Modelo y consistencia financiera de Espacios`](../decisiones/0008-modelo-consistencia-financiera-espacios.md).
El backfill, la coexistencia y el retiro del legado se rigen por
[`0010 — Migración progresiva de Espacios v2`](../decisiones/0010-migracion-progresiva-espacios-v2.md).

## 3. Tipos y ciclo de vida

El flujo principal prioriza:

- Pareja;
- Grupo/Hogar;
- Viaje;
- Proyecto.

El dominio también admite Evento, Personal y Otro. La etiqueta orienta la
experiencia inicial; no crea reglas financieras implícitas.

El ciclo de vida es explícito:

- activo: admite operaciones autorizadas;
- pausado: congela escrituras compartidas hasta reanudar, pero permite resolver
  impactos privados y revisiones;
- cerrado: no admite gastos ni ediciones nuevas, conserva historia y permite
  liquidar saldos existentes y resolver impactos privados;
- archivado: sólo lectura hasta una restauración autorizada.

Pausar, cerrar, reabrir, archivar o restaurar son acciones autorizadas y
registradas. Una excepción no se infiere desde la interfaz.

El período y las fechas se interpretan en la zona horaria del Espacio. Abrir,
editar o enviar un formulario no puede desplazar una fecha por conversiones UTC.

## 4. Participantes, permisos e invitaciones

Los permisos del servidor son la autoridad. La interfaz sólo ofrece acciones
que el usuario puede completar y no presenta una capacidad que el servidor
rechazará por diseño.

Reglas mínimas:

- `owner` conserva la autoridad final sobre el Espacio;
- `admin` administra según las capacidades explícitas del dominio;
- `member` participa y registra dentro de sus permisos;
- no se puede dejar un Espacio sin `owner` por una baja o cambio de rol;
- una remoción o cambio de rol no reescribe movimientos históricos;
- una persona inactiva sigue siendo identificable en repartos históricos, pero
  no se ofrece para movimientos nuevos.

Un `owner` o `admin` autorizado puede generar un enlace temporal:

- hay un solo enlace activo por Espacio;
- vence en 1, 3 o 7 días, con 7 días como valor inicial;
- regenerar revoca el enlace anterior;
- revocar invalida el enlace sin borrar su trazabilidad;
- el token plano nunca se guarda: sólo `tokenHash` y un adelanto corto;
- la pantalla separa con claridad invitar a una persona existente de compartir
  un enlace externo.

El ingreso por enlace es `space-first`: antes de aceptar sólo se muestran el
nombre, tipo, vencimiento e invitador disponible; después de iniciar sesión o
registrarse, la persona vuelve al mismo flujo y entra al Espacio sin completar
la configuración de Mi Finp.

## 5. Movimientos, reparto y balances

El flujo principal registra gastos compartidos. Cada movimiento conserva:

- descripción, fecha, moneda y total;
- persona que pagó;
- participantes incluidos y regla de reparto;
- categoría interna opcional;
- adjuntos y actividad;
- versiones, edición y anulación lógica.

El método de pago personal no forma parte del movimiento compartido. Cuenta,
tarjeta, categoría personal y estado de su resumen pertenecen exclusivamente al
impacto privado de cada usuario y nunca se exponen al Espacio.

Repartos admitidos:

- partes iguales;
- responsable único;
- porcentajes;
- montos fijos.

Antes de confirmar se muestran el total, el pagador y la parte de cada persona.
Los porcentajes y montos deben cerrar exactamente; los redondeos se asignan con
una regla determinista y visible. `Responsable único` asigna el total a una
persona y no simula un reparto igualitario.

Una edición conserva historia. Si cambia total, moneda, pagador, fecha o
reparto, se recalculan balances y se reconcilian los impactos personales según
la sección 8. Anular un movimiento no lo elimina físicamente ni borra
silenciosamente efectos privados ya registrados.

## 6. Deudas y liquidaciones

Cada Espacio usa un único criterio de deuda:

- directo: conserva el origen exacto entre participantes;
- simplificado: reduce la cantidad de pagos recomendados sin reescribir el
  historial.

Los balances del Espacio son la fuente compartida. Deudas presenta la obligación
derivada en el contexto personal. Cambiar el criterio recalcula el reflejo, no
los movimientos originales.

Una liquidación o `settlement`:

- puede ser parcial o total;
- reduce el saldo compartido inmediatamente;
- no es un gasto ni ingreso operacional nuevo;
- puede mover dinero real en la cuenta personal del participante que lo
  registra;
- conserva la relación con el Espacio y la deuda derivada;
- produce el mismo resultado si se inicia desde Espacios o desde Deudas;
- es atómica e idempotente ante reintentos.

La obligación se conserva por moneda. Una liquidación puede combinar varios
tramos de pago, pero cada aplicación a otra moneda muestra y conserva la
conversión utilizada. La simplificación no compensa monedas distintas.

Un pendiente de agregar un gasto a Mi Finp no es una deuda. Deudas no muestra
relaciones en cero ni mezcla decisiones privadas de registración con saldos
entre personas.

Los reintegros avanzados son una evolución posterior. Cuando se incorporen,
deberán distinguir devolución, adelanto recuperable y gasto sin distorsionar
balances ni reporting.

## 7. Impacto personal en Mi Finp

`Agregar a Mi Finp` significa crear una transacción privada para el usuario
actual a partir del gasto del Espacio. No es una confirmación del movimiento
compartido.

Contrato exacto:

- el gasto operacional de la transacción personal es siempre la parte propia
  vigente del usuario, nunca el total por conveniencia;
- si la persona pagó más que su parte, la cuenta refleja la salida real pagada,
  el reporting refleja sólo su parte propia y la diferencia queda como adelanto
  recuperable o deuda a favor;
- si la persona no pagó, puede reconocer su parte propia sin inventar una salida
  de cuenta; la cuenta se mueve cuando registre la liquidación real;
- si no pagó y su parte es cero, el detalle muestra `Tu parte: $0` y no crea una
  acción financiera;
- si pagó por otras personas y su parte es cero, ofrece `Registrar adelanto en
  Mi Finp`: refleja la salida real y la deuda a favor con gasto operacional cero;
- cuenta, categoría y configuración son privadas y las decide Mi Finp;
- moneda, fecha y referencia al origen no se pierden;
- repetir la misma acción no crea otra transacción;
- un fallo parcial no puede dejar una transacción huérfana ni un vínculo sin
  transacción.

### Gasto pagado con tarjeta en un pago

Si el usuario autenticado es el pagador, puede elegir una tarjeta propia para
registrar su impacto personal. El movimiento del Espacio sigue siendo un gasto
compartido común; Mi Finp crea un `credit_card_expense` privado sin
`InstallmentPlan`:

- el cargo real de la tarjeta es el total pagado;
- el gasto operacional es la parte propia vigente;
- la diferencia positiva es adelanto recuperable, no gasto;
- el pago total o parcial de la tarjeta reduce su pendiente por período y
  moneda, sin modificar el gasto histórico ni el balance del Espacio;
- el día financiero coincide con el `dateKey` civil del movimiento;
- sólo se ofrecen tarjetas propias en ARS o USD, que son las monedas vigentes de
  Mi Finp; no existe conversión implícita desde otra moneda del Espacio.

Este recorrido es exclusivamente `1/1`: no muestra ni acepta cantidad de cuotas.
Las cuotas en Espacios requieren un contrato futuro separado. La decisión
completa vive en
[`0012 — Gasto de Espacio pagado con tarjeta en un pago`](../decisiones/0012-gasto-espacio-tarjeta-un-pago.md).

Estados privados relevantes:

- `pending`: existe una parte propia positiva o un adelanto real todavía no
  resuelto;
- `linked`: existe una transacción personal vinculada;
- `ignored`: el usuario decidió no registrarla;
- `cancelled`: el origen dejó de requerir esa decisión;
- `removed`: se quitó la transacción personal vinculada;
- `needs_review`: cambió materialmente un origen ya vinculado.

`Quitar de Mi Finp` elimina sólo la transacción privada vinculada y marca el
impacto como `removed`. No modifica el Espacio. La confirmación anticipa cuenta,
dirección, monto y moneda; la operación valida por identidad exacta y es
idempotente.

## 8. Pendientes, notificaciones y revisión

Finp usa estas palabras con significados distintos:

- pendiente personal: decisión privada sobre una parte propia positiva;
- notificación: aviso descartable o archivable que apunta a un hecho;
- revisión: historia personal vinculada que requiere una decisión por un cambio
  material;
- deuda: obligación monetaria entre personas.

Por lo tanto:

- crear un movimiento compartido no queda pendiente de aprobación individual;
- archivar una notificación no resuelve el pendiente;
- una parte propia cero sin pago no genera pendiente, notificación accionable ni
  deuda; un pagador con parte cero puede tener un adelanto y deuda a favor;
- un pendiente nuevo puede actualizarse o cancelarse si cambia el reparto;
- un impacto `linked` nunca se reescribe automáticamente: pasa a
  `needs_review` si el origen cambia o se anula;
- resolver, ignorar o quitar una acción refresca Espacios, Mi Finp, Deudas y
  notificaciones relacionadas sin duplicarlas.

## 9. Categorías y configuración

Las categorías internas son compartidas: ordenan el historial del Espacio y
ofrecen un lenguaje común. No reemplazan categorías privadas.

Configuración General incluye:

- nombre, tipo, estado y período;
- monedas y moneda de reporte;
- participantes, roles e invitaciones;
- categorías internas;
- reparto inicial y criterio de deuda.

Configuración Mi Finp incluye sólo preferencias del usuario actual:

- elegir categoría al registrar;
- usar una categoría automática con el nombre del Espacio;
- usar una categoría personal fija;
- mapear categorías compartidas a personales.

La categoría automática es una `Category` privada real con origen en el
Espacio. Puede usarse en transacciones, filtros y reportes, pero permanece fuera
de la configuración normal si está marcada como virtual. Cambiar la estrategia
no migra historia ni registra transacciones sin confirmación; una migración
explícita sólo toca datos privados del usuario actual.

## 10. Recorridos e interfaz

La experiencia prioriza la tarea cotidiana y revela configuración avanzada sólo
cuando hace falta.

### Entrada y listado

La portada responde, en este orden:

1. cuáles son mis Espacios;
2. qué requiere atención;
3. cuál es la acción siguiente.

Tiene una acción primaria `Crear espacio`, estados vacío/carga/error y cards que
muestran nombre, tipo, participantes y una señal útil de balance o actividad,
sin convertir cada card en un panel de administración.

### Creación e invitación

Crear pide primero lo mínimo: tipo y nombre. Período, monedas, reparto, deuda y
categorías aparecen después como configuración guiada o valores revisables.
Invitar es un paso claro y omisible; no bloquea empezar a usar el Espacio.

### Navegación interna

Mobile y desktop conservan la misma arquitectura de información:

- Inicio: resumen, actividad y próxima acción;
- Movimientos: historial, filtros y `Nuevo gasto`;
- Balances: quién debe, quién recibe y liquidaciones;
- Configuración: General y Mi Finp, como destino secundario.

El responsive reorganiza esas secciones, pero no cambia nombres, significado ni
capacidades. Volver desde un detalle conserva el filtro y la posición anterior.

### Nuevo gasto

El recorrido principal usa tres decisiones breves:

1. gasto: descripción, total, moneda y fecha;
2. personas: quién pagó y cómo se reparte;
3. revisión: total, partes, balances e impacto personal posible.

La categoría, los adjuntos y las opciones infrecuentes son progresivos. La
confirmación permanece visible sobre la `safe area`, conserva el borrador ante
errores y lleva al primer campo inválido. El preview no presenta ausencia como
error mientras todavía calcula y la revisión final nunca abrevia el monto que
se va a confirmar.

Crear desde la portada o desde el detalle del Espacio invoca el mismo contrato
v2, con dinero exacto, `dateKey`, revisión esperada, cotizaciones e idempotencia.
No existe una variante rápida que envíe un payload legacy o omita la preview.

### Borrador personal persistente

Cada usuario puede tener un solo borrador activo de nuevo gasto por Espacio. Se
persiste como recurso privado separado del movimiento y sobrevive al cierre del
diálogo, navegación, sesión y cambio de dispositivo.

- Movimientos lo muestra únicamente a su autor, con etiqueta `Borrador`, última
  edición y acción `Continuar`;
- abrir `Nuevo gasto` reanuda el borrador activo; descartarlo exige confirmación
  antes de comenzar otro;
- guardado, preview y publicación comparten el contrato v2 y la misma escala de
  moneda;
- hasta publicarse no crea actividad, balances, deuda, impacto personal,
  pendiente ni notificación;
- los adjuntos permanecen privados y asociados al borrador hasta que una
  publicación exitosa los relacione con el movimiento;
- publicar valida la última revisión y es atómico e idempotente; un fallo
  conserva el borrador y sus adjuntos para reintentar.

El diálogo comunica `Guardando…`, `Guardado` y `No se pudo guardar`, conserva
los cambios locales recuperables y resuelve conflictos entre clientes sin
sobrescribir una versión más nueva. La decisión completa vive en
[`0013 — Borrador privado persistente de movimiento de Espacio`](../decisiones/0013-borrador-privado-persistente-movimiento-espacio.md).

### Detalle y liquidación

El detalle presenta primero total, pagador, parte propia y estado. Después
muestra reparto, categoría, adjuntos y actividad. La acción contextual
`Agregar a Mi Finp` o `Registrar adelanto en Mi Finp` explica exactamente qué
gasto personal, salida real y deuda producirá.

Balances presenta deudas antes que mecanismos. Liquidar muestra origen, destino,
monto pendiente, monto a registrar y efecto real antes de confirmar. Éxito y
error indican qué superficies fueron actualizadas y si hubo impacto financiero.

## 11. Estados, errores y accesibilidad

Cada recorrido cubre:

- carga que preserve la estructura y bloquee sólo la acción en curso;
- vacío con explicación y siguiente acción útil;
- error localizable, borrador conservado y reintento seguro;
- éxito que describa el resultado financiero;
- confirmación y recuperación para edición, anulación, cierre, cambio de rol y
  remoción de Mi Finp.

En el alta guiada, la preview distingue `calculando`, `disponible`, `incompleta`
y `error`; sólo el último comunica un fallo. La edición usa la misma preview
financiera antes de confirmar. Crear una transacción personal o vincular una
existente son intenciones excluyentes y sólo se ofrecen candidatos que el
servidor pueda validar.

Requisitos transversales:

- navegación por teclado, foco visible y restaurado;
- labels, descripciones y errores asociados a los controles;
- áreas táctiles adecuadas y soporte de `safe area`;
- montos, estados y roles comprensibles sin depender del color;
- contenido largo, monedas grandes, nombres extensos y saldos negativos sin
  pérdida de información;
- reducción de movimiento respetada;
- sin acciones esenciales disponibles sólo por `hover`.

## 12. Aprendizaje y automatización

El núcleo financiero de Espacios usa nivel `no aplica`: Finp no aprende ni
automatiza pagador, parte, monto, moneda, fecha, liquidación o impacto personal.

Las categorías personales pueden llegar a nivel `sugerir` con evidencia privada
y explicación. Una sugerencia no crea una transacción, no modifica el Espacio y
puede corregirse, descartarse u olvidarse. La automatización futura requiere
consentimiento explícito y no puede cruzar datos entre participantes.

## 13. Multimoneda integral

Un Espacio define una moneda de reporte y una lista de monedas habilitadas. La
moneda de reporte puede cambiar sólo antes del primer movimiento. Se pueden
agregar monedas activas de curso legal; una moneda usada en gastos, partes,
deudas o liquidaciones no se puede retirar.

Todo importe confirmado usa unidades menores exactas y conserva:

- moneda e importe original;
- equivalente histórico en moneda de reporte;
- tasa decimal, dirección, fuente, antigüedad y camino de conversión;
- autor y momento cuando la referencia fue ingresada manualmente.

Las referencias automáticas provienen de DolarAPI para USD/ARS oficial y de
Frankfurter para cruces internacionales. La resolución intenta el par directo,
luego USD y luego EUR; si no existe un camino confiable, exige una cotización
manual. Una referencia automática siempre se puede reemplazar, pero una
referencia vencida o cambiada no se confirma silenciosamente.

Historia y posiciones abiertas tienen lecturas distintas:

- gastos, partes y reportes históricos conservan el snapshot inmutable;
- saldos abiertos muestran además la equivalencia actual y su diferencia;
- si falta una referencia, la moneda original continúa disponible y no se
  presenta un agregado parcial como total confiable.

Los agregados se expresan en moneda de reporte con una acción `Incluye…`. El
detalle explica la composición por moneda y los snapshots. Los movimientos
priorizan el importe original y dejan el equivalente de reporte en segundo
plano. Los filtros por moneda original, pagada y de deuda son combinables y se
aplican antes de paginar.

Las deudas se calculan y simplifican por moneda. Una liquidación multimoneda:

1. selecciona componentes de deuda;
2. agrega uno o más tramos de pago;
3. aplica primero la misma moneda y luego conversiones en el orden visible;
4. revisa aplicaciones, cotizaciones, diferencia de cambio y saldos restantes;
5. confirma la unidad completa en una transacción MongoDB.

El dinero pagado y el aplicado a la deuda permanecen distinguibles. Un pago
parcial deja el resto en su moneda original; la diferencia de cambio es
trazable y no operacional. Una liquidación confirmada se revierte, no se edita.

La tira `Cotizaciones de referencia` muestra únicamente pares entre monedas
habilitadas y la moneda de reporte. Expone hora, fuente, estado y antigüedad;
sólo se mueve cuando hay overflow, se pausa al interactuar y respeta reducción
de movimiento.

Si Mi Finp no tiene una cuenta en la moneda del Espacio, la función compartida
sigue operativa. Al registrar el impacto personal, el flujo de Mi Finp conserva
la decisión final sobre cuenta, moneda e importe real; nunca adopta por omisión
el equivalente de reporte.

La autoridad técnica y las consecuencias se registran en
[`0009 — Autoridad multimoneda de Espacios`](../decisiones/0009-autoridad-multimoneda-espacios.md).

## 14. Migración progresiva

Durante la convivencia, cada detalle expone sólo `legacy`, `bloqueado`, `listo`
o `migrado` y un motivo seguro de sólo lectura. Nunca publica el `runId`,
fingerprints, manifiesto, montos ni decisiones privadas de migración.

Un Espacio bloqueado conserva historia y acceso permitido, pero no presenta
balances parciales ni admite nuevas mutaciones. Un Espacio migra de forma
atómica y confirma `contractVersion: 2` sólo después de comprobar dinero exacto,
deuda por moneda, privacidad, replay y rollback. Desde entonces no puede volver
a una escritura legacy.

Las ambigüedades personales se representan como `needs_review`; no reasignan
propietarios, cuentas ni dinero. Los detalles operativos y las preimágenes
permanecen sólo en artefactos privados excluidos de Git. La copia o el ensayo no
habilitan por sí mismos development ni producción.

## 15. Verificación obligatoria

El recorrido crítico se valida primero en mobile y luego en desktop, con
aislamiento por usuario y Espacio. La matriz mínima incluye:

- Espacio autónomo sin configuración de Mi Finp;
- pagador cuya parte propia coincide con el total;
- pagador que adelanta por otras personas;
- participante que debe su parte pero no pagó;
- pagador con parte propia cero y adelanto recuperable;
- pagador con tarjeta ARS y USD, total real distinto de la parte propia y sin
  `InstallmentPlan`;
- pago parcial y total de esa tarjeta sin alterar el gasto ni el balance del
  Espacio;
- rechazo temprano de tarjeta incompatible y de cualquier cantidad de cuotas;
- no pagador con parte propia cero y sin acción financiera;
- reparto igual, único, porcentual y por monto;
- liquidación parcial y total iniciada desde Espacios y desde Deudas;
- edición y anulación antes y después de vincular Mi Finp;
- reintentos, fallos parciales y ausencia de duplicados o huérfanos;
- participante inactivo, cambio de rol y último `owner`;
- Espacio cerrado y reapertura;
- moneda y fecha históricas en la zona horaria del Espacio;
- escalas monetarias 0, 2 y 3, redondeo y reparto por restos mayores;
- Espacio ARS/USD/EUR, referencias automáticas, manuales, vencidas y sin
  proveedor;
- deudas independientes por moneda y pagos sólo ARS, sólo USD y ARS+USD;
- composición, filtros y revaluación de posiciones abiertas;
- permisos, aislamiento, carga, vacío, error, recuperación y accesibilidad
  básica;
- borrador único que sobrevive a cierre, sesión y cambio de dispositivo, sólo
  visible al autor y reemplazado por un único movimiento al publicar;
- autosave fallido, conflicto entre clientes, adjunto recuperable, descarte y
  limpieza idempotente;
- fecha civil y monto exacto iguales en cada paso, preview y resultado final;
- edición histórica con participantes inactivos preservados.

Las cuentas deben reflejar dinero real; Dashboard y reportes, gasto operacional
propio; Espacios y Deudas, saldos derivados coherentes. Las cuatro lecturas se
comparan en los E2E financieros.

## 16. Decisiones y evolución

Decisiones consolidadas:

- el Espacio es persistente y colaborativo, no un gasto suelto;
- puede usarse sin configurar Mi Finp;
- Mi Finp conserva autoridad sobre toda contabilidad privada;
- el impacto personal es por usuario y por parte propia exacta;
- las categorías compartidas y personales pertenecen a planos distintos;
- actividad y notificaciones dan transparencia sin imponer aprobaciones para
  cada gasto;
- un Espacio usa deuda directa o simplificada, no ambas a la vez;
- adjuntos y datos privados requieren autenticación y autorización;
- edición y anulación conservan historia y disparan revisión cuando corresponde;
- una tarjeta privada registra un consumo `1/1` por el total real y reporting
  por la parte propia, sin crear un plan de cuotas;
- el borrador de nuevo gasto es privado, persistente y no tiene efectos
  compartidos antes de publicarse;
- la deuda conserva autoridad por moneda y toda conversión aplicada tiene un
  snapshot explícito;
- el cutover es por Espacio, falla cerrado y exige rollback exacto antes de
  retirar su fallback legacy.

Cuotas múltiples, compromisos, realtime, slugs, reintegros y otras extensiones se
priorizan únicamente en [`roadmap_finp.md`](roadmap_finp.md). No se amplía el
dominio hasta estabilizar exactitud, recorridos principales y coordinación con
Mi Finp y Deudas.
