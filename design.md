# Diseño de Finp

Estado relevado: 17 de abril de 2026.

Este documento explicita el diseño actual de Finp: producto, experiencia, navegación, sistema visual, componentes, patrones de interacción y criterios para evolucionar la interfaz sin romper su coherencia.

## Identidad del producto

Finp es una aplicación de gestión financiera personal. Su propósito es ayudar a una persona a registrar, entender y anticipar su dinero cotidiano: cuentas, gastos, ingresos, tarjetas, cuotas, compromisos y proyección.

La experiencia busca ser:

- Clara: mostrar el estado financiero sin obligar al usuario a interpretar datos crudos.
- Confiable: cada monto debe sentirse trazable y consistente.
- Rápida: registrar una transacción debe ser una acción corta.
- Serena: la interfaz evita ruido visual y usa color con intención.
- Mobile-first en uso diario: aunque es web, la navegación mobile está tratada como superficie principal.
- Privada: ocultar montos es una acción global y visible.

## Principios de diseño

### 1. El registro debe estar siempre cerca

La acción más frecuente es registrar una operación. Por eso:

- En desktop hay un botón flotante para nueva transacción.
- En mobile hay una acción central en la bottom bar.
- Desde mobile también se ofrece importación como acción rápida secundaria.

### 2. El usuario mira primero el período actual

Las pantallas principales ordenan la información alrededor de un mes o período financiero:

- Dashboard.
- Transacciones.
- Gastos con tarjeta.
- Compromisos.
- Proyección.

El período financiero puede iniciar otro día del mes, por lo que la interfaz debe hablar de "período" cuando sea relevante y evitar asumir siempre mes calendario.

### 3. Multi-moneda sin perder legibilidad

Finp trabaja con ARS y USD. El diseño actual prioriza:

- Mostrar el monto principal con más peso.
- Mostrar el desglose por moneda cuando aporta claridad.
- Evitar conversiones implícitas salvo que haya una preferencia/cotización explícita.

### 4. Las tarjetas y cuotas son un dominio de primera clase

Las tarjetas no se tratan como un simple gasto más. Tienen:

- Vista especializada.
- Resumen mensual.
- Planes de cuotas.
- Estado de cuota.
- Deuda pendiente.
- Relación con patrimonio.

### 5. Las automatizaciones deben ser visibles, no mágicas

Las reglas automáticas pueden categorizar y normalizar datos. La experiencia debe dejar rastros comprensibles:

- Nombre de regla aplicada.
- Categoría asignada.
- Comercio normalizado.
- Posibilidad de editar manualmente.

## Arquitectura de información

### Rutas principales

| Ruta | Propósito |
| --- | --- |
| `/dashboard` | Estado financiero del período |
| `/transactions` | Listado, filtros y gestión de transacciones |
| `/transactions/credit-card` | Gestión específica de gastos con tarjeta |
| `/transactions/import` | Subir Excel |
| `/transactions/import/history` | Historial de importaciones |
| `/transactions/import/[batchId]` | Revisión y confirmación de importación |
| `/accounts` | Cuentas, saldos y detalle |
| `/commitments` | Compromisos recurrentes o programados |
| `/projection` | Proyección futura |
| `/rules` | Reglas automáticas |
| `/settings` | Cuenta, preferencias y categorías |
| `/login` | Ingreso |
| `/register` | Registro |

### Navegación desktop

La navegación desktop usa sidebar izquierda fija.

Elementos:

- Logo textual `Finp`, con la `p` en color primario.
- Items principales con íconos.
- Sub-items bajo Transacciones:
  - Gastos con TC.
  - Importar.
- Controles al pie:
  - Mostrar/ocultar montos.
  - Theme toggle.
  - Cerrar sesión.
- Botón flotante de nueva transacción en la esquina inferior derecha.

Comportamiento:

- El item activo usa gradiente sutil, borde izquierdo y texto blanco.
- Las secciones con sub-items se expanden si la ruta actual pertenece a esa sección.
- El botón flotante muestra tooltip en hover.

### Navegación mobile

La navegación mobile usa bottom bar de 5 columnas:

1. Transacciones.
2. Dashboard.
3. Acción central.
4. Proyección.
5. Más.

La acción central abre un action sheet con:

- Nueva transacción.
- Importar desde Excel.

El panel "Más" contiene:

- Transacciones con sub-items.
- Cuentas.
- Compromisos.
- Reglas.
- Configuración.
- Mostrar/ocultar montos.
- Theme toggle.
- Cerrar sesión.

Comportamiento:

- El panel "Más" bloquea scroll de fondo.
- Los overlays usan fondo negro translúcido.
- Los paneles entran con animación vertical suave.
- La bottom bar respeta safe area.

## Sistema visual

El sistema visual vive principalmente en `src/app/globals.css`.

### Tipografía

Fuentes:

- Sans: Geist Sans.
- Mono: Geist Mono.

Uso:

- Títulos de página: semibold, tracking tight.
- Labels secundarios: uppercase, tamaño chico, tracking amplio.
- Montos: tabular nums cuando están en listas o métricas.
- Inputs mobile: tamaño de texto suficiente para evitar zoom incómodo.

### Radios

Token base:

- `--radius: 0.625rem`

Uso actual:

- Cards y contenedores: radios medianos/grandes.
- Botones e inputs: radios moderados.
- FAB y acción central mobile: redondos por función.
- Sheets mobile: radio superior más grande.

### Tema claro

Tokens principales:

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#FAFAFA` | Fondo general |
| `--foreground` | `#111827` | Texto principal |
| `--card` | `#FFFFFF` | Cards y superficies |
| `--primary` | `#4A9ECC` | Acción primaria |
| `--accent` | `#E8F4FB` | Fondo suave celeste |
| `--destructive` | `#EF4444` | Errores y egresos críticos |
| `--border` | `#E5E7EB` | Bordes |
| `--muted-foreground` | `#6B7280` | Texto secundario |
| `--sidebar` | `#111318` | Sidebar desktop y panel Más |

### Tema oscuro

Tokens principales:

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#0F0F10` | Fondo general |
| `--foreground` | `#F9FAFB` | Texto principal |
| `--card` | `#1A1A1F` | Cards |
| `--primary` | `#60B8E0` | Acción primaria |
| `--border` | `#2D2D35` | Bordes |
| `--sidebar` | `#0A0A0C` | Sidebar |

### Colores semánticos

- Ingresos/positivo: verde `#10B981`.
- Gastos/deuda/negativo: rojo `#EF4444`.
- Acción y navegación: sky/celeste.
- Advertencia o cuota: ámbar.
- Categorías: color propio de cada categoría.
- Muted: gris para metadatos y estados secundarios.

Regla de uso:

- El color no debe ser solo decoración. Debe codificar estado, tipo de dato o jerarquía.

### Sombras y bordes

Cards:

- Fondo `var(--card)`.
- Borde `0.5px` o `1px` con `var(--border)`.
- Shadow `var(--card-shadow)`.

El lenguaje visual actual usa separación sutil, no contenedores pesados.

Reglas de composición:

- Evitar cards dentro de cards como patrón de layout. Ensucia la jerarquía, vuelve la interfaz más pesada y hace que el producto se sienta menos serio.
- Si una sección ya está en una superficie, los elementos internos deben resolverse como filas, listas, divisores, badges o bloques sin sombra.
- Usar cards internas sólo cuando representen entidades repetibles con entidad propia, por ejemplo una cuenta, una tarjeta o un movimiento en una lista.
- Los gradientes en cards y superficies deben ser muy sutiles. La referencia es el prototipo de espacios: acento de baja opacidad, suficiente para orientar pero no para decorar.
- En pantallas operativas, priorizar lectura y estructura sobre ornamentación.
- En heroes operativos, los metadatos como estado, moneda de reporte o cantidad de movimientos no deben resolverse como cards grandes. Deben ser badges/chips informativos o texto secundario para no competir con el nombre, la acción primaria y el resumen financiero.
- Los KPI secundarios deben dimensionarse según su función: si acompañan una pantalla de administración, tienen que ser compactos, escaneables y no dominar la primera pantalla.
- En vistas de configuración, preferir filas con divisores y grupos semánticos antes que tarjetas internas. La configuración se lee como ficha técnica editable, no como tablero.
- Editar una entidad existente no debe reutilizar visualmente el flujo de creación cuando eso implique pasos, lenguaje o jerarquía de onboarding. La edición debe ser directa, contextual y con campos disponibles en una sola superficie cuando sea razonable.

### Movimiento

Librerías:

- Framer Motion para entradas, salidas, acordeones, panels y cambios de mes.
- CSS transitions para botones, links y overlays.

Curvas frecuentes:

- `cubic-bezier(0.22, 1, 0.36, 1)`
- `cubic-bezier(0.16, 1, 0.3, 1)`

Reglas:

- Cambios de estado deben sentirse rápidos.
- No usar animación para esconder latencia de datos.
- Respetar `prefers-reduced-motion`.

#### Cards seleccionables

La animación de referencia para cards seleccionables es la de los KPI del hero del dashboard (`Ingresos`, `Gastos`, `Deuda mensual`, `Compromisos del mes`): debe sentirse suave, mínima y directa.

Patrón obligatorio:

- El elemento clickeable externo debe actuar como `group`.
- La superficie visual interna de la card es la única capa que se desplaza.
- Usar `transition-transform duration-200 group-hover:-translate-y-0.5`.
- El movimiento debe ser corto; no usar `hover:-translate-y-1` ni transformaciones más amplias para cards de selección.
- No animar varias sub-cards internas al mismo tiempo. Si la card tiene bloques internos, pueden cambiar borde/color de forma sutil, pero no deben desplazarse.
- El icono de navegación puede moverse apenas con `group-hover:translate-x-0.5`.

Aplicar este patrón a:

- KPI seleccionables del dashboard.
- Tarjetas de crédito seleccionables o navegables.
- Espacios.
- Cards que actúan como filtro o acceso a detalle.

#### Barras de opciones contextuales

Cuando una pantalla tiene sub-vistas operativas, preferir una barra horizontal de opciones clara antes que tabs genéricos con mucha presencia visual.

En espacios, la barra operativa de referencia contiene:

- Resumen.
- Movimientos, con badge de pendientes cuando aplique.
- Balance.

Participantes, configuración y cierre no viven en esa barra operativa. Son administración del espacio y deben quedar en una zona separada en desktop o detrás del engranaje/context menu en mobile. Esta separación evita mezclar uso diario del espacio con mantenimiento del espacio.

La barra debe sentirse como navegación operativa del contexto, no como otra card. Debe ser baja, escaneable, con estado activo claro y sin ocupar altura excesiva.

En desktop, distribuir las opciones de forma pareja cuando el set es estable. Evitar que queden agrupadas a la izquierda con un vacío grande a la derecha, porque la barra pasa a leerse como un contenedor incompleto.

En mobile, no usar scroll horizontal para navegación estructural. Si hay muchas secciones, usar labels cortos, dos filas compactas o un patrón de selección explícito; el usuario no debe tener que descubrir opciones ocultas arrastrando lateralmente.

#### Mobile en espacios

Espacios concentra resumen, movimientos, balance, participantes, configuración y cierre. En mobile no se intenta mostrar todo a la vez:

- La barra principal muestra sólo Resumen, Movimientos y Balance.
- Los KPI del espacio se agrupan como resumen financiero corto; no deben aparecer como cuatro cards verticales grandes.
- Las secciones profundas deben quedar detrás de la navegación contextual, manteniendo una primera pantalla liviana.
- Las acciones primarias pueden ocupar ancho completo, pero deben conservar separación clara respecto del borde inferior y de la bottom bar.
- El header del detalle conserva back, selector de espacios, engranaje y menú contextual cuando aplique.
- La configuración se abre desde el engranaje y debe sentirse como administración del espacio, no como un formulario suelto.

#### Refactor de Espacios 2026

La home de espacios tiene dos comportamientos principales:

- Desktop: header fuerte con métricas, búsqueda, filtros compactos, grid de 2 o 3 columnas y rail lateral para pendientes/lectura rápida. Si hay uno o pocos espacios, el rail evita que la pantalla quede vacía.
- Mobile: orden compacto de título, CTA, búsqueda/filtros, cards y pendientes. El contenedor debe dejar `pb-28` o equivalente para que nada quede tapado por la bottom bar.

El detalle del espacio se divide en:

- Uso operativo: Resumen, Movimientos y Balance.
- Administración: General, Participantes, Reparto, Monedas, Funcionamiento y Cierre.

En desktop, la administración puede mostrarse como zona propia debajo del uso operativo, con participantes, ficha de configuración y cierre. En mobile, se accede desde el engranaje del header y mantiene el nombre real del espacio como título.

La bottom bar mobile es contextual:

- Fuera de un espacio, el botón central conserva el significado global de `Nuevo`.
- Dentro de `/spaces/[id]`, el botón central crea `Movimiento`.
- La señal contextual debe ser clara y breve: label corto en el FAB y continuidad con el header del espacio.

El wizard de nuevo espacio tiene cinco pasos más éxito:

1. Información básica: nombre, descripción, tipo y preview.
2. Modo y participantes: Solo, Administrado o Sincronizado, con invitaciones opcionales.
3. Monedas y reporte del espacio.
4. Reparto y funcionamiento.
5. Revisión final.

La pantalla de éxito ofrece ir al espacio, crear otro o cerrar. Las monedas del espacio pueden incluir CLP, EUR, BRL u otras monedas informativas para el módulo Espacios; esto no extiende todavía el soporte global multi-moneda del core de Finp.

En claro y oscuro, Espacios usa los tokens de `globals.css`: fondo general claro/oscuro, cards sobre `--card`, bordes `--border`, acento primario `--primary`/`--sky` y verde sólo para estados positivos, confirmaciones o saldos a favor.

## Layout

### Shell autenticado

Estructura:

- Sidebar desktop.
- Main flexible.
- Breadcrumb superior.
- Contenido con padding responsive.
- Bottom padding extra en mobile para no quedar tapado por bottom bar.

Contenedor típico:

- `p-4 md:p-6`
- `max-w-5xl mx-auto`
- `space-y-6`

### Auth layout

Desktop:

- Panel izquierdo de marca, oscuro.
- Panel derecho con formulario centrado.
- Copy de valor en el panel de marca.

Mobile/tablet:

- Logo centrado arriba.
- Formulario centrado con ancho máximo.
- Sin panel lateral.

### Pantallas de contenido

Patrón común:

- Header con título.
- Acción principal alineada a la derecha cuando corresponde.
- Filtros o selector de período.
- Estado de carga con skeleton/spinner.
- Cards o listas.
- Dialogs/sheets para edición.

## Componentes base

### Primitivas UI

Ubicación: `src/components/ui`.

Componentes:

- Alert dialog.
- Badge.
- Breadcrumb.
- Button.
- Calendar.
- Card.
- Dialog.
- Input.
- Label.
- Popover.
- Select.
- Separator.
- Sheet.
- Skeleton.
- Sonner/toast.
- Switch.
- Tabs.

Estas piezas conforman el lenguaje base de interacción. Cualquier componente nuevo debería reutilizarlas antes de crear una variante nueva.

### Componentes compartidos de producto

Ubicación: `src/components/shared`.

Componentes clave:

- `Navbar`: navegación desktop/mobile y acciones globales.
- `TransactionDialog`: creación/edición de transacciones y operaciones complejas.
- `AccountDialog`: creación/edición de cuentas.
- `AccountDetailSheet`: detalle de cuenta.
- `CategoryDialog`: creación/edición de categorías.
- `CommitmentDialog`: creación/edición de compromisos.
- `ApplyCommitmentDialog`: aplicación de compromiso.
- `InstallmentDialog`: creación/edición de cuotas.
- `CreditCardExpenseSheet`: detalle de gasto con tarjeta.
- `TransactionRuleDialog`: reglas automáticas.
- `ImportRowEditDialog`: revisión de filas importadas.
- `SankeyChart`: visualización de flujos.
- `CashflowChart`: visualización de flujo temporal.
- `MobileCardCarousel`: carrusel mobile.
- `ResponsiveAmount`: monto adaptable.
- `CurrencyBreakdownAmount`: monto con desglose ARS/USD.
- `EmptyState`: estado vacío.
- `Spinner`: indicador de carga.
- `ThemeToggle`: selector de tema.

## Patrones de interacción

### Crear/editar

Patrón:

- Desktop y mobile usan dialogs o sheets según la complejidad.
- La acción de crear debe estar visible en la pantalla principal o en navegación global.
- Los formularios usan validación inline.
- Al guardar:
  - API request.
  - Toast de éxito/error.
  - Invalidación de datos relacionados.
  - Cierre del modal si corresponde.

### Eliminar

Patrón:

- Usar `AlertDialog`.
- Explicar la consecuencia en lenguaje directo.
- Confirmar con acción destructiva.
- Invalidar datos relacionados.

### Carga

Patrones actuales:

- Skeleton en dashboard y listas.
- Spinner pequeño para refresh.
- Estados de loading en botones.

Regla:

- Si la estructura de la pantalla es conocida, preferir skeleton.
- Si es una acción puntual, usar spinner en botón o junto al título.

### Error

Patrones actuales:

- Mensajes inline en formularios.
- Toasts para operaciones.
- Mensajes centrados para errores de carga de página.
- Banners en login para sesión vencida o cuenta creada.

Regla:

- Los errores accionables deben decir qué puede hacer el usuario.
- Los errores técnicos deben quedar en consola/API, no como jerga en UI.

### Estado vacío

Usar `EmptyState` cuando:

- No hay transacciones.
- No hay cuentas.
- No hay reglas.
- No hay importaciones.
- No hay resultados para filtros.

Un estado vacío debe incluir:

- Qué está pasando.
- Qué acción primaria tomar si corresponde.
- Copy breve.

### Ocultar montos

El ocultamiento de montos es global.

Reglas:

- Todo monto sensible debe respetar `useHideAmounts`.
- El estado debe persistir entre sesiones locales.
- La acción debe estar disponible en desktop y mobile.
- El placeholder visual actual es `••••`.

## Diseño por pantalla

### Dashboard

Objetivo:

Dar una lectura rápida del estado financiero del período.

Estructura:

- Header con título y selector de período.
- Banner de fecha de inicio operativo si falta.
- Resumen del período.
- Métricas animadas de ingresos, gastos, balance y tarjeta.
- Análisis por categoría.
- Sankey/flujo.
- Cuentas.
- Compromisos pendientes.
- Cuotas del mes.
- Patrimonio.

Mobile:

- Resumen en grilla compacta.
- Secciones expansibles.
- Carruseles para cards.
- Monto principal más destacado y detalle ocultable.

Diseño de datos:

- Ingresos en verde.
- Gastos y pasivos en rojo.
- Balance y acción en sky.
- Tendencias como badges chicos.
- Categorías con punto/color y barra porcentual.

### Transacciones

Objetivo:

Permitir encontrar, revisar y operar movimientos.

Estructura:

- Header con título.
- Resumen del período.
- Filtros.
- Lista paginada.
- Acciones por transacción: editar/eliminar/ver detalle según tipo.

Filtros:

- Mes/período.
- Tipo.
- Categoría.
- Cuenta.
- Moneda.
- Orden.

Reglas:

- Si el tipo seleccionado no es compatible con la categoría, la categoría se limpia.
- Gastos con tarjeta deben distinguirse visualmente de gastos comunes.
- Transferencias y cambios deben mostrar origen/destino.

### Nueva transacción

Objetivo:

Registrar rápido y con baja fricción, pero permitiendo casos complejos.

Tipos a cubrir:

- Ingreso.
- Gasto.
- Gasto con tarjeta.
- Transferencia.
- Cambio manual.
- Pago de tarjeta.
- Ajuste.
- Compra en cuotas.

Reglas de formulario:

- Mostrar campos según tipo.
- Validar origen/destino.
- Validar moneda soportada por cuenta.
- Evitar origen y destino iguales en transferencias/pagos.
- Para cambio manual, exigir moneda destino, monto destino y cotización.
- Para tarjeta/cuotas, usar cuenta tipo tarjeta y datos de cierre cuando aplique.

### Gastos con TC

Objetivo:

Dar seguimiento al consumo mensual de tarjetas y cuotas.

Estructura esperada:

- Selector de período.
- Resumen de deuda/pago por tarjeta.
- Listado de gastos simples y cuotas.
- Estados de cuotas: aún no inicia, cuota N/M, finalizado.
- Sheet de detalle.

Reglas:

- La cuota activa depende de `firstClosingMonth`.
- El gasto de tarjeta puede ser simple o asociado a plan.
- La deuda restante por cuotas afecta el saldo de tarjetas cuando corresponde.

### Cuentas

Objetivo:

Mostrar dónde está el dinero y cómo se mueve por cuenta.

Estructura:

- Header con acción nueva cuenta.
- Cards/lista por cuenta.
- Saldo por moneda.
- Indicador de tipo.
- Color de cuenta.
- Acciones de editar, eliminar y ver detalle.

Reglas:

- Cuentas inactivas no aparecen en listados principales.
- El saldo se calcula desde transacciones e iniciales.
- Cuentas multi-moneda deben mostrar ARS y USD.
- Tarjetas pueden mostrar deuda por cuotas.

### Compromisos

Objetivo:

Administrar pagos u obligaciones previstas.

Estructura:

- Lista de compromisos activos.
- Estado aplicado/no aplicado para el período.
- Acción aplicar.
- Crear/editar compromiso.

Reglas:

- Aplicar genera una transacción.
- Un compromiso no debería aplicarse dos veces al mismo período.
- El día del mes debe verse como ayuda contextual, no como dato principal.

### Proyección

Objetivo:

Ver obligaciones futuras ya conocidas.

Estructura:

- Selector de modo anual/mensual.
- Meses proyectados.
- Compromisos del mes.
- Cuotas agrupadas por tarjeta.
- Totales por moneda.

Reglas:

- Separar compromisos de cuotas.
- Marcar mes actual.
- Atenuar meses pasados.
- Evitar presentar la proyección como presupuesto completo si no incluye ingresos/gastos variables.

### Reglas automáticas

Objetivo:

Reducir carga manual al categorizar transacciones.

Estructura:

- Lista de reglas.
- Estado activa/inactiva.
- Prioridad.
- Condición resumida.
- Acción resultante.
- Crear/editar con dialog.

Reglas:

- La prioridad debe ser visible.
- La condición debe leerse en lenguaje humano.
- La acción debe ser verificable antes de guardar.

### Importación

Objetivo:

Permitir carga masiva sin sacrificar control.

Flujo:

1. Descargar plantilla.
2. Subir archivo.
3. Crear batch en borrador.
4. Revisar filas.
5. Corregir o ignorar filas problemáticas.
6. Confirmar.
7. Crear transacciones.

Estados visuales por fila:

- OK.
- Incompleta.
- Inválida.
- Posible duplicado.
- Ignorada.
- Importada.

Reglas:

- No confirmar si hay filas inválidas o incompletas.
- Posibles duplicados pueden importarse, pero deben estar marcados.
- La edición de fila debe mostrar datos crudos y datos interpretados.
- El resumen del batch debe estar siempre visible.

### Configuración

Objetivo:

Administrar datos del usuario y reglas globales de funcionamiento.

Tabs:

- Cuenta.
- Preferencias.
- Categorías.

Cuenta:

- Perfil.
- Seguridad.

Preferencias:

- Vista inicial.
- Día de inicio del período financiero.
- Fecha de inicio operativo.
- Cuenta predeterminada.
- Moneda/cotización cuando aplique.

Categorías:

- Listado.
- Crear/editar.
- Cargar predeterminadas.
- Eliminar con validación de uso.

## Formularios

### Estilo

- Labels encima del campo.
- Mensajes de error debajo.
- Inputs de altura cómoda.
- Selects para datos cerrados.
- Date input/calendar cuando corresponde.
- Acciones al pie.

### Validación

Reglas:

- Validar en cliente para feedback rápido.
- Validar en API como fuente de verdad.
- Usar mensajes en español.
- No mostrar errores técnicos de Zod sin traducir.

### Inputs monetarios

Reglas:

- Aceptar coma o punto como decimal.
- Mostrar moneda explícita.
- Usar formato local `es-AR` al mostrar montos.
- No permitir monto cero salvo reglas especiales.
- Ajustes pueden permitir signo negativo según validación actual.

## Visualización de datos

### Montos

Reglas:

- Usar `Intl.NumberFormat('es-AR')`.
- Para ARS, normalmente sin decimales.
- Para USD, mostrar como USD.
- Usar `tabular-nums` en listas y tablas.
- Si están ocultos, mostrar placeholder consistente.

### Tendencias

Reglas:

- Mostrar porcentaje vs período anterior.
- Si no hay base anterior, no mostrar badge.
- Para gastos/deuda, la interpretación positiva puede invertirse.

### Barras y proporciones

Usos:

- Distribución de gasto por categoría.
- Ratio deuda/ingreso.

Reglas:

- La barra debe complementar el monto, no reemplazarlo.
- El porcentaje debe aclarar si es sobre gasto o ingreso.

### Sankey

Objetivo:

Representar flujo financiero de ingresos, categorías, cuentas y egresos.

Reglas:

- Mantener labels legibles.
- Evitar superponer montos en mobile.
- Si no hay datos, mostrar estado vacío o fallback.
- La visualización debe respetar ocultar montos.

## Responsive design

### Breakpoints

El diseño usa clases Tailwind con enfoque:

- Mobile por defecto.
- `md:` para desktop/tablet amplio.
- `lg:` para auth layout y paneles.

### Mobile

Principios:

- Acciones principales al alcance del pulgar.
- Bottom bar persistente.
- Paneles desde abajo.
- Cards compactas.
- No depender de hover.
- Evitar tablas anchas cuando se pueda usar cards o filas apiladas.

### Desktop

Principios:

- Sidebar persistente.
- Mayor densidad de información.
- Grillas de cards.
- Botón flotante para acción frecuente.
- Hover states y tooltips sutiles.

## Accesibilidad

Estado actual positivo:

- Uso de labels en formularios auth.
- `aria-label` en botones iconográficos.
- `aria-invalid` en inputs con error.
- Respeto de `prefers-reduced-motion`.
- Contraste fuerte en sidebar.
- Navegación por links reales.

Criterios a sostener:

- Todo botón solo-icono debe tener `aria-label`.
- No depender solo del color para estados críticos.
- Mantener foco visible.
- Los dialogs deben tener título.
- Los overlays deben poder cerrarse de forma clara.
- Los textos chicos no deben ser el único portador de información importante.

## Copy y lenguaje

Tono:

- Directo.
- Cotidiano.
- En español rioplatense/neutro cercano.
- Sin tecnicismos contables innecesarios.

Ejemplos existentes:

- "Bienvenido de vuelta"
- "Ingresá a tu cuenta para continuar"
- "Nueva transacción"
- "Importar desde Excel"
- "Compromisos pendientes"
- "Cuotas del mes"
- "Definí tu fecha de inicio en Finp"

Reglas:

- Preferir verbos de acción: registrar, aplicar, importar, guardar.
- Evitar jerga técnica: batch, schema, ObjectId, aggregation.
- En errores, decir qué falta o qué debe corregirse.
- En confirmaciones destructivas, explicar consecuencia.

## Estados de sistema

### Sesión vencida

Diseño actual:

- Redirección a `/login?reason=session-expired`.
- Banner ámbar en login.

Regla:

- La sesión vencida no debe presentarse como error grave.
- Debe explicar que hay que volver a ingresar.

### Datos no disponibles

Regla:

- Si la API falla, mostrar error de carga.
- Si hay fallback local, usarlo solo cuando la información no sea crítica o esté explícitamente cacheada.

### Sin conexión

Estado actual:

- No hay diseño offline formal.

Diseño futuro recomendado:

- Banner "Sin conexión".
- Lectura de últimos datos cacheados.
- Acciones offline marcadas como pendientes.
- Estado de sincronización visible.

## Reglas para evolucionar el diseño

### Al agregar una pantalla

Debe definir:

- Objetivo principal.
- Acción primaria.
- Estado vacío.
- Estado de carga.
- Estado de error.
- Comportamiento mobile.
- Datos que respeta al ocultar montos.
- Tags de invalidación que la afectan.

### Al agregar un formulario

Debe definir:

- Schema Zod.
- Validación API.
- Mensajes en español.
- Defaults.
- Qué pasa al guardar.
- Qué datos invalida.

### Al agregar una métrica

Debe definir:

- Fuente de verdad.
- Período.
- Moneda.
- Si incluye/excluye tarjetas, cuotas, ajustes y cambios.
- Cómo se muestra si los montos están ocultos.
- Qué pasa si no hay datos.

### Al agregar un tipo de transacción

Debe actualizar:

- Constantes.
- Validación.
- TransactionDialog.
- API de transacciones.
- Cálculo de saldos.
- Dashboard/resúmenes.
- Importación.
- Filtros.
- Tests.

## Decisiones de diseño vigentes

- La app arranca en Dashboard por defecto, pero el usuario puede cambiarlo.
- La acción principal global es nueva transacción.
- Mobile usa bottom nav, no sidebar colapsada.
- Desktop usa sidebar persistente.
- Las tarjetas de crédito tienen vista propia.
- La importación exige revisión previa.
- Las categorías tienen color y tipo.
- Los saldos se calculan, no se editan como dato principal.
- El ocultamiento de montos es global y persistente.
- La fecha de inicio operativo mejora la precisión sin borrar historial.
- ARS y USD se tratan como monedas paralelas.

## Oportunidades de mejora de diseño

### Corto plazo

- Documentar estados vacíos por pantalla.
- Unificar lenguaje entre "mes" y "período".
- Revisar jerarquía visual en formularios largos.
- Reducir densidad en `TransactionDialog`.
- Añadir ayudas contextuales en cambio manual, cuotas y fecha de inicio operativo.
- Mejorar onboarding inicial: primera cuenta, primera categoría, primera transacción.

### Mediano plazo

- Diseñar un centro de estado de sincronización si se avanza con offline.
- Crear guías visuales para tablas vs cards.
- Definir una escala tipográfica explícita.
- Definir una escala de spacing documentada.
- Separar variantes de cards por función: métrica, lista, formulario, alerta.
- Formalizar iconografía por dominio.

### Mobile/offline futuro

- Pantalla de "modo offline".
- Indicador de cambios pendientes.
- Estados de conflicto.
- Sincronización manual.
- Cache visible de "última actualización".
- Bloqueo o degradación amable para operaciones que requieran servidor.

## Checklist de coherencia

Antes de cerrar una nueva funcionalidad, verificar:

- Respeta tema claro y oscuro.
- Respeta mobile y desktop.
- Respeta ocultar montos.
- Usa componentes UI existentes.
- Tiene loading, empty y error.
- Tiene mensajes en español.
- Tiene acción primaria clara.
- No duplica una ruta de navegación existente.
- Invalida datos relacionados.
- No rompe período financiero.
- No mezcla ARS/USD sin aclararlo.
- Tiene tests si toca dominio financiero.

## Conclusión

El diseño actual de Finp ya tiene una dirección clara: una app financiera personal sobria, densa en datos pero usable, con navegación mobile cuidada y una capa visual consistente basada en tokens. El próximo salto no debería ser cambiar la estética, sino formalizar más patrones, reducir complejidad en formularios grandes y preparar estados nuevos para mobile/offline si ese camino avanza.

---

## Módulo Espacios

### Propósito y posición dentro de Finp

Espacios es el módulo de referencia para la nueva etapa visual de Finp.
Es el primer módulo completamente diseñado en clave mobile-first, con jerarquía clara entre resumen, movimientos y balance, y con una experiencia de configuración separada del detalle operativo.

El objetivo de Espacios no es reemplazar la contabilidad personal de Finp, sino ser el lugar donde los gastos compartidos —en pareja, con compañeros de depto, en un viaje, en un proyecto— se registran, distribuyen y cierran de forma ordenada.

---

### Reglas fijas del producto

Estas reglas no son configurables. No deben aparecer como toggles en ninguna pantalla.

#### Comprobantes

- Son **siempre opcionales**.
- El usuario puede adjuntar imágenes o PDFs a un movimiento, pero no está obligado.
- No existe un toggle de "solicitar comprobante" en los settings del espacio.
- En el formulario de movimiento, la sección de comprobantes lleva el badge "Opcional" visible.

#### Confirmación del pagador

- Está **siempre activa**.
- Cuando alguien registra un movimiento donde otra persona pagó, esa persona recibe una confirmación pendiente.
- No existe un toggle de "activar/desactivar confirmación del pagador".
- El flujo de confirmación siempre existe; lo que varía es si hay pendientes o no.

#### Fotos de personas

- **Prohibido usar fotos de perfil** en cualquier parte del módulo.
- Los participantes se representan exclusivamente con iniciales en avatares circulares.
- Esto aplica a cards, listas de participantes, settings, balance y cualquier componente que muestre una persona.

#### Semántica de tipos: pareja vs. hogar

- Un espacio como "Casa con Roro" (compartida con pareja) es tipo **Pareja** (`couple`), no Hogar (`home`).
- `home`: departamento o casa compartida con no-pareja (compañeros, familia).
- `couple`: convivencia o gastos compartidos con una pareja.
- Los placeholders del wizard reflejan esto: el tipo `couple` sugiere "Ej. Casa con Roro".

#### Ingresos

- Los ingresos **no son el eje principal** del overview en la mayoría de los espacios.
- Un espacio de tipo Pareja o Casa no asume que todos los ingresos pasan por ahí.
- Los ingresos (`income`) son un tipo de movimiento disponible, pero no se muestran como métrica destacada por defecto.
- Las KPIs del detalle priorizan: total gastado, tu parte, pendiente, saldo a favor.

---

### Arquitectura visual del módulo

#### Home de Espacios (`/spaces`)

**Desktop layout:** grid principal (1fr) + columna lateral sticky de 360px.

Componentes:
- `SpacesPageHeader`: hero con nombre del módulo, descripción contextual, métricas (Activos / Movimientos / Pendientes), alerta de pendientes cuando existe.
- `SpacesFiltersBar`: buscador de texto libre + filtros por estado (Todos / Activo / Pausado / Cerrado / Archivado).
- Grid de `SpaceOverviewCard`: responsive, compacto en mobile, card completa en desktop.
- Columna lateral (`aside`, solo desktop):
  - `RecentPendingPanel`: pendientes de acción (invitaciones + confirmaciones).
  - "Vista actual": panel contextual que muestra resultado del filtro, búsqueda activa y breakdown de pendientes por tipo. Solo visible si hay espacios o filtros activos.

**Mobile:** sin columna lateral. La barra de pendientes del header es el punto de entrada principal a las acciones.

---

#### Detalle del espacio (`/spaces/[id]`)

**Principio:** detalle operativo separado de configuración.

##### Mobile

- Header fijo: `← | [icono + nombre ∨] | ⚙`
  - ← vuelve a `/spaces`.
  - Selector de espacio abre bottom sheet para cambiar sin volver al home.
  - ⚙ abre `SpaceMobileSettingsSheet`.
- Título compacto: `h1` con nombre + descripción + pills (tipo / modo / estado / participantes / monedas).
- KPIs: scroll horizontal de 4 cards, 3 visibles + 4to parcialmente visible como hint.
- Tabs: **3 tabs fijos** — Resumen | Movimientos | Balance.
  - Configuración, participantes y cierre se acceden desde ⚙.

##### Desktop

- Back button + `SpaceHero` (presentación completa con badges, descripción, CTAs).
- KPIs: grid de 4 cards (`SpaceMetricCard`).
- Tabs: **6 tabs** — Resumen | Movimientos | Balance | Participantes | Configuración | Cierre.

##### Contenido por tab

| Tab | Contenido |
|---|---|
| Resumen | Settlement panel + Charts + Balance + Movimientos recientes + Adjuntos + Pendientes |
| Movimientos | Filtros por tipo + lista completa |
| Balance | Saldo por participante + highlight del saldo neto dominante |
| Participantes | Lista con roles y estado de invitación (desktop) |
| Configuración | Settings legibles + descripción (desktop) |
| Cierre | Estado operativo + toggle abrir/cerrar (desktop) |

---

#### Configuración mobile (`SpaceMobileSettingsSheet`)

Triggered by: ⚙ en el header del detalle.

Diseño: bottom sheet de hasta 92dvh, con handle visual, scroll interno. Estructura settings estilo iOS.

No es un resumen. Es una superficie de configuración real.

Estructura:
1. **Header**: eyebrow "Configuración del espacio" + nombre del espacio (h2, protagonista) + badges + botón ✎ (abre EditSpaceSettingsDialog) + botón ✕.
2. **General**: filas Tipo / Estado / Modo. Descripción del espacio si existe.
3. **Participantes**: lista con iniciales, nombre, email, rol, estado de invitación. Botón "Invitar" en el header de la sección.
4. **Reparto y monedas**: filas Split por defecto / Moneda de reporte / Monedas operativas / Período.
5. **Estado operativo**: estado actual + botón abrir/cerrar. Zona separada visualmente.

---

### Wizard de creación (`CreateSpaceDialog`)

5 pasos:

1. **Información**: tipo (grid con descripción) + nombre (placeholder dinámico por tipo) + descripción.
2. **Modo**: Sincronizado / Administrado / Solo + participantes (oculto si Solo).
3. **Monedas**: monedas activas + moneda de reporte + período.
4. **Reparto**: split por defecto + editor visual de porcentajes.
5. **Revisión**: resumen + botón de crear.

Post-creación: pantalla de éxito con "Ir al espacio" / "Crear otro" / "Cerrar".

Reglas del wizard:
- Sin toggles de confirmación del pagador (siempre activa).
- Sin solicitud de comprobantes (siempre opcionales).
- Modo Solo → oculta participantes y fuerza split a `none`.

---

### Formulario de nuevo movimiento (`SpaceEntryDialog`)

Modal fullscreen en mobile, modal ancho (max 1120px) en desktop.

Secciones:
- Tipo (Gasto / Ingreso / Ajuste / Liquidación).
- Monto, moneda, fecha.
- Descripción.
- Pagó + Categoría.
- Cotización (solo si moneda ≠ reporte).
- Split configurator (si modo ≠ Solo).
- Resumen rápido.
- Impacto personal (solo si el usuario actual es el pagador).
- **Comprobantes** — badge "Opcional". No obligatorio.
- Borrador (sessionStorage, sin adjuntos).
- Notas.

Footer sticky: Guardar / Guardar borrador / Cancelar.

---

### Bottom bar contextual (`SpaceActionContext`)

Al entrar a un espacio, el contexto registra una acción que reemplaza el botón central:
- Icono Plus dentro del círculo azul.
- Label "Movimiento" **debajo** del círculo (no dentro).
- Al salir (unmount), la acción se limpia y el botón vuelve al comportamiento global.

---

### Componentes principales

| Componente | Ubicación | Propósito |
|---|---|---|
| `SpaceUi.tsx` | `spaces/` | Primitivos: badges, avatars, metric cards, surface, icons |
| `SpaceOverviewCard` | `index/` | Card del home |
| `SpacesPageHeader` | `index/` | Hero del home con métricas y alerta |
| `SpacesFiltersBar` | `index/` | Filtros de estado + búsqueda |
| `SpaceDetailMobileHeader` | `detail/` | Header mobile (← / selector / ⚙) |
| `SpaceHero` | `detail/` | Presentación completa (desktop) |
| `SpaceKpiRow` | `detail/` | KPIs (scroll horizontal mobile / grid desktop) |
| `SpaceMobileSettingsSheet` | `detail/` | Settings sheet mobile |
| `SpaceSettlementPanel` | `detail/` | Banner de deuda/crédito con CTAs |
| `SpaceBalanceSection` | `detail/` | Balance entre participantes |
| `SpaceEvolutionChart` | `detail/` | Gráfico de evolución mensual (LineChart) |
| `SpaceCategoryBreakdown` | `detail/` | Distribución por categoría |
| `SpaceMovementsPanel` | `detail/` | Lista filtrada de movimientos |
| `SpaceParticipantsPanel` | `detail/` | Lista de participantes (desktop) |
| `SpaceSettingsPanel` | `detail/` | Settings legibles (desktop) |
| `SpaceClosurePanel` | `detail/` | Estado operativo (desktop) |
| `SpaceSummaryPanels` | `detail/` | Cards de resumen en tab Resumen |
| `CreateSpaceDialog` | `dialogs/` | Wizard 5 pasos + éxito |
| `EditSpaceSettingsDialog` | `dialogs/` | Edición de configuración existente |
| `SpaceEntryDialog` | `dialogs/` | Formulario de movimiento |
| `ConfirmSpaceEntryDialog` | `dialogs/` | Confirmación del pagador |
| `SpaceParticipantDialog` | `dialogs/` | Invitar participante |
| `SpaceAttachmentsUploader` | `dialogs/` | Uploader de comprobantes (siempre opcional) |
| `SpaceSplitConfigurator` | `dialogs/` | Configurador de split |
| `RecentPendingPanel` | `pending/` | Panel de acciones pendientes |

---

### Mobile vs desktop — tabla resumen

| Aspecto | Mobile | Desktop |
|---|---|---|
| Header detalle | `SpaceDetailMobileHeader` | Back button + `SpaceHero` |
| Título del espacio | h1 compacto + pills | Dentro de `SpaceHero` |
| KPIs | Scroll horizontal 3+1 | Grid 4 columnas |
| Tabs | 3 (Resumen / Mov. / Balance) | 6 (+ Participantes / Config. / Cierre) |
| Configuración | `SpaceMobileSettingsSheet` desde ⚙ | Tab "Configuración" |
| Participantes | En settings sheet | Tab "Participantes" |
| Cierre | En settings sheet | Tab "Cierre" |
| Charts | Visibles en Resumen (apilados) | Side by side |
| Adjuntos recientes | Ocultos | Visibles en Resumen |
| Bottom bar | Botón "Movimiento" con label bajo círculo | No aplica |

---

### Patrones de diseño del módulo

- **Surfaces**: `SpaceSurface` con accent color en borde superior izquierdo.
- **Section headings**: eyebrow uppercase + título + descripción + action opcional.
- **Bottom sheets**: `AnimatePresence` + `motion.div` slide desde abajo, handle visual, fondo oscuro semitransparente, scroll interno.
- **Avatars**: `SpaceInitialsAvatar` con iniciales. Nunca fotos de perfil.
- **Tone pills**: `SpaceTonePill` verde (positivo) / rojo (negativo).
- **Amount inline**: `SpaceAmountInline` respeta el contexto de ocultamiento de montos global.
- **Charts**: `LineChart` de Recharts sin área rellena. `ResponsiveContainer` para respetar el ancho.
