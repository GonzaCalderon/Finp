# Backlog de feedback de uso real

Ultima actualizacion: 2026-07-23

Este backlog traduce los hallazgos de uso real a bloques implementables. La prioridad combina riesgo financiero, bloqueo de flujo y alcance tecnico.

## P0 - Exactitud financiera

### Balance, pago de deuda y arrastre de negativos

- Estado: pendiente de diagnostico.
- Alcance: reconstruir el calculo mensual y comprobar como se arrastran saldos negativos despues de pagar una deuda.
- Criterio de cierre: los saldos de apertura, movimientos del mes, pago y saldo final concilian en meses consecutivos, con pruebas para pagos parciales y totales.
- Zonas probables: `src/lib/utils/balance.ts`, `src/lib/utils/debt.ts`, APIs de deudas y dashboard.

### Compra de dolares

- Estado: implementado y auditado el 2026-07-23.
- Bugs corregidos: invertir la operación ahora intercambia cuentas, monedas y montos; editar una compra como venta ya no reutiliza como saldo disponible el crédito de la operación anterior; la cotización persistida se normaliza contra los montos reales.
- UX: el flujo separa "Entregás" y "Recibís", filtra cuentas compatibles, anticipa ambos saldos resultantes y distingue compra de venta de dólares. La cotización aparece arriba, parte de una referencia Blue/Oficial/MEP de DolarAPI, puede editarse manualmente y recalcula cualquiera de los dos montos según cuál complete el usuario. Los montos y selectores ARS/USD reutilizan las banderas de moneda de Espacios.
- Criterio de cierre: una compra de USD descuenta el monto ARS correcto, acredita el monto USD correcto y puede invertirse, editarse o eliminarse sin desbalance.
- Zonas probables: `src/lib/utils/exchange.ts`, `src/components/shared/transaction-dialog/flows/ExchangeFlow.tsx` y API de transacciones.

## P1 - Flujos bloqueantes o confusos

### Deudas en mobile

- Estado: pendiente.
- Alcance: detalle no visible y comportamiento anomalo de pendientes.
- Criterio de cierre: desde mobile se puede abrir una deuda, ver su detalle y resolver cada pendiente sin saltos ni paneles inaccesibles.

### Estado de pago de tarjetas

- Estado: pendiente.
- Alcance: separar tarjetas pagas e impagas y reflejar el estado en cada card.
- Criterio de cierre: para el periodo activo hay un estado explicito, monto pendiente y acceso al pago; los pagos parciales no aparecen como pago total.

### Registrar o quitar movimientos de Mi Finp

- Estado: pendiente.
- Alcance: mejorar el CTA, el flujo, las monedas y el formato del monto al registrar; hacer evidente "Quitar de Mi Finp" en mobile.
- Criterio de cierre: la accion principal parece y funciona como boton, el usuario entiende el impacto antes de confirmar y los montos ARS/USD usan el formato correcto.

## P2 - Mejoras de producto

### Sugerencia de reglas por gastos repetidos

- Estado: implementado el 2026-07-23.
- Alcance: después de al menos tres movimientos consistentes, sugiere automatizar la categoría sin crear nada por su cuenta.
- Criterio de cierre: la regla se crea únicamente con confirmación, explica por qué se propone y queda disponible para reintentar si falla.

### Asistencia inteligente de descripción

- Estado: implementado el 2026-07-23.
- Corrección: propone "¿Quisiste decir?" para errores breves y recuerda localmente las correcciones aceptadas como alias.
- Autocompletado: recupera descripciones y comercios frecuentes del historial propio.
- Movimiento similar: permite copiar categoría, cuenta, moneda, comercio y medio de pago sin reemplazar monto ni fecha.
- Prevención: alerta posibles duplicados por descripción, monto, moneda y cercanía temporal.
- Normalización: ofrece ordenar espacios y capitalización con un clic.
- Explicabilidad: muestra por qué una categoría aparece primero.

### Proyeccion: cuotas vs un pago con tarjeta

- Estado: pendiente.
- Criterio de cierre: la proyeccion muestra por separado cuotas activas y consumos en un pago, manteniendo visible el total.

### Notificaciones y pendientes de espacios

- Estado: pendiente.
- Criterio de cierre: cada pendiente explica origen, accion necesaria y estado; resolverlo actualiza campana, listado y espacio de forma consistente.

### Parte propia igual a cero en movimientos de espacios

- Estado: pendiente.
- Criterio de cierre: el detalle del movimiento muestra explicitamente "Tu parte: $0" cuando el usuario no participa del reparto.

### Apuntar un prestamo desde Deudas

- Estado: pendiente.
- Criterio de cierre: desde una deuda se puede registrar el prestamo en Finp con cuenta, fecha, moneda y contraparte precompletadas, sin duplicar deuda.

## Quick wins

### Calendarios en español

- Estado: implementado el 2026-07-23.
- Alcance: idioma español por defecto en el calendario compartido, incluidos nombres de mes, dias y etiquetas accesibles.
- Cobertura: nuevo movimiento, movimientos de espacios y los demas usos del calendario compartido.

### Colores de categorias en nueva transaccion

- Estado: implementado el 2026-07-23.
- Alcance: cada categoria muestra su color aun sin estar seleccionada; la seleccion conserva una señal visual y semantica explicita.
- Mejora posterior: se elimino el colapsable y la separacion artificial entre frecuentes, sugeridas y restantes.
- Orden: combina movimientos con descripcion o comercio similares, recencia y frecuencia historica, uso reciente guardado en el dispositivo y seleccion actual.
- Privacidad: el análisis se limita al historial del usuario autenticado; el cliente recibe solo las señales necesarias para actuar, nunca el historial completo.
