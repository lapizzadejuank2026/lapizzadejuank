# Activar Enviar a todos — Pulso Food Rider

El frontend de Recepción y Rider ya está en GitHub. Las reglas vigentes de Firestore no están en el repositorio y **no se han publicado**. Antes de activar ofertas reales, el administrador debe revisar las reglas completas actuales. No sustituir todo el archivo de reglas ni quitar los permisos existentes de caja, clientes, productos o repartidores.

## 1. Añadir dentro de match /databases/{database}/documents

Reutilizar las funciones existentes esAdmin() y esDomiciliarioActivo() y comprobar que la última valida el documento propio de accesosDomiciliarios, rol domiciliario y activo == true.

```firestore
function riderOfertaOnline() {
  return esDomiciliarioActivo()
    && get(/databases/$(database)/documents/disponibilidadRiders/$(request.auth.uid)).data.online == true;
}
function pedidoDisponibleOferta(p) {
  return p.get('ofertaActiva', false) == true
    && p.get('domiciliarioUid', '') in ['', null]
    && p.get('domiciliarioId', '') in ['', null]
    && p.get('cobroReportado', null) == null
    && p.get('estado', 'nuevo') in ['nuevo', 'recibido']
    && p.get('estadoEntrega', 'pendiente') in ['pendiente', 'asignado'];
}
function asignacionOfertaValida(p) {
  let acceso = get(/databases/$(database)/documents/accesosDomiciliarios/$(request.auth.uid)).data;
  return p.ofertaActiva == false
    && p.domiciliarioUid == request.auth.uid
    && p.domiciliarioId == acceso.personalId
    && p.domiciliarioNombre == acceso.nombre
    && p.estadoEntrega == 'aceptado'
    && p.domiciliarioAsignadoEn == request.time
    && p.entregaActualizadaEn == request.time;
}
function aceptarOfertaPedido(pedidoId) {
  let antes = get(/databases/$(database)/documents/ofertasDomicilio/$(pedidoId)).data;
  let despues = getAfter(/databases/$(database)/documents/ofertasDomicilio/$(pedidoId)).data;
  return riderOfertaOnline()
    && pedidoDisponibleOferta(resource.data)
    && antes.estado == 'abierta'
    && request.auth.uid in antes.uids
    && despues.estado == 'aceptada'
    && despues.ganadorUid == request.auth.uid
    && despues.cierreEn == request.time
    && asignacionOfertaValida(request.resource.data)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'ofertaActiva','domiciliarioUid','domiciliarioId','domiciliarioNombre',
      'estadoEntrega','domiciliarioAsignadoEn','entregaActualizadaEn'
    ]);
}

match /ofertasDomicilio/{pedidoId} {
  allow get, list: if esAdmin() || (
    esDomiciliarioActivo() && request.auth.uid in resource.data.uids
  );
  allow create: if esAdmin();
  allow update: if esAdmin() || (
    riderOfertaOnline()
    && resource.data.estado == 'abierta'
    && request.auth.uid in resource.data.uids
    && request.resource.data.estado == 'aceptada'
    && request.resource.data.ganadorUid == request.auth.uid
    && request.resource.data.cierreEn == request.time
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['estado','ganadorUid','cierreEn'])
    && pedidoDisponibleOferta(get(/databases/$(database)/documents/pedidos/$(pedidoId)).data)
    && asignacionOfertaValida(getAfter(/databases/$(database)/documents/pedidos/$(pedidoId)).data)
  );
  allow delete: if esAdmin();
}
```

## 2. Dentro del match EXISTENTE /pedidos/{pedidoId}

Añadir únicamente esta autorización adicional, conservando todos los allow existentes (NO añadir permiso general de lectura de pedidos):

```firestore
allow update: if aceptarOfertaPedido(pedidoId);
```

Ambos documentos deben cambiar en la misma transacción. Las reglas verifican que el pedido siga sin asignar y que la oferta esté abierta; que el ganador sea el propio UID autorizado y Online; y que no se cambien precios, productos, pagos ni datos del cliente. El Rider no lee el pedido completo hasta que lo gana. La oferta solo contiene municipio, identificadores de destinatarios y estado; no contiene nombre, teléfono ni dirección del cliente.

## 3. Pruebas imprescindibles antes de producción

- Publicar las reglas solo después de revisarlas con el simulador y comprobar que no hay permisos más amplios por otros bloques match.
- Dos cuentas Rider activas y Online, una tercera Offline. Crear pedido ficticio sin asignar; pulsar Enviar a todos. Solo las dos Online deben verlo.
- Aceptar casi simultáneamente con las dos cuentas. Una sola debe ganar; la otra pierde la oferta. Confirmar que no puede consultar los datos del pedido por ID.
- Probar cancelar oferta y asignar manualmente mientras una oferta está abierta. Deben cerrar la oferta.
- Probar cuenta revocada u Offline: la aceptación debe rechazarse aun con una oferta anterior.
- Completar una entrega de prueba y verificar una sola venta en Caja, sin cobros duplicados.
- Esta versión recibe ofertas mientras Rider está abierto y conectado; no incluye notificación push con la aplicación cerrada. Online es un estado voluntario, no detección de presencia. Los destinatarios se seleccionan al enviar; quien pase Online después no recibe esa oferta anterior.
