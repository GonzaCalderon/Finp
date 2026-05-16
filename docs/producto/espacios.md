# Espacios en Finp

Ultima actualizacion: 2026-05-16

## 1. Que es un espacio

Un espacio es el contexto compartido donde Finp organiza gastos, balances, pagos entre participantes y trazabilidad colaborativa. Sirve para casos persistentes o coordinados, no para un gasto aislado sin continuidad.

Ejemplos de uso:

- pareja;
- grupo/hogar;
- viaje;
- proyecto;
- y, a nivel de dominio, tambien evento, personal u otros casos especiales.

## 2. Tipos de espacio

Hoy conviven dos niveles:

- tipos priorizados en el flujo principal de creacion:
  - Pareja;
  - Grupo/Hogar;
  - Viaje;
  - Proyecto;
- tipos soportados por dominio y configuracion:
  - Evento;
  - Personal;
  - Otro.

Esto resuelve la contradiccion de los planes viejos: el producto ya fue mas alla de las cuatro etiquetas iniciales, aunque la UI principal siga enfocada en los casos mas frecuentes.

## 3. Que puede hacer un espacio hoy

### Gestion base

- nombre, descripcion, estado y periodo;
- monedas habilitadas y moneda de reporte;
- participantes y roles;
- categorias internas;
- adjuntos por movimiento;
- actividad del espacio;
- configuracion de deuda y split por defecto.

### Movimientos

El espacio maneja movimientos propios, con foco actual en gastos y settlements.

Capacidades:

- nuevo gasto compartido;
- split configurable:
  - partes iguales;
  - responsable unico;
  - porcentajes;
  - montos fijos;
- preview de reparto;
- edicion posterior;
- anulacion logica;
- historial de versiones;
- adjuntos persistentes.

Decision consolidada:

- `Responsable unico` usa un movimiento sin reparto igualitario y asigna el total a un participante.

### Balances y pagos

- balance por participante;
- pagos recomendados;
- settlements parciales o totales;
- vista de deuda directa o simplificada;
- recalculo inmediato del balance cuando cambia un movimiento valido.

Decision consolidada:

- si el settlement existe, el balance del espacio debe reflejarlo sin esperar que el pagador lo replique en su Finp personal.

## 4. Categorias internas del espacio

Las categorias del espacio son compartidas y cumplen un rol distinto al de las categorias personales.

Sirven para:

- ordenar el historial del espacio;
- desglosar gasto interno;
- mantener lenguaje comun entre participantes.

No sirven para:

- categorizar automaticamente el Finp personal de todos;
- reemplazar categorias privadas del usuario.

Decision consolidada:

- `SpaceEntry.spaceCategoryId` y `Transaction.categoryId` pertenecen a planos distintos.

## 5. Deuda directa y simplificada

Cada espacio puede trabajar con un criterio de deuda:

- directo: conserva el origen exacto entre participantes;
- simplificado: reduce la cantidad de pagos necesarios.

Principios:

- solo uno manda por espacio;
- el criterio del espacio alimenta tambien las deudas derivadas hacia el modulo Deudas;
- cambiar el criterio recalcula saldos derivados, no reescribe los movimientos originales.

## 6. Settlements

Los settlements son pagos registrados entre participantes para reducir saldos del espacio.

Principios funcionales:

- representan una liquidacion entre personas;
- pueden ser parciales o totales;
- no borran el historial previo;
- viven en el espacio como hecho colaborativo;
- pueden tener impacto personal opcional y privado en Finp.

## 7. Impacto personal y sincronizacion con Finp

Esta es una de las decisiones mas importantes ya cerradas.

Cada participante puede registrar por separado como un movimiento del espacio afecta su Finp personal.

Eso implica:

- el espacio no tiene un unico "linkedTransactionId" valido para todos;
- el estado compartido del movimiento no cambia a vinculado por la accion de una sola persona;
- "En tu Finp" es una lectura contextual del usuario actual;
- no se exponen cuentas ni categorias privadas de otros participantes.

Estados relevantes del impacto personal:

- `pending`;
- `linked`;
- `ignored`;
- `cancelled`;
- `removed`;
- `needs_review`.

## 8. Configuracion global vs configuracion personal

### Configuracion global del espacio

Ya existe en buena parte:

- nombre;
- tipo;
- estado;
- modo;
- monedas;
- split por defecto;
- categorias internas;
- criterio de deuda;
- participantes y roles.

### Configuracion personal del espacio

Todavia no esta cerrada como flujo de producto, pero ya tiene base conceptual clara.

Pendientes principales:

- como impactar automaticamente en Mi Finp;
- categoria virtual por nombre del espacio;
- categoria personal fija;
- mapeo categoria del espacio -> categoria personal;
- preferencia de registrar manualmente cada gasto;
- preferencia de seguir o ignorar ciertas deudas del espacio.

## 9. Decisiones ya tomadas

- el espacio es persistente y colaborativo, no un gasto suelto con otro nombre;
- las categorias internas del espacio no reemplazan categorias personales;
- el impacto personal es por usuario;
- la transparencia via actividad/notificaciones reemplaza aprobaciones obligatorias en el MVP;
- la deuda simplificada no convive con la directa como criterio operativo de un mismo espacio;
- los adjuntos son privados y autenticados;
- la retencion de adjuntos se informa, pero la limpieza automatica todavia no esta cerrada.

## 10. Pendientes futuros ya identificados

- invitaciones por link;
- configuracion personal del espacio;
- categorias virtuales y mapeo personal;
- cuotas en espacios;
- realtime;
- slugs amigables;
- sincronizacion automatica avanzada con transacciones personales;
- migracion completa del legacy de `linkedTransactionId`.
