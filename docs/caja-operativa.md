# Activación segura del módulo de Caja — La Pizza de Juanca
Fecha de diseño: 13 de noviembre de 2026.

## Estado
- Pantalla nueva: caja-operativa.html; lógica: caja-operativa.js. Se accede desde panel-pedidos.html.
- La caja anterior (caja.html) conserva los datos de prueba locales y no se cambió.
- **Las reglas de Firestore NO se publican desde GitHub. Sin ellas la caja nueva no puede operar.**
- La nueva caja permite escribir documentos reales en el proyecto si el administrador autoriza esas reglas; hasta validar las pruebas, usar exclusivamente importes y referencias ficticios.

## Operaciones implementadas
1. Abrir un turno con base de efectivo y nombre del responsable; el documento único cajaControl/actual evita dos aperturas simultáneas.
2. Registrar ingresos de mesa, domicilio, para llevar, otros ingresos, gastos, pagos a personal y retiros. Efectivo, transferencia y mixto; exige que los importes sumen exactamente el total.
3. Para ventas, pedir una referencia única (ID del pedido o cuenta); la referencia global referenciasCaja/venta__ID permite solo un registro por venta, aunque se cambie de categoría o turno.
4. Transacciones Firestore actualizan cajaTurnos, movimientosCaja y referenciasCaja de forma atómica; también cierran los turnos sin permitir movimientos posteriores.
5. Resumen de entradas de efectivo, transferencias, gastos, saldo físico esperado, cierre con diferencia y nota; historial de los últimos 15 turnos.
6. Descarga manual de CSV de los movimientos del turno abierto.
7. Un ingreso por transferencia se registra solo si el administrador marca que ha verificado el abono en la cuenta.
8. El saldo inicial es **base**, no venta; recibir/confirmar un pedido no crea movimiento de caja automáticamente.

## Estructura Firestore
- cajaControl/actual: estado, turnoId, actualizadoEn, abiertoPor/cierrePor.
- cajaTurnos/{turnoId}: responsable, baseEfectivo, aperturaEn, aperturaUid, notaApertura, estado ('abierta'/'cerrada'), efectivoIngresos, efectivoEgresos, transferenciaIngresos, transferenciaEgresos, movimientosCount; al cierre efectivoContado, efectivoEsperado, diferencia, cierreEn, cierrePor, notaCierre.
- movimientosCaja/{id}: turnoId, categoria, tipo ('ingreso'/'egreso'), metodo, total, efectivo, transferencia, concepto, referencia, transferenciaVerificada, creadoEn, responsable, creadoPor.
- referenciasCaja/{id}: para ventas únicamente; evita que dos movimientos con el mismo ID de venta se registren dos veces.

## Reglas de Firebase
NO pegar el siguiente fragmento como documento completo de reglas. En la consola actual, verificar primero la ubicación de esAdmin() y el match existente de pedidos.

Si **esAdmin() ya está disponible dentro de match /databases/{database}/documents**, añadir estos cuatro bloques nuevos, sin borrar reglas existentes:

~~~firestore
match /cajaControl/{documentoId} {
  allow read, write: if esAdmin();
}

match /cajaTurnos/{turnoId} {
  allow read, write: if esAdmin();
}

match /movimientosCaja/{movimientoId} {
  allow read, write: if esAdmin();
}

match /referenciasCaja/{referenciaId} {
  allow read, write: if esAdmin();
}
~~~

Estas reglas son simples porque **solo autorizan al UID administrativo**. No conceder permisos a autenticación anónima ni a domiciliarios. El código cliente usa transacciones para evitar duplicados y carreras simultáneas, pero el frontend no es una barrera de seguridad contra un administrador malicioso; la seguridad real debe probarse en el simulador de Firestore.

Verificar que no existan otros bloques o comodines que dejen estas colecciones abiertas a cualquier usuario: Firestore evalúa los allow con OR.

## Pruebas antes de producción
1. Sin autorización y con usuario domiciliario, lectura/escritura de las cuatro colecciones debe ser denegada.
2. Con administrador, iniciar apertura ficticia de $100.000: el efectivo esperado debe ser $100.000.
3. Registrar venta ficticia de mesa ABC123 por $50.000 efectivo: esperado $150.000.
4. Volver a registrar ABC123, incluso cambiando categoría o recargando: debe rechazar la duplicación.
5. Registrar venta ficticia a domicilio por $30.000 como mixto ($10.000 efectivo y $20.000 transferencia), comprobando el abono: esperado $160.000 y transferencias $20.000.
6. Registrar gasto ficticio de ingredientes por $15.000 efectivo: esperado $145.000.
7. Registrar pago ficticio de personal por $25.000 efectivo: esperado $120.000.
8. Cerrar con contado ficticio de $118.000: debe mostrar diferencia -$2.000 y registrar el cierre.
9. Verificar que no se agreguen movimientos tras cierre, ni se pueda abrir un segundo turno mientras haya uno abierto.
10. Verificar dos dispositivos con la misma cuenta de administración, en especial abrir/cerrar/mover simultáneamente.
11. Los pedidos reales no se deben contar automáticamente ni deben alterarse durante esta prueba.

**Si se hicieron pruebas con importes ficticios dentro de Firebase, son registros persistentes.** Deben diferenciarse del dinero real o borrarse mediante procedimiento administrativo seguro antes de comenzar operaciones reales; no mezclarlos con reportes de ventas.

## Pendiente para caja completamente integrada
- Conectar cobros de pedidos y cuentas de mesas mediante referencias de pago verificadas, con transacción idempotente, después de activar los permisos de cobros domiciliarios y cuentas de mesas. Hoy el módulo es **registro manual de ingresos y egresos**, nunca lectura automática de ventas.
- Validar flujos de transferencias reportadas por domiciliarios: solo conciliación administrativa confirma dinero; no sumar el reporte preliminar dos veces.
- Definir políticas para ingresos de turnos anteriores, transferencias reversadas, ajustes autorizados y recibos/facturación fiscal.
- Esta caja no genera factura electrónica válida ante DIAN ni calcula automáticamente utilidad contable, impuestos o costo de ventas.

## Próximo paso con el usuario
Pedirle una captura actual de Firebase Console → Firestore Database → Reglas. Revisar si esAdmin() es global y dónde insertar los cuatro bloques; guiarlo para publicar y probar permisos uno por uno.
