# Reglas de seguridad: domiciliarios — BORRADOR, NO PUBLICAR SIN REVISIÓN

Estas reglas son una guía para combinar con las reglas **actualmente publicadas** en Firebase Console, porque este repositorio no contiene \`firestore.rules\`. **Nunca reemplazar a ciegas** las reglas existentes de \`pedidos\`, \`productos\` o \`personal\`, porque el menú público usa autenticación anónima para enviar pedidos.

## Paso obligatorio antes de publicar

1. Abrir Firebase Console → Firestore Database → Reglas.
2. Copiar las reglas actualmente publicadas para revisarlas y conservarlas.
3. Identificar la función o condición existente que reconoce el UID del propietario/administrador.
4. Integrar los bloques de abajo de modo que **ninguna regla más amplia** conceda acceso a los domiciliarios. En Firestore, las reglas que coinciden se combinan mediante OR.
5. Publicar y probar con dos cuentas de domiciliarios distintas: cada una ve exclusivamente los documentos \`pedidos\` cuyo campo \`domiciliarioUid\` es su UID; una cuenta no puede abrir un pedido de otra ni modificar datos del cliente, precio, productos o domicilio.
6. Comprobar que los clientes pueden seguir creando pedidos anónimos y que el administrador conserva la lectura de todos los pedidos y la edición de productos.

## Fragmentos para integrar (NO son un archivo autónomo)

Dentro de \`match /databases/{database}/documents { ... }\`, agregar la función:

\`\`\`js
function esDomiciliarioActivo() {
  return request.auth != null
    && exists(/databases/$(database)/documents/accesosDomiciliarios/$(request.auth.uid))
    && get(/databases/$(database)/documents/accesosDomiciliarios/$(request.auth.uid)).data.activo == true
    && get(/databases/$(database)/documents/accesosDomiciliarios/$(request.auth.uid)).data.rol == 'domiciliario';
}

function actualizaSoloEntrega() {
  return request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['estadoEntrega', 'entregaActualizadaEn'])
    && request.resource.data.entregaActualizadaEn == request.time
    && (
      (resource.data.get('estadoEntrega', 'pendiente') == 'pendiente'
        && request.resource.data.estadoEntrega == 'aceptado')
      || (resource.data.get('estadoEntrega', 'pendiente') == 'aceptado'
        && request.resource.data.estadoEntrega == 'recogido')
      || (resource.data.get('estadoEntrega', 'pendiente') == 'recogido'
        && request.resource.data.estadoEntrega == 'en_camino')
      || (resource.data.get('estadoEntrega', 'pendiente') == 'en_camino'
        && request.resource.data.estadoEntrega == 'entregado')
    );
}
\`\`\`

En \`match /pedidos/{pedidoId}\`, conservar las reglas existentes de administrador y creación de clientes, **pero limitar explícitamente lectura y escritura de empleados**. La condición de domiciliario para lectura debe ser:

\`\`\`js
esDomiciliarioActivo()
  && resource.data.domiciliarioUid == request.auth.uid
\`\`\`

La condición para actualizar por domiciliario debe ser:

\`\`\`js
esDomiciliarioActivo()
  && resource.data.domiciliarioUid == request.auth.uid
  && request.resource.data.domiciliarioUid == request.auth.uid
  && actualizaSoloEntrega()
\`\`\`

El administrador necesita permiso de \`get/list/create/update/delete\` sobre \`pedidos\`. La aplicación de domiciliarios consulta solamente \`where('domiciliarioUid','==', auth.currentUser.uid)\`; nunca consulta todos los pedidos.

Crear este bloque para cuentas, dentro de \`match /databases/{database}/documents\`:

\`\`\`js
match /accesosDomiciliarios/{uid} {
  allow get: if request.auth != null
    && (request.auth.uid == uid || ES_ADMINISTRADOR);
  allow list: if ES_ADMINISTRADOR;
  allow create, update, delete: if ES_ADMINISTRADOR;
}
\`\`\`

**ES_ADMINISTRADOR** debe reemplazarse por la condición segura por UID ya usada en las reglas actuales (NO por \`request.auth != null\`, un correo escrito por cliente, ni un valor de rol modificable por usuarios). La colección \`personal\` debe permanecer solo para el administrador.

### Riesgos a evitar

- No usar \`allow read: if request.auth != null\` en \`pedidos\`: eso permite a cualquier usuario registrado, incluso un cliente anónimo, leer pedidos ajenos.
- No usar \`allow update: if request.auth != null\`: permitiría alterar importes, datos de entrega y asignaciones.
- Si existe otra regla coincidente más permisiva, una regla restrictiva adicional **no** la anula.
- Las pantallas no sustituyen las reglas; hasta publicarlas y probarlas, la rama sigue siendo una prueba y no debe mezclarse en \`main\`.
