# Pulso Food — Etapa 1 multiempresa

Estado: desarrollo aislado. No publicar esta rama ni cambiar las reglas de producción todavía.

## Decisiones iniciales
- Mantener el repositorio y la aplicación actual en main.
- Usar un proyecto Firebase de pruebas independiente, con datos ficticios.
- Una cuenta de Firebase Authentication por persona. Pertenencia y rol por restaurante en documentos de membresía; el rol de plataforma se asigna exclusivamente mediante Firebase Admin SDK desde un entorno privilegiado.
- El restaurante activo se obtiene del contexto autorizado, no se confía en parámetros de URL o almacenamiento local. La URL pública identifica el restaurante mediante un slug validado.
- Separar datos públicos, operativos y comerciales; no exponer datos privados de restaurantes ni de sus clientes.

## Modelo propuesto
- restaurantes/{rid}: metadatos privados del negocio.
- restaurantes/{rid}/miembros/{uid}: rol (administrador, caja, mesero, rider), activo.
- restaurantes/{rid}/productos/{id}: productos privados/operativos.
- restaurantes/{rid}/pedidos/{id}, personal, accesosDomiciliarios, disponibilidadRiders, ofertasDomicilio, mesas, cuentasMesa, cajaControl, cajaTurnos, movimientosCaja, referenciasCaja: colecciones aisladas por restaurante.
- catalogosPublicos/{slug}: datos mínimos de marca, horario y disponibilidad pública, con identificador del restaurante.
- catalogosPublicos/{slug}/productos/{id}: únicamente productos publicados y datos públicos.
- suscripciones/{rid}: plan, precio COP, estado, periodo vigente y vencimiento. Escritura exclusiva desde backend autorizado.
- suscripciones/{rid}/pagos/{id}: registro inmutable de pagos verificados, con referencia única, monto, fecha y método.
- auditoriaPlataforma/{id}: eventos de cambios de roles, altas y renovaciones.

## Alta y cobro
El panel de plataforma envía solicitudes a funciones de servidor, verificando token y rol de superadministrador en cada llamada. Crear restaurante y administrador inicial mediante proceso idempotente, invitación/establecimiento de contraseña sin almacenar claves en Firestore. El plan inicial propuesto es COP 150000/mes; periodo de prueba y gracia configurables, no activos hasta aprobación. Primera versión: confirmar transferencias manualmente y registrar el pago con referencia única. Renovar a partir del vencimiento vigente si es futuro; si venció, a partir de la fecha de reactivación. Definir calendario mensual y zona America/Bogota en backend. Las pasarelas se integrarán más adelante mediante eventos autenticados, comprobación de monto, moneda e idempotencia. No colocar secretos en GitHub Pages. No mezclar mensualidad SaaS con pagos de pedidos.

## Inventario comprobado en main
- index-1.html: productos y pedidos globales; autenticación anónima para clientes.
- admin-productos.html: productos globales.
- panel-pedidos.html: productos, personal, accesosDomiciliarios, disponibilidadRiders, ofertasDomicilio, pedidos globales.
- domiciliarios.html: pedidos, ofertas, accesos y disponibilidad globales.
- caja-operativa.js: cajaControl, cajaTurnos, movimientosCaja, referenciasCaja, productos globales.
- salon-operativo.js: mesas, cuentasMesa, pedidos, productos y colecciones de caja globales.
- Revisar también scripts compartidos, configuración, historial, imágenes, instalación PWA, cachés y documentos auxiliares antes de migrar.

## Secuencia de implementación
1. Crear entorno de pruebas y asignar primer superadministrador desde Admin SDK.
2. Implementar registro de restaurantes, membresías, pagos manuales y auditoría mediante funciones de servidor.
3. Implementar reglas con denegación por defecto, permisos por membresía y por acción, pedidos públicos con datos validados y acceso de clientes exclusivamente a sus propios pedidos. No permitir escrituras directas de roles o suscripciones por clientes.
4. Migrar módulos y crear índices y rutas de Storage por restaurante. Aislar también almacenamiento local, service workers y manifiestos por identidad.
5. Crear dos restaurantes ficticios y probar accesos cruzados denegados, roles, pedidos públicos, caja, riders, cobros duplicados y vencimientos. Verificar con Firebase Emulator Suite y pruebas integrales.
6. Obtener respaldo verificable de Firestore, reglas, Auth y Storage mediante procedimientos autorizados; ensayar migración y reversión. Conservar identificadores y relaciones de pedidos, cuentas y movimientos. No usar datos reales en pruebas.
7. Migrar La Pizza de Juan K a la nueva estructura en ventana controlada, verificar totales y pedidos, publicar únicamente después de aprobar las pruebas.

## Criterio de salida
Nunca habilitar un segundo restaurante en producción mientras existan consultas globales sin autorización multiempresa. No desplegar reglas incompletas. El prototipo de interfaz es local y no está conectado a Firebase, no crea cuentas reales ni procesa pagos.
