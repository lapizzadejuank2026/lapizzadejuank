# Pulso Food — Continuidad 25 de noviembre de 2026, 10:28 Colombia

## Confirmado durante la jornada
- Proyecto independiente Firebase: pulso-food-desarrollo, plan Spark. App web Pulso Food Web registrada. Authentication correo/contraseña y anónimo habilitados.
- Firestore Standard, base (default), región southamerica-west1 (Santiago), modo producción, sin copias programadas.
- Cuenta propietaria creada; atributo personalizado superadmin=true asignado mediante Identity Toolkit desde Cloud Shell y comprobado por accounts:lookup. No guardar contraseñas, tokens ni UID personal en este documento.
- Reglas iniciales publicadas: solo superadmin puede leer restaurantes/{id}, suscripciones/{id} y suscripciones/{id}/pagos/{id}; todas las escrituras de clientes y demás accesos denegados. Prueba negativa aún pendiente.
- Rama pulso-multiempresa independiente de main. Archivos docs/pulso-multiempresa.md, superadmin-prototipo.html y superadmin.html. El prototipo es local; superadmin.html usa Authentication y Firestore del proyecto nuevo, sin escrituras.
- Firebase Hosting publicado con éxito desde Cloud Shell. URL: https://pulso-food-desarrollo.web.app
- Prueba real del propietario exitosa: pantalla muestra "Superadministrador autorizado" y "Conexión con Firestore verificada". Restaurantes registrados 0, suscripciones activas 0, mensualidad proyectada $0. Los cuatro botones de escritura siguen desactivados deliberadamente.
- No se modificó main ni se migró la pizzería. No se habilitó facturación.

## Retomar exactamente aquí
1. Diseñar e implementar backend autorizado que compruebe token y atributo superadmin en cada operación. Evaluar Cloud Functions y sus requisitos de facturación antes de activar Blaze; alternativamente mantener pruebas locales con emuladores. No activar gastos sin autorización.
2. Crear restaurante de prueba y asignar administrador mediante invitación/flujo seguro. Implementar membresía por UID y restaurante; no guardar contraseñas en Firestore.
3. Implementar suscripciones y pagos manuales verificados: plan propuesto COP 150.000/mes, referencia única, auditoría, renovación idempotente, vencimiento y estados; no confundir con ventas de restaurantes. Activar botones solo cuando exista backend real. Automatización de pasarela después.
4. Ajustar panel móvil: compactar cabecera de sesión y evitar que el correo se corte; conservar marca Pulso Food y lema Tu herramienta, tu control.
5. Probar que cuentas no autorizadas y usuarios de otros restaurantes no acceden a datos privados; comprobar escrituras denegadas, duplicados de pago y vencimientos. Crear dos negocios ficticios antes de migrar datos reales.
6. Adaptar menú, pedidos, mesas, caja, riders, productos, almacenamiento y configuración a rutas separadas por restaurante. Probar migración, respaldo y reversión antes de incorporar La Pizza de Juan K.
7. No publicar cambios en main ni abrir producción multiempresa hasta completar pruebas. Definir copias de seguridad antes de operar con negocios reales.

## Publicación de prueba
En Cloud Shell se creó ~/pulso-admin-pruebas/public, se descargó superadmin.html como public/index.html y Logo-Pulso-Food.png desde la rama pulso-multiempresa, se creó firebase.json con hosting.public=public y se ejecutó firebase deploy --only hosting --project pulso-food-desarrollo. Para futuras actualizaciones descargar la versión nueva y desplegar solo al proyecto de desarrollo, previa verificación.
