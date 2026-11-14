# Continuidad del proyecto — La Pizza de Juanca
**Cierre de trabajo:** noche del 13 de noviembre de 2026 (hora Colombia).  
**Objetivo de este archivo:** retomar mañana o la próxima semana sin repetir decisiones ni modificar las funciones que ya trabajan bien.

## Datos técnicos
- GitHub: repositorio `lapizzadejuank2026/lapizzadejuank`, rama `main`, GitHub Pages: https://lapizzadejuank2026.github.io/lapizzadejuank/
- Firebase: proyecto `pizzadejuank`; Authentication, Cloud Firestore, reglas con `esAdmin()` (UID administrativo) y `esDomiciliarioActivo()` (repartidor autorizado).
- Archivos centrales:
  - `index.html`: bienvenida.
  - `index-1.html`: menú de clientes, carrito y envío a Firestore.
  - `panel-pedidos.html`: recepción y alarma, seguimiento de domicilios, asignación de repartidor, productos y equipo/roles, control de cobros e impresión de ticket.
  - `domiciliarios.html`: jornada personal, pedidos asignados, aceptación, recogida, en camino, entrega e historial.
  - `cobros-domicilios.js`: registro de efectivo, transferencia o mixto del repartidor; administrador fija costo del domicilio y verifica el reporte.
  - `caja-operativa.html` y `caja-operativa.js`: caja Firebase, apertura, ingresos, salidas, arqueo, cierre y controles para evitar duplicados.
  - `salon-operativo.html` y `salon-operativo.js`: mesas/barra en Firebase, comandas a recepción y «Cobrar y liberar mesa» que actualiza el turno de caja de forma atómica.
  - `salon-mesas.html` y `caja.html`: versiones de demostración local; conservarlas.
  - `impresion-ticket.js`: una sola impresión para cocina y cliente, más precuenta de mesas.
- Documentación adicional: `docs/cobros-domiciliarios.md`, `docs/caja-operativa.md`, `docs/salon-caja-integracion.md`, `docs/mesas-caja-plan.md`, `docs/seguridad-domiciliarios.md`.

## Lo que el usuario comprobó con capturas
1. Pedidos de cliente llegan a recepción y suena la alarma. El administrador confirma recepción y asigna domiciliario.
2. Repartidor puede avanzar en los estados: pendiente → aceptado → recogido → en_camino → entregado; historial registra las entregas.
3. La cuenta personal de otro repartidor no mostraba pedidos del primero en las pruebas realizadas.
4. Menú de mesas y barra: vista separada al tocar una mesa; cuenta puede acumular comandas, personalización por sabores y cobro de mesa.
5. Las comandas/cobros de mesas conectadas reflejaron movimientos en caja Firebase. En una captura, turno de prueba de Juan Carlos tenía base **$100.000**, ingresos en efectivo **$48.000**, gastos/salidas **$10.000**, esperado **$138.000** y **2 movimientos**. Son cifras de pruebas, no asumir que representan efectivo físico real.
6. Un único ticket para cocina/cliente apareció correctamente en vista previa de Android. Impresora física pendiente de probar cuando el dueño esté en el local.
7. Se publicaron las reglas de Firestore para caja, mesas/cuentas y para que el administrador cree pedidos de comanda.
8. El 13 de noviembre por la noche se modificaron y publicaron reglas de pedidos para permitir al repartidor exclusivamente el reporte de cobro en estado `en_camino`, y para exigir `cobroReportado` antes de pasar de `en_camino` a `entregado`. El usuario probó exitosamente el guardado de un pago.
9. **Última prueba exitosa visible**: pedido `OTJOLYGU` (cliente de prueba) con productos **$45.000**, domicilio confirmado **$2.000**, **total $47.000**; repartidor reportó pago **mixto: $20.000 efectivo + $27.000 transferencia**. Se mostró «Cobro reportado, NO verificado», y se habilitó el botón «🏠 Confirmar entregado».
10. **Última acción pendiente del usuario:** dijo que iba a pulsar «Confirmar entregado»; NO se recibió todavía una captura que confirme el resultado de ese clic. Verificar en el panel que quedó `estadoEntrega:'entregado'`.

## Estado exacto de los pagos de domicilios
- El domiciliario registra `cobroReportado:{metodo,efectivo,transferencia,total}` y `cobroReportadoEn`. Solo después puede marcar entregado.
- El administrador confirma valor de `domicilioValor` (incluso cero) antes de habilitar el botón del repartidor; el total a pagar es `total` de productos + `domicilioValor`.
- En administración `mostrarCobroAdmin` permite verificar manualmente la recaudación mediante `cobroVerificado`.
- **CRÍTICO: un reporte del repartidor NO equivale a ingreso registrado en caja.** La transferencia debe comprobarse realmente en banco/Nequi y el efectivo debe entregarse físicamente a caja. La integración automática de cobros de domicilios con `movimientosCaja` y `referenciasCaja` sigue **PENDIENTE**.
- No cobrar dos veces, ni mezclar dinero de prueba con caja real; evitar contabilizar tanto el reporte del repartidor como una entrada manual con distinta referencia.
- Pagos a repartidores y recaudación del cliente son operaciones distintas.

## Prioridad al retomar
1. Verificar si el último pedido `OTJOLYGU` terminó en `entregado`, si la recepción refleja estado y si el administrador puede pulsar «Confirmar pago conciliado» solo cuando corresponda. En pruebas usar datos ficticios, sin afirmar que llegó transferencia real.
2. Diseñar/implementar conexión **segura, atómica e idempotente** entre cobro conciliado del domicilio y caja abierta; un solo movimiento con la referencia canónica del pedido. No asumir que ya está hecho.
3. Revisar coherencia de flujo para llevar y mesa; implementar también cobros de para llevar con integración a caja y protección contra dobles cobros.
4. Probar casos efectivo, transferencia y mixto, sin costos de domicilio, caídas de conexión, pedidos cancelados, cierre de turno y cambios de sesión.
5. Completar impresión en impresora del local cuando se conozca conexión (Bluetooth/USB/WiFi) y ancho del papel. El ticket de navegador no es factura electrónica DIAN.
6. Mejorar detalles operativos (por ejemplo, reportes, roles, permisos del personal, automatización de caja, UX) sin reescribir archivos que ya funcionan.

## Precauciones operativas antes de sustituir OlaClick
- El dueño desea migrar porque su membresía de OlaClick vence pronto, pero prefiere una aplicación sólida. **No recomendar desactivar OlaClick antes de hacer pruebas reales completas y un plan de respaldo.** Si hace falta contratar otro mes, es una transición razonable para evitar perder pedidos.
- Conservar copias y validar cambios de GitHub por separado; verificar y publicar Firestore Security Rules siempre conscientemente, manteniendo acceso individual de repartidores.
- Reglas de caja/mesas implementadas con `esAdmin()` necesitan pruebas de autorización y rechazo con cuentas de repartidores.
- No asumir push sonoro cuando el navegador de recepción está cerrado; alarma en tiempo real mientras el panel está abierto.
- Mantener como prioridad: evitar perder pedidos y mantener estabilidad.

## Cómo retomar la próxima sesión
Pedir: «Sigamos La Pizza de Juanca desde `docs/continuidad-cierre-2026-11-13.md`. Terminamos el cobro mixto de domicilio, falta comprobar entrega final y conectar cobros verificados a caja». Consultar primero código actual del repositorio y capturas/pruebas recientes, no recrear funciones ya existentes.

**Nota de privacidad:** no se registran contraseñas, UID personal ni números de teléfono o direcciones de clientes en este resumen.
