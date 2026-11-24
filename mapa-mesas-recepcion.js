// Monitor de salón de solo lectura. No modifica comandas ni movimientos de caja.
import {collection,query,where,onSnapshot} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
export function crearMapaRecepcion(db,root){
 const $=id=>root.querySelector('#'+id);
 const grid=$('mapa-grilla'),detalle=$('mapa-detalle'),resumen=$('mapa-resumen'),estado=$('mapa-estado');
 let mesas=[],cuentas=new Map(),pedidos=[],pedidosOk=false,seleccion='',historialAbierto=false,visible=false;
 let parar=[],version=0,mesasOk=false,cuentasOk=false,error='';
 const valido=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
 const pesos=n=>'$'+n.toLocaleString('es-CO');
 const fecha=v=>{const d=typeof v==='string'?new Date(v):v?.toDate?.()||(typeof v?.seconds==='number'?new Date(v.seconds*1000):null);return d&&!isNaN(d.getTime())?d:null;};
 const hora=v=>fecha(v)?.toLocaleString('es-CO',{timeZone:'America/Bogota',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})||'Hora no registrada';
 function nodo(tag,txt,clase){const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(clase)n.className=clase;return n;}
 function productos(b,items){for(const it of Array.isArray(items)?items:[]){
  const subtotal=Number(it.precio??it.precioUnitario)*Number(it.cantidad);
  b.append(nodo('div',(it.cantidad??'')+' × '+(it.nombre||it.producto||it.pizza||'Producto')+(Array.isArray(it.sabores)&&it.sabores.length?' · '+it.sabores.join(', '):'')+(valido(subtotal)?' — '+pesos(subtotal):'')));
 }}
 function irAlMapa(){root.scrollIntoView({block:'start',behavior:'instant'});}
 function volverAlMapa(){seleccion='';historialAbierto=false;pintar();irAlMapa();}
 function botonVolver(){const b=nodo('button','← Volver a las mesas','mapa-volver');b.type='button';b.onclick=volverAlMapa;return b;}
 function pintar(){
  root.hidden=!visible;grid.replaceChildren();detalle.replaceChildren();detalle.hidden=true;resumen.hidden=true;grid.hidden=!!seleccion;estado.hidden=!!seleccion;
  if(!visible)return;
  if(!mesasOk||!cuentasOk){
   const mensaje=error||'Sincronizando mesas y cuentas con Firebase. El saldo aparecerá cuando esté confirmado.';
   estado.textContent=mensaje;
   if(seleccion){detalle.hidden=false;detalle.append(botonVolver(),nodo('p',mensaje,'hint'));}
   return;
  }
  const activas=mesas.filter(m=>m.activa).sort((a,b)=>(a.orden??999)-(b.orden??999)||String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
  const ocupadas=activas.filter(m=>!!m.cuentaId);
  const cuenta=m=>{const c=cuentas.get(m.cuentaId);return c&&c.mesaId===m.id&&valido(c.total)?c:null;};
  const completas=ocupadas.every(m=>!!cuenta(m));
  estado.textContent=activas.length?'Toca una mesa para ver su cuenta y sus comandas.':'No hay mesas activas. Configúralas desde Mesas y barra.';
  if(!activas.some(m=>m.id===seleccion))seleccion='';
  resumen.hidden=!!seleccion;grid.hidden=!!seleccion;estado.hidden=!!seleccion;
  $('mapa-libres').textContent=String(activas.length-ocupadas.length);
  $('mapa-ocupadas').textContent=String(ocupadas.length);
  $('mapa-total').textContent=completas?pesos(ocupadas.reduce((n,m)=>n+cuenta(m).total,0)):'Por sincronizar';
  for(const m of seleccion?[]:activas){
   const c=cuenta(m);
   const b=nodo('button',null,m.cuentaId?'ocupada':'libre');b.type='button';
   b.setAttribute('aria-pressed',String(m.id===seleccion));
   b.append(nodo('strong',m.nombre||'Mesa'),nodo('small',m.cuentaId?'🟠 Ocupada':'🟢 Libre'),nodo('strong',m.cuentaId?(c?pesos(c.total):'Por sincronizar'):pesos(0)));
   if(c)b.append(nodo('small',(Array.isArray(c.comandas)?c.comandas.length:0)+' comanda(s)'));
   b.onclick=()=>{if(seleccion!==m.id)historialAbierto=false;seleccion=m.id;pintar();irAlMapa();detalle.querySelector('h4')?.focus({preventScroll:true});};
   grid.append(b);
  }
  const m=activas.find(x=>x.id===seleccion);if(!m)return;
  const c=cuenta(m);detalle.hidden=false;
  detalle.append(botonVolver());
  const titulo=nodo('h4',m.nombre||'Mesa');titulo.tabIndex=-1;detalle.append(titulo);
  detalle.append(nodo('p',m.cuentaId?'🟠 Cuenta abierta':'🟢 Libre · sin cuenta abierta'),nodo('p','Por cobrar: '+(m.cuentaId?(c?pesos(c.total):'Por sincronizar'):pesos(0)),'mapa-total'));
  if(c){
   const cmds=Array.isArray(c.comandas)?c.comandas:[];
   detalle.append(nodo('p','Apertura: '+hora(c.aperturaEn),'hint'),nodo('strong','Comandas de la cuenta actual ('+cmds.length+')'));
   for(const cmd of cmds){
    const b=nodo('div',null,'mapa-comanda');
    b.append(nodo('strong','Comanda '+(cmd.numero??'')+' · '+hora(cmd.fecha)));
    productos(b,cmd.productos);
    const p=pedidosOk?pedidos.find(p=>p.id===cmd.pedidoId):null;
    const e=p?String(p.d.estado||'nuevo').toLowerCase():'';
    b.append(nodo('small','Subtotal: '+(valido(cmd.total)?pesos(cmd.total):'No disponible')+(e==='nuevo'?' · Por confirmar':e==='recibido'?' · Recepción confirmada':'')));
    detalle.append(b);
   }
   if(!cmds.length)detalle.append(nodo('p','No hay comandas registradas en esta cuenta.','hint'));
  }else detalle.append(nodo('p',m.cuentaId?'El saldo aún no está sincronizado.':'La mesa no tiene consumos pendientes.','hint'));
  const link=nodo('a',m.cuentaId?'💰 Abrir mesa para gestionar o cobrar':'🍽️ Abrir mesa para tomar pedido','mapa-enlace');
  link.href='salon-operativo.html?mesa='+encodeURIComponent(m.id);detalle.append(link);
  if(pedidosOk){
   const anteriores=pedidos.filter(p=>p.d.mesaId===m.id&&(!m.cuentaId||p.d.cuentaMesaId!==m.cuentaId)&&String(p.d.estado||'').toLowerCase()!=='prueba').sort((a,b)=>(fecha(b.d.creadoEn)?.getTime()||0)-(fecha(a.d.creadoEn)?.getTime()||0));
   const hist=nodo('details');hist.open=historialAbierto;hist.ontoggle=()=>{if(hist.isConnected)historialAbierto=hist.open;};
   hist.append(nodo('summary','Historial de comandas anteriores ('+anteriores.length+')'));
   if(!anteriores.length)hist.append(nodo('p','No hay comandas anteriores registradas para esta mesa.','hint'));
   for(const p of anteriores.slice(0,10)){
    const b=nodo('div',null,'mapa-comanda');b.append(nodo('strong',hora(p.d.creadoEn)+' · '+(valido(p.d.total)?pesos(p.d.total):'Sin total')));
    productos(b,p.d.productos);hist.append(b);
   }
   if(anteriores.length>10)hist.append(nodo('p','Últimas 10 comandas; las demás están en el historial completo de pedidos.','hint'));
   detalle.append(hist);
  }
  detalle.append(botonVolver());
 }
 function detener(){
  version++;for(const fn of parar)fn();parar=[];mesas=[];cuentas.clear();pedidos=[];pedidosOk=false;seleccion='';historialAbierto=false;mesasOk=false;cuentasOk=false;error='';pintar();
 }
 function escuchar(){
  const v=version;
  parar.push(onSnapshot(collection(db,'mesas'),{includeMetadataChanges:true},snap=>{
   if(v!==version)return;mesas=snap.docs.map(x=>({...x.data(),id:x.id}));mesasOk=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;pintar();
  },err=>{if(v!==version)return;mesasOk=false;error='No se pudieron consultar las mesas ('+(err.code||'error')+').';pintar();}));
  parar.push(onSnapshot(query(collection(db,'cuentasMesa'),where('estado','==','abierta')),{includeMetadataChanges:true},snap=>{
   if(v!==version)return;cuentas=new Map(snap.docs.map(x=>[x.id,x.data()]));cuentasOk=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;pintar();
  },err=>{if(v!==version)return;cuentasOk=false;error='No se pudieron consultar las cuentas ('+(err.code||'error')+').';pintar();}));
 }
 return {escuchar,detener,actualizar(esMesa,docs,cargados){visible=esMesa;pedidos=docs;pedidosOk=cargados;pintar();}};
}
