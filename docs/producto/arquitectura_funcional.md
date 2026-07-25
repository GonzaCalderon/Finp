# Arquitectura funcional de Finp

> Estado: vigente
> Audiencia: producto, diseño, desarrollo y agentes
> Última actualización: 2026-07-25
> Fuente de verdad: relaciones conceptuales entre dominios

## Índice

1. [Dinero real vs. dinero operacional](#1-dinero-real-vs-dinero-operacional)
2. [Espacios](#2-espacios)
3. [Deudas](#3-deudas)
4. [Notificaciones, pendientes y review](#4-notificaciones-pendientes-y-review)
5. [Principios estructurales](#5-principios-estructurales)

Este documento explica como piensa Finp el dominio. No describe implementacion puntual; fija conceptos y limites de producto para futuras decisiones.

## 1. Dinero real vs dinero operacional

Finp separa dos lecturas del mismo hecho:

- dinero real: cuanto entra o sale efectivamente de una cuenta;
- dinero operacional: cuanto corresponde atribuir como gasto o ingreso propio del usuario.

Esto es clave en tres casos:

1. gastos compartidos;
2. pagos o cobros de deuda;
3. movimientos derivados de espacios.

Reglas base:

- cuentas usan impacto real;
- reportes y dashboard usan monto operacional;
- una misma transaccion puede mover mas dinero real que gasto propio;
- `operationalAmount` existe para no romper reportes cuando el usuario adelanta plata por otros.

Ejemplo:

- pagas $100.000 desde tu cuenta en un espacio;
- tu parte real es $40.000;
- la cuenta baja $100.000;
- el reporte personal debe considerar $40.000;
- la diferencia se explica via deuda o saldo a favor, no como gasto propio.

## 2. Espacios

Un espacio es un contexto compartido persistente. No es una categoria, no es una deuda y no es una cuenta.

El espacio concentra:

- participantes;
- reglas de reparto;
- moneda(s) del contexto;
- balances entre participantes;
- actividad;
- configuracion compartida;
- movimientos del espacio.

### Balances

El balance del espacio mide quien puso mas o menos de lo que le correspondia segun los splits.

No mide:

- saldo bancario;
- patrimonio;
- gasto personal puro.

### Deuda simplificada vs deuda directa

Finp usa dos criterios mutuamente excluyentes dentro de cada espacio:

- deuda directa: conserva el origen exacto entre personas;
- deuda simplificada: minimiza la cantidad de pagos necesarios para saldar.

Principio importante:

- un espacio no opera con ambos criterios al mismo tiempo;
- el `debtMode` del espacio define el criterio operativo tambien para deudas derivadas.

### Settlements

Los settlements registran pagos entre participantes para reducir saldos del espacio.

Principios:

- el pago se registra entre personas, no contra una "cuenta del espacio";
- impacta el balance del espacio inmediatamente;
- no espera confirmacion contable del pagador real para existir como hecho compartido;
- el impacto personal del pagador en Finp es una decision separada.

### Impacto personal

El movimiento compartido no es automaticamente una transaccion personal.

Cada usuario puede:

- registrarlo en su Finp;
- ignorarlo;
- revisarlo mas tarde;
- volver a revisarlo si el movimiento cambia.

Por eso existe `SpaceEntryPersonalImpact` y no un estado global "linked" sobre el movimiento compartido.

### Onboarding space-first

Un usuario puede llegar a Finp desde una invitacion a un espacio y usar el producto sin configurar su Finp personal.

Reglas de arquitectura:

- aceptar una invitacion por link crea o reutiliza un `SpaceParticipant` activo;
- el registro normal conserva defaults personales;
- el registro desde invite callback seguro puede omitir cuentas y categorias iniciales;
- dashboard, layout y espacios deben tolerar usuarios sin cuentas ni categorias;
- la configuracion personal se ofrece despues de entrar, pero no bloquea el espacio.

### Configuracion personal por participante

`SpaceParticipant.personalSettings` guarda preferencias privadas del usuario para el espacio.

Incluye:

- estrategia de categoria personal;
- categoria fija opcional;
- mapping entre categorias internas y categorias personales;
- fecha de actualizacion.

Las categorias internas (`SpaceCategory`) siguen siendo compartidas. Las categorias personales (`Category`) siguen siendo privadas y se validan por ownership antes de usarse.

### Invitaciones por link

`SpaceInvite` soporta invitaciones directas y links:

- documentos legacy sin `inviteType` se tratan como `direct`;
- `direct` usa `pending`, `accepted`, `declined`, `revoked` o `expired`;
- `link` usa `active`, `revoked` o `expired`;
- el token plano no se persiste, solo `tokenHash`;
- un indice parcial asegura un unico link activo por espacio.

## 3. Deudas

En Finp una deuda es una obligacion pendiente de pagar o cobrar.

No es:

- una cuenta;
- un gasto;
- un ingreso.

Puede ser:

- `payable`: debo;
- `receivable`: me deben;
- `manual`: creada directamente;
- `space`: derivada de un espacio.

### Consolidacion

La deuda consolida relacion pendiente, no solo movimientos sueltos. Por eso existe un modulo propio con resumen por persona, posicion neta y timeline.

### Pagos y cobros

Pagar o cobrar deuda:

- mueve dinero real en cuentas;
- modifica el estado pendiente de la deuda;
- no altera gasto/ingreso operacional;
- puede generar `DebtMovement` y referencias cruzadas.

### `sourceType`

El origen importa porque cambia la interpretacion del saldo:

- manual: obligacion definida por el usuario;
- space: resultado de balances compartidos y su criterio de deuda.

## 4. Notificaciones, pendientes y review

Finp tiene tres capas relacionadas pero distintas:

- notificacion: elemento de seguimiento y visibilidad;
- pending action: accion real pendiente del usuario;
- review: alerta de que algo vinculado en Finp quedo desactualizado o requiere decision.

### Pending actions

Los pendientes de impacto personal viven en `SpaceEntryPersonalImpact` con estado `pending`.

Principio:

- `pending` no equivale a `linked`;
- un pendiente indica "todavia no decidiste";
- un linked indica "ya lo registraste en tu Finp".

### Review

`needs_review` aparece cuando un movimiento ya vinculado cambio materialmente o fue anulado.

Principio:

- review no elimina la transaccion personal;
- review obliga a decidir si se conserva, se rehace o se elimina;
- la app alerta, no corrige automaticamente.

### Notificaciones

Las notificaciones son derivadas. Sirven para llamar la atencion, no para convertirse en la fuente de verdad.

Principios:

- notification != source of truth;
- archived != resolved;
- dismissed != inexistente;
- pendingAction != linked.

## 5. Principios estructurales

Estas decisiones ya deberian tratarse como invariantes de producto mientras no haya una redefinicion explicita:

- no modificar automaticamente transacciones personales por cambios compartidos;
- cuentas usan impacto real;
- reportes usan parte propia;
- pagos de deuda no son gasto;
- cobros de deuda o reintegros no son ingreso operacional;
- la categoria del espacio y la categoria personal son cosas distintas;
- la deuda simplificada no convive con deuda directa en un mismo espacio operativo;
- el impacto personal es privado por usuario;
- las notificaciones ayudan a seguir el estado, pero no reemplazan el estado del dominio;
- la transparencia y trazabilidad tienen prioridad sobre automatismos destructivos.
