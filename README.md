# Finp

Finp es una aplicación web de finanzas personales y compartidas. Ayuda a registrar, entender y anticipar cuentas, transacciones, tarjetas, cuotas, compromisos, proyección, deudas y gastos compartidos.

La experiencia busca reducir el esfuerzo de mantener las finanzas al día mediante captura rápida, importación, reglas y aprendizaje controlado.

## Índice

1. [Estado](#1-estado)
2. [Documentación](#2-documentación)
3. [Stack](#3-stack)
4. [Requisitos](#4-requisitos)
5. [Instalación](#5-instalación)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Comandos](#7-comandos)
8. [Estructura](#8-estructura)
9. [Testing](#9-testing)
10. [Ramas](#10-ramas)
11. [Antes de contribuir](#11-antes-de-contribuir)

## 1. Estado

Finp está en preproducción controlada.

Disponible:

- finanzas personales en ARS/USD;
- transacciones, cuentas y categorías;
- tarjetas y cuotas;
- compromisos variables y proyección;
- reglas, importación y Captura rápida;
- aprendizaje personal administrable;
- Espacios compartidos;
- Deudas;
- notificaciones, pendientes e insights;
- experiencia responsive mobile-first.

Ver el alcance comprobado en [`docs/producto/estado_actual_finp.md`](docs/producto/estado_actual_finp.md) y las prioridades en [`docs/producto/roadmap_finp.md`](docs/producto/roadmap_finp.md).

## 2. Documentación

### Punto de entrada

Toda la documentación se navega desde [`docs/README.md`](docs/README.md). Ese índice indica qué leer según la tarea.

Los agentes deben empezar por [`AGENTS.md`](AGENTS.md).

### Documentos principales

| Documento | Descripción |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Estatuto obligatorio para agentes y reglas de trabajo. |
| [`docs/README.md`](docs/README.md) | Índice canónico y rutas de lectura. |
| [`docs/producto/especificacion_funcional.md`](docs/producto/especificacion_funcional.md) | Propósito, conceptos, módulos y comportamiento esperado. |
| [`docs/producto/estado_actual_finp.md`](docs/producto/estado_actual_finp.md) | Qué está implementado y verificado. |
| [`docs/producto/roadmap_finp.md`](docs/producto/roadmap_finp.md) | Único backlog y prioridades. |
| [`design.md`](design.md) | Definiciones de diseño, interacción, animación y responsive. |
| [`docs/tecnico/arquitectura.md`](docs/tecnico/arquitectura.md) | Capas, fuentes de verdad, persistencia y seguridad. |
| [`docs/tecnico/guia_desarrollo.md`](docs/tecnico/guia_desarrollo.md) | Cómo implementar, reutilizar, manejar errores y trabajar con Git. |
| [`docs/calidad/plan_calidad_estabilizacion_finp.md`](docs/calidad/plan_calidad_estabilizacion_finp.md) | Estrategia de pruebas y release. |
| [`docs/estandares/documentacion.md`](docs/estandares/documentacion.md) | Cómo crear y mantener documentación y fuentes. |
| [`docs/decisiones/README.md`](docs/decisiones/README.md) | Registro de decisiones duraderas. |

Los documentos históricos viven en `docs/archivados/` y no dirigen el desarrollo.

## 3. Stack

- Next.js 16 y React 19;
- TypeScript;
- MongoDB y Mongoose;
- NextAuth;
- Tailwind CSS;
- Radix/shadcn y componentes propios;
- React Hook Form y Zod;
- Recharts y D3;
- ExcelJS/xlsx;
- Vitest y Testing Library;
- Playwright;
- GitHub Actions.

Las versiones exactas viven en `package.json`.

## 4. Requisitos

- Node.js 20 o superior;
- npm;
- MongoDB local o Atlas;
- variables de entorno;
- para E2E, una base de prueba separada.

## 5. Instalación

```bash
npm install
```

Crear `.env.local` y luego:

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## 6. Variables de entorno

Desarrollo:

```env
MONGODB_URI=mongodb://localhost:27017/finp
NEXTAUTH_SECRET=<secreto-local>
NEXTAUTH_URL=http://localhost:3000
```

Según las funciones usadas pueden requerirse variables adicionales para almacenamiento o servicios externos. No versionar secretos.

E2E usa `.env.test.local`, basado en `.env.test.example`, y un servidor dedicado en el puerto 3001.

Nunca apuntar pruebas a desarrollo o producción.

## 7. Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción. |
| `npm run start` | Servidor de producción local. |
| `npm run typecheck` | Verificación TypeScript. |
| `npm run lint` | ESLint. |
| `npm run test:unit` | Unit tests. |
| `npm run test:watch` | Vitest en watch. |
| `npm run test:coverage` | Cobertura unitaria. |
| `npm run test:e2e` | Playwright desktop/mobile. |
| `npm run test:e2e:ui` | Playwright UI. |
| `npm run test:seed` | Seed E2E. |
| `npm run backfill:commitments` | Dry-run del backfill. |
| `npm run backfill:commitments -- --apply` | Aplica el backfill; requiere revisión y backup. |

## 8. Estructura

```text
src/
├── app/                 páginas y APIs
├── components/          UI compartida y módulos
├── contexts/            contexto React
├── hooks/               acceso cliente
├── lib/
│   ├── client/
│   ├── models/
│   ├── server/
│   ├── utils/
│   └── validations/
└── types/

tests/
├── unit/
├── e2e/
└── helpers/

docs/
├── producto/
├── tecnico/
├── calidad/
├── estandares/
├── decisiones/
└── archivados/
```

Ver [`docs/tecnico/arquitectura.md`](docs/tecnico/arquitectura.md).

## 9. Testing

Chequeo base:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Si se modifica un recorrido crítico:

```bash
npm run test:e2e
```

Estado verificado el 2026-07-25:

- 589 unit tests aprobados;
- 5 `todo`;
- 36 escenarios E2E registrados;
- E2E pendiente de entorno local reproducible y activación en CI.

## 10. Ramas

- `main`: producción.
- `dev`: integración y próximo release.
- ramas cortas desde `dev`: `codex/*`, `feature/*`, `fix/*`, `docs/*` o `refactor/*`.

Regla:

```text
main debe estar contenido en dev, o ambas pueden estar iguales tras un release
```

Los PR normales apuntan a `dev`. La promoción productiva es `dev → main`. Un hotfix en `main` debe reintegrarse a `dev`.

## 11. Antes de contribuir

1. Leer [`AGENTS.md`](AGENTS.md).
2. Elegir la ruta adecuada en [`docs/README.md`](docs/README.md).
3. Revisar el backlog único.
4. Trabajar desde `dev` en una rama corta.
5. Reutilizar servicios y componentes.
6. Verificar mobile primero y desktop después.
7. Ejecutar pruebas proporcionales al riesgo.
8. Actualizar documentación y roadmap.

Proyecto privado.
