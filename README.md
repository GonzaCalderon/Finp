# Finp

Finp es una aplicación web de gestión financiera personal. Permite registrar y analizar cuentas, transacciones, ingresos, gastos, tarjetas de crédito, cuotas, compromisos recurrentes, reglas automáticas, proyecciones e importaciones desde Excel.

El proyecto está construido con Next.js, React, TypeScript, MongoDB, Mongoose y NextAuth.

## Estado del proyecto

Finp ya cuenta con una base funcional amplia:

- Autenticación con email y contraseña.
- Dashboard financiero por período.
- Cuentas en ARS y USD, incluyendo cuentas multi-moneda.
- Transacciones: ingresos, gastos, transferencias, cambios, pagos de tarjeta, ajustes y gastos con tarjeta.
- Tarjetas de crédito y planes de cuotas.
- Compromisos programados.
- Proyección futura.
- Reglas automáticas de categorización.
- Categorías personalizadas y predeterminadas.
- Importación de movimientos desde Excel con revisión previa.
- UI responsive con navegación desktop y mobile.
- Tema claro/oscuro.
- Ocultamiento global de montos.
- Tests unitarios y E2E.
- CI con lint, build y unit tests.

Documentación complementaria:

- [Informe de estado actual](./informe-estado-finp.md)
- [Diseño de Finp](./design.md)

## Stack

- Next.js `16.1.7`
- React `19.2.3`
- TypeScript
- MongoDB
- Mongoose
- NextAuth v5 beta
- Tailwind CSS 4
- Zod
- React Hook Form
- Framer Motion
- Radix UI / componentes UI propios
- Recharts, D3 y d3-sankey
- ExcelJS y xlsx
- Vitest
- Playwright

## Requisitos

- Node.js 20 o superior.
- npm.
- MongoDB local o una URI de MongoDB Atlas.

Para desarrollo local con MongoDB instalado:

```bash
mongod
```

También podés usar una base en Atlas configurando `MONGODB_URI`.

## Instalación

```bash
npm install
```

## Variables de entorno

Creá un archivo `.env.local` en la raíz del proyecto.

```bash
MONGODB_URI=mongodb://localhost:27017/finp
NEXTAUTH_SECRET=un-secreto-largo-y-seguro
NEXTAUTH_URL=http://localhost:3000
```

Variables requeridas:

| Variable | Uso |
| --- | --- |
| `MONGODB_URI` | Conexión a MongoDB |
| `NEXTAUTH_SECRET` | Firma de tokens/sesiones de NextAuth |
| `NEXTAUTH_URL` | URL base de la app para NextAuth |

Notas:

- `.env.local` no debe commitearse.
- En producción, `NEXTAUTH_URL` debe apuntar a la URL pública real.
- Para tests E2E existe `.env.test.example`.

## Desarrollo local

```bash
npm run dev
```

La app queda disponible en:

```text
http://localhost:3000
```

Si es la primera vez que usás la app, registrá un usuario desde:

```text
http://localhost:3000/register
```

Después podés iniciar sesión en:

```text
http://localhost:3000/login
```

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Levanta Next.js en modo desarrollo |
| `npm run build` | Compila la app para producción |
| `npm run start` | Ejecuta la app compilada |
| `npm run lint` | Corre ESLint |
| `npm run test` | Corre Vitest |
| `npm run test:unit` | Corre tests unitarios |
| `npm run test:watch` | Corre Vitest en modo watch |
| `npm run test:coverage` | Corre coverage unitario |
| `npm run test:e2e` | Corre Playwright headless |
| `npm run test:e2e:ui` | Abre Playwright UI |
| `npm run test:e2e:debug` | Corre Playwright con inspector |
| `npm run test:seed` | Crea usuario y datos iniciales para E2E |

## Estructura

```text
src/
  app/
    (auth)/                 Login y registro
    (app)/                  Área autenticada
    api/                    Route handlers internos
    modules/                Módulos por dominio
  components/
    shared/                 Componentes de producto
    ui/                     Primitivas UI
  contexts/                 Providers de estado cliente
  hooks/                    Hooks de datos e interacción
  lib/
    client/                 Helpers cliente
    constants/              Constantes de dominio
    db/                     Conexión a MongoDB
    env/                    Validación de entorno
    models/                 Modelos Mongoose
    utils/                  Lógica de dominio
    validations/            Schemas Zod
  types/                    Tipos compartidos
tests/
  unit/                     Tests unitarios
  e2e/                      Tests Playwright
```

## Dominios principales

### Autenticación

NextAuth usa provider de credenciales. Las contraseñas se guardan hasheadas con bcryptjs. Las rutas autenticadas están protegidas por `src/proxy.ts` y las APIs validan sesión con `auth()`.

Archivos relevantes:

- `src/lib/auth.ts`
- `src/proxy.ts`
- `src/components/shared/SessionGuard.tsx`

### Cuentas

Las cuentas representan bancos, efectivo, billeteras, tarjetas, deudas y ahorros. Pueden operar en ARS, USD o ambas monedas. Los saldos se calculan desde transacciones e importes iniciales.

Archivos relevantes:

- `src/lib/models/account.model.ts`
- `src/lib/utils/accounts.ts`
- `src/lib/utils/balance.ts`
- `src/contexts/AccountsContext.tsx`

### Transacciones

Las transacciones son el centro del producto. Soportan ingresos, gastos, gastos con tarjeta, transferencias, cambios, pagos de tarjeta y ajustes.

Archivos relevantes:

- `src/lib/models/transaction.model.ts`
- `src/lib/validations/transaction.ts`
- `src/hooks/useTransactions.ts`
- `src/app/api/transactions/route.ts`

### Tarjetas y cuotas

Los gastos con tarjeta y los planes de cuotas tienen lógica propia para calcular cuota activa, deuda pendiente y resumen mensual.

Archivos relevantes:

- `src/lib/models/installment-plan.model.ts`
- `src/lib/utils/credit-card.ts`
- `src/app/api/installments/route.ts`
- `src/app/(app)/transactions/credit-card/page.tsx`

### Importación Excel

La importación crea un batch en borrador, parsea filas, detecta errores/duplicados, permite revisión manual y recién después confirma la creación de transacciones.

Archivos relevantes:

- `src/lib/utils/excel-parser.ts`
- `src/lib/utils/excel-template.ts`
- `src/lib/utils/import-transactions.ts`
- `src/app/api/import/route.ts`
- `src/app/(app)/transactions/import/[batchId]/page.tsx`

## Base de datos

Finp usa MongoDB con Mongoose.

Modelos principales:

- `User`
- `Account`
- `Category`
- `Transaction`
- `InstallmentPlan`
- `ScheduledCommitment`
- `CommitmentApplication`
- `TransactionRule`
- `ImportBatch`
- `ImportRow`

La conexión se centraliza en:

```text
src/lib/db/index.ts
```

La conexión mantiene cache global para evitar reconexiones repetidas durante desarrollo y en entornos serverless.

## Tests unitarios

```bash
npm run test:unit
```

Con coverage:

```bash
npm run test:coverage
```

Los tests unitarios viven en:

```text
tests/unit
```

Actualmente cubren validaciones y utilidades críticas de dominio.

## Tests E2E

Los tests E2E usan Playwright y corren contra una base de test.

Primero copiá el archivo de ejemplo:

```bash
Copy-Item .env.test.example .env.test.local
```

Configurá `.env.test.local`:

```bash
MONGODB_URI=mongodb://localhost:27017/finp-test
NEXTAUTH_SECRET=un-secreto-largo-para-test-local
NEXTAUTH_URL=http://localhost:3000
TEST_USER_EMAIL=test@finp.dev
TEST_USER_PASSWORD=TestPass123!
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

Creá el usuario y datos base:

```bash
npm run test:seed
```

Corré los E2E:

```bash
npm run test:e2e
```

Modos útiles:

```bash
npm run test:e2e:ui
npm run test:e2e:debug
```

Notas:

- Playwright usa puerto `3001` localmente según `playwright.config.ts`.
- Los tests corren en desktop Chromium y mobile Chromium.
- Los E2E no están activos en CI por defecto.
- Si un E2E falla a mitad, puede quedar data de test sucia.

## CI

El workflow está en:

```text
.github/workflows/ci.yml
```

Jobs activos:

- Lint.
- Build.
- Unit tests.
- Coverage no bloqueante.

El job E2E está documentado en el workflow, pero comentado. Para activarlo hay que configurar secrets de test y una base MongoDB dedicada.

## Diseño y UI

El sistema visual se define principalmente en:

```text
src/app/globals.css
```

Características:

- Tema claro y oscuro.
- Tokens CSS para color, radius, shadow y sidebar.
- Navegación desktop con sidebar.
- Navegación mobile con bottom bar.
- Action sheet mobile para acciones rápidas.
- Componentes UI propios en `src/components/ui`.
- Componentes de producto en `src/components/shared`.

Ver más detalle en:

- [design.md](./design.md)

## Mobile y offline

Estado actual:

- Finp es responsive y tiene una experiencia mobile web cuidada.
- Todavía no es una app mobile nativa.
- Todavía no es PWA instalable.
- Todavía no tiene uso offline real.

Para avanzar hacia mobile/offline, el camino recomendado es:

1. Convertir la app en PWA instalable.
2. Agregar service worker y cache de la shell.
3. Agregar persistencia local con IndexedDB.
4. Agregar cola de cambios offline.
5. Diseñar sincronización con MongoDB.
6. Evaluar Capacitor si se busca publicar en stores.

## Flujo recomendado de trabajo

Antes de abrir un PR o cerrar una tarea:

```bash
npm run lint
npm run build
npm run test:unit
```

Si tocaste flujos críticos de usuario:

```bash
npm run test:e2e
```

Si tocaste dominio financiero, revisar especialmente:

- Cálculo de saldos.
- Períodos financieros.
- Tarjetas y cuotas.
- Importación.
- Multi-moneda.
- Ocultar montos.

## Troubleshooting

### Falta `MONGODB_URI`

Revisá que exista `.env.local` y que tenga:

```bash
MONGODB_URI=mongodb://localhost:27017/finp
```

### NextAuth redirige mal

Revisá:

```bash
NEXTAUTH_URL=http://localhost:3000
```

En producción debe ser la URL pública.

### No puedo loguearme

- Verificá que el usuario exista.
- Verificá que la app esté apuntando a la DB correcta.
- En E2E, corré `npm run test:seed`.

### Playwright no encuentra la app

- Revisá `.env.test.local`.
- Revisá `PLAYWRIGHT_BASE_URL`.
- Si hay conflicto de puerto, cerrá servidores previos o ajustá la configuración.

### Los saldos no coinciden

Los saldos se calculan desde transacciones e importes iniciales. Revisá:

- Transacciones de origen/destino.
- Moneda de la cuenta.
- Saldos iniciales por moneda.
- Fecha de inicio operativo.
- Planes de cuotas en tarjetas.

## Documentación relacionada

- [Informe de estado actual de Finp](./informe-estado-finp.md)
- [Diseño de Finp](./design.md)
- [Setup de E2E](./tests/e2e/helpers/README.md)

## Licencia

Proyecto privado.
