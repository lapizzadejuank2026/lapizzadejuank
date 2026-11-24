// Historial por dia de turno: SOLO lectura de Firestore. No modifica caja ni pedidos.
import {getApps,getApp,initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,collection,onSnapshot,query,where,getDocs} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const config={
  apiKey:'AIzaSyA65sFJq3vf24a-1VbpYBHCgpEAk--exAA',
  authDomain:'pizzadejuank.firebaseapp.com',projectId:'pizzadejuank',
  storageBucket:'pizzadejuank.firebasestorage.app',
  messagingSenderId:'856650093973',
  appId:'1:856650093973:web:a4cd3ad8e863617706d29c'
};
const app=getApps().length?getApp():initializeApp(config);
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const fechaSelector=$('fechaHistorial');
const panel=$('seccionHistorialDia');
const estado=$('estadoHistorialDia');
const resumen=$('resumenHistorialDia');
const detalle=$('movimientosHistorialDia');
const pesos=n=>'$'+Number(n||0).toLocaleString('es-CO',{maximumFractionDigits:0});
const entero=n=>Number.isSafeInteger(Number(n))?Number(n):0;
const fechaJS=v=>{
  const d=v?.toDate?.()||(typeof v?.seconds==='number'?new Date(v.seconds*1000):new Date(v));
  return d instanceof Date&&!Number.isNaN(d.getTime())?d:null;
};
const claveDia=v=>{
  const d=fechaJS(v);if(!d)return '';
  const partes=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const val=t=>partes.find(p=>p.type===t)?.value;
  return [val('year'),val('month'),val('day')].join('-');
};
const textoFecha=v=>{
  const d=fechaJS(v);
  return d?d.toLocaleString('es-CO',{timeZone:'America/Bogota',dateStyle:'medium',timeStyle:'short'}):'Fecha no disponible';
};
const nombreDia=clave=>new Date(clave+'T12:00:00Z').toLocaleDateString('es-CO',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});
function p(parent,s,clase=''){
  const el=document.createElement('p');el.textContent=s;if(clase)el.className=clase;parent.append(el);return el;
}
function metrica(parent,nombre,valor){
  const div=document.createElement('div');div.className='metrica';
  const fuerte=document.createElement('strong');fuerte.textContent=pesos(valor);
  const etiqueta=document.createElement('span');etiqueta.textContent=nombre;
  div.append(fuerte,etiqueta);parent.append(div);
}
const categoriaNombre={
  venta_mesa:'Mesa',venta_domicilio:'Domicilio',venta_llevar:'Para llevar',
  otro_ingreso:'Otro ingreso',gasto:'Gasto / compra',pago_personal:'Pago a personal',
  retiro:'Retiro / salida'
};
let turnos=[],detener=()=>{},usuario=null,version=0;
function diasCerrados(){
  const grupos=new Map();
  for(const t of turnos){
    if(t.estado!=='cerrada')continue;
    // Fecha de apertura = fecha de la jornada, aun si se cierra despues de medianoche.
    const dia=claveDia(t.aperturaEn||t.cierreEn);if(!dia)continue;
    if(!grupos.has(dia))grupos.set(dia,[]);
    grupos.get(dia).push(t);
  }
  return grupos;
}
function actualizarFechas(){
  const anterior=fechaSelector.value,grupos=diasCerrados();
  const dias=[...grupos.keys()].sort().reverse();
  fechaSelector.replaceChildren();
  if(!dias.length){
    fechaSelector.append(new Option('Aún no hay turnos cerrados',''));
    fechaSelector.disabled=true;
  }else{
    fechaSelector.disabled=false;
    for(const dia of dias)fechaSelector.append(new Option(nombreDia(dia),dia));
    fechaSelector.value=dias.includes(anterior)?anterior:dias[0];
  }
  if(panel.open)mostrarDia();
}
async function mostrarDia(){
  const token=++version;
  resumen.replaceChildren();detalle.replaceChildren();
  if(!usuario){estado.textContent='Inicia sesión como administrador para consultar el historial.';return;}
  const dia=fechaSelector.value;
  const cierres=diasCerrados().get(dia)||[];
  if(!cierres.length){estado.textContent='Todavía no hay turnos cerrados para esta fecha.';return;}
  estado.textContent='Consultando los movimientos guardados en Firebase para '+nombreDia(dia)+'...';
  try{
    const resultados=await Promise.all(cierres.map(t=>
      getDocs(query(collection(db,'movimientosCaja'),where('turnoId','==',t.id)))
    ));
    if(token!==version||!panel.open||!usuario)return;
    const movimientos=resultados.flatMap(x=>x.docs.map(d=>({id:d.id,...d.data()})));
    const numeroEsperado=cierres.reduce((s,t)=>s+entero(t.movimientosCount),0);
    const incompleto=resultados.some(x=>x.metadata.fromCache)||movimientos.length!==numeroEsperado;
    const ventas=movimientos.filter(m=>['venta_mesa','venta_domicilio','venta_llevar'].includes(m.categoria)&&m.tipo==='ingreso');
    const sumar=(arr,clave)=>arr.reduce((s,m)=>s+entero(m[clave]),0);
    const total=m=>Number.isSafeInteger(Number(m.total))?Number(m.total):entero(m.efectivo)+entero(m.transferencia);
    const totalizar=arr=>arr.reduce((s,m)=>s+total(m),0);
    const salidas=movimientos.filter(m=>m.tipo==='egreso');
    const otros=movimientos.filter(m=>m.tipo==='ingreso'&&!['venta_mesa','venta_domicilio','venta_llevar'].includes(m.categoria));
    estado.textContent=incompleto
      ? '⚠️ Hay movimientos sin sincronizar o la cantidad no coincide con los cierres. Revisa la conexión antes de confiar en estos totales.'
      : '✅ Historial consultado en Firebase · '+cierres.length+' turno(s) cerrado(s) · '+movimientos.length+' movimiento(s).';
    const titulo=document.createElement('h3');titulo.textContent='Ventas registradas · '+nombreDia(dia);resumen.append(titulo);
    const grid=document.createElement('div');grid.className='metricaGrid';
    metrica(grid,'Total ventas cobradas',totalizar(ventas));
    metrica(grid,'Mesas',totalizar(ventas.filter(m=>m.categoria==='venta_mesa')));
    metrica(grid,'Domicilios',totalizar(ventas.filter(m=>m.categoria==='venta_domicilio')));
    metrica(grid,'Para llevar',totalizar(ventas.filter(m=>m.categoria==='venta_llevar')));
    metrica(grid,'Efectivo de ventas',sumar(ventas,'efectivo'));
    metrica(grid,'Transferencias de ventas',sumar(ventas,'transferencia'));
    metrica(grid,'Otros ingresos',totalizar(otros));
    metrica(grid,'Salidas y gastos',totalizar(salidas));
    resumen.append(grid);
    p(resumen,'Los valores corresponden a cobros registrados en Caja, no a pedidos pendientes. La base inicial no cuenta como venta.','pequeno');
    const h=document.createElement('h3');h.textContent='Cierres de ese día';resumen.append(h);
    for(const t of cierres){
      const div=document.createElement('div');div.className='registro';
      p(div,'Turno de '+String(t.responsable||'Responsable')+' · Abierto '+textoFecha(t.aperturaEn),'fuerte');
      p(div,'Cerrado '+textoFecha(t.cierreEn)+' · Base '+pesos(entero(t.baseEfectivo)));
      p(div,'Efectivo esperado '+pesos(entero(t.efectivoEsperado))+' · Contado '+pesos(entero(t.efectivoContado))+' · Diferencia '+pesos(entero(t.diferencia)));
      resumen.append(div);
    }
    const lista=document.createElement('details');lista.className='detallesInternos';
    const sum=document.createElement('summary');sum.textContent='📒 Ver movimientos de '+nombreDia(dia)+' ('+movimientos.length+')';lista.append(sum);
    if(!movimientos.length)p(lista,'No hay movimientos registrados para estos cierres.');
    const ordenados=movimientos.sort((a,b)=>(fechaJS(b.creadoEn)?.getTime()||0)-(fechaJS(a.creadoEn)?.getTime()||0));
    for(const m of ordenados){
      const div=document.createElement('div');div.className='registro';
      p(div,(m.tipo==='egreso'?'➖ ':'➕ ')+(categoriaNombre[m.categoria]||String(m.categoria||'Movimiento'))+' · '+pesos(total(m)),'fuerte');
      p(div,'Efectivo '+pesos(entero(m.efectivo))+' · Transferencia '+pesos(entero(m.transferencia)));
      p(div,textoFecha(m.creadoEn)+' · '+String(m.concepto||'')+(m.referencia?' · Ref. '+m.referencia:''));
      lista.append(div);
    }
    detalle.append(lista);
  }catch(e){
    if(token!==version)return;
    estado.textContent='No se pudo consultar el historial de movimientos: '+(e.code||e.message||'sin acceso')+'. Los turnos guardados no se modificaron.';
  }
}
panel.addEventListener('toggle',()=>{
  if(panel.open)mostrarDia();
  else version++;
});
fechaSelector.addEventListener('change',()=>{if(panel.open)mostrarDia();});
onAuthStateChanged(auth,user=>{
  version++;detener();detener=()=>{};turnos=[];usuario=user;
  fechaSelector.replaceChildren(new Option(user?'Cargando fechas...':'Inicia sesión',''));
  fechaSelector.disabled=true;
  resumen.replaceChildren();detalle.replaceChildren();
  if(!user){estado.textContent='Inicia sesión para revisar días anteriores.';return;}
  estado.textContent='Cargando días disponibles...';
  detener=onSnapshot(collection(db,'cajaTurnos'),snap=>{
    turnos=snap.docs.map(d=>({id:d.id,...d.data()}));
    actualizarFechas();
  },error=>{estado.textContent='No fue posible consultar los cierres: '+(error.code||'sin permiso');});
});
