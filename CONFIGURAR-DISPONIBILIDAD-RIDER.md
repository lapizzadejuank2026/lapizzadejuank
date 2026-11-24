# Activar Online / Offline de Pulso Food Rider

En Firebase Console → Firestore Database → Reglas, añadir dentro de `match /databases/{database}/documents`, conservando todas las reglas anteriores. Usar la función de administrador ya existente (`esAdmin()` si así se llama en el proyecto); si no existe, sustituir esa llamada por la comprobación de UID de administrador existente. No abrir permisos generales.

```js
match /disponibilidadRiders/{uid} {
  function riderActivo() {
    return request.auth != null
      && request.auth.uid == uid
      && exists(/databases/$(database)/documents/accesosDomiciliarios/$(uid))
      && get(/databases/$(database)/documents/accesosDomiciliarios/$(uid)).data.rol == 'domiciliario'
      && get(/databases/$(database)/documents/accesosDomiciliarios/$(uid)).data.activo == true;
  }
  allow get: if esAdmin() || riderActivo();
  allow list: if false;
  allow create, update: if riderActivo()
    && request.resource.data.keys().hasAll(['online','actualizadoEn'])
    && request.resource.data.keys().hasOnly(['online','actualizadoEn'])
    && request.resource.data.online is bool
    && request.resource.data.actualizadoEn == request.time;
  allow delete: if false;
}
```

El Rider empieza Offline si no tiene documento. Puede ponerse Online voluntariamente. Al cerrar sesión se intenta pasar a Offline antes. Cerrar la pestaña o perder señal no implica Offline automático; no es un detector de presencia. Los pedidos activos siguen visibles en ambos estados. Recepción muestra Online/Offline y verifica el estado y el pedido en una transacción antes de asignar. Hasta publicar reglas, se permite continuar manualmente únicamente con confirmación expresa de disponibilidad sin verificar. No es una restricción de seguridad de las reglas de pedidos frente a clientes antiguos; si se requiere esa garantía, ajustar también las reglas de pedidos tras revisar las reglas completas actuales. 

Prueba: entrar como Rider, pasar a Online, comprobar que aparece en el selector de Recepción; pasar a Offline y comprobar que queda deshabilitado y que conserva pedidos anteriores. Cambiar a Online para una nueva asignación. Confirmar que la cuenta no puede alterar el estado de otro Rider. No borrar pedidos ni cambiar los permisos de acceso existentes.
