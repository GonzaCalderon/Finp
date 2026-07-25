# Estrategia de ingreso de datos y automatización

> Estado: vigente
> Audiencia: producto, diseño, desarrollo y agentes
> Última actualización: 2026-07-25
> Fuente de verdad: estrategia funcional de captura y automatización

## Índice

1. [Principio y objetivos](#1-principio-de-producto)
2. [Experiencia](#3-principios-de-experiencia)
3. [Modos de ingreso](#4-modos-de-ingreso-propuestos)
4. [Reglas y categorías](#5-relación-con-reglas-y-categorías)
5. [Recurrencia y relevancia](#6-gastos-repetidos-grandes-y-atípicos)
6. [Hábito y métricas](#7-hábito-y-recordatorios)
7. [Evolución funcional](#9-evolución-funcional)
8. [Entrega, riesgos y decisiones](#91-criterio-transversal-de-entrega)
9. [Referencias](#12-referencias-de-patrones)

Las etapas descritas aquí explican una evolución posible. La prioridad y el estado de cada trabajo viven únicamente en [`roadmap_finp.md`](roadmap_finp.md).

## 1. Principio de producto

Finp debe reducir el esfuerzo necesario para registrar movimientos sin degradar la precisión de la información.

La hipótesis central es:

> Menor fricción al registrar + mayor consistencia en los datos = mejores decisiones financieras.

El ciclo buscado es:

1. Ingreso simple.
2. Normalización y clasificación confiable.
3. Información clara.
4. Recomendaciones accionables.
5. Correcciones del usuario.
6. Automatizaciones progresivamente más precisas.

Las automatizaciones no son solamente una mejora de comodidad. Son la base para que categorías, proyección, límites de gasto y objetivos de ahorro puedan producir conclusiones confiables.

La estrategia debe integrarse con Espacios. Captura rápida, reglas, categorías y revisión diaria tienen que comprender si un movimiento es personal o compartido, sin mezclar el total del Espacio con la parte privada del usuario.

Captura rápida evoluciona además como orientador de Finp: permite empezar desde lenguaje cotidiano, resuelve lo simple y deriva intenciones especializadas hacia el módulo correcto con un borrador precargado. Esta dirección se documenta en `docs/producto/captura_rapida_como_orientador.md`.

## 2. Objetivos

- Registrar un gasto cotidiano en menos de cinco segundos.
- Requerir como máximo dos decisiones conscientes en el flujo rápido.
- Evitar que el usuario tenga que recordar información que Finp puede inferir.
- Separar captura inmediata de revisión y enriquecimiento.
- Mantener una vía completa para movimientos financieros complejos.
- Hacer que toda automatización sea explicable, corregible y reversible.
- Entregar valor visible inmediatamente después de registrar.
- Facilitar el descubrimiento contextual de Compromisos, Reglas, Deudas, Espacios, cuotas e Importación.
- Evitar que el usuario necesite conocer de antemano la arquitectura o ubicación de cada función.

## 3. Principios de experiencia

### Capturar ahora, completar después

Un movimiento cotidiano debería poder guardarse con monto, descripción y cuenta. La fecha, moneda, comercio y categoría pueden resolverse con valores por defecto, reglas o sugerencias.

Cuando exista ambigüedad, el movimiento puede quedar en una bandeja de revisión sin bloquear la captura.

### Reconocimiento antes que recuerdo

Finp debe priorizar:

- movimientos recientes;
- comercios frecuentes;
- plantillas personales;
- reglas confirmadas;
- cuentas usadas habitualmente;
- sugerencias basadas en transacciones similares.

### Progresive disclosure

El flujo rápido no reemplaza al formulario completo. El usuario debe poder ampliar el movimiento cuando necesite cuotas, cambio de moneda, transferencia, tarjeta, espacio, deuda o información adicional.

La derivación debe conservar el trabajo ya realizado. Cuando Captura rápida detecta una intención especializada, explica qué función recomienda, ofrece alternativas y abre el destino con un borrador transportable. La configuración final permanece bajo responsabilidad del módulo especializado.

### Automatización por confianza

- Confianza alta: completar automáticamente e informar qué se aplicó.
- Confianza media: sugerir una opción seleccionable con un toque.
- Confianza baja: guardar para revisión o pedir la decisión mínima necesaria.

### Recompensa mediante información

Finp no debería premiar la cantidad de movimientos cargados. La recompensa debe ser el valor financiero generado:

- saldo disponible actualizado;
- categoría y límite mensual;
- efecto sobre la proyección;
- movimientos del día conciliados;
- información pendiente de revisión.

## 4. Modos de ingreso propuestos

### 4.1 Captura rápida

Una entrada compacta para gastos e ingresos simples, disponible desde mobile y desktop.

Estado: v1 implementada y verificada el 2026-07-24.

Ejemplos:

- `4500 café`
- `supermercado 38500 visa`
- `12 usd netflix`
- `nafta 54000 ayer`
- `cobré 800000 sueldo galicia`

Finp mostraría una interpretación editable antes de guardar:

> $4.500 ARS · Café · Hoy · Mercado Pago · Restaurantes

Características:

- acceso persistente en mobile y primera accion del FAB: implementado;
- atajo `Q` en desktop: implementado;
- interpretacion determinista y resumen vivo: implementado;
- sugerencia de cuenta, categoria, comercio y descripcion: implementado;
- autocompletado inline de descripciones y prefijos de cuentas activas: implementado;
- alias sincronizados y administrables: implementado;
- aprendizaje personal explicable desde movimientos confirmados: implementado;
- validacion financiera compartida entre vista previa y creacion: implementado;
- Enter para guardar cuando no hay bloqueos: implementado;
- deshacer inmediato durante ocho segundos: implementado;
- derivacion al flujo completo conservando el borrador: implementado.

Dirección evolutiva aprobada:

- actuar como orientador hacia otras funciones de Finp;
- distinguir transacción simple, aplicación de compromiso y creación de un compromiso;
- enseñar capacidades mediante onboarding breve y ayudas contextuales;
- usar un contrato común para sugerencias funcionales;
- medir si la derivación se completa, no solamente si el usuario toca el CTA.

La autoridad final es `POST /api/transactions`: vuelve a evaluar reglas, cuenta,
moneda, categoria, fondos y duplicados aunque la vista previa del navegador haya
sido valida. `POST /api/transactions/preview` no escribe datos y anticipa el
resultado normalizado, la regla aplicada, el impacto de saldo y las advertencias.

#### Aprendizaje personal explicable

El parser financiero sigue siendo determinista. El modelo personal solo ordena o
completa descripcion, cuenta, categoria y comercio; no decide monto, fecha,
moneda ni tipo financiero.

- Fuentes: hasta 500 gastos e ingresos simples vigentes posteriores al ultimo reinicio.
- Evidencia: descripcion normalizada, terminos significativos y comercio, aislados por tipo y moneda.
- Umbrales: desde tres confirmaciones y 70% de consistencia se muestra; desde cinco, 90%, ventaja de dos casos y sin feedback negativo reciente puede autocompletar.
- Precedencia: texto financiero y entidades explicitas, alias, reglas, patrones personales, frecuencia/recencia y similitud.
- Feedback: aceptar mejora prioridad; descartar, revertir o corregir la reduce. Dos rechazos recientes suspenden el autocompletado.
- Recuperacion: una reversion o correccion equivale a dos descartes, mientras evidencia consistente posterior vuelve a habilitar el automatismo.
- Explicabilidad: el dialogo muestra el origen `Personalizada`, evidencia resumida y permite quitar el valor antes de registrar.
- Control: Configuracion > Aprendizaje y atajos permite pausar, olvidar, restaurar, corregir, convertir en regla y reiniciar.
- Migracion: los alias locales se sincronizan una vez, se eliminan del dispositivo y no vuelven a imponerse sobre altas, ediciones o borrados del vocabulario sincronizado.
- Privacidad: los eventos no guardan frase original, monto, fecha ni notas, vencen a los 180 dias y nunca son requisito para crear una transaccion.

### 4.2 Accesos frecuentes

Entre tres y cinco acciones dinámicas construidas desde el historial:

- repetir último almuerzo;
- café habitual;
- supermercado;
- carga SUBE;
- nafta.

Una acción frecuente debe copiar la estructura del movimiento, pero permitir confirmar o modificar el monto.

### 4.3 Bandeja diaria

Una vista breve para revisar:

- capturas incompletas;
- movimientos importados;
- gastos sin categoría;
- tickets escaneados;
- notificaciones bancarias pegadas;
- movimientos repetidos detectados;
- sugerencias con confianza media.

Acciones:

- confirmar;
- corregir;
- ignorar;
- crear regla;
- marcar como recurrente;
- confirmar en lote sugerencias de alta confianza.

### 4.4 Captura asistida

Evoluciones posteriores:

- pegar una notificación bancaria y extraer monto, comercio, tarjeta y fecha;
- fotografiar un ticket y obtener comercio, total, moneda y fecha;
- compartir una imagen, PDF o correo hacia Finp;
- widget, acceso directo o integración móvil;
- entrada por voz.

La primera versión de OCR debe priorizar encabezado y total. Interpretar todos los productos de un ticket no es un requisito inicial.

## 5. Relación con reglas y categorías

### Motor de reglas

Antes de ampliar las automatizaciones, todas las transacciones deben pasar por un motor único:

- nueva transacción;
- importación;
- cuotas;
- compromisos;
- impactos desde Espacios;
- reevaluación explícita al editar.

Base implementada el 2026-07-24:

- servicio común para nueva transacción, importación, cuotas, compromisos e impactos personales desde Espacios;
- acción `setType` efectiva para gastos e ingresos simples, con resguardo de tipos financieros especializados;
- normalización de tildes, espacios, signos, prefijos y referencias variables;
- trazabilidad del criterio y de las acciones aplicadas en cada transacción;
- cantidad de coincidencias y última aplicación por regla;
- simulación sin mutaciones con la misma resolución de acciones que el guardado real;
- detección de solapamientos, redundancias, acciones contradictorias y prioridad ganadora.

Pendientes del siguiente bloque:

- registrar correcciones y reevaluación explícita al editar;
- permitir condiciones múltiples de manera progresiva.

### Categorías

Las categorías deben evolucionar de etiquetas visuales a unidades de análisis financiero.

Cada categoría debería poder mostrar:

- gasto del mes;
- comparación histórica;
- proyección al cierre;
- comercios principales;
- gastos recurrentes;
- movimientos grandes o atípicos;
- límite mensual;
- porcentaje consumido;
- movimientos pendientes de revisar;
- relación con objetivos de ahorro.

La gestión futura debe contemplar renombrar, fusionar, archivar y ordenar categorías sin romper el historial.

### Espacios

Las automatizaciones deben poder:

- sugerir el Espacio correcto;
- reutilizar comercios y categorías internas;
- proponer reparto y pagador habitual;
- distinguir total compartido, parte propia y dinero adelantado;
- respetar la configuración privada de categoría de cada participante;
- derivar compromisos compartidos hacia un movimiento de Espacio.

Una automatización nunca debe crear simultáneamente un gasto personal completo y un gasto compartido por el mismo hecho.

### Compromisos

Los compromisos son otra fuente de datos predecibles. Deben integrarse con:

- captura rápida;
- reglas;
- Espacios;
- categorías;
- proyección;
- objetivos de ahorro.

Captura rápida debe poder aplicar un compromiso pendiente cuando la coincidencia sea clara. Cuando el texto parezca definir uno nuevo, debe invitar a abrir la página dedicada con descripción, monto, moneda, recurrencia, día, cuenta y categoría ya interpretados. Políticas variables, aumentos, índices, reparto y otros campos avanzados se confirman allí.

El historial puede originar candidatos mensuales explicables, pero nunca crear un compromiso automáticamente. La evolución funcional de compromisos compartidos, montos variables y ajustes argentinos está documentada en `docs/producto/compromisos_espacios_y_proyeccion.md`; el contrato de orientación está en `docs/producto/captura_rapida_como_orientador.md`.

## 6. Gastos repetidos, grandes y atípicos

### Gastos repetidos

Una propuesta debe explicar:

- cantidad de coincidencias;
- período observado;
- categoría usada habitualmente;
- estabilidad de monto y frecuencia;
- acción sugerida.

El usuario puede:

- crear una regla;
- crear un compromiso;
- crear ambos;
- editar;
- ignorar;
- no volver a sugerir ese patrón.

### Gastos grandes

Un gasto puede ser relevante porque:

- supera el comportamiento habitual de la categoría;
- representa una proporción importante del ingreso;
- consume gran parte de un límite;
- modifica una proyección u objetivo;
- es atípico frente a movimientos similares.

Debe poder marcarse como extraordinario, esperado, recurrente o excluido de recomendaciones futuras.

## 7. Hábito y recordatorios

Evitar mensajes genéricos como “Registrá tus gastos”.

Preferir recordatorios accionables:

- “Tenés tres movimientos para revisar”.
- “¿Querés repetir tu gasto habitual de almuerzo?”.
- “Detectamos dos consumos importados de hoy”.
- “Este movimiento parece igual a otros de Supermercado”.

Opciones:

- revisar ahora;
- recordar más tarde;
- omitir por hoy;
- desactivar ese tipo de recordatorio.

La gamificación debe ser sobria:

- porcentaje revisado;
- cierre semanal;
- estado “Finanzas al día”;
- celebración breve al vaciar la bandeja;
- días de gracia.

No se recomienda una racha rígida ni premiar la cantidad de gastos ingresados.

## 8. Métricas de éxito

- Tiempo medio para registrar un gasto simple.
- Cantidad de decisiones por registro.
- Abandono por paso del flujo.
- Porcentaje de movimientos categorizados.
- Porcentaje confirmado sin corrección.
- Correcciones posteriores por regla o sugerencia.
- Movimientos pendientes al cierre del día o semana.
- Tiempo medio para vaciar la bandeja.
- Adopción de accesos frecuentes.
- Reglas creadas desde sugerencias.
- Reglas desactivadas o corregidas después de aplicarse.
- Derivaciones funcionales aceptadas y efectivamente completadas.
- Campos precargados que el usuario conserva o corrige en el módulo de destino.
- Módulos descubiertos por primera vez desde Captura rápida.

Las métricas deben evaluar calidad y ahorro de esfuerzo, no incentivar la creación de movimientos.

## 9. Evolución funcional

La estrategia evoluciona en este orden conceptual:

1. una base confiable de reglas, validación y trazabilidad;
2. captura rápida con aprendizaje controlado;
3. orientación hacia módulos especializados;
4. revisión opcional;
5. información accionable por categoría y recurrencia;
6. asistencia avanzada sólo cuando la calidad de los datos lo permita.

Espacios, Compromisos y Proyección atraviesan esta evolución: deben distinguir contexto personal o compartido, parte propia, certeza de monto y procedencia.

Este orden expresa dependencias de producto. Los ítems, estados y prioridades viven únicamente en [`roadmap_finp.md`](roadmap_finp.md).

## 9.1 Criterio transversal de entrega

La implementacion de Captura rapida y de cualquier mejora del motor debe usar el criterio de entrega completa: dominio, cobertura de entradas, descubrimiento, control, trazabilidad y verificacion de punta a punta.

Documento operativo: `docs/producto/criterio_entrega_motores_y_automatizaciones.md`.

Este criterio evita que una capacidad quede disponible solo en la logica interna sin una superficie comprensible y accionable para el usuario.

## 10. Riesgos y resguardos

- No alterar silenciosamente el significado financiero de un movimiento.
- No convertir sugerencias de confianza media en automatismos.
- No usar gamificación que genere culpa o datos ficticios.
- No mezclar gasto recurrente, compromiso y regla como si fueran equivalentes.
- No aplicar cambios históricos sin vista previa y posibilidad de deshacer.
- Mantener el procesamiento sensible limitado al usuario autenticado.
- No incorporar IA donde un parser determinista sea más rápido, económico y explicable.

## 11. Decisiones abiertas

- Si la bandeja vive en Transacciones, Dashboard o como destino propio.
- Si los accesos frecuentes se generan automáticamente o pueden fijarse.
- Qué canales de captura asistida son viables en web/PWA antes de una app nativa.

Decisiones cerradas por Captura rápida v1:

- monto positivo, descripcion, fecha y cuenta son minimos; categoria es opcional;
- un borrador nunca afecta saldos: solo una transaccion confirmada;
- las aproximaciones requieren confirmacion; los alias persistentes requieren una accion explicita;
- el aprendizaje personal esta activo por defecto, usa solo movimientos confirmados y puede pausarse, corregirse, olvidarse o reiniciarse;
- solo evidencia personal de confianza alta puede autocompletar campos semanticos, siempre de forma visible y reversible;
- confianza y origen se muestran mediante fragmentos, sugerencias, correcciones y regla aplicada.

## 12. Referencias de patrones

- Todoist Quick Add y lenguaje natural: <https://www.todoist.com/help/articles/introduction-to-tasks-080OAXric>
- Toggl Track, autocompletado y captura desde actividad: <https://support.toggl.com/timer-mode> y <https://support.toggl.com/the-timeline-feature>
- MyFitnessPal, escaneo visual y códigos de barras: <https://support.myfitnesspal.com/hc/en-us/articles/360045761612-Meal-Scan-FAQ> y <https://support.myfitnesspal.com/hc/en-us/articles/360032624771-How-do-I-use-the-barcode-scanner-to-log-foods>
- Day One, plantillas para reducir el inicio en blanco: <https://dayoneapp.com/guides/tips-and-tutorials/templates/>
- Duolingo, hábito mínimo y flexibilidad: <https://blog.duolingo.com/improving-the-streak/> y <https://blog.duolingo.com/how-duolingo-streak-builds-habit/>
- Apple App Shortcuts: <https://developer.apple.com/documentation/appintents/app-shortcuts>
