// Portal de repartidores. Nunca decide permisos: Firestore Rules es la autoridad.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,collection,doc,query,where,onSnapshot,updateDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
const app=initializeApp({
    apiKey:'AIzaSyA65sFJq3vf24a-1VbpYBHCgpEAk--exAA',
    authDomain:'pizzadejuank.firebaseapp.com',
    projectId:'pizzadejuank',
    storageBucket:'pizzadejuank.firebasestorage.app',
    messagingSenderId:'856650093973',
    appId:'1:856650093973:web:a4cd3ad8e863617706d29c'
  });
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
let dejarAcceso=()=>{},dejarPedidos=()=>{},uidAutorizado='';
const tabs=['pedidos','historial','cuenta'];
function verTab(nombre){for(const n of tabs){$('vista-'+n).hidden=n!==nombre;$('tab-'+n).setAttribute('aria-selected',String(n===nombre))}}
for(const n of tabs)$('tab-'+n).addEventListener('click',()=>verTab(n));
function texto(t){const p=document.createElement('p');p.textContent=t;return p}
function avisar(mensaje){const p=document.createElement('p');p.className='aviso';p.textContent=mensaje;return p}
function dinero(x){return Number.isFinite(Number(x))?'$'+Number(x).toLocaleString('es-CO'):'Por confirmar'}
function bloquear(mensaje){
  dejarPedidos();dejarPedidos=()=>{};uidAutorizado='';
  $('vista-pedidos').replaceChildren(avisar(mensaje));
  $('vista-historial').replaceChildren();
  $('vista-cuenta').replaceChildren();
}
function tarjeta(id,d){
  const card=document.createElement('article');card.className='caja';card.style.border='1px solid #6e5d45';
  const cliente=(d.cliente&&typeof d.cliente==='object')?d.cliente:{};
  const estado=d.estadoEntrega||'pendiente';
  const pasos={pendiente:['aceptado','✅ Aceptar'],aceptado:['recogido','🍕 Recogido'],recogido:['en_camino','🛵 En camino'],en_camino:['entregado','🏠 Entregado']};
  const h=document.createElement('h2');h.textContent='Pedido '+id.slice(0,8)+' · '+estado.replace('_',' ');card.append(h);
  card.append(texto('Cliente: '+(cliente.nombre||d.nombre||'Sin nombre')));
  card.append(texto('Teléfono: '+(cliente.telefono||d.telefono||'No indicado')));
  card.append(texto('Dirección: '+(d.direccion||cliente.direccion||'No indicada')));
  card.append(texto('Municipio: '+(d.municipio||cliente.municipio||'No indicado')));
  if(d.observaciones)card.append(texto('Observaciones: '+d.observaciones));
  card.append(texto('Total: '+dinero(d.total)));
  const detalles=document.createElement('pre');detalles.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit';
  detalles.textContent=JSON.stringify(d.productos||d.items||[],null,2);card.append(detalles);
  if(pasos[estado]){
    const [sig,etiqueta]=pasos[estado],boton=document.createElement('button');
    boton.className='principal';boton.textContent=etiqueta;
    const respuesta=texto('');respuesta.className='estado';
    boton.addEventListener('click',async()=>{
      if(auth.currentUser?.uid!==uidAutorizado)return;
      boton.disabled=true;respuesta.textContent='Guardando...';
      try{await updateDoc(doc(db,'pedidos',id),{estadoEntrega:sig,entregaActualizadaEn:serverTimestamp()});respuesta.textContent='✅ Actualizado'}
      catch(e){respuesta.textContent=e?.code==='permission-denied'?'Firebase no autorizó el cambio de estado.':'No se pudo guardar ('+(e?.code||'error')+').';boton.disabled=false}
    });
    card.append(boton,respuesta);
  }
  return card;
}
function render(snapshot){
  const todos=snapshot.docs.map(x=>({id:x.id,d:x.data()})).sort((a,b)=>(b.d.creadoEn?.seconds||0)-(a.d.creadoEn?.seconds||0));
  const actuales=todos.filter(x=>x.d.estadoEntrega!=='entregado'),historicos=todos.filter(x=>x.d.estadoEntrega==='entregado');
  const cont=$('vista-pedidos');cont.replaceChildren();
  const h=document.createElement('h2');h.textContent='🛵 Solo mis entregas';cont.append(h,texto(actuales.length+' pedido(s) pendientes.'));
  if(!actuales.length)cont.append(avisar('El administrador todavía no te ha asignado pedidos.'));
  else for(const x of actuales)cont.append(tarjeta(x.id,x.d));
  const hist=$('vista-historial');hist.replaceChildren();const h2=document.createElement('h2');h2.textContent='Entregas completadas';hist.append(h2);
  if(!historicos.length)hist.append(avisar('Aún no hay entregas completadas.'));
  else for(const x of historicos)hist.append(tarjeta(x.id,x.d));
}
$('login').addEventListener('submit',async e=>{
  e.preventDefault();$('entrar').disabled=true;$('mensaje-acceso').textContent='Verificando cuenta...';
  try{await signInWithEmailAndPassword(auth,$('correo').value.trim(),$('clave').value);$('clave').value=''}
  catch(e){$('mensaje-acceso').textContent=e?.code==='auth/invalid-credential'?'Correo o contraseña incorrectos.':'Error de acceso ('+(e?.code||'desconocido')+').'}
  finally{$('entrar').disabled=false}
});
$('salir').addEventListener('click',()=>signOut(auth));
onAuthStateChanged(auth,user=>{
  dejarAcceso();dejarAcceso=()=>{};bloquear('Comprobando permisos de tu cuenta...');
  $('acceso').hidden=!!user;$('portal').hidden=!user;
  $('correo-sesion').textContent=user?.email||'';
  if(!user){$('mensaje-acceso').textContent='Ingresa con el correo y contraseña autorizados.';verTab('pedidos');return}
  const uid=user.uid;
  dejarAcceso=onSnapshot(doc(db,'accesosDomiciliarios',uid),registro=>{
    if(auth.currentUser?.uid!==uid)return;
    const persona=registro.exists()?registro.data():null;
    if(!persona||persona.activo!==true||persona.rol!=='domiciliario'){
      bloquear('Acceso sin autorización. El administrador debe activar tu cuenta en Equipo y roles.');return;
    }
    $('cuenta-correo').textContent='Correo: '+(user.email||'');
    $('vista-cuenta').replaceChildren(texto('Nombre: '+(persona.nombre||'Domiciliario')),texto('Correo: '+(user.email||'')));
    if(uidAutorizado===uid)return;
    uidAutorizado=uid;
    $('vista-pedidos').replaceChildren(avisar('Buscando únicamente tus pedidos asignados...'));
    dejarPedidos=onSnapshot(query(collection(db,'pedidos'),where('domiciliarioUid','==',uid)),render,error=>{
      bloquear(error?.code==='permission-denied'?'Firebase bloqueó la consulta. Se deben publicar las reglas de seguridad.':'No fue posible cargar tus pedidos ('+(error?.code||'error')+').');
    });
  },error=>bloquear('No se pudo validar tu autorización ('+(error?.code||'error')+').'));
});
window.__domiciliariosListo=true;
