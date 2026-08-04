# 0007 — Escenarios efímeros sobre una base viva

> Estado: aceptada
> Fecha: 2026-07-31
> Audiencia: producto, diseño, arquitectura, desarrollo y calidad
> Ámbito: Proyección
> Fuente de verdad: estrategia de escenarios efímeros y precedencia de cambios

## Índice

1. [Contexto](#1-contexto)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Precedencia](#5-precedencia)
6. [Persistencia y privacidad](#6-persistencia-y-privacidad)
7. [Consecuencias](#7-consecuencias)
8. [Verificación](#8-verificación)

## 1. Contexto

Proyección necesitaba responder preguntas de tipo “¿qué pasa si…?” sin convertir
una exploración en un compromiso, cuota o transacción real. El valor de la
comparación depende de que la base siga reflejando los datos vigentes, incluso
si cambian mientras la persona conserva un borrador.

El escenario puede contener descripciones y montos sensibles. No debe crear una
segunda fuente financiera, aparecer en URLs, alimentar aprendizaje ni sobrevivir
como historial permanente.

## 2. Restricciones

- Una única comparación visible `Base real ↔ Con gastos`.
- Gastos solamente; ingresos, saldos y cuentas pertenecen a Cashflow.
- ARS y USD separados, sin conversión implícita.
- Sin modelos, migraciones, dependencias ni preferencias nuevas.
- Máximo 50 cambios y 24 horas de vigencia dentro de la pestaña.
- Cada preview vuelve a consultar la base autenticada.
- Ningún preview escribe colecciones financieras.

## 3. Opciones consideradas

### Opción A — Guardar escenarios en MongoDB

Permitía reabrir y compartir escenarios, pero introducía retención de datos
sensibles, permisos, migraciones, borrado y una nueva fuente de verdad antes de
validar el uso real.

### Opción B — Congelar una copia completa de la base en el navegador

Simplificaba el cálculo posterior, pero comparaba contra información obsoleta y
duplicaba datos financieros innecesarios en almacenamiento cliente.

### Opción C — Guardar sólo cambios efímeros y rebasarlos sobre una base viva

Mantiene la simulación reversible y liviana. Exige resolver cambios cuyo origen
desapareció y definir precedencia determinista.

## 4. Decisión

Se adopta la opción C.

El cliente conserva únicamente una unión discriminada de cambios `adjust`,
`omit` e `hypothetical`. `POST /api/projection/scenarios/preview` autentica,
valida estrictamente, vuelve a leer Proyección y aplica los cambios mediante un
motor puro. La respuesta contiene base, escenario, comparación por período y
horizonte, y advertencias de rebase.

`hypothetical` es sólo el discriminante técnico para un gasto que no existe en
la base. La interfaz lo presenta como `Simular un gasto` y lo especializa en
Compromiso, `TC · un pago` o `TC · cuotas`. Las compras con tarjeta referencian
una cuenta de tarjeta activa del usuario; el servidor resuelve todas las
tarjetas en una consulta agrupada y valida tipo y moneda. Un pago impacta una
vez; una compra en cuotas divide el monto total y agrega una cuota por período.

Un objetivo existente se identifica por tipo de fuente, ID y período. Nunca se
resuelve por descripción o monto. La moneda original no puede cambiarse; una
moneda distinta requiere simular un gasto nuevo.

Mover es un ajuste puntual con período de destino: quita el impacto del origen
y agrega una única representación en el destino visible.

## 5. Precedencia

1. Un cambio puntual gana sobre cualquier cambio hacia adelante aplicable.
2. Entre cambios hacia adelante gana el de período inicial más reciente.
3. Ante igual objetivo, alcance e inicio, gana la última edición del borrador.
4. Un movimiento sólo afecta la ocurrencia objetivo; no se propaga.
5. Un origen ausente, pasado o fuera del horizonte produce una advertencia y no
   altera el resultado.

La omisión y el origen de un movimiento quedan visibles con monto simulado cero,
pero no aportan a totales, estimados ni pendientes.

## 6. Persistencia y privacidad

El borrador usa `sessionStorage` bajo una clave versionada y separada por usuario.
El sobre conserva inicio y vencimiento fijo; guardar de nuevo no extiende las 24
horas. Si el navegador bloquea el storage, Finp mantiene el borrador en memoria y
advierte que no sobrevivirá una recarga.

No se incluyen cambios, descripciones ni montos en la URL. No hay telemetría,
señales de aprendizaje ni escritura de servidor. El nivel de aprendizaje es
`no aplica`.

## 7. Consecuencias

### Positivas

- La comparación siempre usa la información real más reciente.
- Descartar es inmediato y no requiere compensaciones financieras.
- El motor puede probarse sin base de datos ni navegador.
- La ausencia de persistencia reduce superficie de permisos y retención.

### Costos y límites

- No hay nombres, biblioteca, sincronización entre dispositivos ni compartir.
- Cerrar la pestaña elimina el borrador.
- Cambiar mucho el horizonte puede dejar cambios sin efecto hasta que se editen
  o restauren.
- Cashflow por cuenta y escenarios permanentes requieren otra decisión.

## 8. Verificación

La implementación exige pruebas del motor, contrato API, aislamiento de
categorías, almacenamiento bloqueado, recuperación, UI accesible y recorridos
E2E mobile/desktop. El cierre del roadmap requiere además evidencia de que
preview y descarte no escriben compromisos, planes ni transacciones.
