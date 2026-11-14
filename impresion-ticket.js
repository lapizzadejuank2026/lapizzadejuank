/* La Pizza de Juanca — un único ticket económico para cocina y cliente.
   La vista usa impresión del navegador. NO es facturación electrónica ni cobra dinero. */
(function(){
  'use strict';
  const html = valor => String(valor==null?'':valor).replace(/[&<>"']/g,
    char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const pesos = valor => Number(valor).toLocaleString('es-CO',{maximumFractionDigits:0});
  const monto = valor => {
    if(valor===undefined || valor===null || valor==='')return null;
    const n=Number(valor);
    return Number.isFinite(n) && n>=0 ? n : null;
  };
  const fecha = valor => {
    try{
      const d=valor && typeof valor.toDate==='function'?valor.toDate():
        valor && typeof valor.seconds==='number'?new Date(valor.seconds*1000):
        valor?new Date(valor):new Date();
      return !isNaN(d.getTime())?d.toLocaleString('es-CO'):'';
    }catch(_){return '';}
  };
  const fila = (nombre,valor)=>!valor?'': '<div class="par"><span>'+html(nombre)+
    '</span><span>'+html(valor)+'</span></div>';

  function itemsNormalizados(datos){
    const lista=Array.isArray(datos?.productos)?datos.productos:
      Array.isArray(datos?.items)?datos.items:[];
    return lista.map(p=>{
      const cantidad=Number(p.cantidad??p.qty??1);
      const precio=monto(p.precioUnitario??p.precio??p.price);
      const subtotal=monto(p.subtotal);
      return {
        nombre:String(p.producto||p.pizza||p.nombre||p.name||'Producto'),
        cantidad:Number.isFinite(cantidad)&&cantidad>0?cantidad:1,
        sabores:Array.isArray(p.sabores)?p.sabores.map(String):[],
        detalle:String(p.detalle||p.observaciones||''),
        subtotal:subtotal!==null?subtotal:(precio!==null?precio*cantidad:null)
      };
    });
  }
  function prepararPedido(id, datos){
    const d=datos||{};
    const cliente=(typeof d.cliente==='object' && d.cliente)||{};
    const modo=String(d.modalidad||d.tipoEntrega||'').toLowerCase();
    const mesa=modo==='mesa'||d.mesaId;
    const domicilio=modo.includes('domicilio');
    const llevar=modo.includes('recoger')||modo.includes('llevar');
    return {
      encabezado:mesa?String(d.mesaNombre||d.mesaId||'Mesa'):domicilio?'🛵 DOMICILIO':llevar?'🛍️ PARA LLEVAR':'PEDIDO',
      numero:String(id||'').slice(0,8).toUpperCase(),
      fecha:fecha(d.creadoEn),
      nombre:String(cliente.nombre||d.nombre||d.clienteNombre||''),
      telefono:String(cliente.telefono||d.telefono||''),
      direccion:domicilio?String(d.direccion||cliente.direccion||''):'',
      municipio:domicilio?String(d.municipio||cliente.municipio||''):'',
      observaciones:String(d.observaciones||''),
      titulo:mesa?'COMANDA / CUENTA': 'PEDIDO / COMPROBANTE',
      items:itemsNormalizados(d),
      subtotal:monto(d.total),
      domicilio:domicilio?monto(d.domicilioValor):null,
      mostrarDomicilio:domicilio,
      nota:mesa?'Cuenta de mesa. Pendiente de pago.':
        domicilio && monto(d.domicilioValor)===null?'Costo del domicilio pendiente de confirmar.':'',
      prueba:false
    };
  }
  function prepararCuentaMesa(nombre,cuenta){
    const comandas=Array.isArray(cuenta?.comandas)?cuenta.comandas:[];
    const items=comandas.flatMap(cmd=>(Array.isArray(cmd.productos)?cmd.productos:[]).map(p=>({
      nombre:String(p.nombre||p.producto||'Producto'),
      cantidad:Math.max(1,Number(p.cantidad||1)),
      sabores:Array.isArray(p.sabores)?p.sabores.map(String):[],
      detalle:'',
      subtotal:Number(p.precio||0)*Number(p.cantidad||1)
    })));
    const subtotal=comandas.reduce((a,c)=>a+Number(c.total||0),0);
    return {
      encabezado:String(nombre||'Mesa'),numero:'',
      fecha:fecha(cuenta?.abierta),nombre:'',telefono:'',direccion:'',municipio:'',
      observaciones:'',titulo:'PRECUENTA DE MESA · DEMOSTRACIÓN',
      items,subtotal,domicilio:null,mostrarDomicilio:false,
      nota:'Precuenta antes de pagar. No certifica ningún pago.',
      prueba:true
    };
  }
  function abrirTicket(datos){
    if(!datos || !Array.isArray(datos.items) || datos.items.length===0){
      alert('No hay productos para imprimir en este pedido.');
      return;
    }
    const ventana=window.open('','_blank');
    if(!ventana){
      alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para esta página e inténtalo nuevamente.');
      return;
    }
    const lineas=datos.items.map(item=>{
      const sabores=item.sabores?.length?'<div class="detalle">Sabores: '+html(item.sabores.join(' / '))+'</div>':'';
      const detalle=item.detalle?'<div class="detalle">'+html(item.detalle)+'</div>':'';
      const subtotal=monto(item.subtotal);
      return '<div class="producto"><div class="principal"><span>'+html(item.cantidad)+' × '+html(item.nombre)+
        '</span><span>'+(subtotal!==null?'$'+pesos(subtotal):'')+'</span></div>'+
        sabores+detalle+'</div>';
    }).join('');
    const totalProductos=monto(datos.subtotal);
    const domicilio=monto(datos.domicilio);
    const totalFinal=totalProductos!==null && (!datos.mostrarDomicilio || domicilio!==null)
      ? totalProductos+(domicilio||0):null;
    const documento='<!doctype html><html lang="es"><head><meta charset="utf-8">'+
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Ticket La Pizza de Juanca</title>'+
      '<style>'+
      '*{box-sizing:border-box}body{margin:0;background:#eee;color:#000;font-family:Arial,sans-serif}'+
      '.acciones{margin:16px auto;max-width:380px;display:flex;gap:9px;padding:0 12px}'+
      'button{flex:1;padding:13px;border:0;border-radius:8px;font:inherit;font-weight:bold;background:#111;color:#fff}'+
      '.ticket{width:76mm;max-width:100%;margin:16px auto;background:white;padding:4mm 3mm;font-size:11px;line-height:1.35;overflow-wrap:anywhere}'+
      'h1{text-align:center;font-size:18px;margin:0 0 4px}h2{text-align:center;font-size:13px;margin:5px 0 8px}'+
      '.centrado{text-align:center}.linea{border-top:1px dashed #111;margin:9px 0}.par,.principal{display:flex;justify-content:space-between;gap:5px}'+
      '.par span:first-child,.principal span:first-child{flex:1}.producto{padding:5px 0;border-bottom:1px dotted #bbb}'+
      '.principal{font-weight:bold}.detalle{font-size:10px;margin-left:12px}.total{font-size:15px;font-weight:bold}'+
      '.pie{text-align:center;margin-top:13px;font-size:10px}'+
      '@media print{body{background:white}.acciones{display:none}.ticket{margin:0;padding:0;width:100%;max-width:76mm}'+
      '@page{margin:3mm}}'+
      '</style></head><body>'+
      '<div class="acciones"><button type="button" onclick="window.print()">🖨️ Imprimir una copia</button><button type="button" onclick="window.close()">Cerrar</button></div>'+
      '<article class="ticket"><h1>LA PIZZA DE JUANCA</h1><h2>'+html(datos.titulo||'PEDIDO')+'</h2>'+
      (datos.prueba?'<p class="centrado"><strong>SOLO DEMOSTRACIÓN — SIN VALIDEZ COMERCIAL</strong></p>':'')+
      '<p class="centrado"><strong>'+html(datos.encabezado||'PEDIDO')+'</strong>'+
      (datos.numero?' · #'+html(datos.numero):'')+'</p>'+
      fila('Fecha:',datos.fecha)+fila('Impreso:',fecha(new Date()))+
      fila('Cliente:',datos.nombre)+fila('Teléfono:',datos.telefono)+
      fila('Municipio:',datos.municipio)+fila('Dirección:',datos.direccion)+
      '<div class="linea"></div><strong>DETALLE</strong>'+lineas+
      '<div class="linea"></div>'+
      (totalProductos===null?'':fila('Subtotal productos:','$'+pesos(totalProductos)))+
      (datos.mostrarDomicilio?fila('Domicilio:',domicilio===null?'Por confirmar':'$'+pesos(domicilio)):'')+
      (totalFinal===null?'': '<p class="par total"><span>TOTAL:</span><span>$'+pesos(totalFinal)+'</span></p>')+
      (datos.observaciones?'<p><strong>Observaciones:</strong> '+html(datos.observaciones)+'</p>':'')+
      (datos.nota?'<p>'+html(datos.nota)+'</p>':'')+
      '<div class="linea"></div><div class="pie">Gracias por tu compra.<br>Comprobante interno / precuenta. No reemplaza una factura electrónica cuando esta sea obligatoria.</div>'+
      '</article></body></html>';
    ventana.document.open();
    ventana.document.write(documento);
    ventana.document.close();
    ventana.focus();
  }
  window.ImpresionJuanca=Object.freeze({abrirTicket,prepararPedido,prepararCuentaMesa});
})();