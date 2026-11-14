// Módulo de salón conectado a Firestore: mesas + comandas + cobro/caja atómicos.
// Habilitar únicamente tras publicar reglas de Firestore exclusivas del admin.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,query,where,writeBatch,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const config={apiKey:'AIzaSyA65sFJq3vf24a-1VbpYBHCgpEAk--exAA',
 authDomain:'pizzadejuank.firebaseapp.com',projectId:'pizzadejuank',
 storageBucket:'pizzadejuank.firebasestorage.app',
 messagingSenderId:'856650093973',
 appId:'1:856650093973:web:a4cd3ad8e863617706d29c'};
const app=initializeApp(config);
const auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const pesos=n=>'$'+Number(n||0).toLocaleString('es-CO');
const entero=(n,min=0)=>n!==''&&n!=null&&Number.isSafeInteger(Number(n))&&Number(n)>=min&&Number(n)<=100000000?Number(n):null;
const controlCaja=doc(db,'cajaControl','actual');
const mesaRef=id=>doc(db,'mesas',id);
const cuentaRef=id=>doc(db,'cuentasMesa',id);
const refsCaja=id=>doc(db,'referenciasCaja','venta__'+id.toUpperCase());
const movimientosRef=id=>doc(db,'movimientosCaja',id);
const turnosRef=id=>doc(db,'cajaTurnos',id);
const orderRef=id=>doc(db,'pedidos',id);
const element=(tag,text,clase)=>{
 const e=document.createElement(tag);e.textContent=text;if(clase)e.className=clase;return e;
};
const normalizar=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const saboresBase=[
 ['hawaiana','Hawaiana'],['carnes','Carnes'],['pollo-champinon','Pollo champiñón'],
 ['mi-tierrita','Mi Tierrita'],['mexicana','Mexicana'],['venezolana','Venezolana'],
 ['de-la-casa','De la Casa'],['ranchera','Ranchera'],['campesina','Campesina'],
 ['pepperoni','Pepperoni']
];
const pizzasBase=[
 {id:'personal',nombre:'Pizza personal',precio:20000,max:2},
 {id:'small',nombre:'Pizza small',precio:35000,max:2},
 {id:'mediana',nombre:'Pizza mediana',precio:45000,max:3},
 {id:'familiar',nombre:'Pizza familiar',precio:62000,max:3}
];
const iniciales=Array.from({length:6},(_,i)=>({id:'mesa-'+(i+1),nombre:'Mesa '+(i+1),tipo:'mesa'}))
 .concat([{id:'barra',nombre:'Barra',tipo:'barra'}]);
let user=null;
let mesas=[],cuentas=new Map(),menuProductos=[],pizzas=[],sabores=[];
let seleccion='',categoria='Pizzas',borrador=[],pizzaElegida=null,ocupado=false;
let control=null,mesaEscuchada=false,cuentasEscuchadas=false,catalogoEscuchado=false;
let deteners=[];
let intentoComanda=null, intentoCobro=null;
let itemEnEdicion=null;
function mensaje(txt,alerta=false){
 $('mensaje').textContent=txt;$('mensaje').className=alerta?'mensaje error':'mensaje';
}
function avisoMesa(txt,alerta=false){
 $('avisoMesa').textContent=txt;$('avisoMesa').className=alerta?'mensaje error':'mensaje';
}
function limpiaTodo(){
 for(const parar of deteners)parar();
 deteners=[];mesas=[];cuentas.clear();menuProductos=[];pizzas=[];sabores=[];
 seleccion='';borrador=[];control=null;mesaEscuchada=cuentasEscuchadas=catalogoEscuchado=false;
 intentoComanda=null;intentoCobro=null;ocupado=false;
}
function cuentaActual(){const m=mesas.find(m=>m.id===seleccion);return m?.cuentaId?cuentas.get(m.cuentaId):null;}
function mesaActual(){return mesas.find(m=>m.id===seleccion)||null;}
function totalBorrador(){return borrador.reduce((s,i)=>s+i.precio*i.cantidad,0);}
function monedaValida(n){return entero(n)!==null;}
function elegirPantalla(vista){
 $('vistaMesas').hidden=vista!=='mesas';
 $('vistaDetalle').hidden=vista!=='detalle';
 window.scrollTo(0,0);
}
function abrirMesa(id){
 if(ocupado)return;
 const m=mesas.find(m=>m.id===id);
 if(!m||!m.activa)return;
 if(seleccion!==id && borrador.length&&!confirm('¿Descartar los productos aún no enviados de la mesa anterior?'))return;
 if(seleccion!==id)borrador=[];
 seleccion=id;intentoComanda=null;intentoCobro=null;
 pintarTodo();elegirPantalla('detalle');
}
function volver(){
 if(ocupado)return;
 elegirPantalla('mesas');
}
$('volverMesas').onclick=volver;
$('volverMesasAbajo').onclick=volver;
function pintarMesas(){
 const holder=$('mesas');holder.replaceChildren();
 const visibles=mesas.filter(m=>m.activa).sort((a,b)=>(a.orden??999)-(b.orden??999)||a.nombre.localeCompare(b.nombre,'es'));
 if(!mesas.length){
  $('iniciarMesas').hidden=false;
  holder.append(element('p','Todavía no hay mesas creadas en Firebase. Primero crea la distribución inicial.'));
 }else{
  $('iniciarMesas').hidden=true;
  if(!visibles.length)holder.append(element('p','Todas las mesas están ocultas. Reactiva una desde el administrador.'));
 }
 for(const m of visibles){
   const b=element('button',m.nombre,'mesa '+(m.cuentaId?'ocupada':'libre'));
   const cuenta=m.cuentaId?cuentas.get(m.cuentaId):null;
   b.append(element('small',m.cuentaId?'🟠 Ocupada'+(cuenta?' · '+pesos(cuenta.total):''):'🟢 Libre'));
   b.onclick=()=>abrirMesa(m.id);b.disabled=ocupado;holder.append(b);
 }
 const ocultas=$('reactivarMesa');ocultas.replaceChildren(new Option('Selecciona mesa oculta',''));
 for(const m of mesas.filter(m=>!m.activa))ocultas.append(new Option(m.nombre,m.id));
 $('activarMesa').disabled=!mesas.some(m=>!m.activa)||ocupado;
 const actual=mesaActual();
 $('editarMesa').disabled=!actual||ocupado;
 $('ocultarMesa').disabled=!actual||!!actual.cuentaId||ocupado;
 $('agregarMesa').disabled=!mesas.length||ocupado;
}
function pintarCuenta(){
 const m=mesaActual(),c=cuentaActual();
 $('nombreMesa').textContent=m?'🍽️ '+m.nombre:'Mesa';
 $('estadoCuenta').textContent=m?.cuentaId?'🟠 Cuenta abierta':'🟢 Libre, se abrirá con la primera comanda';
 $('totalCuenta').textContent=pesos(c?.total||0);
 const resumen=$('comandas');resumen.replaceChildren();
 if(c?.comandas?.length){
  for(const cmd of c.comandas){
   const sec=element('div','', 'comanda');
   sec.append(element('strong','Comanda '+cmd.numero+' · '+String(cmd.fecha||'').replace('T',' ').slice(0,16)));
   for(const it of cmd.productos||[]){
    sec.append(element('div',it.cantidad+' × '+it.nombre+(it.sabores?.length?' · '+it.sabores.join(', '):'')+' — '+pesos(it.precio*it.cantidad)));
   }
   sec.append(element('small','Subtotal: '+pesos(cmd.total)+' · enviada a recepción'));
   resumen.append(sec);
  }
 }else resumen.append(element('p','La mesa todavía no tiene comandas.'));
 $('abrirCobro').disabled=ocupado||!c||!control||control.estado!=='abierta'||borrador.length>0;
 $('imprimirCuenta').disabled=!c;
 $('estadoCajaMesa').textContent=control?.estado==='abierta'
   ? '💰 Hay una caja abierta. El cobro se registrará directamente en ese turno.'
   : '⚠️ No hay caja abierta. Abre caja antes de cobrar o liberar la mesa.';
}
function pintarBorrador(){
 const div=$('borrador');div.replaceChildren();
 if(!borrador.length)div.append(element('p','Selecciona productos del menú.'));
 for(const [idx,it] of borrador.entries()){
  const fila=element('div','', 'item');
  fila.append(element('span',it.cantidad+' × '+it.nombre+(it.sabores?.length?' ('+it.sabores.join(', ')+')':'')+' · '+pesos(it.precio*it.cantidad)));
  const quitar=element('button','Quitar','secundario pequeno');
  quitar.disabled=ocupado;
  quitar.onclick=()=>{borrador.splice(idx,1);intentoComanda=null;pintarBorrador();pintarCuenta();};
  fila.append(quitar);div.append(fila);
 }
 $('totalNuevo').textContent='Subtotal de nueva comanda: '+pesos(totalBorrador());
 $('enviarComanda').disabled=ocupado||!borrador.length||!user||!mesaEscuchada;
}
function agregarProducto(p,saboresElegidos=[]){
 if(!mesaActual()||ocupado)return;
 const id=String(p.id);
 const found=borrador.find(x=>x.id===id&&JSON.stringify(x.sabores)===JSON.stringify(saboresElegidos));
 if(found)found.cantidad=Math.min(found.cantidad+1,99);
 else borrador.push({id,nombre:p.nombre,precio:p.precio,sabores:[...saboresElegidos],cantidad:1});
 intentoComanda=null;pintarBorrador();
}
function productosActuales(){
 const tipos=menuProductos.filter(p=>p.categoria==='Pizzas');
 const nombres=new Set(tipos.filter(p=>p.max).map(p=>normalizar(p.nombre)));
 const lista=pizzas.filter(p=>!nombres.has(normalizar(p.nombre))).map(p=>({...p,esPizza:true}));
 return lista.concat(tipos);
}
function pintarCatalogo(){
 const tabs=$('categorias');tabs.replaceChildren();
 const categorias=['Pizzas', ...new Set(menuProductos.map(p=>p.categoria).filter(x=>x!=='Pizzas'))];
 if(!categorias.includes(categoria))categoria='Pizzas';
 for(const cat of categorias){
  const b=element('button',cat,'tab'+(cat===categoria?' seleccionada':''));
  b.onclick=()=>{categoria=cat;pintarCatalogo();};tabs.append(b);
 }
 const cont=$('productos');cont.replaceChildren();
 const items=categoria==='Pizzas'?productosActuales():menuProductos.filter(p=>p.categoria===categoria);
 if(!catalogoEscuchado){
  cont.append(element('p','Cargando el catálogo de Firebase...'));return;
 }
 if(!items.length)cont.append(element('p','Sin productos disponibles en esta categoría.'));
 for(const p of items){
   const tarjeta=element('article','', 'producto');
   tarjeta.append(element('strong',p.nombre),element('span',pesos(p.precio)));
   const b=element('button',p.esPizza?'Elegir sabores':'Agregar');
   b.disabled=ocupado;
   b.onclick=()=>p.esPizza?seleccionarPizza(p):agregarProducto(p);
   tarjeta.append(b);cont.append(tarjeta);
 }
}
function seleccionarPizza(p){
 pizzaElegida=p;$('tituloPizza').textContent=p.nombre+' · '+pesos(p.precio);
 $('ayudaPizza').textContent='Elige de 1 a '+p.max+' sabores.';
 const holder=$('saboresPizza');holder.replaceChildren();
 for(const sabor of sabores){
  const label=element('label','');
  const checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.value=sabor;
  checkbox.addEventListener('change',()=>{
   const elegidos=holder.querySelectorAll('input:checked');
   if(elegidos.length>p.max)checkbox.checked=false;
  });
  label.append(checkbox,document.createTextNode(' '+sabor));holder.append(label);
 }
 $('dialogPizza').showModal();
}
$('cancelarPizza').onclick=()=>$('dialogPizza').close();
$('agregarPizza').onclick=()=>{
 if(!pizzaElegida)return;
 const seleccionados=[...$('saboresPizza').querySelectorAll('input:checked')].map(n=>n.value);
 if(!seleccionados.length){$('errorPizza').textContent='Elige al menos un sabor.';return;}
 $('errorPizza').textContent='';
 agregarProducto(pizzaElegida,seleccionados);
 $('dialogPizza').close();pizzaElegida=null;
};
function pintarTodo(){
 pintarMesas();pintarCuenta();pintarBorrador();pintarCatalogo();
}
function parseCatalogo(docs){
 const overrides=new Map(),saboresOverride=new Map(),prod=[];
 for(const x of docs){
  const p=x.data(),id=x.id,precio=entero(p.precio);
  if(p.tipo==='pizza-tamano'&&id.startsWith('pizza-tamano-')){
    overrides.set(id.slice('pizza-tamano-'.length),p);continue;
  }
  if(p.tipo==='pizza-sabor'&&id.startsWith('pizza-sabor-')){
    saboresOverride.set(id.slice('pizza-sabor-'.length),p);continue;
  }
  if(p.activo===false||!String(p.nombre||'').trim()||!String(p.categoria||'').trim()||precio===null)continue;
  const n=normalizar(p.nombre);
  const max=p.categoria==='Pizzas'&&n.startsWith('pizza ')
    ?(/\b(porcion|slice)\b/.test(n)?1:/\b(personal|small)\b/.test(n)?2:/\b(mediana|familiar)\b/.test(n)?3:0):0;
  prod.push({id:'catalogo:'+id,nombre:String(p.nombre),precio,categoria:String(p.categoria),orden:p.orden||10,
    esPizza:max>0,max});
 }
 pizzas=pizzasBase.map(p=>{
  const v=overrides.get(p.id)||{},precio=entero(v.precio);
  return {...p,precio:precio===null?p.precio:precio,nombre:v.nombre||p.nombre,
    activo:v.activo!==false,esPizza:true};
 }).filter(p=>p.activo);
 sabores=saboresBase.filter(([k])=>saboresOverride.get(k)?.activo!==false)
   .map(([k,n])=>String(saboresOverride.get(k)?.nombre||n));
 menuProductos=prod.sort((a,b)=>Number(a.orden)-Number(b.orden)||a.nombre.localeCompare(b.nombre,'es'));
 catalogoEscuchado=true;pintarCatalogo();
}
function escuchar(){
 const r1=onSnapshot(collection(db,'mesas'),snap=>{
  mesaEscuchada=true;
  mesas=snap.docs.map(x=>({id:x.id,...x.data()}));
  if(seleccion && !mesas.some(m=>m.id===seleccion)){seleccion='';elegirPantalla('mesas');}
  mensaje('✅ Mesas sincronizadas con Firebase.');
  pintarTodo();
 },err=>mensaje('🔒 Sin acceso a mesas en Firebase: '+(err.code||'error')+'. Falta habilitar sus reglas.',true));
 const r2=onSnapshot(query(collection(db,'cuentasMesa'),where('estado','==','abierta')),snap=>{
  cuentas=new Map(snap.docs.map(x=>[x.id,{id:x.id,...x.data()}]));
  cuentasEscuchadas=true;pintarTodo();
 },err=>mensaje('🔒 Sin acceso a cuentas de mesas: '+(err.code||'error')+'. Revisa las reglas.',true));
 const r3=onSnapshot(collection(db,'productos'),snap=>parseCatalogo(snap.docs),
   err=>mensaje('No se pudo cargar el catálogo: '+(err.code||'error'),true));
 const r4=onSnapshot(controlCaja,snap=>{
   control=snap.exists()?snap.data():null;pintarCuenta();
 },err=>mensaje('No se puede consultar caja: '+(err.code||'error'),true));
 deteners.push(r1,r2,r3,r4);
}
$('login').addEventListener('submit',async e=>{
 e.preventDefault();
 $('entrar').disabled=true;
 $('estadoLogin').textContent='Verificando acceso...';
 try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('clave').value);
   $('clave').value='';$('estadoLogin').textContent='';
 }catch(err){$('estadoLogin').textContent='No se pudo ingresar ('+(err.code||'error')+').';}
 finally{$('entrar').disabled=false;}
});
$('salir').onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{
 limpiaTodo();user=u;
 $('vistaLogin').hidden=!!u;$('pantallaAdmin').hidden=!u;
 if(!u)return;
 $('usuario').textContent=u.email||'Administrador';
 elegirPantalla('mesas');escuchar();
});
function bloquear(estado){ocupado=estado;pintarTodo();}
$('iniciarMesas').onclick=async()=>{
 if(ocupado||mesas.length)return;
 if(!confirm('¿Crear las 6 mesas y la barra en Firebase?'))return;
 bloquear(true);
 try{
  const batch=writeBatch(db);
  iniciales.forEach((m,i)=>batch.set(mesaRef(m.id),{
    nombre:m.nombre,tipo:m.tipo,orden:i+1,activa:true,cuentaId:null,creadaEn:serverTimestamp()
  }));
  await batch.commit();mensaje('✅ Mesas y barra creadas en Firebase.');
 }catch(err){mensaje('No se pudieron crear las mesas: '+(err.code||err.message),true);}
 finally{bloquear(false);}
};
$('agregarMesa').onclick=async()=>{
 if(ocupado)return;
 const nombre=prompt('Nombre de la nueva mesa (ej.: Mesa 7):');
 if(nombre===null)return;
 const n=nombre.trim().slice(0,50);
 if(!n){mensaje('Escribe un nombre de mesa.',true);return;}
 if(mesas.some(m=>normalizar(m.nombre)===normalizar(n))){mensaje('Ya hay una mesa con ese nombre.',true);return;}
 const id=doc(collection(db,'mesas')).id;
 bloquear(true);
 try{
  const batch=writeBatch(db);
  batch.set(mesaRef(id),{nombre:n,tipo:'mesa',orden:mesas.length+1,activa:true,cuentaId:null,creadaEn:serverTimestamp()});
  await batch.commit();mensaje('✅ Mesa creada en Firebase.');
 }catch(err){mensaje('No se pudo crear la mesa: '+(err.code||err.message),true);}
 finally{bloquear(false);}
};
$('editarMesa').onclick=async()=>{
 const m=mesaActual();if(!m||ocupado)return;
 const nuevo=prompt('Cambiar el nombre de '+m.nombre,m.nombre);
 if(nuevo===null)return;const nombre=nuevo.trim().slice(0,50);
 if(!nombre||mesas.some(x=>x.id!==m.id&&normalizar(x.nombre)===normalizar(nombre))){
  mensaje('Nombre vacío o repetido.',true);return;
 }
 bloquear(true);
 try{
  await runTransaction(db,async tx=>{
   const ref=mesaRef(m.id),snap=await tx.get(ref);
   if(!snap.exists())throw Error('La mesa ya no existe.');
   if(snap.data().cuentaId)throw Error('No puedes renombrar una mesa ocupada.');
   tx.update(ref,{nombre});
  });mensaje('✅ Nombre actualizado.');
 }catch(err){mensaje('No se pudo editar: '+(err.code||err.message),true);}
 finally{bloquear(false);}
};
$('ocultarMesa').onclick=async()=>{
 const m=mesaActual();if(!m||ocupado)return;
 if(!confirm('¿Ocultar '+m.nombre+'?'))return;
 bloquear(true);
 try{
  await runTransaction(db,async tx=>{
    const ref=mesaRef(m.id),snap=await tx.get(ref);
    if(!snap.exists()||snap.data().cuentaId)throw Error('No puedes ocultar una mesa ocupada.');
    tx.update(ref,{activa:false});
  });mensaje('✅ Mesa oculta. Puedes reactivarla después.');
 }catch(err){mensaje('No se pudo ocultar: '+(err.code||err.message),true);}
 finally{bloquear(false);}
};
$('activarMesa').onclick=async()=>{
 const id=$('reactivarMesa').value;if(!id||ocupado)return;
 bloquear(true);
 try{
  await runTransaction(db,async tx=>{
   const ref=mesaRef(id),snap=await tx.get(ref);
   if(!snap.exists())throw Error('Mesa no encontrada.');
   tx.update(ref,{activa:true});
  });mensaje('✅ Mesa reactivada.');
 }catch(err){mensaje('No se pudo reactivar: '+(err.code||err.message),true);}
 finally{bloquear(false);}
};
// Un ID estable para cada intento de comanda. Si falla la conexión, no crear otro pedido
// hasta verificar el resultado en recepción o la cuenta abierta.
$('enviarComanda').onclick=async()=>{
 const m=mesaActual(),items=borrador.map(x=>({...x,sabores:[...x.sabores]}));
 if(!m||!items.length||ocupado)return;
 if(!confirm('¿Enviar esta comanda de '+m.nombre+' por '+pesos(totalBorrador())+' a recepción?'))return;
 const total=totalBorrador();
 intentoComanda ||= doc(collection(db,'pedidos')).id;
 const idPedido=intentoComanda;
 const nuevaCuentaId=m.cuentaId||doc(collection(db,'cuentasMesa')).id;
 bloquear(true);avisoMesa('Guardando comanda en Firebase...');
 try{
  await runTransaction(db,async tx=>{
   const mesaDoc=await tx.get(mesaRef(m.id));
   if(!mesaDoc.exists()||mesaDoc.data().activa===false)throw Error('Mesa no disponible.');
   const activa=mesaDoc.data().cuentaId||null;
   const idCuenta=activa||nuevaCuentaId;
   const refCuenta=cuentaRef(idCuenta);
   const docCuenta=activa?await tx.get(refCuenta):null;
   const pedidoYa=await tx.get(orderRef(idPedido));
   if(pedidoYa.exists())throw Error('Esta comanda ya fue registrada. Revisa recepción antes de intentar de nuevo.');
   if(activa&&(!docCuenta.exists()||docCuenta.data().estado!=='abierta'))throw Error('La cuenta cambió de estado.');
   const prev=docCuenta?.exists()?docCuenta.data():null;
   const n=(prev?.comandas?.length||0)+1;
   if(n>60)throw Error('Cuenta muy extensa. Cobra esta mesa antes de seguir agregando.');
   const fecha=new Date().toISOString();
   const nuevo={numero:n,fecha,pedidoId:idPedido,total,productos:items};
   const totalCuenta=(prev?.total||0)+total;
   if(!Number.isSafeInteger(totalCuenta)||totalCuenta>100000000)throw Error('Total fuera del rango permitido.');
   if(prev)tx.update(refCuenta,{total:totalCuenta,comandas:[...(prev.comandas||[]),nuevo],actualizadaEn:serverTimestamp()});
   else tx.set(refCuenta,{mesaId:m.id,mesaNombre:mesaDoc.data().nombre,estado:'abierta',
     aperturaEn:serverTimestamp(),total:totalCuenta,comandas:[nuevo],abiertaPor:user.uid});
   if(!activa)tx.update(mesaRef(m.id),{cuentaId:idCuenta});
   tx.set(orderRef(idPedido),{
    modalidad:'mesa',mesaId:m.id,mesaNombre:mesaDoc.data().nombre,cuentaMesaId:idCuenta,
    numeroComanda:n,cliente:{nombre:mesaDoc.data().nombre,telefono:''},
    municipio:'',direccion:'',observaciones:'',productos:items.map(p=>({
      producto:p.nombre,pizza:p.sabores.length?p.nombre:undefined,
      sabores:p.sabores,cantidad:p.cantidad,precioUnitario:p.precio,subtotal:p.precio*p.cantidad
    })).map(p=>Object.fromEntries(Object.entries(p).filter(([k,v])=>v!==undefined))),
    total,estado:'nuevo',creadoEn:serverTimestamp(),origen:'salon'
   });
  });
  borrador=[];intentoComanda=null;pintarTodo();
  avisoMesa('✅ Comanda enviada. La cuenta de la mesa continúa abierta.');
 }catch(err){
  avisoMesa('No se confirmó la comanda: '+(err.code||err.message)+'. Antes de reintentar, revisa si aparece en recepción.',true);
 }finally{bloquear(false);}
};
$('imprimirCuenta').onclick=()=>{
 const c=cuentaActual(),m=mesaActual();
 if(!c||!m)return;
 const impresora=window.ImpresionJuanca;
 if(!impresora){avisoMesa('No cargó el formato de impresión. Actualiza la página.',true);return;}
 impresora.abrirTicket(impresora.prepararCuentaMesa(m.nombre,c,{prueba:false}));
};
const modal=$('dialogCobrar');
$('abrirCobro').onclick=()=>{
 const c=cuentaActual();
 if(!c||ocupado||borrador.length)return;
 if(control?.estado!=='abierta'){avisoMesa('Primero abre caja. No puedes liberar la mesa sin registrar el cobro.',true);return;}
 $('montoCobro').textContent='Total por cobrar: '+pesos(c.total);
 $('metodoPago').value='efectivo';
 $('confirmaTransferencia').checked=false;
 $('errorCobro').textContent='';
 ajustarPago();modal.showModal();
};
$('cancelarCobro').onclick=()=>modal.close();
function ajustarPago(){
 const t=cuentaActual()?.total||0,m=$('metodoPago').value;
 $('efectivoPago').disabled=m==='transferencia';
 $('transferenciaPago').disabled=m==='efectivo';
 if(m==='efectivo'){$('efectivoPago').value=String(t);$('transferenciaPago').value='0';}
 else if(m==='transferencia'){$('efectivoPago').value='0';$('transferenciaPago').value=String(t);}
 else{$('efectivoPago').value='';$('transferenciaPago').value='';}
 $('verificarTransferencia').hidden=m==='efectivo';
 calcularPago();
}
function calcularPago(){
 const total=cuentaActual()?.total||0;
 const e=entero($('efectivoPago').value),t=entero($('transferenciaPago').value);
 $('sumaPago').textContent=e===null||t===null?'Completa los dos valores.':
   'Registrado: '+pesos(e+t)+' / '+pesos(total)+(e+t===total?' ✅':' · Diferencia: '+pesos(Math.abs(total-e-t)));
}
$('metodoPago').addEventListener('change',ajustarPago);
$('efectivoPago').addEventListener('input',calcularPago);
$('transferenciaPago').addEventListener('input',calcularPago);
$('confirmarCobro').onclick=async()=>{
 const c=cuentaActual(),m=mesaActual();
 if(!c||!m||ocupado)return;
 const metodo=$('metodoPago').value,efectivo=entero($('efectivoPago').value),transferencia=entero($('transferenciaPago').value);
 const total=entero(c.total,1);
 if(total===null||efectivo===null||transferencia===null||efectivo+transferencia!==total||
  (metodo==='efectivo'&&transferencia!==0)||
  (metodo==='transferencia'&&efectivo!==0)||
  (metodo==='mixto'&&(!efectivo||!transferencia))){
  $('errorCobro').textContent='Los valores deben sumar exactamente la cuenta y corresponder al método de pago.';return;
 }
 if(transferencia>0&&!$('confirmaTransferencia').checked){
  $('errorCobro').textContent='Primero comprueba en tu banco o Nequi que llegó la transferencia.';return;
 }
 if(!confirm('¿Cobrar '+pesos(total)+' y liberar '+m.nombre+'? Se registrará en caja automáticamente.'))return;
 const idCuenta=c.id;
 // ID estable por cuenta para prevenir duplicación; referencia compatible con caja manual.
 const movId='mesa__'+idCuenta;
 bloquear(true);$('confirmarCobro').disabled=true;
 $('errorCobro').textContent='Guardando cobro y liberando mesa en una sola transacción...';
 try{
  await runTransaction(db,async tx=>{
   const rm=mesaRef(m.id),rc=cuentaRef(idCuenta),rRef=refsCaja(idCuenta);
   const [sm,sc,scaja,sref,smov]=await Promise.all([
     tx.get(rm),tx.get(rc),tx.get(controlCaja),tx.get(rRef),tx.get(movimientosRef(movId))
   ]);
   if(!sm.exists()||sm.data().cuentaId!==idCuenta)throw Error('Esta mesa ya fue liberada o cambió de cuenta.');
   if(!sc.exists()||sc.data().estado!=='abierta')throw Error('Cuenta cerrada, no se puede volver a cobrar.');
   if(sc.data().total!==total)throw Error('El total cambió. Revisa la cuenta antes de cobrar.');
   if(sref.exists()||smov.exists())throw Error('Esta cuenta ya tiene un movimiento en caja. No se duplicó.');
   if(!scaja.exists()||scaja.data().estado!=='abierta')throw Error('No hay caja abierta. Abre caja antes de cobrar.');
   const turnoId=scaja.data().turnoId;
   const rt=turnosRef(turnoId),st=await tx.get(rt);
   if(!st.exists()||st.data().estado!=='abierta')throw Error('El turno de caja ya está cerrado.');
   const turno=st.data();
   const seguro=n=>Number.isSafeInteger(n)?n:0;
   tx.update(rt,{
    efectivoIngresos:seguro(turno.efectivoIngresos)+efectivo,
    transferenciaIngresos:seguro(turno.transferenciaIngresos)+transferencia,
    movimientosCount:seguro(turno.movimientosCount)+1
   });
   tx.set(movimientosRef(movId),{
    turnoId,categoria:'venta_mesa',tipo:'ingreso',metodo,total,efectivo,transferencia,
    concepto:'Cobro '+(m.nombre||'Mesa'),referencia:idCuenta.toUpperCase(),
    cuentaMesaId:idCuenta,mesaId:m.id,
    transferenciaVerificada:transferencia>0,creadoEn:serverTimestamp(),
    responsable:user.email||'Administrador',creadoPor:user.uid
   });
   tx.set(rRef,{turnoId,movimientoId:movId,categoria:'venta_mesa',
     referencia:idCuenta.toUpperCase(),cuentaMesaId:idCuenta,creadoEn:serverTimestamp()});
   tx.update(rc,{
    estado:'cobrada',cobroEn:serverTimestamp(),cobradoPor:user.uid,
    turnoId,movimientoCajaId:movId,
    pago:{metodo,total,efectivo,transferencia,transferenciaVerificada:transferencia>0}
   });
   tx.update(rm,{cuentaId:null});
  });
  modal.close();borrador=[];intentoCobro=null;
  mensaje('✅ Cobro guardado en caja y mesa liberada. Comprueba el resumen del turno.');
  elegirPantalla('mesas');
 }catch(err){
  $('errorCobro').textContent='No se completó el cobro: '+(err.code||err.message)+
   '. Si tu conexión falló, verifica la mesa y la caja antes de volver a cobrar.';
 }finally{bloquear(false);$('confirmarCobro').disabled=false;}
};
pintarTodo();elegirPantalla('mesas');
