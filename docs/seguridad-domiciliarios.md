# Conexión privada de domicilios — Firebase Firestore

**Importante:** este documento NO es un archivo de reglas completo ni está publicado en Firebase. Las reglas que ya existen en la consola deben conservarse (administrador, clientes, productos y creación de pedidos). No pegues estas instrucciones como sustitución de todas las reglas.

## Lo que ya hace el código web

- `panel-pedidos.html` guarda `domiciliarioId` (ID de personal), `domiciliarioUid` (UID de Firebase Authentication), `domiciliarioNombre`, `domiciliarioAsignadoEn` y `estadoEntrega: "asignado"`.
- `domiciliarios.html` primero verifica el documento propio `accesosDomiciliarios/{uid}` y luego consulta `pedidos` filtrados por `domiciliarioUid == auth.uid`.
- Los domiciliarios pueden pasar, en orden, por `asignado → aceptado → recogido → en_camino → entregado`. El estado general `estado` del pedido y la alarma de recepción del restaurante no se modifican por este flujo.
- La oferta de pedido a *todos* continúa desactivada. Tampoco hay notificaciones push cuando el navegador está cerrado.

## Antes de probar: reglas para **pedidos**

En Firebase Console → Firestore Database → Reglas, **dentro** de `match /databases/{database}/documents`, agrega esta función si todavía no existe una equivalente:

```firestore
function repartidorHabilitado() {
  return request.auth != null
    && exists(/databases/$(database)/documents/accesosDomiciliarios/$(request.auth.uid))
    && get(/databases/$(database)/documents/accesosDomiciliarios/$(request.auth.uid)).data.rol == 'domiciliario'
    && get(/databases/$(database)/documents/accesosDomiciliarios/$(request.auth.uid)).data.activo == true;
}
```

**Dentro del bloque existente** `match /pedidos/{pedidoId}` agrega las dos declaraciones siguientes, **sin borrar** las autorizaciones existentes para el administrador ni la creación de pedidos por clientes:

```firestore
allow get, list: if repartidorHabilitado()
  && resource.data.domiciliarioUid == request.auth.uid;

allow update: if repartidorHabilitado()
  && resource.data.domiciliarioUid == request.auth.uid
  && request.resource.data.domiciliarioUid == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['estadoEntrega', 'estadoEntregaActualizadoEn'])
  && request.resource.data.estadoEntregaActualizadoEn == request.time
  && (
    (resource.data.get('estadoEntrega', 'asignado') == 'asignado'
      && request.resource.data.estadoEntrega == 'aceptado') ||
    (resource.data.estadoEntrega == 'aceptado'
      && request.resource.data.estadoEntrega == 'recogido') ||
    (resource.data.estadoEntrega == 'recogido'
      && request.resource.data.estadoEntrega == 'en_camino') ||
    (resource.data.estadoEntrega == 'en_camino'
      && request.resource.data.estadoEntrega == 'entregado')
  );
```

Comprueba también que exista un bloque `match /accesosDomiciliarios/{uid}` que permita al domiciliario autenticado leer **solo su propio** documento (por ejemplo `allow get: if request.auth != null && request.auth.uid == uid;`) y que la escritura sea exclusiva del administrador. No permitas `list` de toda esa colección a repartidores. La colección `personal` debe ser solo de administración.

**Ojo:** en Firestore las reglas permisivas se suman (OR). Si hay cualquier otra regla que permite a los repartidores consultar **todos** los pedidos o editar cualquier campo, estas reglas restrictivas NO la anulan. Antes de usar pedidos reales, revisa todos los `allow` existentes y usa el simulador de reglas de Firebase para comprobar acceso denegado al pedido de otro repartidor.

No se conoce desde GitHub el contenido actual de las reglas publicadas en Firebase; por eso no es seguro reemplazarlas a ciegas.

## Prueba con dos domiciliarios

1. En Centro de control → **Equipo y roles**, comprueba que cada domiciliario tenga cuenta Firebase vinculada y activa.
2. Crea un **pedido de prueba** con modalidad domicilio desde el menú público.
3. En Centro de control → **Pedidos**, selecciona el primer domiciliario y pulsa **Guardar asignación**. La asignación debe guardar ahora `domiciliarioUid`. Si el pedido tenía una asignación anterior sin UID, vuelve a guardarla.
4. Abre `domiciliarios.html` con el correo y contraseña del primer repartidor. Mientras la app esté abierta, debe aparecer en **Mis pedidos**.
5. Prueba **Aceptar**, **Pedido recogido**, **Voy en camino** y **Confirmar entregado**. El pedido debe pasar a **Historial** y el administrador debe ver el estado de entrega.
6. En otra sesión, entra como el segundo domiciliario. **No** debe ver el pedido del primero. Comprueba también en el simulador de reglas que no pueda leer por ID la orden de otro.
7. Reasigna otro pedido de prueba para verificar que solo el nuevo UID asignado lo vea. No uses pedidos reales hasta comprobar las reglas.

Si sale **permission-denied**, revisa las reglas: el frontend ya no intenta leer todos los pedidos. Si la aplicación del repartidor está cerrada, el cambio se verá cuando la abra; no hay push en segundo plano.
