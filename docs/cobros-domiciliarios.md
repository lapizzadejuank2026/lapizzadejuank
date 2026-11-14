# Cobros de domiciliarios — reglas y pruebas
La Pizza de Juanca, 13 de noviembre de 2026.

ATENCIÓN: Las pantallas de cobros ya se subieron a GitHub, pero las reglas de permisos de Firestore no se actualizan mediante GitHub. NO usar todavía este cobro con pedidos reales. No reemplazar todas las reglas de Firebase por este documento.

## Modelo de pago
- El administrador fija domicilioValor (precio confirmado del domicilio). El campo total del pedido sigue siendo el subtotal de productos.
- El domiciliario, en estado en_camino, reporta cobroReportado = {metodo, efectivo, transferencia, total}, más cobroReportadoEn (timestamp del servidor).
- El método puede ser efectivo, transferencia o mixto. Efectivo + transferencia = total productos + domicilioValor.
- Registrar NO significa que la transferencia haya llegado. Solo el administrador puede marcar cobroVerificado=true y cobroVerificadoEn, luego de comprobar el banco y recibir el efectivo.
- La interfaz impide completar la entrega sin reporte; las reglas también deben exigirlo.
- No hay integración bancaria ni módulo de caja todavía.

## Reglas adicionales propuestas

En Firebase Console → Firestore Database → Reglas, conserva las funciones y reglas existentes. En la captura anterior existían esAdmin(), esDomiciliarioActivo() y entregaPermitida().

Añade la función siguiente dentro de match /databases/{database}/documents, FUERA del match de pedidos:

~~~firestore
function reporteCobroPermitido() {
  let r = request.resource.data.cobroReportado;
  return request.auth != null
    && resource.data.estadoEntrega == 'en_camino'
    && !('cobroReportado' in resource.data)
    && ('domicilioValor' in resource.data)
    && resource.data.total is int
    && resource.data.domicilioValor is int
    && resource.data.total >= 0
    && resource.data.domicilioValor >= 0
    && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['cobroReportado', 'cobroReportadoEn'])
    && request.resource.data.cobroReportadoEn == request.time
    && r is map
    && r.keys().hasAll(['metodo', 'efectivo', 'transferencia', 'total'])
    && r.keys().hasOnly(['metodo', 'efectivo', 'transferencia', 'total'])
    && r.metodo in ['efectivo', 'transferencia', 'mixto']
    && r.efectivo is int
    && r.transferencia is int
    && r.total is int
    && r.efectivo >= 0
    && r.transferencia >= 0
    && r.efectivo <= 100000000
    && r.transferencia <= 100000000
    && r.total == resource.data.total + resource.data.domicilioValor
    && r.efectivo + r.transferencia == r.total
    && (
      (r.metodo == 'efectivo' && r.transferencia == 0) ||
      (r.metodo == 'transferencia' && r.efectivo == 0) ||
      (r.metodo == 'mixto' && r.efectivo > 0 && r.transferencia > 0)
    );
}
~~~

Dentro del match EXISTENTE /pedidos/{pedidoId}, la condición de actualización debería ser equivalente a:

~~~firestore
allow update: if esAdmin()
  || (
    esDomiciliarioActivo()
    && resource.data.domiciliarioUid == request.auth.uid
    && request.resource.data.domiciliarioUid == request.auth.uid
    && (entregaPermitida() || reporteCobroPermitido())
  );
~~~

También modifica únicamente la última transición de entregaPermitida() para que exija que el reporte ya exista:

~~~firestore
(anterior == 'en_camino' && siguiente == 'entregado'
  && ('cobroReportado' in resource.data))
~~~

IMPORTANTE: Este texto se basa en las reglas visibles en la captura previa, NO en una lectura en vivo de la versión publicada. Revisar el código actual completo antes de pegar: no borrar reglas de pedidos de clientes, personal, productos ni accesosDomiciliarios. No dejar otra regla más permisiva (las allow se suman mediante OR). Usar simulador de reglas antes de pedidos reales.

## Pruebas
1. Crear orden ficticia de 48.000 COP, confirmar domicilio de 5.000 en administración, cobrar 53.000.
2. Antes de ir en camino, el domiciliario no debe poder registrar un pago.
3. En camino: probar efectivo de 53.000. Debe guardarse como reportado, no como verificado.
4. Transferencia: el repartidor informa 53.000; solo el administrador puede comprobar y marcar conciliado.
5. Mixto: 20.000 efectivo + 33.000 transferencia debe permitir guardar; una suma incorrecta debe rechazarse.
6. Marcar entregado solo después de reportar, luego confirmar conciliación en el panel.
7. Simular intentos de escribir sobre pedidos ajenos, cobroVerificado, total, domicilioValor o sobreescribir cobroReportado: deben ser denegados.
8. No contabilizar los pedidos ficticios como ingresos en caja. Pedidos antiguos sin reporte requieren conciliación manual.

Pendiente para fase posterior: integración a caja con conciliación de recaudación y pagos a repartidores por separado, evitar doble contabilización, vuelto y recibos de transferencia.
