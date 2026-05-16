# Plan de calidad y estabilizacion - Finp

**Ultima actualizacion:** 2026-05-16

Documento dedicado para ordenar la estabilizacion posterior a una Fase 6 grande. El roadmap principal vive en `docs/producto/roadmap_finp.md`.

---

## Objetivo general

Garantizar que Finp pueda pasar a preproduccion con confianza despues de cambios grandes en Espacios, Deudas, sincronizacion multiusuario, pendientes accionables, notificaciones e impacto personal.

---

## Riesgos principales

- saldos incorrectos;
- deudas duplicadas;
- pendientes interpretados como vinculados;
- notificaciones stale o mal resueltas;
- usuarios viendo cuentas/categorias privadas de otros;
- dashboard usando total pagado en vez de parte propia;
- transacciones personales modificadas automaticamente por eventos compartidos.

---

## Piramide y matriz de testing

Piramide:

- Unit tests: logica pura, estados, privacidad, montos, dedupe.
- Integration/API tests: route handlers, auth, ownership y persistencia mockeada o DB de test.
- Component tests: acciones criticas de UI sin cubrir flujos completos.
- E2E Playwright: multiusuario, mobile/desktop y navegacion real.
- QA manual complementario: revision visual y flujos de dinero end-to-end.

Matriz de flujos criticos:

| Flujo | Unit | Integration/API | Component | E2E | Manual |
|---|---:|---:|---:|---:|---:|
| Crear gasto de espacio | Si | Si | Parcial | Si | Si |
| Impactar en Finp | Si | Si | Parcial | Si | Si |
| Editar movimiento | Si | Si | No | Si | Si |
| Anular movimiento | Si | Si | No | Si | Si |
| Pagar/cobrar deuda | Si | Si | Parcial | Si | Si |
| Archivar/eliminar notificacion | Si | Si | Si | Si | Si |
| Dashboard/transacciones/cuentas | Si | Si | Parcial | Si | Si |
| Mobile/desktop navigation | No | No | Parcial | Si | Si |

---

## Bloques

### 6T.1 - Infra de testing y factories

**Estado:** en curso.

Incluye helpers de IDs, factories de dominio, mocks de auth, mocks de Mongoose, assertions comunes y documentacion breve para escribir tests nuevos sin duplicar setup.

### 6T.2 - Unit tests criticos

**Estado:** en curso.

Incluye tests de notificaciones, `SpaceEntryPersonalImpact`, eventos de sync personal, edicion/anulacion de movimientos, Deudas, montos operativos vs reales, `data-sync` y componentes minimos de notificaciones.

### 6T.3 - Integration/API tests

**Estado:** siguiente bloque recomendado.

Cubrir endpoints con auth, ownership, validaciones, status codes, privacidad y persistencia controlada. Prioridad: notificaciones, pending actions, personal impact, debts y entries de espacios.

### 6T.4 - E2E Playwright multiusuario/mobile

**Estado:** posterior al bloque API.

Cubrir flujos reales de usuario A/B: crear gasto, ver pending, impactar, editar/anular, revisar notificaciones, pagar/cobrar deuda y navegacion mobile/desktop.

### 6RC - Release candidate preproduccion

**Estado:** posterior.

Ejecutar suite ampliada, QA manual guiado, revision de datos semilla, smoke test de build y checklist de regresion antes de abrir preproduccion controlada.

### Realtime

**Estado:** fuera del cierre actual.

Evaluar realtime para notificaciones, pending actions, actividad de espacios y sincronizacion de vistas multiusuario. No bloquear la estabilizacion actual con realtime.

---

## Estrategia de CI

Pull request:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run test:unit
npm run build
```

Release candidate:

```bash
npm run test:coverage
npm run test:e2e
```

---

## Testing manual complementario

- crear gasto de espacio con pagador actual y no pagador;
- impactar gasto en Finp y validar cuenta/categoria privada;
- editar monto, fecha, pagador y split;
- anular movimiento con impactos linked y pending;
- pagar/cobrar deuda manual y de espacio;
- archivar, restaurar y eliminar notificaciones;
- revisar Dashboard, Transacciones y Cuentas;
- navegar en mobile y desktop, incluyendo menus y sheets.

---

## Que queda fuera por ahora

- integration tests completos;
- E2E completos;
- sincronizacion realtime;
- objetivo alto de coverage;
- performance testing;
- visual regression testing;
- reversas contables automaticas;
- migracion legacy masiva.
