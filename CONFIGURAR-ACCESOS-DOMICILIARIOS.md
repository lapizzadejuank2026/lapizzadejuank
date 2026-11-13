# Activar cuentas individuales de domiciliarios (Firebase)

El administrador ya puede guardar trabajadores con correo y, al editar una ficha sin acceso, crear la cuenta en Firebase Authentication mediante una contraseña inicial. El formulario usa una sesión temporal separada, y **no guarda la contraseña en Firestore**. También se crea `accesosDomiciliarios/<UID>` y se vincula `personal/<id>.authUid`.

## Paso obligatorio: reglas de Firestore

En **Firebase Console → Firestore Database → Reglas**, conserva todas las reglas actuales de `pedidos`, `productos` y `personal`. Agrega este bloque **dentro** de `match /databases/{database}/documents` (no sustituyas el archivo entero).

Reemplaza `PEGA_AQUI_EL_UID_DEL_ADMIN` por el **mismo UID administrador** que ya funciona en las reglas de `personal`. No utilices el correo, ni el UID del domiciliario.

```js
match /accesosDomiciliarios/{uid} {
  // El domiciliario activo solo puede consultar SU documento (por UID).
  allow get: if request.auth != null
    && request.auth.uid == uid
    && resource.data.rol == 'domiciliario'
    && resource.data.activo == true;

  // Nunca permitir que un repartidor liste todas las cuentas.
  allow list: if false;

  // Solo el UID administrador gestiona altas, cambios y bajas.
  allow create, update, delete: if request.auth != null
    && request.auth.uid == 'PEGA_AQUI_EL_UID_DEL_ADMIN';
}
```

Revisa que ninguna regla general del proyecto otorgue lectura o escritura amplia; las reglas de Firestore son aditivas y una regla general permisiva puede prevalecer.

## Procedimiento de prueba seguro

1. En el Centro de control abre **Equipo y roles → Personal registrado → Editar** sobre el domiciliario de prueba que ya existe.
2. Comprueba nombre, teléfono, correo y rol «Domiciliario». Escribe una **contraseña inicial** de mínimo 6 caracteres y guarda. No borres la ficha anterior.
3. El estado deberá mostrar «✅ Cuenta creada y vinculada» y la tarjeta «🔐 Cuenta vinculada a Firebase». Si falla, comprueba las reglas, y no repitas a ciegas.
4. En otro navegador o perfil abre `domiciliarios.html` e ingresa con ese correo y contraseña. Debe abrir «Mi jornada» sin mostrar pedidos de otros.
5. Para probar la baja temporal, vuelve al administrador y pulsa **Desactivar**. El domiciliario debe perder acceso. Puedes reactivarlo después.

**Importante:** la pantalla «Mis pedidos» aún no muestra pedidos reales; la consulta individual de pedidos necesita reglas de seguridad adicionales y pruebas. No dar permisos de lectura a toda la colección `pedidos` a los repartidores. Las asignaciones existentes no deben modificarse durante esta prueba.

**Restricción técnica:** desde una web estática de GitHub Pages no es posible crear usuarios de Authentication con privilegios administrativos del servidor. Por ahora el registro web usa Firebase Authentication en el navegador y Firestore restringe quién puede vincular/autorizar la cuenta. Para un registro de usuarios administrado exclusivamente desde servidor, utilizar Firebase Admin SDK en Cloud Functions o un backend protegido.
