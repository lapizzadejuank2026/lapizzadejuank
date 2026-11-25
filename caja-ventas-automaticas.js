// Pulso Food: registro de ventas por una sesión administrativa activa.
import {doc,collection,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
const valido=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const fecha=t=>t?.toMillis?.()??(typeof t?.seconds==='number'?t.seconds*1000+(t.nanoseconds||0)/1000000:NaN);
const dinero=n=>'$'+Number(n).toLocaleString('es-CO');
const numero=n=>n==null||n===''?NaN:Number(n);
function llevar(d){
  const m=String(d.modalidad||d.tipoEntrega||'').toLowerCase();
  return !d.mesaId&&!d.cuentaMesaId&&!m.includes('mesa')&&/recoger|llevar|recogida|retiro|mostrador/.test(m);
}
export function pagoValido(r,total){
  return !!r&&valido(r.efectivo)&&valido(r.transferencia)&&valido(r.total)&&r.total>0&&r.total===total&&r.efectivo+r.transferencia===total&&
    (r.metodo==='efectivo'?r.transferencia===0:r.metodo==='transferencia'?r.efectivo===0:r.metodo==='mixto'&&r.efectivo>0&&r.transferencia>0);
}
export function candidato(d,apertura){
  const p=numero(d.total),e=numero(d.domicilioValor);
  return !!d.domiciliarioUid&&!llevar(d)&&!d.mesaId&&!d.cuentaMesaId&&d.estadoEntrega==='entregado'&&!d.cajaMovimientoId&&
    Number.isFinite(fecha(apertura))&&fecha(d.cobroReportadoEn)>=fecha(apertura)&&valido(p)&&valido(e)&&pagoValido(d.cobroReportado,p+e);
}
export async function registrar(db,user,id,canal,pago=null,turnoEsperado=null){
  if(!user?.uid)throw Error('Sesión administrativa requerida.');
  const domi=canal==='domicilio',categoria=domi?'venta_domicilio':'venta_llevar',movId=(domi?'domicilio__':'llevar__')+id;
  const refs=[doc(db,'cajaControl','actual'),doc(db,'pedidos',id),doc(db,'movimientosCaja',movId),doc(db,'referenciasCaja','venta__'+id.toUpperCase()),doc(db,'referenciasCaja','venta__'+id.slice(0,8).toUpperCase())];
  return runTransaction(db,async tx=>{
    const [sc,sp,sm,sf,ss]=await Promise.all(refs.map(r=>tx.get(r)));
    if(!sp.exists())throw Error('Pedido inexistente.');
    const d=sp.data();
    if(d.cajaMovimientoId||sm.exists())return 'registrado';
    if(sf.exists()||ss.exists())throw Error('Referencia ya utilizada: revisa el movimiento existente.');
    if(!sc.exists()||sc.data().estado!=='abierta')throw Error('No hay caja abierta.');
    const turnoId=sc.data().turnoId;
    if(turnoEsperado&&turnoEsperado!==turnoId)throw Error('El turno cambió.');
    const tr=doc(db,'cajaTurnos',turnoId),st=await tx.get(tr);
    if(!st.exists()||st.data().estado!=='abierta')throw Error('Turno cerrado.');
    const t=st.data();
    if(domi){
      if(!candidato(d,t.aperturaEn))throw Error('Cobro inválido, anterior al turno o entrega pendiente.');
      pago=d.cobroReportado;
    }else if(!llevar(d)||/nuevo|cancelad|anulad/.test(String(d.estado||'nuevo').toLowerCase())||!pagoValido(pago,numero(d.total)))throw Error('Pedido o pago inválido.');
    const e=Number(t.efectivoIngresos||0),v=Number(t.transferenciaIngresos||0),n=Number(t.movimientosCount||0);
    if(!valido(e)||!valido(v)||!Number.isSafeInteger(n)||n<0)throw Error('Totales inválidos.');
    const nombre=String(d.domiciliarioNombre||'Domiciliario').slice(0,70);
    const movimiento={turnoId,categoria,tipo:'ingreso',metodo:pago.metodo,total:pago.total,efectivo:pago.efectivo,transferencia:pago.transferencia,
      concepto:(domi?'Domicilio ':'Para llevar ')+id.slice(0,8).toUpperCase()+(domi?' · '+nombre:''),
      referencia:id.toUpperCase(),pedidoId:id,transferenciaVerificada:pago.transferencia>0&&(!domi||d.cobroVerificado===true),
      creadoEn:serverTimestamp(),responsable:user.email||'Administrador',creadoPor:user.uid};
    if(domi)Object.assign(movimiento,{domiciliarioUid:d.domiciliarioUid,domiciliarioNombre:nombre,origen:'cobro_domiciliario'});
    tx.update(tr,{efectivoIngresos:e+pago.efectivo,transferenciaIngresos:v+pago.transferencia,movimientosCount:n+1});
    tx.set(refs[2],movimiento);
    for(const [ref,referencia] of [[refs[3],id.toUpperCase()],[refs[4],id.slice(0,8).toUpperCase()]])tx.set(ref,{turnoId,movimientoId:movId,categoria,referencia,creadoEn:serverTimestamp()});
    tx.update(refs[1],{cajaMovimientoId:movId,cajaTurnoId:turnoId,cajaRegistradoEn:serverTimestamp()});
    return 'nuevo';
  });
}
export function escucharCobros(db,user,avisar=()=>{}){
  let activo=true,ctrl=null,pedidos=[],cOK=false,pOK=false,ocupado=false;
  const intentos=new Set(),fallos=new Map();
  async function procesar(){
    if(!activo||ocupado||!cOK||!pOK||ctrl?.estado!=='abierta')return;
    const turno=ctrl.turnoId;
    const pendientes=pedidos.filter(p=>candidato(p.d,ctrl.actualizadoEn)&&!intentos.has(turno+'|'+p.id));
    if(!pendientes.length)return;
    ocupado=true;
    try{
      for(const p of pendientes){
        if(!activo||ctrl?.estado!=='abierta'||ctrl.turnoId!==turno)break;
        const k=turno+'|'+p.id;intentos.add(k);
        try{await registrar(db,user,p.id,'domicilio',null,turno);fallos.delete(k);}
        catch(e){fallos.set(k,p.id.slice(0,8)+': '+(e.code||e.message));}
      }
      if(activo){const errores=[...fallos].filter(([k])=>k.startsWith(turno+'|')).map(([,v])=>v);avisar(errores.length?'Cobros pendientes: '+errores.join('; ')+'. Actualiza para reintentar.':'');}
    }finally{ocupado=false;if(activo)queueMicrotask(procesar);}
  }
  const a=onSnapshot(doc(db,'cajaControl','actual'),{includeMetadataChanges:true},s=>{cOK=!s.metadata.fromCache&&!s.metadata.hasPendingWrites;ctrl=s.exists()?s.data():null;procesar();},e=>{cOK=false;avisar('No se pudo consultar caja: '+e.code);});
  const b=onSnapshot(collection(db,'pedidos'),{includeMetadataChanges:true},s=>{pOK=!s.metadata.fromCache&&!s.metadata.hasPendingWrites;pedidos=s.docs.map(x=>({id:x.id,d:x.data()}));procesar();},e=>{pOK=false;avisar('No se pudo consultar cobros: '+e.code);});
  return ()=>{activo=false;a();b();};
}
export function mostrarCobroLlevar(parent,id,d,db,user){
  if(/nuevo|cancelad|anulad/.test(String(d.estado||'nuevo').toLowerCase()))return;
  const div=document.createElement('div');div.className='asignacion';
  const texto=s=>{const p=document.createElement('p');p.textContent=s;div.append(p);return p;};
  texto('💰 Cobro para llevar');
  if(d.cajaMovimientoId){texto('✅ Venta registrada en caja.');parent.append(div);return;}
  const total=numero(d.total);if(!valido(total)||total<=0){texto('Total inválido.');parent.append(div);return;}
  texto('Total a cobrar: '+dinero(total));
  const m=document.createElement('select');m.setAttribute('aria-label','Forma de pago real');
  for(const [v,t] of [['efectivo','Efectivo'],['transferencia','Transferencia'],['mixto','Mixto']])m.append(new Option(t,v));
  const e=document.createElement('input');e.type='number';e.min='0';e.max=String(total);e.step='1';e.placeholder='Valor efectivo';e.setAttribute('aria-label','Valor efectivo');e.hidden=true;
  m.onchange=()=>{e.hidden=m.value!=='mixto';e.value='';};div.append(m,e);
  const b=document.createElement('button');b.type='button';b.textContent='Confirmar pago y registrar en caja';div.append(b);
  const msg=texto('');msg.setAttribute('role','status');
  b.onclick=async()=>{
    const ef=m.value==='efectivo'?total:m.value==='transferencia'?0:numero(e.value),r={metodo:m.value,efectivo:ef,transferencia:total-ef,total};
    if(!pagoValido(r,total)){msg.textContent='Revisa los importes.';return;}
    if(!confirm('¿Recibiste '+dinero(total)+(r.transferencia?' y comprobaste el abono bancario?':' en efectivo?')+' Se registrará una vez.'))return;
    b.disabled=true;msg.textContent='Registrando...';
    try{await registrar(db,user,id,'llevar',r);msg.textContent='Venta registrada en caja.';}
    catch(err){msg.textContent='No se pudo registrar: '+(err.code||err.message);b.disabled=false;}
  };
  parent.append(div);
}
