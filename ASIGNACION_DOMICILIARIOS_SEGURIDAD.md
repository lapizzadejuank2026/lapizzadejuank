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

1. Crear primero el usuario del domiciliario en Firebase Authentication con correo/contraseña. Para invitar usuarios desde la propia aplicación hará falta un proceso de registro confiable; nunca guardar contraseñas en Firestore.
2. Crear documento **equipo/UID_DEL_DOMICILIARIO**, con nombre, rol = domiciliario, activo = true y restauranteId = la-pizza-de-juanca. El ID del documento debe ser su UID real de Authentication.
3. Revisar las reglas VIGENTES de Firestore antes de cambiarlas. Conservar intactos los permisos actuales del administrador y el permiso limitado de crear pedidos para clientes anónimos.
4. Solo el administrador puede listar, crear, actualizar o desactivar perfiles en equipo. El repartidor solo puede obtener su propio perfil y no cambiar el rol ni el estado activo.
5. Solo el administrador puede asignar pedidos. El repartidor puede leer únicamente documentos cuyo domiciliarioUid coincide con su UID, y únicamente si su perfil está activo y pertenece a este restaurante. Nunca permitir lectura pública de pedidos.
6. Las actualizaciones del repartidor deben limitarse exclusivamente a estadoDomicilio y pagoEntrega. Las reglas deben prohibir modificar dirección, nombre, cliente, productos, precios, total o domiciliarioUid; exigir transiciones válidas y que efectivo + transferencia sea exactamente igual al total, con ambos importes no negativos.
7. Pruebas en el emulador de reglas de Firebase: admin y DOS repartidores; A ve solo A, B solo B; ni uno puede leer pedidos ajenos ni editar la información del cliente; la alarma del admin sigue sonando y apagándose correctamente.
8. El pago al domiciliario, la entrega del efectivo y la verificación bancaria quedarán para un segundo módulo de caja con comprobaciones del administrador.

## Cambios de código

- panel-pedidos.html: selector de repartidor y botón para guardar la asignación; no modifica la lógica de confirmación ni la alarma.
- domiciliario.html: página con inicio de sesión, consulta filtrada por UID, información de entrega, cambios de estado y pago mixto.
- La demo pública **demo-domiciliario.html** sigue separada y solo contiene datos ficticios.

## Regla importante de Firestore

Las reglas de Firestore son aditivas: agregar otro allow demasiado amplio en otro match podría exponer todos los pedidos. Antes de dar acceso al repartidor se necesita revisar el conjunto COMPLETO de reglas y probar que la consulta filtrada por domiciliarioUid no sea rechazada ni permita leer pedidos de otro repartidor.

**No aplicar un bloque de reglas copiado de forma aislada ni cambiar la autorización de producción sin revisión.** Esta fase es para La Pizza de Juanca. El aislamiento entre restaurantes se diseña y prueba aparte.

## Secuencia de prueba real

Cliente envía → admin confirma → admin asigna por UID → repartidor entra con su usuario → ve solamente el pedido asignado → acepta → sale a entregar → registra 35.000 efectivo y 25.000 transferencia para un pedido de 60.000 COP → el administrador verifica el pago bancario y recibe el efectivo por un procedimiento separado.
