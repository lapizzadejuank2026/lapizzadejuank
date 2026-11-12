# Asignación de domiciliarios — revisión de seguridad

**Solo rama de pruebas. No publicar ni fusionar hasta verificar las reglas en Firebase.**
El menú y el panel actualmente publicados deben seguir funcionando.

## Funciones preparadas

- El administrador confirma la recepción de un pedido a domicilio y luego ve el botón **Asignar domiciliario**.
- El panel carga repartidores activos desde la colección **equipo** filtrando rol domiciliario y restauranteId = la-pizza-de-juanca.
- Una transacción asigna el documento de **pedidos** solamente si sigue recibido y no está asignado. Guarda domiciliarioUid, domiciliarioNombre, asignadoEn y estadoDomicilio.
- El domiciliario entra con correo y contraseña a la página nueva **domiciliario.html**. Se consulta su perfil activo en equipo y únicamente pedidos con domiciliarioUid igual a su UID autenticado.
- Los datos de cliente, teléfono, dirección, municipio, productos y total se leen del MISMO documento, sin copiar datos personales a otra colección.
- El conductor marca asignado → aceptado → en_camino → entregado. El registro de entrega contiene pagoEntrega con efectivo, transferencia y verificacionTransferencia pendiente.
- El campo estado original de los pedidos NO se cambia cuando el repartidor avanza, para proteger la alarma y el flujo existente.

## Antes de publicar: tareas indispensables

1. **Nuevo flujo propuesto:** desde `equipo-roles.html`, el administrador crea la cuenta del domiciliario en Firebase Authentication mediante una instancia secundaria aislada (para no perder su sesión). Se genera una contraseña temporal aleatoria que NO se guarda ni se muestra; se escribe el perfil `equipo/{uid}` y se solicita un correo de recuperación para que el domiciliario elija su propia contraseña. Esto **no se habilita en producción** hasta confirmar la entrega del correo y las reglas de acceso. Si falla la escritura en Firestore, se intenta eliminar la cuenta recién creada para evitar perfiles huérfanos. Si falla ese intento, se requiere una limpieza manual con el UID indicado.
2. Crear documento **equipo/UID_DEL_DOMICILIARIO**, con nombre, rol = domiciliario, activo = true y restauranteId = la-pizza-de-juanca. El ID del documento debe ser su UID real de Authentication.
3. Revisar las reglas VIGENTES de Firestore antes de cambiarlas. Conservar intactos los permisos actuales del administrador y el permiso limitado de crear pedidos para clientes anónimos.
4. Solo el administrador puede listar, crear, actualizar o desactivar perfiles en equipo. El repartidor solo puede obtener su propio perfil y no cambiar el rol ni el estado activo.
5. Solo el administrador puede asignar pedidos. El repartidor puede leer únicamente documentos cuyo domiciliarioUid coincide con su UID, y únicamente si su perfil está activo y pertenece a este restaurante. Nunca permitir lectura pública de pedidos.
6. Las actualizaciones del repartidor deben limitarse exclusivamente a estadoDomicilio y pagoEntrega. Las reglas deben prohibir modificar dirección, nombre, cliente, productos, precios, total o domiciliarioUid; exigir transiciones válidas y que efectivo + transferencia sea exactamente igual al total, con ambos importes no negativos.
7. Pruebas en el emulador de reglas de Firebase: admin y DOS repartidores; A ve solo A, B solo B; ni uno puede leer pedidos ajenos ni editar la información del cliente; la alarma del admin sigue sonando y apagándose correctamente.
8. El pago al domiciliario, la entrega del efectivo y la verificación bancaria quedarán para un segundo módulo de caja con comprobaciones del administrador.

## Cambios de código

- panel-pedidos.html: incorpora pestaña **Equipo y roles** y selector de repartidor, con botón para guardar la asignación; no modifica la lógica de confirmación ni la alarma.
- equipo-roles.html: formulario para crear cuenta, invitación por correo y altas/bajas de perfiles, sujeto al bloqueo de permisos de Firestore. La cuenta Auth de un empleado desactivado permanece existente, pero las reglas deben impedirle consultar o modificar pedidos.
- domiciliario.html: página con inicio de sesión, consulta filtrada por UID, información de entrega, cambios de estado y pago mixto.
- La demo pública **demo-domiciliario.html** sigue separada y solo contiene datos ficticios.

## Regla importante de Firestore

Las reglas de Firestore son aditivas: agregar otro allow demasiado amplio en otro match podría exponer todos los pedidos. Antes de dar acceso al repartidor se necesita revisar el conjunto COMPLETO de reglas y probar que la consulta filtrada por domiciliarioUid no sea rechazada ni permita leer pedidos de otro repartidor.

**No aplicar un bloque de reglas copiado de forma aislada ni cambiar la autorización de producción sin revisión.** Esta fase es para La Pizza de Juanca. El aislamiento entre restaurantes se diseña y prueba aparte.

## Secuencia de prueba real

Cliente envía → admin confirma → admin asigna por UID → repartidor entra con su usuario → ve solamente el pedido asignado → acepta → sale a entregar → registra 35.000 efectivo y 25.000 transferencia para un pedido de 60.000 COP → el administrador verifica el pago bancario y recibe el efectivo por un procedimiento separado.


## Reglas de acceso y activación

La operación necesita una regla `match /equipo/{uid}` que permita al administrador **listar, crear y actualizar** perfiles; al domiciliario solo **obtener su propio perfil**, pero nunca modificarlo. El acceso a `pedidos` debe exigir UID coincidente, rol `domiciliario`, perfil activo y restaurante autorizado. No añadir un `allow read` público. La seguridad real NO depende de que el selector esté oculto en la pantalla: depende de las reglas en Firestore. Para revocaciones inmediatas de acceso también debe verificarse el perfil activo en cada lectura y modificación. Probar primero con el emulador de Firestore y cuentas de prueba.
