# Deudas en Finp

Ultima actualizacion: 2026-05-16

## 1. Que son las deudas

El modulo Deudas representa obligaciones pendientes entre personas. Finp las trata como una capa propia porque no encajan bien ni como transaccion comun ni como cuenta.

Dos lecturas principales:

- `payable`: debo;
- `receivable`: me deben.

Dos origenes principales:

- manual;
- derivada de espacios.

## 2. Para que existe un modulo propio

Una deuda necesita:

- monto pendiente;
- contraparte;
- historial de pagos o cobros;
- estado;
- relacion con cuentas;
- relacion opcional con espacios;
- integracion con reportes sin contaminar gasto/ingreso.

Eso justifica que Finp no la haya dejado como una simple etiqueta de transaccion.

## 3. Tipos de deuda

### Deudas manuales

Se crean directamente desde el usuario.

Sirven para:

- prestamos informales;
- plata adelantada;
- cobros a favor;
- saldos que no vienen de Espacios.

### Deudas derivadas de espacios

Se sincronizan desde balances compartidos.

Principios:

- respetan el `debtMode` del espacio;
- pueden ignorarse o restaurarse sin borrar el origen compartido;
- no duplican el movimiento del espacio: representan la obligacion resultante.

## 4. Pagos y cobros

Las acciones principales del modulo son:

- pagar deuda;
- registrar cobro;
- ignorar;
- restaurar;
- revisar historial.

### Regla critica

Pagos y cobros de deuda:

- si impactan cuentas reales;
- no son gasto ni ingreso operacional.

Esto evita errores de lectura financiera.

Ejemplo:

- si le pagas a alguien una deuda, tu saldo de cuenta baja;
- pero eso no debe inflar tus gastos del mes;
- si alguien te devuelve plata, tu saldo sube;
- pero eso no debe contar como ingreso nuevo.

## 5. Consolidacion y estado

El modulo consolida relaciones activas y su estado.

Estados funcionales actuales:

- activa;
- parcialmente pagada;
- pagada;
- ignorada;
- cancelada.

La vista esta orientada a responder:

- cuanto debo;
- cuanto me deben;
- con quien;
- de donde sale ese saldo;
- como evoluciono.

## 6. Relacion con cuentas

La deuda no es una cuenta.

Pero sus movimientos si pueden tocar cuentas:

- pago de deuda -> salida real de cuenta;
- cobro de deuda -> entrada real de cuenta.

Principio:

- cuentas reflejan efectivo;
- deudas reflejan obligacion pendiente.

## 7. Relacion con reporting

Finp usa `operationalAmount` y tipos no operacionales para no mezclar pagos/cobros de deuda con consumo o ingresos reales de actividad.

Consecuencia:

- dashboard y reportes no deben leer un pago de deuda como nuevo gasto;
- sankey, cashflow operativo y resumen personal deben respetar esa separacion;
- la cuenta, en cambio, si debe mostrar el movimiento real.

## 8. Relacion con espacios

Cuando la deuda nace en un espacio:

- el espacio sigue siendo el origen funcional;
- la deuda aparece en `/debts` como reflejo operativo personal;
- pagos y cobros desde Deudas y desde Espacios tienen que mantenerse coherentes;
- ignorar una deuda derivada no borra el movimiento del espacio ni altera su historial.

## 9. Relacion futura con tarjeta de credito

La integracion profunda con TC sigue diferida.

Decision actual:

- no forzar una unificacion prematura;
- no reescribir la logica de tarjeta para encajarla artificialmente en Deudas;
- resolverla cuando haya suficiente uso real y despues de cuotas en espacios.

## 10. Decisiones consolidadas

- una deuda no es una cuenta;
- pagar deuda no es gasto;
- cobrar deuda no es ingreso operacional;
- las deudas de espacios pueden ignorarse y restaurarse;
- el modulo debe mostrar posicion neta y relacion por persona;
- la fuente del saldo importa: manual no significa lo mismo que `space`.
