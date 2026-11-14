// La Pizza de Juanca — Caja con Firestore (pendiente de validar reglas de producción).
import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,runTransaction,serverTimestamp,query,where} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const app=initializeApp({
  apiKey:'AIzaSyA65sFJq3vf24a-1VbpYBHCgpEAk--exAA',
  authDomain:'pizzadejuank.firebaseapp.com',projectId:'pizzadejuank',
  storageBucket:'pizzadejuank.firebasestorage.app',
  messagingSenderId:'856650093973',
  appId:'1:856650093973:web:a4cd3ad8e863617706d29c'
});
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const ctrlRef=doc(db,'cajaControl','actual');
const opciones={
 venta_mesa:{label:'Venta de mesa',tipo:'ingreso',ref:true},
 venta_domicilio:{label:'Venta a domicilio',tipo:'ingreso',ref:true},
 venta_llevar:{label:'Venta para llevar',tipo:'ingreso',ref:true},
 otro_ingreso:{label:'Otro ingreso',tipo:'ingreso',ref:false},
 gasto:{label:'Gasto / compra',tipo:'egreso',ref:false},
 pago_personal:{label:'Pago a personal',tipo:'egreso',ref:false},
 retiro:{label:'Retiro de efectivo / banco',tipo:'egreso',ref:false}
};
const pesos=n=>'$'+Number(n||0).toLocaleString('es-CO',{maximumFractionDigits:0});
const entero=(value,min=0)=>value!==''&&value!=null&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=100000000?Number(value):null;
const saldoBase=t=>entero(t?.baseEfectivo)??0;
const enteroRegistro=v=>Number.isSafeInteger(Number(v))?Number(v):0;
const totales=['efectivoIngresos','efectivoEgresos','transferenciaIngresos','transferenciaEgresos'];
const efectivoEsperado=t=>saldoBase(t)+enteroRegistro(t?.efectivoIngresos)-enteroRegistro(t?.efectivoEgresos);
const fecha=timestamp=>{
  if(!timestamp)return 'Sin fecha';
  const d=timestamp.toDate?timestamp.toDate():
    typeof timestamp.seconds==='number'?new Date(timestamp.seconds*1000):new Date(timestamp);
  return isNaN(d.getTime())?'Sin fecha':d.toLocaleString('es-CO',{timeZone:'America/Bogota',dateStyle:'short',timeStyle:'short'});
};
const fechaOrden=v=>v?.seconds??(v?.toDate?.().getTime()||0)/1000;
const texto=(padre,valor,clase)=>{
  const p=document.createElement('p');
  p.textContent=valor;if(clase)p.className=clase;padre.append(p);return p;
};
let turno=null,control=null,turnos=[],movimientos=[],servidor=false,usuario=null;
let detenerControl=()=>{},detenerTurnos=()=>{},detenerMovimientos=()=>{};
let cargando=false,turnoEscuchado='',ultimoError='';
function aviso(mensaje,error=false){
  const el=$('conexion');el.textContent=mensaje;
  el.className=error?'estado error':'estado';
}
function guardarDeshabilitado(des){
  $('abrirCajaBoton').disabled=des;
  $('guardarMovimiento').disabled=des;
  $('cerrarCajaBoton').disabled=des;
}
function validarOnline(){
  if(!usuario)throw Error('Inicia sesión como administrador.');
  if(!servidor)throw Error('Esperando confirmación del servidor. Revisa Internet o los permisos de Firebase.');
}
function limpiarSubs(){
  detenerControl();detenerTurnos();detenerMovimientos();
  detenerControl=()=>{};detenerTurnos=()=>{};detenerMovimientos=()=>{};
  servidor=false;control=null;turno=null;turnos=[];movimientos=[];turnoEscuchado='';
}
function pintarResumen(){
  const ocupada=control?.estado==='abierta';
  const abierta=ocupada&&turno?.estado==='abierta'&&control.turnoId===turno.id;
  $('seccionApertura').hidden=ocupada;
  $('seccionTurno').hidden=!abierta;
  $('seccionMovimiento').hidden=!abierta;
  $('seccionArqueo').hidden=!abierta;
  $('seccionLista').hidden=!abierta;
  const puede=abierta&&servidor&&!cargando;
  $('abrirCajaBoton').disabled=!usuario||!servidor||ocupada||cargando;
  $('guardarMovimiento').disabled=!puede;
  $('cerrarCajaBoton').disabled=!puede;
  if(!abierta){$('controlActivo').textContent=ocupada
    ? '⏳ Cargando el turno abierto...'
    : 'No hay una caja abierta.';pintarHistorial();return;}
  $('controlActivo').textContent='Turno abierto · '+(turno.responsable||'Responsable')+' · '+fecha(turno.aperturaEn)+' · Base: '+pesos(saldoBase(turno));
  $('resumenEfectivo').textContent=pesos(efectivoEsperado(turno));
  $('resumenEfectivoEntradas').textContent=pesos(enteroRegistro(turno.efectivoIngresos));
  $('resumenTransferencias').textContent=pesos(enteroRegistro(turno.transferenciaIngresos)-enteroRegistro(turno.transferenciaEgresos));
  $('resumenSalidas').textContent=pesos(enteroRegistro(turno.efectivoEgresos)+enteroRegistro(turno.transferenciaEgresos));
  $('resumenMovimientos').textContent=String(enteroRegistro(turno.movimientosCount));
  calcularArqueo();pintarMovimientos();pintarHistorial();
}
function pintarHistorial(){
  const cont=$('historialTurnos');cont.replaceChildren();
  const cerrados=turnos.filter(x=>x.estado==='cerrada').sort((a,b)=>fechaOrden(b.cierreEn)-fechaOrden(a.cierreEn)).slice(0,15);
  if(!cerrados.length){texto(cont,'No hay cierres de caja todavía.');return;}
  for(const t of cerrados){
    const div=document.createElement('div');div.className='registro';
    texto(div,'🔒 '+fecha(t.cierreEn)+' · '+String(t.responsable||'Responsable'),'fuerte');
    texto(div,'Base: '+pesos(t.baseEfectivo)+' · Efectivo esperado: '+pesos(t.efectivoEsperado));
    texto(div,'Contado: '+pesos(t.efectivoContado)+' · Diferencia: '+pesos(t.diferencia));
    texto(div,'Movimientos: '+enteroRegistro(t.movimientosCount)+' · ID: '+t.id.slice(0,8).toUpperCase(),'pequeno');
    cont.append(div);
  }
}
function pintarMovimientos(){
  const cont=$('listaMovimientos');cont.replaceChildren();
  if(!movimientos.length){texto(cont,'Aún no hay movimientos registrados en este turno.');return;}
  const lista=[...movimientos].sort((a,b)=>fechaOrden(b.creadoEn)-fechaOrden(a.creadoEn));
  for(const m of lista){
    const div=document.createElement('div');div.className='registro';
    const n=opciones[m.categoria]||{};
    texto(div,(m.tipo==='ingreso'?'➕ ':'➖ ')+(n.label||m.categoria||'Movimiento')+' · '+pesos(m.total),'fuerte');
    texto(div,'Efectivo: '+pesos(m.efectivo||0)+' · Transferencia: '+pesos(m.transferencia||0));
    texto(div,(m.concepto||'')+(m.referencia?' · Ref: '+m.referencia:''));
    texto(div,fecha(m.creadoEn)+' · '+String(m.responsable||''),'pequeno');
    cont.append(div);
  }
}
function escucharMovimientos(turnoId){
  detenerMovimientos();movimientos=[];
  turnoEscuchado=turnoId||'';
  if(!turnoId){pintarMovimientos();return;}
  detenerMovimientos=onSnapshot(query(collection(db,'movimientosCaja'),where('turnoId','==',turnoId)),
    snap=>{
      if(turnoEscuchado!==turnoId)return;
      movimientos=snap.docs.map(x=>({id:x.id,...x.data()}));
      pintarMovimientos();
    },error=>{
      $('estadoMovimientos').textContent='No se pueden consultar movimientos: '+(error.code||'sin acceso')+'. Revisa reglas.';
    });
}
function escucharTodo(){
  detenerControl=onSnapshot(ctrlRef,{includeMetadataChanges:true},snap=>{
    servidor=!snap.metadata.fromCache;
    control=snap.exists()?snap.data():null;
    ultimoError='';
    turno=(control?.estado==='abierta'
      ?turnos.find(t=>t.id===control.turnoId):null)||null;
    const id=control?.estado==='abierta'?control.turnoId:'';
    if(id!==turnoEscuchado)escucharMovimientos(id);
    aviso(servidor?'✅ Conectado a Firebase. Acceso a caja sujeto a permisos del administrador.':'⏳ Esperando confirmación de Firebase; no se permiten movimientos sin conexión.');
    pintarResumen();
  },error=>{
    servidor=false;aviso('🔒 Firebase no permite leer caja ('+(error.code||'error')+'). Hay que publicar las reglas exclusivas del administrador.',true);pintarResumen();
  });
  detenerTurnos=onSnapshot(collection(db,'cajaTurnos'),snap=>{
    turnos=snap.docs.map(d=>({id:d.id,...d.data()}));
    turno=(control?.estado==='abierta'?turnos.find(t=>t.id===control.turnoId):null)||null;
    pintarResumen();
  },error=>{
    servidor=false;aviso('🔒 Sin permisos para consultar turnos de caja ('+(error.code||'error')+').',true);pintarResumen();
  });
}
$('accesoCaja').addEventListener('submit',async e=>{
  e.preventDefault();const b=$('entrarCaja');b.disabled=true;
  $('errorAcceso').textContent='Verificando acceso...';
  try{
    await signInWithEmailAndPassword(auth,$('correoCaja').value.trim(),$('claveCaja').value);
    $('claveCaja').value='';$('errorAcceso').textContent='';
  }catch(error){$('errorAcceso').textContent='No se pudo ingresar. Código: '+(error.code||'error');}
  finally{b.disabled=false;}
});
$('salirCaja').addEventListener('click',()=>signOut(auth));
onAuthStateChanged(auth,user=>{
  limpiarSubs();usuario=user;
  $('vistaAcceso').hidden=!!user;$('vistaCaja').hidden=!user;
  if(!user){aviso('Inicia sesión para consultar los turnos.');return;}
  $('usuarioCaja').textContent=user.email||'Administrador';
  aviso('Conectando con Firebase...');escucharTodo();
});
const refTurno=id=>doc(db,'cajaTurnos',id);
$('formApertura').addEventListener('submit',async e=>{
  e.preventDefault();
  const base=entero($('baseCaja').value),responsable=$('responsableCaja').value.trim();
  if(base===null||!responsable){$('estadoApertura').textContent='Indica base de efectivo y nombre del responsable.';return;}
  if(!confirm('¿Abrir caja con base '+pesos(base)+'? Verifica que no exista otro turno abierto.'))return;
  const b=$('abrirCajaBoton');b.disabled=true;cargando=true;
  $('estadoApertura').textContent='Abriendo caja...';
  const turnoId=doc(collection(db,'cajaTurnos')).id;
  try{
    validarOnline();
    await runTransaction(db,async tx=>{
      const previo=await tx.get(ctrlRef);
      if(previo.exists()&&previo.data().estado==='abierta')throw Error('Ya existe una caja abierta.');
      tx.set(refTurno(turnoId),{
        responsable,baseEfectivo:base,estado:'abierta',aperturaEn:serverTimestamp(),
        aperturaUid:auth.currentUser.uid,notaApertura:$('notaApertura').value.trim(),
        efectivoIngresos:0,efectivoEgresos:0,transferenciaIngresos:0,transferenciaEgresos:0,
        movimientosCount:0
      });
      tx.set(ctrlRef,{estado:'abierta',turnoId,abiertoPor:auth.currentUser.uid,actualizadoEn:serverTimestamp()});
    });
    $('estadoApertura').textContent='✅ Caja abierta en Firebase.';
    $('baseCaja').value='';$('notaApertura').value='';
  }catch(error){$('estadoApertura').textContent='No se abrió la caja: '+(error.message||error.code);}
  finally{cargando=false;pintarResumen();}
});
function ajustarMovimiento(){
  const cfg=opciones[$('categoriaCaja').value];if(!cfg)return;
  $('tipoDescripcion').textContent=cfg.tipo==='ingreso'?'El dinero entra al negocio.':'El dinero sale del negocio.';
  $('referenciaCaja').required=cfg.ref;
  $('notaReferencia').textContent=cfg.ref
    ? 'Escribe el número del pedido o cuenta. La caja rechazará esa misma referencia si ya fue cobrada.'
    : 'Opcional. Para movimientos manuales, registra un concepto claro.';
  $('labelReferencia').hidden=false;
  configurarMetodo();
}
function configurarMetodo(){
  const metodo=$('metodoCaja').value;
  const total=entero($('montoCaja').value,1);
  $('efectivoCaja').disabled=metodo==='transferencia';
  $('transferenciaCaja').disabled=metodo==='efectivo';
  if(metodo==='efectivo'){$('efectivoCaja').value=total===null?'':String(total);$('transferenciaCaja').value='0';}
  else if(metodo==='transferencia'){$('efectivoCaja').value='0';$('transferenciaCaja').value=total===null?'':String(total);}
  else{$('efectivoCaja').value='';$('transferenciaCaja').value='';}
  $('verificarTransferenciaCaja').hidden=metodo==='efectivo'||opciones[$('categoriaCaja').value]?.tipo!=='ingreso';
  if($('verificarTransferenciaCaja').hidden)$('confirmoTransferenciaCaja').checked=false;
  revisarSuma();
}
function revisarSuma(){
  const total=entero($('montoCaja').value,1);
  const e=entero($('efectivoCaja').value),t=entero($('transferenciaCaja').value);
  if(total===null||e===null||t===null){$('sumaCaja').textContent='Completa los importes.';return;}
  $('sumaCaja').textContent='Efectivo + transferencia = '+pesos(e+t)+' / '+pesos(total)+(e+t===total?' ✅':' · Diferencia: '+pesos(Math.abs(total-e-t)));
}
$('categoriaCaja').addEventListener('change',ajustarMovimiento);
$('metodoCaja').addEventListener('change',configurarMetodo);
$('montoCaja').addEventListener('input',()=>{
  if($('metodoCaja').value==='mixto')revisarSuma();else configurarMetodo();
});
$('efectivoCaja').addEventListener('input',revisarSuma);
$('transferenciaCaja').addEventListener('input',revisarSuma);
ajustarMovimiento();
// Una clave local de intento: evita duplicados por reintentar el mismo envío tras un fallo de red.
let intentoMovimiento=null;
$('formMovimientoCaja').addEventListener('input',()=>{intentoMovimiento=null;});
$('formMovimientoCaja').addEventListener('submit',async e=>{
  e.preventDefault();
  const categoria=$('categoriaCaja').value,cfg=opciones[categoria];
  const metodo=$('metodoCaja').value,total=entero($('montoCaja').value,1);
  const efectivo=entero($('efectivoCaja').value),transferencia=entero($('transferenciaCaja').value);
  const referencia=$('referenciaCaja').value.trim().toUpperCase();
  const concepto=$('conceptoCaja').value.trim();
  if(!cfg||total===null||efectivo===null||transferencia===null||efectivo+transferencia!==total||
    (metodo==='efectivo'&&transferencia!==0)||
    (metodo==='transferencia'&&efectivo!==0)||
    (metodo==='mixto'&&(!efectivo||!transferencia))||
    !concepto||
    (cfg.ref&&!/^[A-Z0-9._-]{3,80}$/.test(referencia))){
    $('estadoMovimientoCaja').textContent='Revisa valores, concepto y referencia. Una venta necesita ID del pedido (3–80 caracteres sin espacios).';return;
  }
  if(transferencia>0 && cfg.tipo==='ingreso' && !$('confirmoTransferenciaCaja').checked){
    $('estadoMovimientoCaja').textContent='Antes de registrar un ingreso por transferencia, confirma que verificaste el abono en tu cuenta.';
    return;
  }
  if(!confirm((cfg.tipo==='ingreso'?'¿Registrar entrada':'¿Registrar salida')+' de '+pesos(total)+'? Solo registra dinero realmente recibido o pagado.'))return;
  const b=$('guardarMovimiento');b.disabled=true;cargando=true;
  $('estadoMovimientoCaja').textContent='Registrando movimiento...';
  intentoMovimiento??=doc(collection(db,'movimientosCaja')).id;
  const movId=intentoMovimiento;
  try{
    validarOnline();
    const refMov=doc(db,'movimientosCaja',movId);
    // Una sola venta por referencia, aunque se cambie la categoría por error.
    const refUnico=cfg.ref?doc(db,'referenciasCaja','venta__'+referencia):null;
    await runTransaction(db,async tx=>{
      const snapControl=await tx.get(ctrlRef);
      if(!snapControl.exists()||snapControl.data().estado!=='abierta')throw Error('No hay una caja abierta.');
      const id=snapControl.data().turnoId;
      const rTurno=refTurno(id);
      const [snapTurno,snapMov,snapReferencia]=await Promise.all([
        tx.get(rTurno),tx.get(refMov),refUnico?tx.get(refUnico):Promise.resolve(null)
      ]);
      if(!snapTurno.exists()||snapTurno.data().estado!=='abierta')throw Error('El turno está cerrado.');
      if(snapMov.exists())throw Error('Este movimiento ya fue registrado.');
      if(snapReferencia?.exists())throw Error('Esta venta ya se registró. Verifica la referencia antes de duplicar.');
      const t=snapTurno.data();
      const fields={};
      const claveE=cfg.tipo==='ingreso'?'efectivoIngresos':'efectivoEgresos';
      const claveT=cfg.tipo==='ingreso'?'transferenciaIngresos':'transferenciaEgresos';
      fields[claveE]=enteroRegistro(t[claveE])+efectivo;
      fields[claveT]=enteroRegistro(t[claveT])+transferencia;
      fields.movimientosCount=enteroRegistro(t.movimientosCount)+1;
      tx.update(rTurno,fields);
      tx.set(refMov,{
        turnoId:id,categoria,tipo:cfg.tipo,metodo,total,efectivo,transferencia,
        concepto,referencia,transferenciaVerificada:cfg.tipo==='ingreso'&&transferencia>0,
        creadoEn:serverTimestamp(),responsable:usuario.email||'Administrador',
        creadoPor:usuario.uid
      });
      if(refUnico)tx.set(refUnico,{
        turnoId:id,movimientoId:movId,categoria,referencia,creadoEn:serverTimestamp()
      });
    });
    $('estadoMovimientoCaja').textContent='✅ Movimiento guardado. Revisa el historial de caja.';
    $('montoCaja').value='';$('conceptoCaja').value='';$('referenciaCaja').value='';
    $('confirmoTransferenciaCaja').checked=false;
    intentoMovimiento=null;configurarMetodo();
  }catch(error){
    $('estadoMovimientoCaja').textContent='No se registró: '+(error.message||error.code)+
      ' Si hubo un fallo de red, comprueba primero el historial antes de volver a intentar.';
  }finally{cargando=false;pintarResumen();}
});
function calcularArqueo(){
  if(!turno)return;
  const contado=entero($('contadoCaja').value);
  if(contado===null){$('diferenciaCaja').textContent='Ingresa el efectivo contado para calcular la diferencia.';return;}
  const diferencia=contado-efectivoEsperado(turno);
  $('diferenciaCaja').textContent='Esperado: '+pesos(efectivoEsperado(turno))+' · Diferencia: '+
    (diferencia>0?'+':'')+pesos(diferencia)+
    (diferencia===0?' ✅ Cuadrada':diferencia<0?' · Faltante':' · Sobrante');
}
$('contadoCaja').addEventListener('input',calcularArqueo);
$('cerrarCajaBoton').addEventListener('click',async()=>{
  const contado=entero($('contadoCaja').value);
  if(contado===null){$('estadoCierreCaja').textContent='Ingresa el efectivo contado físicamente.';return;}
  if(!confirm('¿Cerrar la caja? Una vez cerrada no podrás agregar movimientos a este turno.'))return;
  $('cerrarCajaBoton').disabled=true;cargando=true;
  $('estadoCierreCaja').textContent='Cerrando caja en Firebase...';
  try{
    validarOnline();
    await runTransaction(db,async tx=>{
      const actual=await tx.get(ctrlRef);
      if(!actual.exists()||actual.data().estado!=='abierta')throw Error('La caja ya está cerrada.');
      const id=actual.data().turnoId,rTurno=refTurno(id);
      const sTurno=await tx.get(rTurno);
      if(!sTurno.exists()||sTurno.data().estado!=='abierta')throw Error('El turno cambió.');
      const esperado=efectivoEsperado(sTurno.data());
      tx.update(rTurno,{
        estado:'cerrada',cierreEn:serverTimestamp(),cierrePor:usuario.uid,
        efectivoContado:contado,efectivoEsperado:esperado,diferencia:contado-esperado,
        notaCierre:$('notaCierreCaja').value.trim()
      });
      tx.set(ctrlRef,{estado:'cerrada',turnoId:id,actualizadoEn:serverTimestamp(),cierrePor:usuario.uid});
    });
    $('estadoCierreCaja').textContent='✅ Caja cerrada.';
    $('contadoCaja').value='';$('notaCierreCaja').value='';
  }catch(error){$('estadoCierreCaja').textContent='No se pudo cerrar: '+(error.message||error.code);}
  finally{cargando=false;pintarResumen();}
});
$('exportarCaja').addEventListener('click',()=>{
  if(!turno)return;
  const filas=[['Fecha','Categoria','Tipo','Concepto','Referencia','Efectivo','Transferencia','Total','Responsable']];
  for(const m of movimientos)filas.push([
    fecha(m.creadoEn),opciones[m.categoria]?.label||m.categoria,m.tipo,m.concepto,m.referencia||'',
    m.efectivo||0,m.transferencia||0,m.total||0,m.responsable||''
  ]);
  const csv=filas.map(row=>row.map(v=>{
    const s=String(v??'');
    const seguro=/^[=+\-@\t\r]/.test(s)?'\''+s:s;
    return '"'+seguro.replace(/"/g,'""')+'"';
  }).join(';')).join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const enlace=document.createElement('a');
  enlace.href=URL.createObjectURL(blob);
  enlace.download='caja-'+turno.id.slice(0,8)+'-movimientos.csv';
  enlace.click();setTimeout(()=>URL.revokeObjectURL(enlace.href),2000);
});
