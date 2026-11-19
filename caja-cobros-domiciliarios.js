// La Pizza de Juanca — integración prudente de cobros domiciliarios en caja.
// No contabilizar solo con el reporte del repartidor: se requiere entrega y conciliación del administrador.
// Cada movimiento se registra en una transacción Firestore con referencias anti-duplicado.
import {getApps,getApp,initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const config={
  apiKey:'AIzaSyA65sFJq3vf24a-1VbpYBHCgpEAk--exAA',
  authDomain:'pizzadejuank.firebaseapp.com',projectId:'pizzadejuank',
  storageBucket:'pizzadejuank.firebasestorage.app',
  messagingSenderId:'856650093973',
  appId:'1:856650093973:web:a4cd3ad8e863617706d29c'
};
const app=getApps().length?getApp():initializeApp(config);
const auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const pesos=n=>'$'+Number(n||0).toLocaleString('es-CO',{maximumFractionDigits:0});
const valido=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000000;
const txt=(parent,value,clase='')=>{
  const el=document.createElement('p');el.textContent=value;
  if(clase)el.className=clase;parent.append(el);return el;
};
const fecha=x=>{
  const f=x?.toDate?.()||(typeof x?.seconds==='number'?new Date(x.seconds*1000):null);
  return f&&Number.isFinite(f.getTime())?f.toLocaleString('es-CO',{timeZone:'America/Bogota',dateStyle:'short',timeStyle:'short'}):'Fecha sin confirmar';
};
const numFecha=x=>x?.seconds||(x?.toDate?.().getTime()||0)/1000;

let pedidos=[],control=null,controlEnServidor=false,pedidosEnServidor=false,usuario=null;
let errorLecturaCobros='',errorLecturaControl='',errorRegistro='';
let detenerControl=()=>{},detenerPedidos=()=>{},guardandoId='';
function actualizarEstado(mensaje,error=false){
  $('estadoCobrosDomi').textContent=mensaje;
  $('estadoCobrosDomi').className=error?'estado error':'estado';
}
function limpiar(){
  detenerPedidos();detenerControl();detenerPedidos=()=>{};detenerControl=()=>{};
  pedidos=[];control=null;controlEnServidor=false;pedidosEnServidor=false;guardandoId='';
  errorLecturaCobros='';errorLecturaControl='';errorRegistro='';
  $('listaCobrosDomi').replaceChildren();
  for(const id of ['domiEfectivoReportado','domiTransferenciaReportada','domiEfectivoListo','domiTransferenciaLista']){
    $(id).textContent='—';
  }
}
function integridad(d){
  const r=d.cobroReportado;
  if(!r||typeof r!=='object')return null;
  const e=r.efectivo,t=r.transferencia,total=r.total;
  if(!valido(e)||!valido(t)||!valido(total)||total<=0||e+t!==total||
    !['efectivo','transferencia','mixto'].includes(r.metodo)||
    (r.metodo==='efectivo'&&t!==0)||
    (r.metodo==='transferencia'&&e!==0)||
    (r.metodo==='mixto'&&(!e||!t)))return null;
  return {efectivo:e,transferencia:t,total,metodo:r.metodo};
}
function sePuedeRegistrar(p){
  return p.d.estadoEntrega==='entregado'&&p.d.cobroVerificado===true&&!p.d.cajaMovimientoId&&!!integridad(p.d);
}
function dibujar(){
  if(!usuario)return;
  const lista=$('listaCobrosDomi');lista.replaceChildren();
  if(errorLecturaCobros||errorLecturaControl){
    actualizarEstado(errorLecturaCobros||errorLecturaControl,true);
    return;
  }
  if(!pedidosEnServidor){
    actualizarEstado('Esperando lectura de cobros confirmada por Firebase. No se permiten registros todavía.');
    return;
  }
  const reportados=pedidos.filter(p=>p.d.cobroReportado && p.d.domiciliarioUid);
  const sinCaja=reportados.filter(p=>!p.d.cajaMovimientoId);
  const listos=sinCaja.filter(p=>sePuedeRegistrar(p));
  $('domiEfectivoReportado').textContent=pesos(sinCaja.reduce((s,p)=>s+(integridad(p.d)?.efectivo||0),0));
  $('domiTransferenciaReportada').textContent=pesos(sinCaja.reduce((s,p)=>s+(integridad(p.d)?.transferencia||0),0));
  $('domiEfectivoListo').textContent=pesos(listos.reduce((s,p)=>s+integridad(p.d).efectivo,0));
  $('domiTransferenciaLista').textContent=pesos(listos.reduce((s,p)=>s+integridad(p.d).transferencia,0));
  const cajaAbierta=controlEnServidor && control?.estado==='abierta';
  const pendientes=reportados.filter(p=>!p.d.cajaMovimientoId);
  const anotados=reportados.filter(p=>p.d.cajaMovimientoId);
  const ordenados=[...pendientes.sort((a,b)=>numFecha(b.d.cobroReportadoEn)-numFecha(a.d.cobroReportadoEn)),
    ...anotados.sort((a,b)=>numFecha(b.d.cajaRegistradoEn)-numFecha(a.d.cajaRegistradoEn)).slice(0,12)];
  actualizarEstado(errorRegistro || (cajaAbierta
    ? '✅ Cobros sincronizados. Solo los pagos conciliados pueden ingresar al turno abierto.'
    : 'ℹ️ Los cobros se pueden revisar, pero no registrar hasta que exista una caja abierta.'),!!errorRegistro);
  if(!ordenados.length){txt(lista,'Aún no hay cobros de domiciliarios reportados.');return;}
  for(const p of ordenados){
    const d=p.d,r=integridad(d);
    const div=document.createElement('div');div.className='registro';
    txt(div,'🛵 '+String(d.domiciliarioNombre||'Domiciliario')+' · Pedido '+p.id.slice(0,8).toUpperCase(),'fuerte');
    txt(div,r?'Efectivo: '+pesos(r.efectivo)+' · Transferencia: '+pesos(r.transferencia)+' · Total: '+pesos(r.total)
      :'⚠️ Este reporte tiene importes inválidos y requiere revisión.');
    txt(div,fecha(d.cobroReportadoEn),'pequeno');
    if(d.cajaMovimientoId){
      txt(div,'✅ Registrado en caja · Movimiento '+String(d.cajaMovimientoId).slice(0,12),'pequeno');
    }else if(d.estadoEntrega!=='entregado'){
      txt(div,'⏳ Pago informado; espera a confirmar la entrega. No figura como ingreso de caja.','pequeno');
    }else if(d.cobroVerificado!==true){
      txt(div,'⏳ Falta conciliación por administración. Verifica banco y efectivo en el panel de pedidos.','pequeno');
    }else if(!r){
      txt(div,'⚠️ No registrable: los importes del cobro no coinciden.','pequeno');
    }else{
      const boton=document.createElement('button');
      boton.type='button';boton.textContent=guardandoId===p.id?'Registrando…':'💾 Registrar cobro en caja';
      boton.disabled=!cajaAbierta||!!guardandoId;
      const mensaje=txt(div,'','estado');div.append(boton);
      boton.addEventListener('click',()=>registrarCobro(p.id,mensaje));
    }
    lista.append(div);
  }
}
async function registrarCobro(pedidoId,mensaje){
  if(!usuario||!controlEnServidor||!pedidosEnServidor||control?.estado!=='abierta'||guardandoId)return;
  if(!window.confirm('¿Registrar el efectivo y la transferencia de este pedido conciliado en el turno abierto? Se registrará una sola vez.'))return;
  errorRegistro='';
  guardandoId=pedidoId;dibujar();
  try{
    const movId='domicilio__'+pedidoId;
    const movRef=doc(db,'movimientosCaja',movId);
    const pedidoRef=doc(db,'pedidos',pedidoId);
    const controlRef=doc(db,'cajaControl','actual');
    const refCompleta=doc(db,'referenciasCaja','venta__'+pedidoId.toUpperCase());
    const refCorta=doc(db,'referenciasCaja','venta__'+pedidoId.slice(0,8).toUpperCase());
    await runTransaction(db,async tx=>{
      const [sControl,sPedido,sMov,sCompleta,sCorta]=await Promise.all([
        tx.get(controlRef),tx.get(pedidoRef),tx.get(movRef),tx.get(refCompleta),tx.get(refCorta)
      ]);
      if(!sControl.exists()||sControl.data().estado!=='abierta')throw Error('No existe un turno abierto.');
      if(!sPedido.exists())throw Error('El pedido no existe.');
      const d=sPedido.data(),r=integridad(d);
      if(d.estadoEntrega!=='entregado'||d.cobroVerificado!==true||!r||!d.domiciliarioUid)throw Error('La entrega o el cobro todavía no están conciliados.');
      if(d.cajaMovimientoId||sMov.exists()||sCompleta.exists()||sCorta.exists())throw Error('Este pedido ya figura registrado o su referencia ya se utilizó. Revisa movimientos antes de reintentar.');
      const turnoId=sControl.data().turnoId,turnoRef=doc(db,'cajaTurnos',turnoId);
      const sTurno=await tx.get(turnoRef);
      if(!sTurno.exists()||sTurno.data().estado!=='abierta')throw Error('El turno cambió o se cerró.');
      const turno=sTurno.data();
      const eAntes=Number(turno.efectivoIngresos||0),tAntes=Number(turno.transferenciaIngresos||0),nAntes=Number(turno.movimientosCount||0);
      if(!valido(eAntes)||!valido(tAntes)||!Number.isSafeInteger(nAntes)||nAntes<0)throw Error('El resumen del turno tiene cifras inválidas.');
      const nombre=String(d.domiciliarioNombre||'Domiciliario').slice(0,70);
      tx.update(turnoRef,{
        efectivoIngresos:eAntes+r.efectivo,
        transferenciaIngresos:tAntes+r.transferencia,
        movimientosCount:nAntes+1
      });
      tx.set(movRef,{
        turnoId,categoria:'venta_domicilio',tipo:'ingreso',metodo:r.metodo,
        total:r.total,efectivo:r.efectivo,transferencia:r.transferencia,
        concepto:'Domicilio '+pedidoId.slice(0,8).toUpperCase()+' · '+nombre,
        referencia:pedidoId.toUpperCase(),pedidoId,domiciliarioUid:d.domiciliarioUid,
        domiciliarioNombre:nombre,origen:'cobro_domiciliario',
        transferenciaVerificada:r.transferencia>0,
        creadoEn:serverTimestamp(),responsable:usuario.email||'Administrador',creadoPor:usuario.uid
      });
      tx.set(refCompleta,{turnoId,movimientoId:movId,categoria:'venta_domicilio',referencia:pedidoId.toUpperCase(),creadoEn:serverTimestamp()});
      tx.set(refCorta,{turnoId,movimientoId:movId,categoria:'venta_domicilio',referencia:pedidoId.slice(0,8).toUpperCase(),creadoEn:serverTimestamp()});
      tx.update(pedidoRef,{cajaMovimientoId:movId,cajaTurnoId:turnoId,cajaRegistradoEn:serverTimestamp()});
    });
    errorRegistro='';
  }catch(error){
    errorRegistro='No se pudo registrar el cobro: '+(error.message||error.code||'Error de Firebase')+'. Comprueba las reglas de Firebase y consulta movimientos antes de reintentar.';
  }finally{guardandoId='';dibujar();}
}
onAuthStateChanged(auth,user=>{
  limpiar();usuario=user;
  if(!user){actualizarEstado('Inicia sesión como administrador para consultar cobros.');return;}
  actualizarEstado('Cargando cobros de domiciliarios en Firebase...');
  detenerControl=onSnapshot(doc(db,'cajaControl','actual'),{includeMetadataChanges:true},snap=>{
    control=snap.exists()?snap.data():null;
    controlEnServidor=!snap.metadata.fromCache;errorLecturaControl='';dibujar();
  },err=>{
    controlEnServidor=false;errorLecturaControl='No se pudo consultar el estado de caja: '+(err.code||'sin acceso');dibujar();
  });
  detenerPedidos=onSnapshot(collection(db,'pedidos'),{includeMetadataChanges:true},snap=>{
    pedidos=snap.docs.map(d=>({id:d.id,d:d.data()}));
    pedidosEnServidor=!snap.metadata.fromCache;errorLecturaCobros='';dibujar();
  },err=>{
    pedidosEnServidor=false;errorLecturaCobros='Firebase no permite consultar los pedidos: '+(err.code||'sin acceso')+'. Comprueba permisos de administrador.';dibujar();
  });
});
