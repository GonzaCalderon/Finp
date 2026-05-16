# Estado actual de Finp

Ultima actualizacion: 2026-05-16

## 1. Vision general

Finp es una aplicacion de finanzas personales con una capa colaborativa real. El producto combina gestion privada de cuentas, transacciones y proyeccion con contextos compartidos donde varias personas pueden registrar gastos, saldar saldos y dejar trazabilidad.

Hoy Finp esta pensado como un sistema hibrido:

- finanzas personales como fuente principal de control diario;
- espacios como contexto compartido persistente;
- deudas como modulo propio para obligaciones pendientes;
- notificaciones e insights como capa de seguimiento y accion.

Principios actuales del producto:

- separar dinero real de dinero operacional;
- no mezclar automaticamente la contabilidad personal con la compartida;
- preservar privacidad por usuario;
- mostrar contexto accionable antes que complejidad contable;
- priorizar trazabilidad sobre automatismos irreversibles.

## 2. Finanzas personales

Finp ya cubre un flujo personal amplio:

- cuentas en ARS y USD, incluidas cuentas multi-moneda;
- transacciones de ingreso, gasto, gasto con tarjeta, transferencia, cambio, pago de tarjeta y ajuste;
- dashboard por periodo financiero configurable;
- resumen de cashflow y vistas de flujo como parte de la capa analitica;
- categorias personalizadas y categorias por defecto;
- reglas automaticas de categorizacion;
- importacion desde Excel con revision previa por filas;
- fecha de inicio operativo para no contaminar metricas con historial previo;
- ocultamiento global de montos;
- preferencias persistidas por usuario.

Tambien existe una capa madura para tarjetas y compromisos:

- gastos con tarjeta de credito;
- planes de cuotas personales;
- resumen mensual por tarjeta;
- deuda pendiente por cuotas;
- pagos de tarjeta;
- compromisos recurrentes aplicables a transacciones;
- proyeccion basada en compromisos y cuotas.

En la capa de reportes personales ya esta consolidada la idea de monto operacional:

- dashboard, reportes y vistas operativas priorizan la parte propia;
- cuentas y movimientos reales muestran el impacto efectivo sobre saldo.

## 3. Espacios

Espacios ya es un modulo funcional de producto, no un experimento.

Capacidades actuales:

- listado de espacios y detalle responsive;
- espacios compartidos con participantes, roles y configuracion;
- creacion guiada con tipos principales priorizados en UI;
- modos de funcionamiento del espacio y estado del espacio;
- movimientos compartidos con split configurable:
  - partes iguales;
  - responsable unico;
  - porcentajes;
  - montos fijos;
- balances por participante;
- pagos entre participantes mediante settlements;
- vista de deuda directa o simplificada segun `debtMode`;
- pagos recomendados para saldar el espacio;
- categorias internas del espacio;
- actividad del espacio;
- adjuntos persistentes de imagen y PDF;
- edicion y anulacion logica con trazabilidad.
- invitaciones por link con expiracion y revocacion;
- onboarding `space-first` para usuarios invitados;
- configuracion separada entre General y Mi Finp.

Sincronizacion personal desde Espacios:

- cada participante puede registrar su propio impacto en Finp;
- el impacto es privado por usuario mediante `SpaceEntryPersonalImpact`;
- el movimiento compartido no cambia a "linked" como estado global;
- el detalle del movimiento expone una seccion "Tu Finp";
- si el movimiento cambia materialmente o se anula, el impacto personal pasa a `needs_review`.
- cada participante puede definir estrategia personal de categoria:
  - elegir al impactar;
  - usar el nombre del espacio como categoria automatica;
  - usar categoria fija;
  - mapear categorias internas a categorias personales.
- la categoria automatica queda oculta del CRUD normal de categorias, pero aparece en transacciones/reportes si tiene uso;
- la migracion de categoria automatica solo toca transacciones personales del usuario y del espacio.

Invitaciones:

- un owner/admin puede generar, regenerar o revocar el link activo del espacio;
- el link vence en 1, 3 o 7 dias;
- no se guarda token plano;
- antes de aceptar no se muestran movimientos, balances, deudas ni detalles financieros;
- un usuario nuevo puede registrarse, aceptar y entrar al espacio sin configurar cuentas ni categorias.

Tipos de espacio:

- el flujo principal de creacion prioriza Pareja, Grupo/Hogar, Viaje y Proyecto;
- el dominio ya contempla tambien Evento, Personal y Otro para casos especiales.

## 4. Deudas

Deudas ya es un modulo propio conectado con Espacios y Finanzas personales.

Capacidades actuales:

- vista `/debts` con posicion neta;
- separacion operativa entre "Debo" y "Me deben";
- deudas manuales;
- deudas derivadas de espacios;
- pagos de deuda;
- cobros de deuda;
- estados activos, parciales, pagados e ignorados;
- ignorar y restaurar deudas derivadas de espacios;
- consolidacion por persona/relacion;
- timeline de movimientos de deuda;
- sincronizacion idempotente cuando cambia un espacio.

Reglas actuales:

- pagar o cobrar deuda mueve dinero real en cuentas;
- pagar o cobrar deuda no suma gasto ni ingreso operacional;
- el modulo respeta el criterio de deuda del espacio cuando la deuda nace en Espacios;
- la UI de deudas esta orientada a personas y relaciones, no a asientos contables.

## 5. Notificaciones

Finp tiene una capa global de notificaciones y seguimiento ya integrada al uso diario.

Incluye:

- campana global con badge de unread y pending;
- tabs para Todas, Pendientes, Espacios, Deudas y Archivadas;
- estados `unread`, `read`, `archived` y `dismissed`;
- `actionStatus` para distinguir pendiente, completado, ignorado o cancelado;
- pendientes accionables vinculados a impactos personales y revisiones;
- review flows para movimientos de espacios que fueron editados o anulados;
- NavInsight en navegacion para resumir senales importantes;
- swipe mobile para archivar o descartar;
- resolucion automatica de notificaciones stale cuando la accion ya fue atendida.

Tipos de senales ya activos:

- gastos compartidos que esperan decision;
- revisiones `needs_review`;
- actividad nueva en espacios;
- novedades de deudas;
- imports en borrador;
- compromisos proximos;
- insights de resumen como categoria fuerte del mes o tendencia de tarjeta.

## 6. Mobile y desktop

La experiencia actual esta pensada como web app responsive:

- sidebar en desktop;
- bottom navigation y menu "Mas" en mobile;
- sheets y dialogs adaptados a mobile;
- espacios, deudas y notificaciones con trabajo responsive real;
- soporte de safe areas y layouts tactiles;
- dark mode y light mode.

Estado actual de app installable:

- no hay PWA operativa;
- no hay service worker;
- no hay cache offline;
- no hay base local para uso sin conexion.

## 7. Testing y calidad

La base de calidad ya existe y esta creciendo sobre Fase 6:

- Vitest para logica, dominio y componentes criticos;
- Playwright preparado para desktop y mobile;
- tests unitarios para:
  - notificaciones;
  - `SpaceEntryPersonalImpact`;
  - `personal-sync-events`;
  - `nav-insights`;
  - `debt-sync`;
  - montos operacionales;
  - split y categorias de espacios;
  - `data-sync`;
  - validaciones clave;
- CI con lint, build y unit tests.

Mecanismos relevantes de robustez ya presentes:

- invalidacion cliente por tags con `data-sync`;
- polling controlado para notificaciones;
- refresco por foco y visibilidad de pestana;
- dedupe en notificaciones y pendientes;
- tests orientados a privacidad y consistencia de estados.

Estado general:

- la base es buena para preproduccion controlada;
- todavia falta ampliar integration/API, E2E y QA de cierre.

## 8. Limitaciones actuales conocidas

- no hay realtime real entre usuarios;
- no hay offline ni PWA funcional;
- cuotas dentro de Espacios todavia no existen;
- la configuracion personal de espacios todavia no esta cerrada;
- no hay sincronizacion automatica completa entre ediciones/anulaciones de espacios y transacciones personales;
- persiste compatibilidad legacy alrededor de `linkedTransactionId` y `status: linked`;
- invitaciones por link siguen pendientes como flujo de producto;
- la integracion profunda entre tarjetas y Deudas sigue diferida.
