# Seguimiento privado de pedidos desde el menú

## Estado del desarrollo — 20 de noviembre de 2026

El menú `index-1.html` ahora presenta **📦 Consultar mi pedido** y guarda en el navegador el identificador del último pedido enviado. Cuando el cliente envía un pedido, el documento en Firestore `pedidos/{pedidoId}` incluye el campo `clienteUid` con el UID de la sesión anónima de Firebase Auth. La sección **Mi pedido** consulta únicamente ese documento con `onSnapshot(doc(...))`. No lista pedidos de otros clientes ni necesita que creen una cuenta con correo.

El cliente ve el número abreviado, los productos, el subtotal y las transiciones reales del sistema: pedido enviado, recepción confirmada, asignado, aceptado, recogido, en camino y entregado. Para `recoger`, actualmente solo se confirma recepción, salvo que exista el estado `listo_para_recoger` establecido mediante un flujo que lo soporte.

## Paso necesario en Firebase Console: regla privada de lectura

**Las reglas de Firestore NO están versionadas en este repositorio. NO se han cambiado ni publicado automáticamente.** Es indispensable revisar la versión vigente de `Firestore Database → Reglas` con el propietario de Firebase. **NO reemplazar todo el archivo de reglas** por el siguiente ejemplo.

Dentro del bloque **ya existente** `match /pedidos/{pedidoId}`, conservar TODAS las reglas actuales de recepción, administrador, domiciliarios, caja y creación; añadir la condición mínima para que el dueño anónimo lea por documento exacto su propio pedido:

```javascript
allow get: if request.auth != null
  && resource.data.clienteUid == request.auth.uid;
```

No conceder `allow list` ni `allow read` público para clientes. Se debe conservar el acceso administrativo y del domiciliario autorizado. La regla puede dar permiso por OR con otras reglas coincidentes; revisar otros bloques `match` para evitar lecturas accidentales de otros clientes.

### Pruebas obligatorias antes de producción

1. Verificar en Firebase que las reglas existentes de creación permiten el nuevo campo `clienteUid`; si se usa validación con `keys().hasOnly(...)`, **añadir `clienteUid` sin cambiar las demás validaciones**. Exigir que `request.resource.data.clienteUid == request.auth.uid` cuando se cree desde una sesión anónima.
2. En el menú, generar un pedido nuevo de prueba desde un navegador. Confirmar que aparece en Recepción y su alarma se activa normalmente.
3. En el mismo navegador, abrir **📦 Mi pedido**. Debe mostrar pedido enviado; al pulsar **Confirmar recepción** en administración debe actualizarse a recepción confirmada. Si hay repartidor, probar las transiciones.
4. Desde otro navegador con otra sesión anónima, intentar leer el documento anterior por ID: **debe denegar el acceso**, incluso si conoce el ID.
5. Cerrar y volver a abrir el menú original: el mismo navegador debe recuperar el seguimiento del último pedido. Borrar datos del navegador o cambiar de celular no garantiza recuperar el UID anónimo.

Si el seguimiento indica `permission-denied`, **no abrir `pedidos` a todos**: revisar esta regla y usar el simulador de reglas de Firestore.

## Limitaciones

No es rastreo GPS ni predicción de tiempo de llegada. No muestra pedidos antiguos anteriores al campo `clienteUid`. En esta primera versión sigue solo el último pedido del navegador. El acceso depende de conservar la sesión anónima en ese navegador. No se ha realizado una prueba en vivo de lectura privada de Firestore desde esta conexión; falta la revisión y publicación de reglas y el ensayo de extremo a extremo.
