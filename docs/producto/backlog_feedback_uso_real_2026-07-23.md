# Backlog de feedback de uso real

Ultima actualizacion: 2026-07-24

Este backlog traduce los hallazgos de uso real a bloques implementables. La prioridad combina riesgo financiero, bloqueo de flujo y alcance tecnico.

## Resumen operativo actual

### Validacion inmediata

1. Validar con datos reales el nuevo saldo acumulado, pagos de deuda, cuotas e historico mensual.
2. Verificar visualmente Dashboard y Transacciones en desktop/mobile, ARS/USD y saldos negativos.

### Proximo bloque recomendado

1. Unificar el motor de reglas y corregir acciones incompletas.
2. Diseñar e implementar Captura rapida v1 sobre el motor confiable.
3. Diseñar compromisos personales variables como base para compromisos de Espacios.
4. Diseñar la bandeja diaria de revision como complemento, no como requisito para guardar.

### Pendientes UX de alta prioridad

1. Deudas en mobile.
2. Estado de tarjetas pagas, parciales e impagas.
3. Registrar o quitar movimientos de Mi Finp.

### Pendientes de producto posteriores

1. Compromisos de Espacios y ajustes de monto.
2. Categorias accionables y gastos grandes/atipicos.
3. Proyeccion de cuotas vs consumos de un pago.
4. Notificaciones y pendientes de Espacios.
5. Parte propia igual a cero en movimientos de Espacios.
6. Apuntar un prestamo desde Deudas.

## P0 - Exactitud financiera

### Balance, pago de deuda y arrastre de negativos

- Estado: implementado y auditado el 2026-07-23; pendiente de validacion visual con datos reales.
- Resultado: Dashboard y Transacciones separan `Saldo disponible` acumulado de `Resultado del periodo`. Los saldos historicos se reconstruyen desde los saldos iniciales hasta el cierre seleccionado y arrastran negativos entre meses.
- Deudas: pagar o cobrar mueve la cuenta sin convertirse en gasto o ingreso operacional; transaccion, deuda y movimiento se confirman atomicamente.
- Tarjetas: se elimino el doble descuento de compras en cuotas.
- Patrimonio: contempla tarjetas y deudas personales pendientes.
- Consistencia: prestamos producen el mismo resultado en Dashboard y Transacciones.
- Criterio de cierre restante: smoke test con datos reales para arrastre negativo, pago parcial/total, cuota de tarjeta y consulta de un mes historico.
- Zonas principales: `src/lib/utils/balance.ts`, `src/lib/server/debt-settlement.ts`, APIs de cuentas, deudas, transacciones y dashboard.

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

### Motor unificado de reglas

- Estado: pendiente; relevamiento funcional completado el 2026-07-24.
- Problemas detectados: `setType` se configura pero no se ejecuta; importacion, cuotas y algunos impactos de Espacios no atraviesan el mismo motor.
- Alcance: centralizar evaluacion, normalizar textos, hacer las reglas explicables y preparar simulacion/conflictos antes de ampliar condiciones.
- Criterio de cierre: una misma regla produce el mismo resultado en todos los puntos de ingreso autorizados y deja trazabilidad de su aplicacion.

### Compromisos personales variables

- Estado: documentado para diseño.
- Problema actual: cada compromiso repite un monto fijo en Proyeccion y no conserva aumentos efectivos por fecha.
- Alcance inicial: historial de montos, monto variable a confirmar, agenda de aumentos manuales y proyeccion correcta por periodo.
- Evolucion: porcentajes pautados e indices oficiales con fallback manual.
- Documento: `docs/producto/compromisos_espacios_y_proyeccion.md`.

### Captura rapida de movimientos

- Estado: documentado para discovery.
- Alcance propuesto: entrada compacta por lenguaje natural, valores sugeridos, accesos frecuentes, Enter para guardar y deshacer inmediato.
- Meta inicial: registrar un gasto simple en menos de cinco segundos y con un maximo de dos decisiones.
- Documento: `docs/producto/estrategia_ingreso_datos_y_automatizacion.md`.

## P2 - Mejoras de producto

### Sugerencia de reglas por gastos repetidos

- Estado: implementado el 2026-07-23.
- Alcance: después de al menos tres movimientos consistentes, sugiere automatizar la categoría sin crear nada por su cuenta.
- Criterio de cierre: la regla se crea únicamente con confirmación, explica por qué se propone y queda disponible para reintentar si falla.
- Evolucion pendiente: distinguir regla, compromiso y suscripcion; incorporar feedback de propuestas ignoradas y estadisticas de efectividad.

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
- Alcance ampliado: incorporar parte propia de compromisos de Espacios y distinguir montos confirmados, calculados, estimados y pendientes.

### Notificaciones y pendientes de espacios

- Estado: pendiente.
- Criterio de cierre: cada pendiente explica origen, accion necesaria y estado; resolverlo actualiza campana, listado y espacio de forma consistente.

### Compromisos en Espacios

- Estado: documentado para diseño.
- Casos: alquiler, expensas, servicios y otras obligaciones recurrentes de pareja, hogar, viaje o proyecto.
- Criterio funcional: una aplicacion genera un unico movimiento del Espacio; el impacto personal se deriva de la parte propia y la configuracion de cada participante.
- Requisitos: reparto, categoria interna, pagador habitual, permisos, confirmacion mensual, idempotencia e historial.
- Dependencias: compromisos personales variables, impacto personal de Espacios y proyeccion por niveles de certeza.
- Documento: `docs/producto/compromisos_espacios_y_proyeccion.md`.

### Parte propia igual a cero en movimientos de espacios

- Estado: pendiente.
- Criterio de cierre: el detalle del movimiento muestra explicitamente "Tu parte: $0" cuando el usuario no participa del reparto.

### Apuntar un prestamo desde Deudas

- Estado: pendiente.
- Criterio de cierre: desde una deuda se puede registrar el prestamo en Finp con cuenta, fecha, moneda y contraparte precompletadas, sin duplicar deuda.

### Bandeja diaria de revision

- Estado: documentado para discovery.
- Alcance: reunir capturas incompletas, imports, movimientos sin categoria y sugerencias de confianza media para confirmar o corregir en lote.
- Dependencias: motor unificado de reglas, origen/confianza de clasificacion y definicion de cuando un borrador afecta saldos.

### Categorias accionables

- Estado: vision documentada; implementacion pendiente.
- Alcance: detalle por categoria con evolucion, comercios, recurrentes, gastos grandes, proyeccion, limites y relacion con objetivos de ahorro.
- Dependencias: ingreso de datos confiable, normalizacion de comercios y trazabilidad de clasificacion.

### Gastos grandes y atipicos

- Estado: pendiente de diseño.
- Criterio: detectar relevancia por historial de categoria, proporcion del ingreso, consumo de limite e impacto en proyeccion; permitir marcar extraordinarios y excluirlos de recomendaciones.

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
