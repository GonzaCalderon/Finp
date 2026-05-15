# Helpers de testing

- Usar `tests/helpers/factories.ts` para armar objetos de dominio mínimos y válidos. Las factories aceptan overrides profundos cuando el test necesita cambiar solo una parte.
- Usar `tests/helpers/ids.ts` para evitar `new Types.ObjectId()` repetidos. `fixedObjectId(name)` sirve para fixtures estables.
- Para auth en route handlers, mockear `@/lib/auth` con `authMockModule` o exponer `authMock` dentro de un `vi.mock`, y preparar el estado con `mockAuthenticatedUser`, `mockUnauthenticated` y `resetAuthMock`.
- Para queries Mongoose con `.lean()`, usar `makeLeanResult`, `makeFindResult`, `makeFindOneAndUpdateResult` o `mockQueryLean`.
- Nombrar tests por comportamiento de negocio: estado, privacidad, idempotencia, monto operativo o sincronizacion.
