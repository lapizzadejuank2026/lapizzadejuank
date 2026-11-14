# Integración segura — mesas, comandas, cobrar y liberar mesa en caja
La Pizza de Juanca · 13 de noviembre de 2026

## Situación actual
- El menú público, los domicilios, la recepción y la alarma siguen en archivos anteriores.
- La pantalla anterior de mesas, \`salon-mesas.html\`, guarda únicamente demostraciones locales: no se reemplazó ni se importaron sus datos.
- La nueva \`salon-operativo.html\` (con lógica en \`salon-operativo.js\`) trabaja con Firebase y permite mesas compartidas entre dispositivos.
- La caja \`caja-operativa.html\` con \`caja-operativa.js\` ya utiliza \`cajaControl/actual\`, \`cajaTurnos\`, \`movimientosCaja\` y \`referenciasCaja\`.
- **Hasta que se publiquen y validen las reglas adicionales de Firestore, no deben hacerse pruebas con dinero real.**

## Comportamiento al cobrar
1. Se agregan comandas a una mesa abierta. Cada comanda es un documento nuevo en \`pedidos\`, con \`modalidad:'mesa'\`, número y estado \`nuevo\`; aparecerá en la recepción existente y activará la alarma.
2. La cuenta acumula todas las comandas en \`cuentasMesa/{id}\` y la mesa almacena \`cuentaId\` para indicar ocupación.
3. El administrador abre el diálogo de pago y elige efectivo, transferencia o mixto. Si informa transferencia, debe confirmar que comprobó el dinero en Nequi o su banco.
4. El botón **Cobrar y liberar mesa** ejecuta **una única transacción Firestore** que:
   - lee y comprueba que \`cajaControl/actual\` y el turno de \`cajaTurnos\` están abiertos;
   - comprueba que la mesa y la cuenta siguen abiertas y el total coincide;
   - rechaza duplicados de \`referenciasCaja/venta__<CUENTAID>\` o \`movimientosCaja/mesa__<cuentaId>\`;
   - suma los importes a los contadores de ingresos del turno;
   - crea un movimiento de tipo \`venta_mesa\`, con referencia \`cuentaId.toUpperCase()\`;
   - marca la cuenta como cobrada y libera la mesa.
5. Si la transacción falla, **ningún paso debe haberse guardado**. Si el navegador pierde la conexión después de confirmar, revisar primero el estado de caja y mesa antes de reintentar.
6. La referencia evita duplicar el pago con la función manual de caja SI se usa la misma referencia completa. No registrar aparte la misma venta con un nombre o código alternativo.

## Reglas Firestore pendientes

En Firebase Console → Firestore Database → Reglas, dentro de
\`match /databases/{database}/documents\`, al mismo nivel que los otros bloques:

~~~firestore
match /mesas/{mesaId} {
  allow read, write: if esAdmin();
}

match /cuentasMesa/{cuentaId} {
  allow read, write: if esAdmin();
}
~~~

**También es indispensable modificar el bloque YA EXISTENTE \`match /pedidos/{pedidoId}\`.** Actualmente su \`allow create\` permite cuentas anónimas que cumplen las validaciones del menú de clientes, pero NO permite que el administrador envíe una comanda de mesa. Sin cambiar las otras condiciones de los clientes, envolver la condición original y anteponer la alternativa admin:

~~~firestore
allow create: if esAdmin()
  || (
    request.auth != null
    && request.auth.token.firebase.sign_in_provider == 'anonymous'
    && request.resource.data.estado in ['prueba', 'nuevo']
    && request.resource.data.total is number
    && request.resource.data.total > 0
    && request.resource.data.productos is list
    && request.resource.data.productos.size() > 0
    && request.resource.data.productos.size() <= 20
    && request.resource.data.keys().hasOnly([
      'cliente', 'modalidad', 'municipio', 'direccion',
      'observaciones', 'productos', 'total', 'estado', 'creadoEn'
    ])
  );
~~~

Este ejemplo se basa en la captura compartida del 13 de noviembre: **compara con las reglas actuales y conserva cualquier condición adicional que se haya incorporado después**. No dupliques el \`match /pedidos\`, ni modifiques permisos de domiciliarios, clientes, productos o caja sin necesidad.

La alternativa \`esAdmin()\` es amplia deliberadamente porque el administrador autorizado ya puede actualizar los pedidos; NO dar ese privilegio a trabajadores ni a cuentas anónimas.

En la configuración actual, \`esAdmin()\` comprueba un UID administrativo específico; no convertirla en \`request.auth != null\`.

## Pruebas (siempre importes ficticios)
1. Con administrador, abrir nueva pantalla \`salon-operativo.html\` y crear seis mesas más barra desde el botón inicial. No cambiar las mesas del demo local.
2. Sin acceso de administrador o como domiciliario, las colecciones \`mesas\` y \`cuentasMesa\` deben rechazar lectura y escritura.
3. Abrir Mesa 1, enviar una gaseosa; debe llegar a recepción con etiqueta \`Mesa 1\` y sonar alarma.
4. Enviar segunda comanda de pizza, escoger sabores. Debe quedar una sola cuenta con dos comandas, y dos pedidos en recepción.
5. Abrir \`caja-operativa.html\` en otro navegador o pestaña. Verifica qué turno está abierto antes de usar un pago de prueba.
6. Cobrar una mesa por efectivo: el efectivo esperado sube exactamente lo cobrado y Mesa 1 se vuelve libre.
7. Cobrar otra por transferencia: el efectivo esperado no sube; el acumulado de transferencias sí, si confirmaste el abono (ficticio).
8. Cobrar por mixto, verificar que ambos importes suman el total.
9. Repetir el pago de la misma cuenta, intentar cobrar sin caja abierta o registrar manualmente con la misma referencia: debe rechazarse sin duplicar ingresos.
10. Abrir dos dispositivos sobre la misma mesa: no deben poder cobrarla dos veces ni duplicar comandas al reenviar.
11. Comprobar que los pedidos de clientes y domicilios, y la alarma, siguen intactos.

## Pendiente antes de producción
- Los registros que se generen durante las pruebas quedan en Firebase y deben identificarse y excluirse de los reportes comerciales reales. La caja del 13 de noviembre comenzó con una base ficticia de 100.000 COP.
- Definir ajustes y devoluciones de ventas, cobros parciales, anulación administrativa, contabilización fiscal y conciliación.
- Los domicilios y pedidos para llevar todavía no se conectan automáticamente a caja; este módulo automatiza **solo las ventas de mesas**.
- No es una pasarela de pago ni factura electrónica DIAN.
