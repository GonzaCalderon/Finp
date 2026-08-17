# Estrategia de calidad y estabilización de Finp

> Estado: vigente
> Audiencia: desarrollo, calidad, producto y agentes
> Última actualización: 2026-08-17
> Fuente de verdad: verificación y criterios de calidad

## Índice

1. [Objetivo](#1-objetivo)
2. [Modelo de calidad](#2-modelo-de-calidad)
3. [Riesgos prioritarios](#3-riesgos-prioritarios)
4. [Pirámide de pruebas](#4-pirámide-de-pruebas)
5. [Matriz por tipo de cambio](#5-matriz-por-tipo-de-cambio)
6. [Dominio financiero](#6-dominio-financiero)
7. [APIs y seguridad](#7-apis-y-seguridad)
8. [Mobile-first y experiencia](#8-mobile-first-y-experiencia)
9. [E2E](#9-e2e)
10. [Rendimiento](#10-rendimiento)
11. [Dependencias](#11-dependencias)
12. [CI y ramas](#12-ci-y-ramas)
13. [Datos de prueba](#13-datos-de-prueba)
14. [Criterio de release](#14-criterio-de-release)
15. [Estado actual](#15-estado-actual)
16. [Referencias](#16-referencias)

## 1. Objetivo

La calidad de Finp consiste en preservar:

- exactitud funcional;
- confiabilidad;
- seguridad;
- rendimiento;
- mantenibilidad;
- compatibilidad;
- usabilidad y accesibilidad;
- capacidad de recuperación.

La cantidad de tests es una señal, no la definición de calidad.

## 2. Modelo de calidad

Finp toma como referencia las características de ISO/IEC 25010 y las adapta:

| Característica | Aplicación |
|---|---|
| Adecuación funcional | Las operaciones representan correctamente la intención. |
| Eficiencia | Mobile, bundle, consultas y procesos razonables. |
| Compatibilidad | Rutas, datos y migraciones evolucionan sin romper usos vigentes. |
| Usabilidad | Flujos claros, breves, accesibles y recuperables. |
| Fiabilidad | Operaciones atómicas, idempotentes y tolerantes a reintentos. |
| Seguridad | Aislamiento, autorización, privacidad y dependencias. |
| Mantenibilidad | Servicios compartidos, tipos, pruebas y documentación. |
| Portabilidad/flexibilidad | Web responsive y evolución de plataforma no bloqueada. |
| Safety | Evitar daño financiero por automatización o fallo parcial. |

## 3. Riesgos prioritarios

1. Saldo, período o moneda incorrectos.
2. Escritura parcial de una operación financiera.
3. Acceso a datos de otro usuario o Espacio.
4. Duplicación por reintento.
5. Reescritura histórica.
6. Estado compartido que expone decisiones privadas.
7. UI mobile que impide revisar o resolver.
8. Automatización sin consentimiento.
9. Migración sobre ambiente equivocado.
10. Dependencia o proceso con costo no evaluado.

La profundidad de pruebas se decide por riesgo, no por tamaño del diff.

## 4. Pirámide de pruebas

### Unitarias

Para:

- cálculos;
- períodos;
- monedas;
- normalización;
- ranking;
- validaciones;
- estado derivado;
- transformaciones.

Deben ser rápidas, deterministas y sin red.

### Integración y servicios

Para:

- coordinación entre modelos;
- permisos;
- idempotencia;
- transacciones de base;
- cascadas;
- reglas compartidas;
- aislamiento por usuario.

### Componentes

Para:

- interacción;
- validación visible;
- estados;
- foco;
- accesibilidad básica;
- responsive cuando pueda verificarse sin navegador completo.

### E2E

Para:

- recorridos críticos;
- autenticación;
- integración entre módulos;
- borradores y navegación;
- errores recuperables;
- mobile y desktop.

No usar E2E para cada combinación de lógica que puede cubrir una prueba menor.

## 5. Matriz por tipo de cambio

| Cambio | Unit | Integration/API | Componente | E2E | Visual |
|---|---:|---:|---:|---:|---:|
| Utilidad pura | obligatorio | no habitual | no | no | no |
| Regla financiera | obligatorio | obligatorio | según UI | flujo crítico | sí |
| Route Handler | bordes | obligatorio | no | según riesgo | no |
| Componente compartido | lógica | según datos | obligatorio | si es crítico | sí |
| Flujo entre módulos | obligatorio | obligatorio | obligatorio | obligatorio | sí |
| Migración | transformación | base de prueba | no | no | revisión de reporte |
| Diseño/tokens | no | no | según componente | smoke | obligatorio |
| Dependencia | según uso | según uso | según uso | según riesgo | bundle/seguridad |

## 6. Dominio financiero

Toda función financiera relevante considera:

- ARS y USD;
- cuenta mono y multi-moneda;
- saldo suficiente e insuficiente;
- período actual e histórico;
- `monthStartDay`;
- fecha en límites;
- monto cero, negativo, grande y decimal;
- edición;
- eliminación;
- duplicado;
- retry;
- relación derivada;
- usuario no autorizado.

Casos especializados:

- tarjeta y cuotas;
- pago total/parcial;
- cambio compra/venta;
- deuda manual/derivada;
- parte propia y total de Espacio;
- compromiso fijo/variable;
- snapshot histórico.

## 7. APIs y seguridad

Cada API nueva o modificada prueba:

- `401` sin sesión;
- `403` cuando existe pero no está autorizado;
- `404` sin revelar recursos ajenos cuando corresponda;
- validación de body, params y query;
- propiedad del recurso;
- rol de Espacio;
- conflicto e idempotencia;
- error de dependencia;
- respuesta sin campos privados.

Revisión de seguridad:

- inyección;
- mass assignment;
- enumeración;
- autorización horizontal;
- tokens;
- archivos;
- logs;
- secretos;
- rate abuse;
- dependencias.

OWASP Secure Coding Practices es referencia mínima.

## 8. Mobile-first y experiencia

Orden:

1. Chromium mobile;
2. comprobación táctil y teclado virtual;
3. desktop.

Verificar:

- viewport angosto;
- áreas táctiles;
- safe areas;
- scroll;
- foco;
- overlays;
- teclado;
- texto largo;
- montos grandes;
- ARS/USD;
- light/dark;
- carga, vacío, error, éxito y recuperación;
- movimiento reducido;
- labels y contraste.

Un flujo no está cerrado si sólo funciona en desktop.

## 9. E2E

### Entorno

- `.env.test.local` no versionado;
- base exclusiva;
- nombre de base confirmado por `E2E_DATABASE_NAME`;
- preflight `npm run test:e2e:check` sin conexión ni escrituras;
- usuario de prueba;
- servidor dedicado en puerto 3001;
- seed idempotente;
- ninguna URI de desarrollo o producción.

### Suite crítica

- autenticación;
- transacción;
- Captura rápida;
- orientación con borrador;
- aplicación de compromiso;
- importación;
- deuda;
- impacto personal de Espacio;
- permisos de invitación.

### CI

Activar por etapas:

1. smoke mobile;
2. smoke desktop;
3. integración crítica;
4. suite completa programada si el costo lo requiere.

Si ejecutar todo en cada PR es costoso, presentar tiempos, costo y alternativas antes de decidir.

## 10. Rendimiento

Medir:

- bundle por ruta;
- tiempo de carga;
- trabajo cliente;
- queries y agregaciones;
- memoria;
- polling;
- tamaño de payload;
- almacenamiento;
- procesos batch.

Áreas críticas:

- Dashboard;
- Transacciones;
- Proyección;
- gráficos;
- aprendizaje;
- notificaciones;
- futuros schedulers.

Primero establecer línea base. Después definir presupuestos y alertas.

## 11. Dependencias

Antes de integrar:

- reputación y mantenimiento;
- licencia;
- vulnerabilidades;
- tamaño;
- compatibilidad;
- alternativas;
- costo de migración;
- scripts de instalación.

Después:

- build;
- tests;
- `npm audit`;
- análisis de bundle si afecta cliente;
- decisión documentada si es estructural.

OpenSSF Scorecard es una señal, no una garantía.

## 12. CI y ramas

### Pull requests a `dev`

Requerir:

- lint;
- typecheck;
- unit;
- build;
- tests adicionales según riesgo;
- documentación actualizada.

### Promoción `dev` → `main`

Requerir:

- P0 sin regresiones;
- E2E críticos;
- smoke mobile/desktop;
- migraciones ensayadas;
- variables y operación revisadas;
- rollback razonable;
- `main` contenido en `dev`.

### Protección

Recomendado:

- no force-push;
- checks requeridos;
- conversaciones resueltas;
- PR para integrar;
- reglas equivalentes en `main` y `dev` según riesgo.

## 13. Datos de prueba

- No usar producción.
- Separar desarrollo de E2E.
- Generar datos representativos sin copiar información personal.
- Incluir monedas, períodos, negativos, cuotas, deudas y Espacios.
- Limpiar de forma acotada.
- Scripts destructivos requieren destino explícito.
- Seeds y factories deben ser idempotentes o indicar precondición.

## 14. Criterio de release

Una versión puede promoverse cuando:

- build y checks están limpios;
- no hay P0 abiertos introducidos por el release;
- migraciones fueron probadas;
- recorridos críticos pasaron mobile y desktop;
- errores conocidos tienen impacto y workaround documentados;
- documentación y roadmap reflejan realidad;
- se conoce el rollback;
- el prompter aprobó costos o riesgos materiales.

## 15. Estado actual

Checks base y E2E global verificados el 2026-08-17:

- 804 pruebas unitarias aprobadas en 100 archivos;
- build, typecheck, lint y validación documental aprobados;
- 60 de 60 E2E globales aprobados en Chromium desktop y Pixel 7 sobre el build
  de producción;
- 60 de 60 E2E globales aprobados nuevamente con `next dev`, sin reproducir 404
  ni altas fallidas después de una ejecución larga;
- CI con lint, build y unit;
- job E2E activo y protegido: sin `MONGODB_URI_TEST` informa el bloqueo sin
  conectar; con la credencial ejecuta preflight, seed, build y Playwright;
- preflight de aislamiento aprobado contra `finp-e2e`;
- seed repetible: recrea todas las cuentas sólo para el usuario general y
  mantiene usuarios independientes para smoke financiero, Proyección e impactos
  personales de Espacios;
- cobertura no bloqueante;
- el smoke financiero conserva datos representativos de dos períodos y volvió a
  quedar verde sin depender de cuentas residuales;
- la regresión de Captura rápida recarga un Dashboard sin primera capa del
  Sankey, espera el SVG, valida la descripción accesible del diálogo y falla si
  reaparece cualquiera de los dos avisos cerrados por FINP-P1-012;
- recorridos P2 aprobados para candidato recurrente, compra en un pago con
  Deshacer, cuotas, pago de resumen y revisión sin duplicar plan.

Los pendientes se administran únicamente en [`../producto/roadmap_finp.md`](../producto/roadmap_finp.md).

## 16. Referencias

- [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html)
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist)
- [W3C Mobile Accessibility](https://www.w3.org/WAI/standards-guidelines/mobile/)
- [Next.js Package Bundling](https://nextjs.org/docs/app/guides/package-bundling)
- [OpenSSF Scorecard](https://openssf.org/scorecard/)
- [npm audit reports](https://docs.npmjs.com/about-audit-reports/)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

Consulta: 2026-07-25.
