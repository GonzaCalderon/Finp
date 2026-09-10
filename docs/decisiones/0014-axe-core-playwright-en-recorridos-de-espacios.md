# 0014 — `@axe-core/playwright` en los recorridos E2E de Espacios

> Estado: propuesta
> Fecha: 2026-09-10
> Audiencia: producto, diseño, desarrollo, calidad y agentes
> Fuente de verdad: decisión 0014
> Responsables: prompter y equipo Finp
> Ámbito: calidad, dependencias y accesibilidad

## Índice

1. [Contexto y problema](#1-contexto-y-problema)
2. [Restricciones](#2-restricciones)
3. [Opciones consideradas](#3-opciones-consideradas)
4. [Decisión](#4-decisión)
5. [Consecuencias](#5-consecuencias)
6. [Verificación](#6-verificación)
7. [Referencias](#7-referencias)

## 1. Contexto y problema

La etapa 4 de FINP-P1-013 cierra la experiencia de Espacios con un criterio
explícito de accesibilidad: foco, labels, orden de tabulación, contraste,
`safe area` y anuncio de paso. Hoy esa verificación depende de aserciones
dirigidas escritas a mano en RTL y Playwright. Son necesarias, pero no
detectan lo que nadie pensó en afirmar: un control sin nombre accesible en una
rama nueva, un contraste roto por un token de tema, un `aria-*` inválido.

`AGENTS.md` §11 exige evaluar una dependencia antes de agregarla. Esta decisión
es esa evaluación.

## 2. Restricciones

- Sólo desarrollo: no puede entrar al bundle de producción ni a `next build`.
- No reemplaza las aserciones dirigidas: axe no verifica foco en el primer
  error, anuncio del paso, orden de tabulación real ni `safe area`.
- No puede volver lenta la matriz global de 80 escenarios más allá de lo
  proporcional al valor.
- Licencia compatible con un proyecto privado que no redistribuye la
  herramienta.
- Versión fijada por lockfile e instalación verificada.

## 3. Opciones consideradas

### Opción A — `@axe-core/playwright`

Wrapper oficial de Deque para inyectar `axe-core` en la página que ya controla
Playwright y devolver violaciones por regla WCAG.

- Ventajas: se integra en los specs existentes sin otra infraestructura; una
  llamada por superficie; resultados por regla, impacto y selector; mismo
  motor que usan las extensiones de navegador; `playwright-core >= 1.0` como
  única peer dependency, satisfecha por `@playwright/test ^1.49`.
- Desventajas: agrega `axe-core` (~500 KB) al `node_modules` de desarrollo;
  cada análisis suma entre 0,5 y 2 s por página; los falsos positivos por
  contraste sobre fondos con `color-mix` requieren revisión humana.
- Riesgos: convertir el reporte en ruido si se corre sobre todas las páginas
  sin criterio; tratar "cero violaciones" como accesibilidad cerrada.

Consultado el 2026-09-10 en el registro npm: versión `4.13.0`, licencia
MPL-2.0, dependencia `axe-core ~4.13.0`, peer `playwright-core >= 1.0.0`.

### Opción B — sólo aserciones dirigidas RTL y Playwright

Mantener lo que hay: `getByRole` con nombre, `toBeFocused`, `aria-current`,
`aria-live`.

- Ventajas: cero dependencias; cada aserción documenta una intención.
- Desventajas: sólo cubre lo que alguien anticipó; no detecta regresiones
  genéricas de nombre accesible, `aria-*` inválido o contraste; el costo de
  escribir una aserción por control no escala a un diálogo de cuatro pasos y
  tres superficies.

### Opción C — `eslint-plugin-jsx-a11y` como único control

Análisis estático de JSX.

- Ventajas: barato, corre en `npm run lint`.
- Desventajas: no ve el DOM real ni Radix, que renderiza fuera del árbol JSX;
  no detecta contraste ni nombre accesible calculado; no verifica mobile.

## 4. Decisión

Adoptar la opción A como complemento de la B, no como reemplazo. Alcance:

- `devDependency` `@axe-core/playwright` fijada por lockfile;
- un helper único en `tests/e2e/helpers/accessibility.ts` que corre
  `AxeBuilder` con las etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y
  `best-practice`, excluye lo que no controla Finp (iframes de terceros no
  existen hoy; si aparecen, se excluyen ahí) y falla el test ante cualquier
  violación de impacto `serious` o `critical`; `moderate` y `minor` se
  reportan como adjunto del test sin fallar;
- se corre sólo sobre las superficies de Espacios que la etapa 4 modifica:
  portada, detalle, `Nuevo gasto` en cada paso, edición, impacto personal y
  liquidación; en Chromium desktop y Pixel 7;
- una exclusión de regla se escribe en el helper con el motivo y el enlace a la
  regla; nunca inline en un spec.

Opción C no se adopta ahora: su valor sobre el DOM real es bajo y agregaría un
segundo criterio que nadie reconcilia.

## 5. Consecuencias

### Positivas

- Regresiones genéricas de accesibilidad detectadas sin escribir una aserción
  por control.
- Evidencia reproducible por impacto y selector para la revisión de cierre.

### Negativas o costos

- Entre 12 y 24 s adicionales en la matriz global (seis superficies, dos
  proyectos, 1–2 s por análisis).
- Dependencia de desarrollo nueva que hay que mantener alineada con
  `@playwright/test`.

### Seguimiento

- Si el ruido de `moderate` supera lo útil, bajar el umbral de reporte, no el
  de fallo.
- Ampliar a otras superficies sólo cuando su ítem del roadmap lo pida.

## 6. Verificación

- `npm ls @axe-core/playwright` muestra una sola versión instalada.
- `npm run build` no incluye `axe-core` en el bundle del cliente.
- Los recorridos de Espacios de `tests/e2e/spaces-v2-financial-flow.spec.ts`
  corren el helper y fallan ante una violación `serious` inyectada a propósito
  en un fixture local (por ejemplo, un botón sin nombre), luego revertida.
- La matriz global se mantiene bajo diez minutos en el entorno local.

## 7. Referencias

- Registro npm de `@axe-core/playwright`, consultado el 2026-09-10 mediante
  `npm view`: versión `4.13.0`, licencia MPL-2.0, peer `playwright-core >= 1.0.0`.
  Respalda compatibilidad, licencia y tamaño de la dependencia.
- Deque Systems, "axe-core" (`https://github.com/dequelabs/axe-core`),
  consultado el 2026-09-10: reglas por etiqueta WCAG y niveles de impacto.
  Respalda el criterio de fallo por impacto.
- [`AGENTS.md`](../../AGENTS.md) §11: criterio de evaluación de dependencias.
