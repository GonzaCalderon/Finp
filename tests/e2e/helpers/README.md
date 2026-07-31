# Preparación del entorno E2E

> Estado: vigente
> Audiencia: desarrollo, calidad y agentes
> Última actualización: 2026-07-31
> Fuente de verdad: procedimiento local para preparar y ejecutar Playwright

## Índice

1. [Precondiciones](#1-precondiciones)
2. [Configurar el entorno](#2-configurar-el-entorno)
3. [Verificar sin conectar](#3-verificar-sin-conectar)
4. [Preparar datos](#4-preparar-datos)
5. [Ejecutar Playwright](#5-ejecutar-playwright)
6. [CI](#6-ci)
7. [Límites](#7-límites)

## 1. Precondiciones

E2E necesita:

- una base exclusiva que no se use en desarrollo ni producción;
- un nombre de base con marcador `e2e`, `test` o `ci`;
- credenciales limitadas a esa base cuando el proveedor lo permita;
- `.env.test.local` fuera de Git;
- puerto 3001 disponible.

`appName` identifica una conexión, pero no selecciona ni aísla la base. La URL
de Playwright también debe usar el servidor dedicado `http://localhost:3001`.

## 2. Configurar el entorno

Copiar `.env.test.example` a `.env.test.local` y completar los valores. El nombre
en la ruta de `MONGODB_URI` y `E2E_DATABASE_NAME` debe coincidir:

```env
MONGODB_URI=mongodb://localhost:27017/finp-test
E2E_DATABASE_NAME=finp-test
NEXTAUTH_SECRET=<secreto-exclusivo-de-test>
NEXTAUTH_URL=http://localhost:3001
AUTH_TRUST_HOST=true
TEST_USER_EMAIL=test@finp.dev
TEST_USER_PASSWORD=<contraseña-de-test>
PLAYWRIGHT_BASE_URL=http://localhost:3001
```

La configuración local compara el destino con `.env.local` y falla si servidor y
base coinciden. Playwright tampoco reutiliza un servidor que ya esté escuchando
en el puerto 3001.

## 3. Verificar sin conectar

```bash
npm run test:e2e:check
```

Este comando sólo analiza la configuración. No abre una conexión ni escribe
datos. Valida base, separación respecto de desarrollo y URL en el puerto 3001.
Seed y Playwright ejecutan el mismo control antes de conectarse o levantar el
servidor.

## 4. Preparar datos

Después de aprobar el control:

```bash
npm run test:seed
```

El seed es idempotente y acotado al usuario configurado. Crea o repara:

- usuario y contraseña de test;
- categorías predeterminadas;
- cuenta Efectivo;
- tarjeta bimonetaria Tarjeta E2E;
- cuenta histórica no patrimonial y candidato recurrente P2;
- usuario financiero independiente derivado del email de test;
- usuario independiente de Proyección derivado del email de test;
- dos períodos representativos con ARS/USD, saldo acumulado y negativo;
- compra en tres cuotas;
- Proyección con compromiso, compra `1/1`, consumo histórico sin plan y cuotas
  en ARS/USD;
- préstamo parcialmente pagado y préstamo saldado.

Antes de recrear los fixtures, restaura transacciones, cuotas, compromisos y
descartes del usuario general configurado. No toca otros usuarios, no imprime la
contraseña y mantiene aislado el dataset del smoke financiero.

## 5. Ejecutar Playwright

```bash
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
```

La suite corre con un worker sobre Chromium desktop y Pixel 7.

Para validar el artefacto ya compilado localmente en PowerShell:

```powershell
$env:E2E_USE_PRODUCTION_BUILD='true'
npm run test:e2e
```

El smoke financiero adjunta capturas de Dashboard, Transacciones, Cuentas y
Deudas al reporte de Playwright en ambos proyectos.

`projection.spec.ts` valida el contrato y el recorrido real en desktop y Pixel
7: seis meses, ARS/USD, expansión, navegación, persistencia, privacidad, dark
mode y movimiento reducido.

## 6. CI

El job `E2E Critical` está activo en `.github/workflows/ci.yml`. Sólo necesita el
secret `MONGODB_URI_TEST`, que debe apuntar a `finp-e2e` con un usuario limitado
a esa base. Mientras falta, el job informa el bloqueo y termina sin conectar.

Cuando la URI existe, el job genera `NEXTAUTH_SECRET` y la contraseña del usuario
de aplicación de forma efímera, ejecuta preflight, seed, build y los dos proyectos
Playwright. Ante fallos conserva `playwright-report/` y `test-results/` durante
siete días.

## 7. Límites

- Los tests de transacciones crean datos con nombres únicos y no hacen una
  limpieza global.
- El fixture financiero usa otro usuario y documentos con identificadores
  deterministas para no depender de esos movimientos.
- Si el puerto 3001 está ocupado, la ejecución falla y debe revisarse el proceso
  existente.
- La credencial vigente no se copia a GitHub; `MONGODB_URI_TEST` se configura
  únicamente después de rotarla.
