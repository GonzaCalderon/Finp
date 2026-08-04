# Diseño de Finp

> Estado: vigente
> Audiencia: producto, diseño, frontend y agentes
> Última actualización: 2026-07-26
> Fuente de verdad: experiencia visual e interacción

## Índice

1. [Identidad](#1-identidad)
2. [Principios](#2-principios)
3. [Fuentes técnicas del sistema visual](#3-fuentes-técnicas-del-sistema-visual)
4. [Jerarquía y layout](#4-jerarquía-y-layout)
5. [Navegación](#5-navegación)
6. [Mobile-first y responsive](#6-mobile-first-y-responsive)
7. [Color, tipografía y superficie](#7-color-tipografía-y-superficie)
8. [Componentes y composición](#8-componentes-y-composición)
9. [Formularios financieros](#9-formularios-financieros)
10. [Estados y feedback](#10-estados-y-feedback)
11. [Animación](#11-animación)
12. [Visualización de datos](#12-visualización-de-datos)
13. [Copy y lenguaje](#13-copy-y-lenguaje)
14. [Accesibilidad](#14-accesibilidad)
15. [Patrones de orientación](#15-patrones-de-orientación)
16. [Patrones prohibidos](#16-patrones-prohibidos)
17. [Checklist de entrega visual](#17-checklist-de-entrega-visual)

## 1. Identidad

Finp debe sentirse como un compañero financiero sereno, confiable y cercano. No es una terminal contable ni una red social.

La experiencia busca ser:

- clara: el usuario entiende qué ocurrió y qué puede hacer;
- rápida: las acciones cotidianas requieren pocas decisiones;
- confiable: todo monto relevante tiene contexto y trazabilidad;
- personal: aprende preferencias sin quitar control;
- discreta: evita ruido, urgencia artificial y exposición innecesaria;
- mobile-first: el uso cotidiano se diseña primero para una mano y una pantalla pequeña.

## 2. Principios

### La acción frecuente está cerca

Registrar un movimiento debe estar disponible desde la navegación principal. Captura rápida es la primera opción; el formulario completo conserva operaciones avanzadas.

### El resultado precede al mecanismo

La interfaz explica qué cambia —saldo, deuda, compromiso o parte propia— antes de mostrar detalles técnicos.

### Complejidad progresiva

La primera vista muestra lo necesario para decidir. Opciones infrecuentes aparecen cuando el contexto las requiere.

### Una intención, una superficie responsable

Una superficie simple puede orientar una intención compleja, pero la confirmación final ocurre donde existen todas las herramientas y validaciones del dominio.

### Automatización visible

Reglas, aprendizaje y sugerencias muestran procedencia, permiten corrección y nunca parecen magia irreversible.

### Consistencia por encima de novedad

Un patrón nuevo necesita una razón clara. Si un componente compartido resuelve el caso, se reutiliza.

## 3. Fuentes técnicas del sistema visual

Los valores vigentes viven en el código:

| Fuente | Responsabilidad |
|---|---|
| `src/app/globals.css` | Tokens, temas, colores, superficies, radios y variables globales. |
| `src/components/ui/` | Primitivas visuales y de interacción. |
| `src/components/shared/` | Componentes reutilizables de producto. |
| `src/components/*/` | Composición propia de cada dominio. |
| `src/lib/constants/` | Constantes compartidas de presentación y producto. |

Este documento define intención y reglas. No duplica valores volátiles que ya tienen una fuente técnica.

Antes de agregar un token o variante:

1. comprobar que no exista;
2. verificar light y dark;
3. justificar el significado semántico;
4. evitar valores locales difíciles de mantener.

## 4. Jerarquía y layout

Una pantalla autenticada se organiza así:

1. contexto: título, período o entidad;
2. estado principal: saldo, posición, proyección o pendiente;
3. acción primaria;
4. información de soporte;
5. acciones secundarias y configuración.

Reglas:

- una pantalla tiene una acción primaria evidente;
- los KPI no compiten con la tarea principal;
- los filtros se mantienen cerca del contenido que modifican;
- los detalles extensos usan sheets, dialogs o páginas según profundidad;
- los montos importantes preservan moneda y signo;
- el espacio vertical comunica agrupación, no decoración.

## 5. Navegación

### Desktop

- Sidebar persistente para módulos principales.
- Encabezado de página estable.
- Contenido con ancho y densidad adecuados a lectura financiera.
- Dialogs para tareas acotadas; páginas para recorridos profundos.

### Mobile

- Bottom navigation para destinos de uso frecuente.
- Menú “Más” para destinos secundarios.
- Acción central o FAB para captura.
- Sheets de borde inferior para acciones contextuales.
- Regreso predecible, sin perder borradores ni contexto.

Una función no puede existir únicamente porque hay espacio en desktop. Su recorrido mobile debe resolverse desde el diseño inicial.

## 6. Mobile-first y responsive

Orden de diseño y verificación:

1. mobile angosto;
2. mobile amplio;
3. tablet o ancho intermedio;
4. desktop.

Requisitos:

- áreas táctiles cómodas;
- controles alcanzables y separados;
- soporte de safe areas;
- teclado virtual sin ocultar confirmación o errores;
- contenido crítico sin scroll horizontal;
- tablas transformadas en cards o listas cuando sea necesario;
- dialogs adaptados a sheets si la altura o interacción lo exige;
- montos y etiquetas que no dependan sólo del color;
- acciones destructivas alejadas de acciones frecuentes.

El responsive no consiste en ocultar contenido importante. Debe reorganizarlo conservando significado y capacidad de acción.

Los flujos financieros con contenido variable usan una estructura estable:
encabezado y cierre fuera del área desplazable, cuerpo con scroll propio y CTA
primario visible sobre la safe area. En mobile, un diálogo alto pasa a pantalla
completa o sheet inferior de hasta `90dvh`; en desktop usa un diálogo mediano o
sheet lateral. Abrir un detalle desde una relación conserva un regreso explícito
al contexto anterior.

## 7. Color, tipografía y superficie

### Color

- Usar color semántico: éxito, advertencia, error, información, ingreso, gasto o estado.
- Evitar convertir cada categoría o módulo en un sistema visual independiente.
- Mantener contraste en light y dark.
- El color de categoría acompaña la identificación, no reemplaza su nombre.
- Los saldos negativos requieren signo y texto además de color.

### Tipografía

- Títulos breves y jerarquía estable.
- Montos con lectura rápida y alineación coherente.
- Texto auxiliar de menor énfasis, pero legible.
- Evitar mayúsculas sostenidas y etiquetas excesivas.

### Superficies

- Cards agrupan una unidad conceptual.
- Bordes y sombras separan niveles, no decoran cada elemento.
- El radio y la densidad deben provenir de los tokens existentes.
- Una superficie seleccionada debe tener señal visual y semántica.

## 8. Componentes y composición

Orden de preferencia:

1. primitiva existente;
2. composición compartida;
3. extensión mediante propiedades o variantes;
4. componente de dominio;
5. componente nuevo sólo si hay una responsabilidad nueva.

Extraer un componente cuando:

- el patrón aparece en más de un flujo;
- contiene una regla de interacción significativa;
- reduce divergencias visuales o de accesibilidad.

No extraer:

- wrappers que sólo cambian nombres;
- abstracciones sin un segundo caso real;
- componentes que ocultan reglas financieras importantes.

Los componentes de UI no deben calcular dominio financiero. Reciben datos ya resueltos o invocan servicios responsables.

## 9. Formularios financieros

### Flujos guiados

Cuando un formulario combina más de dos grupos conceptuales o no cabe con
claridad en un viewport mobile, se divide en pasos breves:

1. cada paso responde una decisión del usuario;
2. la validación ocurre antes de avanzar;
3. los pasos completados pueden revisarse sin perder el borrador;
4. el último paso resume el efecto antes de confirmar;
5. las operaciones secundarias con historia propia se abren en otra superficie.

En Compromisos, alta y edición siguen `Compromiso → Frecuencia → Aplicación`.
La agenda de montos no forma parte del formulario general: se administra desde
`Cambiar monto` para no mezclar configuración, vigencia e historia.

En mobile, el progreso se resume como `Paso N de 3 · Nombre` y una barra
compacta; no se reservan tres columnas sin contenido para representar el
stepper. En desktop se conservan los tres pasos visibles. El día mensual usa el
mismo patrón de datepicker de Nueva transacción, adaptado a un calendario fijo
de 31 días; no usa texto libre, un desplegable largo ni una cuadrícula siempre
abierta. Debe mostrar una vista previa del vencimiento y el recordatorio
derivados.

En diálogos guiados, encabezado y acciones quedan fuera del área desplazable.
Sólo el contenido del paso hace scroll. Desktop aprovecha el ancho disponible
con columnas cuando reduce altura o mejora comparación; mobile mantiene una
columna y ambos CTA visibles sobre la safe area.

Toda fecha financiera reutiliza los controles temporales compartidos de Finp:
`DatePickerField` para una fecha, `MonthPickerField` para un período mensual y
`CommitmentDayPicker` para un día recurrente. No se usa `input[type="date"]` ni
otro selector nativo en una superficie financiera. Una excepción requiere una
decisión explícita y documentada en este archivo.

La clasificación reutiliza el selector compartido de Nueva transacción:
búsqueda, chips con nombre y color, y orden por historial. Un módulo no crea un
segundo patrón de categorías si el comportamiento ya existe.

`Cambiar monto` usa `CircleDollarSign`; `CalendarClock` identifica la fecha de
vigencia. La superficie presenta primero el monto vigente, después las opciones
`Desde ahora`, `Desde el próximo vencimiento` y `Elegir fecha`, y finalmente una
vista previa. Mobile usa una columna y CTA inferior fijo; desktop usa un diálogo
mediano sin tarjetas anidadas innecesarias. El historial pasado es de sólo
lectura y únicamente los tramos futuros se pueden eliminar.

### Orden

1. intención o tipo;
2. monto y moneda;
3. origen/destino o cuenta;
4. fecha o período;
5. clasificación;
6. detalles opcionales;
7. revisión e impacto;
8. confirmación.

El orden puede simplificarse para Captura rápida, pero no omitir validaciones.

### Montos

- Mostrar siempre moneda.
- Aplicar formato local consistente.
- Diferenciar monto total, parte propia, saldo disponible y resultado del período.
- Permitir edición sin saltos de cursor ni redondeos inesperados.
- Mostrar el saldo resultante cuando la decisión depende de él.

### Validación

- Validar cerca del campo.
- Conservar valores válidos después de un error.
- Llevar foco o scroll al primer error relevante.
- No usar sólo un toast para errores corregibles dentro del formulario.
- Revalidar en servidor antes de escribir.

### Confirmación

La revisión final explica:

- qué se registrará;
- cuándo;
- en qué cuenta o contexto;
- qué saldo o estado cambia;
- qué regla, compromiso o sugerencia intervino.

## 10. Estados y feedback

Todo flujo contempla:

### Carga

- Skeleton si preserva la estructura esperada.
- Indicador local para mutaciones.
- Bloquear sólo la acción que no puede repetirse.

### Vacío

- Explicar qué falta.
- Ofrecer una acción útil.
- No presentar el vacío como error.

### Error

- Decir qué no se completó.
- Indicar si hubo o no impacto financiero.
- Permitir reintentar o corregir.
- Conservar el borrador siempre que sea seguro.

### Éxito

- Confirmar el resultado, no sólo “Guardado”.
- Refrescar superficies relacionadas.
- Ofrecer siguiente acción sólo si es relevante.

### Reversión

- Deshacer cuando sea seguro.
- Confirmar acciones destructivas o de alto impacto.
- Explicar qué relaciones se limpiarán o quedarán pendientes.

## 11. Animación

La animación comunica:

- entrada o salida de una superficie;
- cambio de estado;
- relación espacial;
- confirmación o reversión.

Reglas:

- breve y no bloqueante;
- consistente entre módulos;
- respetar preferencias de movimiento reducido;
- no animar montos de forma que dificulte leerlos;
- evitar secuencias ornamentales en tareas frecuentes;
- no introducir una librería sólo para un efecto local;
- una transición no debe retrasar el acceso a una acción financiera.

## 12. Visualización de datos

Una visualización se usa cuando revela una relación mejor que una lista o un número.

- Mantener unidades, período y moneda visibles.
- No sumar ARS y USD sin una conversión explicada.
- Mostrar fuente o referencia de cotización cuando corresponda.
- Diferenciar dato real, confirmado, calculado, estimado y pendiente.
- Mantener alternativa textual accesible.
- Evitar gráficos con demasiadas categorías o leyendas difíciles en mobile.
- El Sankey se reserva para flujo; no sustituye un resumen numérico.
- Las tendencias no deben convertir correlación en recomendación.

### Escenarios de Proyección

- `¿Qué pasa si gasto…?` vive en el encabezado y abre directamente el editor de
  un gasto. Al activarlo, `Base real` / `Con gastos` y un aviso que explica que
  Finp recalcula Proyección sin registrar ni editar datos reales permanecen
  visibles fuera del contenido desplazable.
- En mobile, `Gastos simulados` y `Sumar gasto` forman una barra inferior y los
  editores usan sheet inferior. En desktop, las acciones están en el encabezado
  y el editor usa sheet lateral.
- La creación parte de modelos ya familiares: Compromiso, `TC · un pago` y `TC
  · cuotas`. Fechas, meses, día mensual, moneda, monto y categoría reutilizan
  los controles compartidos. Una compra con tarjeta sólo ofrece tarjetas
  activas compatibles con la moneda elegida.
- La Base real usa una barra neutral; `Con gastos` se apila por las mismas
  fuentes que Proyección. Tooltip y tabla accesible repiten Base real, Con
  gastos y Diferencia.
- El resumen contiene cuatro lecturas: Base real, Con gastos, Diferencia y
  Gastos simulados. Cada monto conserva desglose ARS/USD y respeta el
  ocultamiento global.
- Un ítem simulado muestra texto además de color: `Modificado`, `Omitido`,
  `Movido` o `Simulado`. El monto anterior permanece como referencia cuando
  corresponde y una omisión nunca se presenta como gasto real de `$0`.
- Los períodos pasados siguen visibles, identificados y sin acciones. Editar,
  restaurar y descartar deben ser accesibles por teclado; descartar cambios
  requiere confirmación.
- Un fallo de preview conserva la última comparación válida, explica el error
  en contexto y ofrece reintento. Un storage bloqueado no impide simular, pero
  advierte que el borrador no sobrevivirá una recarga.

## 13. Copy y lenguaje

- Español rioplatense claro y respetuoso.
- Usar verbos de acción: “Registrar”, “Aplicar”, “Revisar”, “Quitar”.
- Evitar jerga contable si una expresión cotidiana es precisa.
- Explicar consecuencias antes que implementación.
- No atribuir certeza a una inferencia.
- Diferenciar “Finp detectó”, “Finp sugiere” y “Finp aplicará”.
- Evitar mensajes culpabilizantes por datos incompletos.
- Los ejemplos deben parecer entradas reales y breves.

## 14. Accesibilidad

- HTML semántico y nombres accesibles.
- Navegación completa por teclado en desktop.
- Foco visible y restaurado al cerrar overlays.
- Labels asociados a controles.
- Errores vinculados al campo.
- Contraste suficiente en ambos temas.
- No depender sólo de color, posición o animación.
- Controles táctiles adecuados.
- Orden de lectura coherente después del responsive.
- Soporte de movimiento reducido.
- Probar flujos críticos con zoom y contenido largo.

## 15. Patrones de orientación

Captura rápida establece el patrón:

1. interpretar texto sin escribir datos;
2. mostrar qué se entendió;
3. resolver lo simple en la superficie actual;
4. detectar una intención especializada;
5. explicar por qué conviene otra función;
6. transferir un borrador tipado y versionado;
7. confirmar en el módulo responsable;
8. medir aceptación y finalización como eventos distintos.

Este patrón puede aplicarse a Compromisos, cuotas, Deudas, Espacios, reglas e Importación. Cada destino debe entregarse completo antes de sumar el siguiente.

## 16. Patrones prohibidos

- Variantes visuales locales sin razón semántica.
- Acciones sólo disponibles por hover.
- Formularios extensos sin jerarquía ni revisión.
- Automatizaciones invisibles.
- Toasts como única explicación de un error de campo.
- Sumar monedas incompatibles.
- Ocultar el efecto financiero de una acción.
- Usar un color sin texto para distinguir estado.
- Animación ornamental en recorridos frecuentes.
- Copiar componentes para cambiar pequeñas diferencias.
- Reducir mobile a una versión mutilada de desktop.
- Mostrar datos compartidos antes de validar permisos.

## 17. Checklist de entrega visual

- [ ] Respeta los principios y tokens existentes.
- [ ] Reutiliza componentes adecuados.
- [ ] Tiene una acción primaria clara.
- [ ] Funciona primero en mobile y luego en desktop.
- [ ] Cubre carga, vacío, error, éxito y recuperación.
- [ ] Explica impacto financiero.
- [ ] Conserva moneda, signo, período y procedencia.
- [ ] Tiene foco, labels, contraste y áreas táctiles.
- [ ] La animación tiene propósito y admite movimiento reducido.
- [ ] No duplica lógica de dominio.
- [ ] Se verificó con contenido largo, montos grandes y estados negativos.
- [ ] Si creó un patrón nuevo, este documento fue actualizado.
