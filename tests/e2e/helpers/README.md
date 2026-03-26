# Setup de E2E tests

## Usuario de test

Los E2E requieren un usuario registrado en la DB configurada en `MONGODB_URI` (o `TEST_MONGODB_URI`).

### Opción A — Crear el usuario manualmente

1. Levantá la app: `npm run dev`
2. Registrate en `/register` con:
   - Email: `test@finp.dev`
   - Contraseña: `TestPass123!`
   - Nombre: `Test User`
3. Una vez registrado, el usuario queda en la DB y podés correr los E2E.

### Opción B — Script de setup (próximo paso)

Se puede agregar un script en `tests/e2e/global-setup.ts` que cree el usuario via API antes de correr los tests.

## Variables de entorno para E2E

Copiá `.env.test.example` a `.env.test.local` y completá:

```
MONGODB_URI=mongodb://localhost:27017/finp-test
NEXTAUTH_SECRET=un-secreto-de-test
NEXTAUTH_URL=http://localhost:3000
TEST_USER_EMAIL=test@finp.dev
TEST_USER_PASSWORD=TestPass123!
```

## Correr los E2E

```bash
# Modo headless
npm run test:e2e

# Modo UI interactivo (recomendado para desarrollar tests)
npm run test:e2e:ui

# Debug con inspector de Playwright
npm run test:e2e:debug
```

## ⚠️ Importante

- Los E2E no limpian la base de datos automáticamente entre runs
- Los tests de transacciones crean datos propios y los limpian al final
- Si un test falla a mitad, puede quedar data sucia → reiniciar los tests o limpiar la DB
