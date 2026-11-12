# Estado del proyecto — La Pizza de Juanca
**Corte:** jueves, 12 de noviembre de 2026.  
**Repositorio:** `lapizzadejuank2026/lapizzadejuank` — rama principal `main`.  
**Sitio:** https://lapizzadejuank2026.github.io/lapizzadejuank/  
**Firebase:** proyecto `pizzadejuank`.

## Lo que está desarrollado
- `index.html`: bienvenida del negocio.
- `index-1.html`: menú y carrito; envía pedidos a Firestore.
- `panel-pedidos.html`: **Centro de control** con pestañas **Pedidos**, **Productos** y **Equipo y roles**.
- `admin-productos.html`: gestión del catálogo en el administrador.
- `domiciliarios.html`: interfaz preliminar para repartidores: inicio de sesión, Mi jornada, Mis pedidos, Historial, Mi cuenta, y espacio para ofertas enviadas a todos. Los controles para tomar y avanzar entregas permanecen deshabilitados.

## Avances de hoy
1. **Firestore**: el dueño publicó las reglas de la colección `personal` con acceso exclusivo para el UID administrador, copiando el patrón de la regla `productos`, sin alterar `pedidos`. En su prueba posterior, un integrante fue guardado correctamente.
2. **Equipo y roles**: registro de nombre, teléfono, correo y rol (domiciliario, mesero, cocina, caja, otro). Correo obligatorio para domiciliarios, opcional en los demás roles. Lista editable; activar/desactivar sin eliminar. El registro en `personal` no equivale a crear usuario en Firebase Authentication.
3. **Asignación manual**: el administrador puede elegir entre domiciliarios activos y guardar una asignación en un pedido a domicilio. Se probó con un integrante de prueba llamado Juan Carlos y el panel mostró «Asignado a Juan Carlos». Al actualizar, la asignación seguía visible.
4. **Recepción de pedidos**: el dueño realizó pedido de prueba desde el menú (pizza de tres sabores); el mensaje indicó envío exitoso, y en el Centro de control sonó la alarma. Se confirmó la recepción.
5. **Asignación a todos**: se agregó el botón visible «📣 Enviar a todos (próximamente)» en la ficha de pedidos y una sección de ofertas en la vista del domiciliario. **No está habilitada**: faltan permisos por repartidor, vínculo con usuarios de Authentication y aceptación atómica para que un solo domiciliario tome cada pedido.
6. **Navegación de Equipo y roles**: botones «➕ Registrar personal y roles» y «🛵 Abrir aplicación de domiciliarios», sin texto confuso de demostración.

## Estado de seguridad
- Firestore actualmente permite administrar `personal` solo como administrador; **no otorgar lectura global de pedidos a domiciliarios**.
- Desactivar un integrante lo excluye de nuevas asignaciones manuales, pero **todavía no bloquea el acceso de una cuenta de domiciliario**.
- El portal de domiciliarios tiene interfaz de autenticación, pero aún **no enlaza de modo autorizado** una sesión con el registro `personal` ni consulta pedidos reales. No anunciar el flujo como terminado.
- Para las futuras cuentas reales, usar correo propio de cada repartidor, **no las credenciales del administrador**. El administrador usó su propio correo para un registro de prueba, no para conceder acceso independiente.

## Próximos pasos recomendados
1. Diseñar alta segura de cuentas de repartidores en Firebase Authentication, vinculando el UID a su documento de `personal` sin exponer contraseñas del administrador y evitando que el inicio de sesión con la cuenta administradora se interprete como sesión de repartidor.
2. Crear reglas Firestore de mínimo privilegio: domiciliarios autenticados y activos solo ven pedidos asignados a ellos u ofertas elegibles; evitar que puedan modificar importe, dirección de otros pedidos, asignación ajena u otros datos no autorizados.
3. Conectar la vista `domiciliarios.html` a pedidos asignados, aceptación y estados de entrega; probar con cuenta independiente en celular.
4. Implementar opción «Enviar a todos» con transacción Firestore o mecanismo servidor que haga la aceptación **atómica**. Si uno acepta, los demás deben ver la oferta cerrada; considerar cancelación, reasignación y ausencia de respuesta.
5. Probar con pedidos de prueba antes de activar reparto real. Mantener la recepción con alarma y el flujo existente.

## Nota operativa
La aplicación sigue siendo un proyecto web en GitHub Pages; el usuario opera principalmente desde su teléfono Android. Hacer cambios incrementales y comprobar permisos y funcionamiento antes de presentar nuevas funciones como activas.

**Punto de reanudación:** se verificó la persistencia de la asignación manual «Juan Carlos». La última actividad fue revisar la pantalla de domiciliarios; el usuario pidió pausar y conservar este estado. Puede aportar una nueva idea para una mejora futura.
