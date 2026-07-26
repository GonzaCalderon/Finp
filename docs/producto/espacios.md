# Espacios en Finp

> Estado: vigente
> Audiencia: producto, diseño, desarrollo y agentes
> Última actualización: 2026-07-25
> Fuente de verdad: reglas funcionales de Espacios

## Índice

1. [Qué es un Espacio](#1-que-es-un-espacio)
2. [Tipos](#2-tipos-de-espacio)
3. [Capacidades](#3-que-puede-hacer-un-espacio-hoy)
4. [Categorías, invitaciones y configuración](#4-categorias-internas-del-espacio)
5. [Deuda y settlements](#5-deuda-directa-y-simplificada)
6. [Impacto personal](#7-impacto-personal-y-sincronizacion-con-finp)
7. [Decisiones y evolución](#9-decisiones-ya-tomadas)

Las posibilidades futuras descritas aquí no establecen prioridad. El backlog único es [`roadmap_finp.md`](roadmap_finp.md).

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

## 4.1 Invitaciones por link y onboarding space-first

Un admin u owner puede generar un link temporal para sumar participantes al espacio.

Reglas actuales:

- hay un solo link activo por espacio;
- el link vence en 1, 3 o 7 dias, con 7 dias como default;
- regenerar revoca el link activo anterior;
- revocar invalida el link sin borrarlo fisicamente;
- el token plano nunca se guarda, solo se guarda `tokenHash` y un `tokenPreview` corto;
- si ya hay un link activo, Finp muestra metadata y permite regenerarlo para obtener un enlace copiable nuevo.

El flujo por link es `space-first`:

- una persona puede abrir `/spaces/invite/[token]` sin sesion;
- antes de aceptar solo ve nombre, tipo, vencimiento e invitador si esta disponible;
- puede iniciar sesion o registrarse y volver al mismo callback seguro;
- al aceptar entra directo a `/spaces/[spaceId]?joined=1`;
- no se exige crear cuentas, categorias, dashboard ni saldo inicial.

Esto permite que alguien use Finp solo como participante de un espacio.

## 4.2 General vs Mi Finp

La configuracion del espacio se divide en dos planos:

- General: afecta a todos. Incluye nombre, tipo, deuda, monedas, participantes, categorias internas e invitacion por link.
- Mi Finp: afecta solo al usuario actual. Incluye como se sugiere categorizar el impacto personal de movimientos del espacio.

Un admin no puede editar la configuracion personal de otro participante.

Estrategias personales:

- manual: elegir categoria al impactar;
- `space_name_virtual`: usar el nombre del espacio como categoria automatica personal;
- `fixed_personal_category`: usar una categoria personal fija;
- `map_space_categories`: mapear categorias internas del espacio a categorias personales.

La configuracion personal no impacta automaticamente movimientos viejos ni registra transacciones sin confirmacion del usuario.

## 4.3 Categoria automatica y migracion

La categoria automatica del espacio se modela como una `Category` real del usuario:

- `isVirtual: true`;
- `hiddenFromSettings: true`;
- `sourceType: space`;
- `sourceSpaceId`.

No aparece en Configuracion > Categorias normales, pero puede aparecer en transacciones, filtros y reportes con badge "Espacio" si tiene uso.

La migracion avanzada permite mover transacciones personales desde esa categoria automatica hacia otra categoria del usuario. Solo toca transacciones e impactos personales del usuario actual y del espacio actual; no modifica el espacio ni afecta a otros participantes.

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

Cuando una edicion cambia el reparto de manera material, los pendientes se
reconcilian contra el reparto nuevo:

- a quien le cambio el monto se le actualiza su pendiente y se refresca el aviso,
  porque sigue teniendo la misma decision por tomar con otras cifras;
- a quien salio del reparto se le cancela el pendiente y se resuelve su
  notificacion: ya no le corresponde registrar nada;
- a quien entro al reparto se le crea un pendiente nuevo, sin duplicar si ya tenia
  uno ni crearlo si ya registro el movimiento.

Un pendiente todavia no es historia financiera, asi que actualizarlo no reescribe
nada. Quien ya registro su impacto sigue el camino de revision, que si supone
historia y por eso nunca se resuelve solo.

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

Está disponible en la sección Mi Finp y es privada por participante:

- elegir al registrar el impacto;
- usar una categoría automática con el nombre del Espacio;
- usar una categoría personal fija;
- mapear categoría del Espacio a categoría personal;
- migrar la categoría automática cuando cambia la estrategia.

La decisión de impactar un movimiento sigue siendo personal. Automatizaciones adicionales requieren consentimiento y deben conservar la privacidad.

## 9. Decisiones ya tomadas

- el espacio es persistente y colaborativo, no un gasto suelto con otro nombre;
- las categorias internas del espacio no reemplazan categorias personales;
- el impacto personal es por usuario;
- la transparencia via actividad/notificaciones reemplaza aprobaciones obligatorias en el MVP;
- la deuda simplificada no convive con la directa como criterio operativo de un mismo espacio;
- los adjuntos son privados y autenticados;
- la retencion de adjuntos se informa, pero la limpieza automatica todavia no esta cerrada.

## 10. Evolución

Las extensiones consideradas para Espacios —cuotas, compromisos, realtime, slugs, reintegros, sincronización avanzada y retiro de legacy— se describen y priorizan únicamente en [`roadmap_finp.md`](roadmap_finp.md).

Toda evolución debe preservar:

- un único movimiento compartido como origen;
- impacto personal privado por usuario;
- separación entre total, parte propia y adelanto;
- idempotencia;
- permisos y trazabilidad.
