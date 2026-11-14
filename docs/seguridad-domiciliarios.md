# Conexión privada de domicilios — Firebase Firestore

**Importante:** este documento NO es un archivo de reglas completo ni está publicado en Firebase. Las reglas que ya existen en la consola deben conservarse (administrador, clientes, productos y creación de pedidos). No pegues estas instrucciones como sustitución de todas las reglas.

## Lo que ya hace el código web

- `panel-pedidos.html` guarda `domiciliarioId` (ID de personal), `domiciliarioUid` (UID de Firebase Authentication), `domiciliarioNombre`, `domiciliarioAsignadoEn` y `estadoEntrega: "pendiente"`.
- `domiciliarios.html` primero verifica el documento propio `accesosDomiciliarios/{uid}` y luego consulta `pedidos` filtrados por `domiciliarioUid == auth.uid`.
- Los domiciliarios pueden pasar, en orden, por `pendiente → aceptado → recogido → en_camino → entregado`. El estado general `estado` del pedido y la alarma de recepción del restaurante no se modifican por este flujo.
- La oferta de pedido a *todos* continúa desactivada. Tampoco hay notificaciones push cuando el navegador está cerrado.

## Reglas revisadas en captura del 13 de noviembre de 2026

En la captura enviada por el administrador se ve que las reglas ya tienen:
- `function esAdmin()` para la cuenta administradora.
- `function esDomiciliarioActivo()` que comprueba el acceso del UID individual, rol domiciliario y estado activo.
- `function entregaPermitida()` que limita las transiciones de `estadoEntrega`: `pendiente → aceptado → recogido → en_camino → entregado`; solo permite cambios en `estadoEntrega` y `entregaActualizadaEn`.
- En `match /pedidos/{pedidoId}`: lectura del administrador, o del repartidor activo **solo si** `resource.data.domiciliarioUid == request.auth.uid`; edición del administrador, o actualización limitada por `entregaPermitida()`.
- En `match /accesosDomiciliarios/{uid}`: lectura propia y escritura administrativa.
- En `match /personal/{personalId}`: acceso administrativo.

**No hay que pegar reglas nuevas ni sustituir las actuales basándose en esta captura.** No podemos confirmar si la captura corresponde a reglas ya publicadas ni si el simulador valida todos los casos. Antes de usar pedidos reales, prueba acceso permitido a un pedido propio y denegado a un pedido de otro repartidor.

Los archivos web se alinearon con las reglas que muestra esa captura: una nueva asignación guarda `estadoEntrega: 'pendiente'`; el domiciliario escribe `entregaActualizadaEn: serverTimestamp()` (no el campo `estadoEntregaActualizadoEn`).

Revisa en Firebase Console que las reglas estén **publicadas** y que no existan otras reglas que amplíen permisos accidentalmente. En Firestore los permisos en diferentes bloques coincidentes se suman (OR): una regla permisiva adicional puede permitir lo que otra pretende restringir.

## Prueba con dos domiciliarios

1. En Centro de control → **Equipo y roles**, comprueba que cada domiciliario tenga cuenta Firebase vinculada y activa.
2. Crea un **pedido de prueba** con modalidad domicilio desde el menú público.
3. En Centro de control → **Pedidos**, selecciona el primer domiciliario y pulsa **Guardar asignación**. La asignación guarda `domiciliarioUid` y el estado inicial `pendiente`. Si el pedido tenía una asignación anterior sin UID, vuelve a guardarla.
4. Abre `domiciliarios.html` con el correo y contraseña del primer repartidor. Mientras la app esté abierta, debe aparecer en **Mis pedidos**.
5. Prueba **Aceptar**, **Pedido recogido**, **Voy en camino** y **Confirmar entregado**. El pedido debe pasar a **Historial** y el administrador debe ver el estado de entrega.
6. En otra sesión, entra como el segundo domiciliario. **No** debe ver el pedido del primero. Comprueba también en el simulador de reglas que no pueda leer por ID la orden de otro.
7. Reasigna otro pedido de prueba para verificar que solo el nuevo UID asignado lo vea. No uses pedidos reales hasta comprobar las reglas.

Si sale **permission-denied**, revisa las reglas: el frontend ya no intenta leer todos los pedidos. Si la aplicación del repartidor está cerrada, el cambio se verá cuando la abra; no hay push en segundo plano.
