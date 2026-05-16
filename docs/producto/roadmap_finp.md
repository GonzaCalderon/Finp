# Roadmap Finp

Ultima actualizacion: 2026-05-16

Este roadmap reemplaza la logica de fases lineales gigantes. Ordena el trabajo por horizonte, prioridad, dependencia y costo relativo.

## En estabilizacion / preproduccion

### Cierre operativo post-Fase 6
- Estado: en curso
- Prioridad: critica
- Complejidad: media
- Dependencias: base actual de tests, QA manual, cierre de navegacion y pulido responsive
- Feedback real: si
- Problema que resuelve: Finp ya tiene mucho dominio conectado; el riesgo ahora es inconsistencia entre modulos, no falta de features base.
- Por que importa: define si el producto puede pasar de "dev grande" a "uso controlado" sin perder confianza.
- Riesgo tecnico: medio, por cruces entre espacios, deudas, notificaciones, dashboard y cuentas.
- Notas: incluye Fase 6T.1, 6T.2, ampliacion posterior de integration/API, E2E y release candidate.

### Pulido final de navegacion y UX responsive
- Estado: pendiente inmediato
- Prioridad: alta
- Complejidad: media
- Dependencias: cierre de hallazgos de QA
- Feedback real: si
- Problema que resuelve: la app ya tiene profundidad funcional, pero aun necesita consistencia en menus, affordances y transiciones entre modulos.
- Por que importa: impacta onboarding, uso recurrente y percepcion de solidez.
- Riesgo tecnico: bajo a medio.
- Notas: foco en menu desktop/mobile, sheets, empty states y continuidad entre Dashboard, Transacciones, Espacios y Deudas.

### Preproduccion limitada y feedback de uso real
- Estado: siguiente paso despues del cierre tecnico
- Prioridad: alta
- Complejidad: media
- Dependencias: estabilizacion minima y checklist de QA
- Feedback real: si, es el objetivo del bloque
- Problema que resuelve: varias decisiones futuras dependen de uso real, no de especulacion.
- Por que importa: evita roadmap fantasioso y ordena prioridades con evidencia.
- Riesgo tecnico: medio, porque puede exponer huecos de consistencia mas que bugs aislados.
- Notas: especialmente importante para configuracion personal de espacios, realtime y cuotas en espacios.

## Alta prioridad

### Invitaciones por link
- Estado: pendiente
- Prioridad: alta
- Complejidad: media
- Dependencias: participants/roles ya existentes, flujo de aceptacion y seguridad de acceso
- Feedback real: parcial
- Problema que resuelve: hoy sumar participantes sigue demasiado atado al flujo interno del espacio.
- Por que importa: sin invitaciones simples, Espacios queda limitado para adopcion real.
- Costo relativo: medio
- Riesgo tecnico: medio, por autenticacion, aceptacion y manejo de usuarios nuevos vs existentes.
- Notas: el rol por defecto sigue siendo participante; la administracion fina de roles queda dentro del espacio.

### Configuracion personal de espacios
- Estado: pendiente
- Prioridad: alta
- Complejidad: media
- Dependencias: `SpaceEntryPersonalImpact`, categorias personales, reporting operacional
- Feedback real: si
- Problema que resuelve: hoy el impacto personal existe, pero la politica por espacio todavia no esta modelada como preferencia estable del usuario.
- Por que importa: es la pieza que termina de unir colaboracion con finanzas personales.
- Costo relativo: medio
- Riesgo tecnico: medio, porque toca UX, defaults y consistencia en reporting.
- Notas: debe separar claramente configuracion global del espacio de "Mi Finp".

### Categorias virtuales y mapeo personal por espacio
- Estado: pendiente
- Prioridad: alta
- Complejidad: media
- Dependencias: configuracion personal de espacios
- Feedback real: si
- Problema que resuelve: falta una forma consistente de hacer que un espacio impacte en reportes personales sin forzar categorias internas compartidas.
- Por que importa: hoy Espacios ya genera impacto, pero todavia no resuelve automatizacion semantica.
- Costo relativo: medio
- Riesgo tecnico: medio.
- Notas: incluye nombre del espacio como categoria virtual, categoria fija, categorizacion manual y mapeo por categoria interna.

## Prioridad media/alta

### Cuotas en espacios
- Estado: pendiente
- Prioridad: media/alta
- Complejidad: alta
- Dependencias: estabilizacion, feedback real, integracion con tarjeta/cuotas personales
- Feedback real: si
- Problema que resuelve: hoy Espacios no puede modelar gastos financiados sin caer en atajos que rompen balances futuros.
- Por que importa: es una necesidad fuerte para pareja, hogar y compras grandes.
- Costo relativo: alto
- Riesgo tecnico: alto, por reconocimiento mensual vs upfront, deuda exigible vs compromiso futuro y enlace con Finp personal.
- Notas: ya esta decidido que Espacios no debe convertirse en una mini proyeccion financiera.

### Sincronizacion realtime
- Estado: futura, no bloqueante
- Prioridad: media/alta
- Complejidad: alta
- Dependencias: cierre de estabilizacion, definicion de eventos a sincronizar
- Feedback real: si
- Problema que resuelve: hoy la app usa polling e invalidacion, suficientes para estabilidad pero no para inmediatez real.
- Por que importa: mejora colaboracion, campana y actividad de espacios.
- Costo relativo: alto
- Riesgo tecnico: alto, por concurrencia, consistencia visual y costo de infraestructura.
- Notas: no debe adelantarse al cierre de preproduccion.

## Prioridad media

### Gastos compartidos simples
- Estado: pendiente
- Prioridad: media
- Complejidad: media
- Dependencias: ninguna estructural fuerte
- Feedback real: si
- Problema que resuelve: hoy el salto desde gasto personal a colaboracion pasa casi siempre por Espacios.
- Por que importa: cubre casos rapidos sin abrir un contexto persistente.
- Costo relativo: medio
- Riesgo tecnico: medio, porque hay que mostrar reparto sin crear sincronizacion falsa.
- Notas: ya esta decidido que en MVP impacta solo la parte propia y no crea deuda sincronizada.

### Reintegros avanzados
- Estado: pendiente
- Prioridad: media
- Complejidad: media/alta
- Dependencias: modelo actual de deudas y reporting operacional
- Feedback real: si
- Problema que resuelve: falta representar dinero que vuelve por adelantos sin tratarlo como ingreso.
- Por que importa: es central para cerrar el modelo hibrido de gasto compartido.
- Costo relativo: medio/alto
- Riesgo tecnico: medio/alto, porque toca reportes, dashboard, cuentas y transacciones.
- Notas: la decision cerrada es que reintegro no equivale a ingreso.

### Slugs y claridad de acceso en espacios
- Estado: pendiente
- Prioridad: media
- Complejidad: baja
- Dependencias: ninguna mayor
- Feedback real: no
- Problema que resuelve: las URLs actuales siguen demasiado tecnicas.
- Por que importa: mejora navegacion, links compartidos y legibilidad general.
- Costo relativo: bajo
- Riesgo tecnico: bajo.
- Notas: conviene resolverlo antes de empujar invitaciones externas a gran escala.

## Prioridad baja

### Integracion profunda tarjeta de credito + Deudas
- Estado: diferida
- Prioridad: baja
- Complejidad: alta
- Dependencias: estabilizacion, cuotas en espacios, feedback real
- Feedback real: si
- Problema que resuelve: hoy Deudas y TC conviven bien, pero aun no forman un flujo unificado de producto.
- Por que importa: puede aportar mucha potencia, pero no es el cuello de botella actual.
- Costo relativo: alto
- Riesgo tecnico: alto.
- Notas: la decision vigente es no reescribir logica de tarjeta prematuramente.

### Resolucion avanzada de `needs_review`
- Estado: diferida
- Prioridad: baja
- Complejidad: media
- Dependencias: uso real de review flows
- Feedback real: si
- Problema que resuelve: hoy hay alerta y decision manual, pero no resoluciones mas sofisticadas.
- Por que importa: puede mejorar trazabilidad y cierre de casos complejos, pero todavia no justifica peso extra.
- Costo relativo: medio
- Riesgo tecnico: medio.
- Notas: antes conviene observar cuantos casos reales terminan en review.

### Limpieza automatica de adjuntos y migracion legacy
- Estado: diferida
- Prioridad: baja
- Complejidad: media
- Dependencias: operaciones de mantenimiento y validacion de datos
- Feedback real: no
- Problema que resuelve: hoy hay compatibilidad legacy y aviso de retencion, pero no mantenimiento automatico completo.
- Por que importa: reduce deuda tecnica y operativa.
- Costo relativo: medio
- Riesgo tecnico: medio.

## Largo plazo

### PWA y offline
- Estado: largo plazo
- Prioridad: estrategica
- Complejidad: alta
- Dependencias: estabilizacion completa, definicion de cache local y sync
- Feedback real: si
- Problema que resuelve: hoy Finp es mobile-friendly, pero depende de conexion y backend disponibles.
- Por que importa: abre un salto de experiencia, especialmente en uso mobile frecuente.
- Costo relativo: alto
- Riesgo tecnico: muy alto, porque exige persistencia local, outbox y resolucion de conflictos.
- Notas: no deberia mezclarse con el cierre operativo actual.

### Arquitectura local-first / sincronizacion avanzada
- Estado: largo plazo
- Prioridad: estrategica
- Complejidad: muy alta
- Dependencias: PWA/offline, modelo de ids, estrategia de conflictos
- Feedback real: si
- Problema que resuelve: la arquitectura actual ya escalo bien a web conectada, pero no a colaboracion offline o sincronizacion compleja.
- Por que importa: definiria una nueva etapa del producto.
- Costo relativo: alto
- Riesgo tecnico: muy alto.
- Notas: no es un paso incremental pequeno; requiere decision explicita de producto e infraestructura.

## Orden recomendado

1. Cerrar estabilizacion post-Fase 6.
2. Hacer preproduccion limitada y recoger feedback real.
3. Resolver invitaciones por link.
4. Cerrar configuracion personal de espacios.
5. Resolver categorias virtuales y mapeo personal por espacio.
6. Definir cuotas en espacios con evidencia de uso real.
7. Evaluar realtime.
8. Empujar gastos compartidos simples y reintegros avanzados.
9. Dejar integraciones profundas y arquitectura offline para una etapa posterior.
