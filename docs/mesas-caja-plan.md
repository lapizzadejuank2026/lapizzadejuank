# Plan de integración: mesas, comandas y caja — La Pizza de Juanca
Fecha: 13 noviembre 2026. Alcance: diseño y prototipo; NO ES UNA ACTIVACIÓN EN PRODUCCIÓN.

## Lo que ya funciona y NO se debe romper
- Menú público index-1.html: productos, tamaños y sabores de pizza, carrito y pedidos.
- Recepción panel-pedidos.html: escucha en tiempo real de colección pedidos, alarma para estado nuevo, confirmación de recepción.
- Domiciliarios: asignaciones individuales y estados de entrega.
- Administración de productos: catálogo en productos (Firestore).

## Primera versión disponible para probar la experiencia
- salon-mesas.html: seis mesas y barra de inicio, renombrar, añadir, ocultar/reactivar, selección de mesa, catálogo de referencia y productos de Firestore si el usuario tiene sesión admin, pizzas por tamaño y sabores, comandas múltiples, cuenta acumulada, cobro ficticio y liberación. Almacenamiento en localStorage solo en ese dispositivo. No se envía a recepción ni a caja real.
- caja.html: apertura simulada con efectivo base, movimientos de prueba en efectivo o transferencia, arqueo y cierre con diferencias, todo en localStorage. No suma ventas reales.
- panel-pedidos.html: enlaces a ambos diseños. La presentación de pedidos ahora identifica visualmente «Mesa», «Domicilio» y «Para llevar» cuando existan pedidos del salón.

## Próxima etapa técnica: operaciones reales en Firestore (por validar)

Colecciones propuestas:
1. mesas/{mesaId}: nombre, orden, activa, tipo ('mesa' o 'barra'). Solo administrador edita; no eliminar una mesa ocupada.
2. cuentasMesa/{cuentaId}: mesaId, mesaNombre, estado ('abierta','cobrada','anulada'), abiertaEn, cerradaEn, total, pagado, metodoPago; una cuenta activa por mesa.
3. pedidos/{pedidoId}: mismo esquema que ya usa recepción, pero con modalidad:'mesa', mesaId, mesaNombre, cuentaMesaId, numeroComanda, estado:'nuevo', creadoEn, productos y total. **Cada nueva comanda** es un pedido independiente para cocina, de modo que suene la alarma sin reabrir pedidos antiguos.
4. cajas/{cajaId}: responsable, aperturaEn, baseEfectivo, estado, cierreEn, efectivoContado.
5. movimientosCaja/{id}: cajaId, origen (mesa/domicilio/llevar/gasto/ajuste), origenId, referenciaPago, monto, medio (efectivo/transferencia), tipo (ingreso/egreso), creadoEn. Pagos mixtos se representan con dos asientos distintos, enlazados a la MISMA cuenta.

Reglas del negocio:
- Abrir mesa no genera ingreso. Agregar comanda no registra cobro. Al cobrar, la cuenta se cierra y la mesa queda libre.
- Una mesa puede acumular bebidas y comida de varias comandas, pero cada comanda se envía a cocina UNA sola vez.
- Repetir un clic o perder conexión no debe duplicar comanda ni cobro: usar IDs idempotentes y transacciones/batches.
- La venta y el movimiento de caja son conceptos distintos. **No registrar doble**: pedido recibido, comanda enviada o entrega aceptada no deben generar movimiento de caja.
- Para transferencias, un empleado reporta un pago, pero solo administrador puede verificar abono. La caja debe distinguir pendiente de conciliado.
- Asegurar la sesión de caja abierta y decidir qué sucede con pagos de turnos cerrados.
- Nunca permitir que cuentas anónimas del menú público escriban en mesas, cuentasMesa, cajas o movimientosCaja. Crear reglas del administrador y pruebas en el simulador antes de activar.

Pruebas antes de publicar:
1. Abrir mesa, enviar una gaseosa, volver y enviar una pizza con sabores; dos comandas aparecen en recepción por separado y UNA cuenta mantiene el total.
2. Verificar que la alarma suene por cada nueva comanda y se detenga al confirmar. Los domicilios siguen funcionando normalmente.
3. Iniciar sesión desde dos dispositivos, no perder ocupación ni duplicar cuentas por una carrera simultánea.
4. Agregar, renombrar, ocultar y reactivar mesas, sin alterar una cuenta abierta.
5. Cobrar mesa en efectivo, transferencia y mixto; cerrar y liberar mesa, asociando correctamente los movimientos a caja abierta.
6. Apertura con base, gastos y cierre; comprobar saldo esperado, diferencia y no duplicación.
7. Simular rechazo de reglas, problemas de conexión y recarga sin pérdida o doble registro.
8. Verificar con el simulador que domiciliarios no puedan leer ni editar caja, cuentas de mesas o configuración de salón.

Importante: **No publicar a producción** la conexión real de salón/caja sin revisar reglas Firestore vigentes y probar el circuito completo. La versión de hoy es una maqueta funcional en este navegador, sin operaciones reales.
