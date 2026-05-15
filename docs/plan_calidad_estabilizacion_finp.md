# Plan de calidad y estabilización — Finp

**Última actualización:** 2026-05-15

Documento dedicado para ordenar la estabilización posterior a una Fase 6 grande. El plan principal sigue en `plan_de_desarrollo_finp.md`.

---

## Objetivo general

Garantizar que Finp pueda pasar a producción con confianza después de cambios grandes en Espacios, Deudas, sincronización multiusuario, pendientes accionables, notificaciones e impacto personal.

---

## Riesgos principales

- Saldos incorrectos.
- Deudas duplicadas.
- Pendientes interpretados como vinculados.
- Notificaciones stale o mal resueltas.
- Usuarios viendo cuentas/categorías privadas de otros.
- Dashboard usando total pagado en vez de parte propia.
- Transacciones personales modificadas automáticamente por eventos compartidos.

---

## Pirámide y matriz de testing

Pirámide:

- Unit tests: lógica pura, estados, privacidad, montos, dedupe.
- Integration/API tests: route handlers, auth, ownership y persistencia mockeada o DB de test.
- Component tests: acciones críticas de UI sin cubrir flujos completos.
- E2E Playwright: multiusuario, mobile/desktop y navegación real.
- QA manual complementario: revisión visual y flujos de dinero end-to-end.

Matriz de flujos críticos:

| Flujo | Unit | Integration/API | Component | E2E | Manual |
|---|---:|---:|---:|---:|---:|
| Crear gasto de espacio | Sí | Sí | Parcial | Sí | Sí |
| Impactar en Finp | Sí | Sí | Parcial | Sí | Sí |
| Editar movimiento | Sí | Sí | No | Sí | Sí |
| Anular movimiento | Sí | Sí | No | Sí | Sí |
| Pagar/cobrar deuda | Sí | Sí | Parcial | Sí | Sí |
| Archivar/eliminar notificación | Sí | Sí | Sí | Sí | Sí |
| Dashboard/transacciones/cuentas | Sí | Sí | Parcial | Sí | Sí |
| Mobile/desktop navigation | No | No | Parcial | Sí | Sí |

---

## Fases

### 6T.1 — Infra de testing y factories

**Estado:** fase actual.

Incluye helpers de IDs, factories de dominio, mocks de auth, mocks de Mongoose, assertions comunes y documentación breve para escribir tests nuevos sin duplicar setup.

### 6T.2 — Unit tests críticos

**Estado:** fase actual.

Incluye tests de notificaciones, `SpaceEntryPersonalImpact`, eventos de sync personal, edición/anulación de movimientos, Deudas, montos operativos vs reales, `data-sync` y componentes mínimos de notificaciones.

### 6T.3 — Integration/API tests

**Estado:** fase posterior.

Cubrir endpoints con auth, ownership, validaciones, status codes, privacidad y persistencia controlada. Prioridad: notificaciones, pending actions, personal impact, debts y entries de espacios.

### 6T.4 — E2E Playwright multiusuario/mobile

**Estado:** fase posterior.

Cubrir flujos reales de usuario A/B: crear gasto, ver pending, impactar, editar/anular, revisar notificaciones, pagar/cobrar deuda y navegación mobile/desktop.

### 6RC — Release Candidate pre-producción

**Estado:** fase posterior.

Ejecutar suite ampliada, QA manual guiado, revisión de datos semilla, smoke test de build y checklist de regresión antes de producción.

### Fase futura — Sincronización realtime

**Estado:** futura.

Evaluar realtime para notificaciones, pending actions, actividad de espacios y sincronización de vistas multiusuario. No bloquear la estabilización actual con realtime.

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

- Crear gasto de espacio con pagador actual y no pagador.
- Impactar gasto en Finp y validar cuenta/categoría privada.
- Editar monto, fecha, pagador y split.
- Anular movimiento con impactos linked y pending.
- Pagar/cobrar deuda manual y de espacio.
- Archivar, restaurar y eliminar notificaciones.
- Revisar Dashboard, Transacciones y Cuentas.
- Navegar en mobile y desktop, incluyendo menús y sheets.

---

## Qué queda fuera por ahora

- Integration tests completos.
- E2E completos.
- Sincronización realtime.
- Objetivo alto de coverage.
- Performance testing.
- Visual regression testing.
- Reversas contables automáticas.
- Migración legacy masiva.
