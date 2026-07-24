# Criterio de entrega de motores y automatizaciones

Última actualización: 2026-07-24

Una mejora de lógica no está terminada cuando el motor calcula correctamente. Está terminada cuando el usuario puede descubrirla, entenderla, controlarla y verificar su efecto en todos los puntos donde corresponde.

## Definición de terminado

Cada motor o automatización nueva debe cerrar estas capas:

### 1. Dominio confiable

- Una única implementación de la decisión, reutilizada por todos los flujos.
- Entradas, salidas, prioridades, límites y excepciones explícitas.
- Comportamiento seguro ante datos incompletos o incompatibles.
- Idempotencia cuando un proceso pueda reintentarse.

### 2. Cobertura de puntos de ingreso

- Alta y edición manual.
- Importación y captura asistida.
- Procesos derivados, como cuotas y compromisos.
- Contextos compartidos, como impactos personales de Espacios.
- Procesos masivos o diferidos, si existen.

La matriz de cobertura se documenta y se prueba. Una integración parcial debe presentarse como parcial.

### 3. Llegada completa al usuario

- Un lugar claro para descubrir, crear y administrar la función.
- Sugerencias contextuales cuando el historial permita reducir trabajo.
- Estados de carga, vacío, error y éxito.
- Diseño mobile y desktop consistente con Finp.
- Lenguaje que explique el resultado, no la implementación.
- Valores iniciales útiles sin crear automatismos sin consentimiento.

### 4. Control y confianza

- Vista previa o simulación cuando una decisión pueda tener impacto financiero.
- Explicación de qué coincidió, qué acción se tomó y qué alternativa ganó.
- Conflictos, prioridades y excepciones visibles.
- Activar, pausar, editar y eliminar desde una superficie coherente.
- Deshacer o reevaluar cuando el cambio histórico lo justifique.

### 5. Trazabilidad y aprendizaje

- Registrar origen, versión o regla aplicada y acciones efectivas.
- Mostrar esa procedencia en la entidad afectada.
- Medir cobertura, frecuencia, última aplicación y correcciones.
- Usar correcciones e ignorados como feedback; nunca como aprobación implícita.
- Evitar volver a sugerir decisiones descartadas sin evidencia nueva.

### 6. Verificación

- Pruebas unitarias del motor y sus bordes.
- Pruebas de integración en cada punto de ingreso.
- Pruebas de API para autenticación, aislamiento por usuario y errores.
- Pruebas de componente para el recorrido principal.
- Verificación visual responsive y de accesibilidad básica.
- Documentación de producto y backlog actualizados con estado real.

## Revisión previa a cada entrega

Antes de cerrar un bloque se responde:

1. ¿Qué puede hacer ahora el usuario que antes no podía?
2. ¿Dónde lo descubre y cómo entiende su valor?
3. ¿En qué entradas se aplica y en cuáles todavía no?
4. ¿Cómo puede probarlo sin riesgo?
5. ¿Cómo sabe después que efectivamente ocurrió?
6. ¿Cómo lo corrige, pausa o revierte?
7. ¿Qué evidencia confirma que funciona de punta a punta?

Si alguna respuesta falta, el bloque conserva un pendiente explícito de producto aunque el motor ya esté implementado.

## Aplicación al motor de reglas

- Gestión: página de Reglas con estado, actividad y cobertura.
- Descubrimiento: sugerencias basadas en patrones categorizados consistentes.
- Consentimiento: una sugerencia abre una regla revisable; nunca se activa sola.
- Control: flujo guiado para coincidencia, acciones, simulación y activación.
- Confianza: conflictos y omisiones se explican antes de guardar.
- Trazabilidad: cada movimiento automatizado muestra la regla aplicada.
- Pendiente evolutivo: reevaluación explícita, deshacer y aprendizaje desde correcciones.

