# Backlog de feedback de uso real — archivo histórico

> Estado: archivado  
> Archivado: 2026-07-25  
> Reemplazado por: [`../producto/roadmap_finp.md`](../producto/roadmap_finp.md)  
> Motivo: Finp mantiene un único backlog canónico.

Ultima actualizacion: 2026-07-24

Este backlog traduce los hallazgos de uso real a bloques implementables. La prioridad combina riesgo financiero, bloqueo de flujo y alcance tecnico.

## Resumen operativo actual

### Validacion inmediata

1. Validar con datos reales el nuevo saldo acumulado, pagos de deuda, cuotas e historico mensual.
2. Verificar visualmente Dashboard y Transacciones en desktop/mobile, ARS/USD y saldos negativos.

### Bloque cerrado el 2026-07-25

1. Compromisos personales variables, agenda de montos por fecha y aplicaciones con snapshots y estados. Implementado.
2. Cruce con Captura rapida: aplicar pendientes, derivar altas con borrador y procedencia visible. Implementado.
3. Onboarding contextual y contrato de sugerencias funcionales. Implementado.
4. Reevaluacion de la traza de reglas al editar una transaccion. Implementado.
5. Cascada al eliminar una transaccion (compromiso, impacto de Espacios, notificaciones). Implementado; `InstallmentPlan` queda pendiente.
6. Unificacion de `monthStartDay` en lista, dashboard, proyeccion y nav-insights. Implementado.

### Proximo bloque recomendado

1. Detectar candidatos mensuales explicables sin crear compromisos automaticamente.
2. Limpiar el `InstallmentPlan` al eliminar la transaccion que lo originó.
3. Diseñar la bandeja diaria de revision como complemento, no como requisito para guardar.
4. Extender la orientacion a reglas, cuotas, Deudas, Espacios e Importacion, de punta a punta y una por vez.
5. Ajustes porcentuales pautados e indices oficiales con fallback manual.

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

- Estado: base confiable, simulacion, conflictos y experiencia de gestion implementados el 2026-07-24; correcciones explicitas pendientes.
- Experiencia: la pagina de Reglas expone cobertura, actividad, reglas activas o pausadas y sugerencias persistentes basadas en patrones consistentes. Crear y editar usa un flujo guiado de coincidencia, acciones y prueba.
- Llegada al movimiento: las transacciones automatizadas muestran la regla que completo sus datos.
- Resultado: nueva transaccion, importacion, cuotas, compromisos e impactos personales de Espacios atraviesan el mismo servicio. Los movimientos financieros especializados conservan su tipo para evitar reclasificaciones silenciosas.
- Acciones: `setType` ya reclasifica gastos e ingresos simples y mueve la cuenta al lado correcto; categoria y comercio se completan cuando el usuario no definio un valor explicito.
- Normalizacion: coincidencias sin diferencias por tildes, mayusculas, espacios, signos, prefijos bancarios comunes y referencias variables.
- Trazabilidad: cada transaccion conserva regla, criterio normalizado y acciones efectivamente aplicadas. Cada regla registra cantidad de coincidencias y ultima aplicacion.
- Simulacion: crear o editar una regla permite probar descripcion, comercio y tipo sin guardar movimientos ni modificar reglas. La vista previa usa la misma resolucion de acciones que la creacion real.
- Conflictos: detecta reglas redundantes, acciones contradictorias y acciones ocultas por prioridad. Si coinciden varias reglas muestra cual gana.
- Resguardos: la simulacion explica acciones omitidas en tipos financieros especializados y el selector solo ofrece categorias compatibles con el tipo resultante.
- Cobertura: pruebas unitarias del motor, de la integracion del servicio y del resguardo de tipos especializados.
- Pendiente transversal: reevaluacion explicita al editar una transaccion y registro de correcciones.
- Criterio de cierre total: una misma regla produce el mismo resultado en todos los puntos de ingreso autorizados, explica su aplicacion y puede simularse sin modificar datos.
- Criterio transversal adoptado: `docs/producto/criterio_entrega_motores_y_automatizaciones.md`.

### Compromisos personales variables

- Estado: diseño funcional ampliado con Captura rapida, orientación y recurrencia aprendida.
- Problema actual: cada compromiso repite un monto fijo en Proyeccion y no conserva aumentos efectivos por fecha.
- Alcance inicial: historial de montos, monto variable a confirmar, snapshots de aplicacion, agenda de aumentos manuales y proyeccion correcta por periodo.
- Cruce con Captura rapida: aplicar un pendiente dentro del dialogo; para altas nuevas interpretar lo confiable y abrir Compromisos con un borrador.
- Recurrencia: sugerir un compromiso despues de al menos tres periodos mensuales consistentes, explicar la evidencia y requerir confirmacion.
- Trazabilidad: la transaccion aplicada debe mostrar compromiso y periodo; editar no cambia la plantilla y eliminar reabre la aplicacion.
- Evolucion: porcentajes pautados e indices oficiales con fallback manual.
- Documento: `docs/producto/compromisos_espacios_y_proyeccion.md`.

### Captura rapida de movimientos

- Estado: v1.3 implementada y verificada el 2026-07-24 en desktop y mobile.
- Experiencia: primera accion del FAB, atajo `Q`, resumen vivo, fragmentos reconocidos y hasta cinco accesos frecuentes. En mobile el dialogo es compacto, no produce scroll horizontal y los campos manuales quedan colapsados hasta que el usuario necesita corregirlos.
- Autocompletado visible: el sufijo sugerido aparece dentro del texto con menor opacidad y explica la palabra completa antes de aceptarla. También completa nombres de cuentas activas cuando el fragmento escrito es un prefijo inequívoco; abreviaturas y similitudes siguen requiriendo una sugerencia explícita.
- Teclado: Enter o Espacio aceptan el autocompletado inline; Tab conserva el mismo atajo en desktop. La ayuda se puede tocar en mobile. Un segundo Espacio consecutivo revierte la expansion, conserva el texto original con un espacio y descarta esa sugerencia. Enter registra cuando ya no quedan sugerencias.
- Personalizacion: alias sincronizados por usuario para cuenta, categoria, comercio y descripcion; CRUD en Configuracion > Aprendizaje y atajos y migracion de alias locales.
- Cierre de migracion: los alias locales se usan una sola vez, se limpian al sincronizarse y dejaron de alimentar Nueva transaccion. Eliminar un atajo sincronizado ya no permite que reaparezca desde el dispositivo original.
- Aprendizaje personal: implementado el 2026-07-24. Aprende de movimientos simples confirmados y vigentes, nunca de montos, fechas, notas u operaciones financieras especiales. Tres casos consistentes habilitan una sugerencia; cinco casos con 90% de consistencia pueden completar cuenta, categoria o comercio de forma visible y reversible.
- Explicabilidad: cada valor aprendido muestra `Personalizada`, la evidencia resumida y una accion para descartarlo. Alias, reglas, texto explicito y selecciones manuales conservan prioridad.
- Control: el usuario puede pausar el aprendizaje, revisar patrones y metricas, olvidar, restaurar, corregir como alias, convertir un patron compatible en regla o reiniciar sin borrar movimientos.
- Feedback: dos descartes recientes suspenden el autocompletado; una correccion o reversion pesa el doble. Nueva evidencia consistente posterior permite recuperarlo. Reiniciar conserva la preferencia activa o pausada.
- Metricas: las personalizaciones automaticas registran impresion y aceptacion con deduplicacion por sesion, y las tasas visibles quedan acotadas a valores validos.
- Consolidacion tecnica: cuentas simples, etiquetas y resolucion de IDs tienen fuentes compartidas; frecuentes y aprendizaje reutilizan una sola lectura de historial al abrir el dialogo.
- Privacidad y trazabilidad: eventos idempotentes sin frase original, monto, fecha ni notas; retencion de 180 dias, aislamiento por usuario y procedencia `quick_capture`. La telemetria es best-effort y nunca bloquea una operacion financiera.
- Seguridad financiera: vista previa y creacion comparten reglas y validaciones de propiedad, actividad, tipo de cuenta, categoria, moneda, fondos y saldo negativo. El servidor revalida inmediatamente antes de guardar.
- Sincronizacion: tipo, categoria, comercio, cuenta, moneda, fecha y descripcion visibles reflejan el resultado normalizado de la vista previa, sin impedir que el servidor vuelva a aplicar y auditar la regla al guardar.
- Resguardos: ARS/USD con banderas y codigo, impacto de saldo, conflictos de moneda, duplicados confirmables, fechas futuras o anteriores al inicio operativo, doble envio bloqueado y derivacion al formulario completo.
- Reversibilidad: toast de ocho segundos con Deshacer real; si falla, la transaccion permanece visible y se informa el error.
- Parser: determinista, sin IA generativa; cubre orden flexible, alias, nombres exactos, reglas, historial, autocompletado por prefijo y similitud prudente. `syer` y `ayyer` corrigen fecha de forma visible; `cafw` y `xafé` se sugieren; `cage` no se reemplaza solo.
- Fechas argentinas: reconoce `antes de ayer`, dias de semana completos o abreviados, ultimo/proximo dia, `que viene`, `pasado`, `hace N`, `N atras` y `dentro de N` para dias, semanas y dias de semana.
- Incertidumbre: las palabras comunes permanecen como descripcion y la categoria puede quedar vacia; abreviaturas cortas sin significado se muestran como no resueltas y nunca se convierten silenciosamente en cuenta o categoria.
- Verificacion: suite unitaria completa, E2E Chromium desktop/mobile, registro y deshacer en ARS/USD y smoke visual con la cuenta de prueba.
- Meta inicial: registrar un gasto simple en menos de cinco segundos y con un maximo de dos decisiones.
- Dirección aprobada: evolucionar gradualmente como orientador de Finp, resolviendo lo simple y derivando Compromisos, reglas, cuotas, Deudas, Espacios e Importacion con un borrador.
- Onboarding pendiente: introduccion breve, ejemplos rotativos, ayuda `¿Que puedo escribir?` y descubrimiento contextual con frecuencia limitada.
- Contrato: las sugerencias funcionales explican motivo y destino, requieren confirmacion y miden si la accion se completo.
- Documento: `docs/producto/estrategia_ingreso_datos_y_automatizacion.md`.
- Diseño de orientación: `docs/producto/captura_rapida_como_orientador.md`.

## P2 - Mejoras de producto

### Sugerencia de reglas por gastos repetidos

- Estado: implementado de punta a punta el 2026-07-24.
- Superficie: las propuestas viven en Reglas, explican frecuencia y confianza, se pueden revisar con el formulario precompletado o descartar de forma persistente.
- Alcance: después de al menos tres movimientos consistentes, sugiere automatizar la categoría sin crear nada por su cuenta.
- Criterio de cierre: la regla se crea únicamente con confirmación, explica por qué se propone y queda disponible para reintentar si falla.
- Evolucion pendiente: distinguir regla, compromiso y suscripcion; incorporar feedback de propuestas ignoradas y estadisticas de efectividad.

### Asistencia inteligente de descripción

- Estado: implementado el 2026-07-23.
- Corrección: propone "¿Quisiste decir?" para errores breves. Captura rápida migra los alias locales y permite administrarlos sincronizados por usuario.
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
