// La Pizza de Juanca — reporte de cobros, fase de pruebas.
// Este módulo NO procesa transferencias ni valida abonos bancarios automáticamente.
import { doc, updateDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const MAXIMO = 100000000;
const nombreMetodos = { efectivo:'Efectivo', transferencia:'Transferencia', mixto:'Mixto' };
export const pesosCobro = n => '$' + Number(n).toLocaleString('es-CO');
const entero = v => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 && n <= MAXIMO ? n : null;
};

function parrafo(padre, mensaje, clase='') {
  const p = document.createElement('p');
  p.textContent = mensaje;
  if (clase) p.className = clase;
  padre.append(p);
  return p;
}
function titulo(padre, mensaje) {
  const h = document.createElement('h3');
  h.textContent = mensaje;
  padre.append(h);
}
function boton(padre, mensaje, clase='') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = mensaje;
  if (clase) b.className = clase;
  padre.append(b);
  return b;
}
function inputDinero(padre, leyenda) {
  const label = document.createElement('label');
  label.textContent = leyenda;
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = '0';
  input.max = String(MAXIMO);
  input.step = '1';
  label.append(input);
  padre.append(label);
  return input;
}
function insertarEstilos() {
  if (document.getElementById('pizza-cobros-estilos')) return;
  const css = document.createElement('style');
  css.id = 'pizza-cobros-estilos';
  css.textContent = [
    '.pizza-cobro {background:#241f18;border:1px solid #7b6536;border-radius:12px;padding:14px;margin:14px 0;color:#fff;}',
    '.pizza-cobro h3 {font-size:18px;margin:0 0 10px;color:#ffda83;}',
    '.pizza-cobro p {font-size:14px;line-height:1.5;margin:8px 0;}',
    '.pizza-cobro label {display:block;font-size:14px;font-weight:bold;margin:12px 0 5px;}',
    '.pizza-cobro select,.pizza-cobro input {width:100%;border-radius:8px;background:white;color:#171717;border:0;padding:12px;font:inherit;margin-top:5px;}',
    '.pizza-cobro button {width:100%;margin-top:14px;border:0;border-radius:9px;background:#f6bd42;color:#161616;padding:13px;font-weight:bold;font:inherit;}',
    '.pizza-cobro button:disabled {opacity:.55;}',
    '.pizza-cobro .cobro-total {font-size:18px;font-weight:bold;color:#ffdb8b;margin-top:10px;}',
    '.pizza-cobro .cobro-error {color:#ffb3a9;}',
    '.pizza-cobro .cobro-ok {color:#bdf4ca;}',
    '.pizza-cobro .cobro-calculo {border-top:1px solid #746344;margin-top:12px;padding-top:10px;}'
  ].join('\n');
  document.head.append(css);
}
function cuadro(padre) {
  insertarEstilos();
  const section = document.createElement('section');
  section.className = 'pizza-cobro';
  padre.append(section);
  return section;
}
function resumenReporte(section, d) {
  const r = d.cobroReportado;
  if (!r || typeof r !== 'object') return false;
  parrafo(section, 'Método: ' + (nombreMetodos[r.metodo] || 'Por revisar'));
  parrafo(section, 'Efectivo informado: '+pesosCobro(r.efectivo || 0));
  parrafo(section, 'Transferencia informada: '+pesosCobro(r.transferencia || 0));
  parrafo(section, 'Total reportado: '+pesosCobro(r.total || 0));
  parrafo(section, d.cobroVerificado === true
    ? '✅ Cobro conciliado por el negocio.'
    : '⏳ Cobro reportado, NO verificado. Caja debe comprobar la transferencia y/o recibir el efectivo.',
    d.cobroVerificado === true ? 'cobro-ok' : '');
  return true;
}

export function mostrarCobroDomiciliario(padre, pedidoId, d, db, auth) {
  const section = cuadro(padre);
  titulo(section, '💰 Pago del cliente');
  const productos = entero(d.total);
  const domicilio = entero(d.domicilioValor);
  parrafo(section, 'Productos: '+(productos === null ? 'Por confirmar' : pesosCobro(productos)));
  parrafo(section, 'Domicilio: '+(domicilio === null ? 'Pendiente por administración' : pesosCobro(domicilio)));
  if (productos !== null && domicilio !== null) {
    parrafo(section, 'TOTAL POR COBRAR: '+pesosCobro(productos+domicilio), 'cobro-total');
  }
  if (resumenReporte(section,d)) return;
  const estado = String(d.estadoEntrega || '').toLowerCase();
  if (estado === 'entregado') {
    parrafo(section,'⚠️ Entrega ya cerrada sin reporte de pago. El administrador debe revisar y registrar manualmente este cobro en caja, si corresponde.','cobro-error');
    return;
  }
  if (estado !== 'en_camino') {
    parrafo(section,'💵 El botón «Registrar forma de pago» aparecerá cuando marques «Voy en camino».');
    return;
  }
  if (productos === null || domicilio === null) {
    parrafo(section,'⚠️ No se puede cobrar todavía: el administrador debe guardar el valor del domicilio (puede ser $0 si es gratis). Después aparecerá «Registrar forma de pago».','cobro-error');
    return;
  }

  const total = productos+domicilio;
  // El repartidor abre el pago con un botón visible cuando está en camino.
  const abrirFormulario = boton(section, '💰 Registrar forma de pago');
  abrirFormulario.className = 'abrir-cobro';
  const form = document.createElement('form');
  form.hidden = true;
  abrirFormulario.addEventListener('click', () => {
    form.hidden = !form.hidden;
    abrirFormulario.textContent = form.hidden
      ? '💰 Registrar forma de pago'
      : '⬆️ Ocultar opciones de pago';
  });
  const label = document.createElement('label');
  label.textContent = '¿Cómo pagó el cliente?';
  const metodo = document.createElement('select');
  for (const [value,nombre] of Object.entries(nombreMetodos)) {
    const o = document.createElement('option');o.value=value;o.textContent=nombre;metodo.append(o);
  }
  label.append(metodo);form.append(label);
  const efectivo = inputDinero(form,'Efectivo recibido (COP)');
  const transferencia = inputDinero(form,'Transferencia informada (COP)');
  const calculo = parrafo(form,'','cobro-calculo');
  parrafo(form,'Este formulario únicamente reporta el pago. Una transferencia no queda confirmada hasta que administración compruebe el abono.');
  const estadoForm = parrafo(form,'');
  estadoForm.setAttribute('role','status');
  const guardar=boton(form,'💾 Registrar pago del cliente');
  guardar.type='submit';
  function revisar() {
    const e=entero(efectivo.value), t=entero(transferencia.value);
    const suma = e===null||t===null ? null : e+t;
    calculo.textContent = suma===null ? 'Completa ambos importes.' :
      'Suma: '+pesosCobro(suma)+' / '+pesosCobro(total)+
      (suma===total?' ✅':' · Diferencia: '+pesosCobro(Math.abs(total-suma)));
  }
  function metodoNuevo() {
    efectivo.disabled = metodo.value==='transferencia';
    transferencia.disabled = metodo.value==='efectivo';
    if (metodo.value==='efectivo') {
      efectivo.value=String(total);transferencia.value='0';
    } else if(metodo.value==='transferencia') {
      efectivo.value='0';transferencia.value=String(total);
    } else { efectivo.value='';transferencia.value=''; }
    revisar();
  }
  metodo.addEventListener('change',metodoNuevo);
  efectivo.addEventListener('input',revisar);
  transferencia.addEventListener('input',revisar);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const e=entero(efectivo.value), t=entero(transferencia.value), m=metodo.value;
    if(e===null || t===null || e+t!==total ||
       (m==='efectivo'&&t!==0) || (m==='transferencia'&&e!==0) ||
       (m==='mixto'&&(e<=0||t<=0))) {
      estadoForm.textContent='Los importes deben sumar el total exacto y coincidir con el método seleccionado.';
      return;
    }
    if (!window.confirm('¿Registrar este pago? Se notificará como reportado, no verificado por caja.'))return;
    guardar.disabled=true;
    estadoForm.textContent='Guardando reporte de cobro...';
    try {
      await runTransaction(db,async tx=>{
        const ref=doc(db,'pedidos',pedidoId);
        const snap=await tx.get(ref);
        if(!snap.exists())throw new Error('pedido-inexistente');
        const actual=snap.data();
        if (auth.currentUser?.uid!==actual.domiciliarioUid ||
            actual.estadoEntrega!=='en_camino' ||
            actual.cobroReportado ||
            entero(actual.total)!==productos ||
            entero(actual.domicilioValor)!==domicilio)
          throw new Error('pedido-modificado');
        tx.update(ref,{
          cobroReportado:{metodo:m,efectivo:e,transferencia:t,total},
          cobroReportadoEn:serverTimestamp()
        });
      });
      estadoForm.textContent='✅ Reporte enviado. Pendiente de verificación de caja.';
    } catch(error) {
      estadoForm.textContent=error?.code==='permission-denied'
        ? 'Firebase todavía no permite registrar cobros. Debemos habilitar las reglas específicas de cobro.'
        : 'No se pudo guardar. El pedido pudo cambiar; actualiza la pantalla y revisa antes de repetir.';
      guardar.disabled=false;
    }
  });
  section.append(form);
  metodoNuevo();
}

export function mostrarCobroAdmin(padre, pedidoId, d, db) {
  const section = cuadro(padre);
  titulo(section,'💰 Control de cobro');
  const productos=entero(d.total), domicilio=entero(d.domicilioValor);
  parrafo(section,'Productos: '+(productos===null?'Sin total válido':pesosCobro(productos)));
  parrafo(section,'Valor domicilio: '+(domicilio===null?'Sin confirmar':pesosCobro(domicilio)));
  if(productos!==null && domicilio!==null) {
    parrafo(section,'Total cliente: '+pesosCobro(productos+domicilio),'cobro-total');
  }
  const reporte=Boolean(d.cobroReportado);
  if(!reporte && d.estadoEntrega!=='entregado') {
    const form=document.createElement('form');
    const campo=inputDinero(form,'Confirmar costo del domicilio (COP)');
    campo.placeholder='Ejemplo: 5000';
    if(domicilio!==null)campo.value=String(domicilio);
    const aviso=parrafo(form,'Es el costo que verá el domiciliario. No cambia el precio de los productos.');
    const msg=parrafo(form,'');
    msg.setAttribute('role','status');
    const guardar=boton(form,'💾 Guardar valor del domicilio');
    guardar.type='submit';
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const valor=entero(campo.value);
      if(valor===null) {msg.textContent='Ingresa un valor entero entre $0 y $100.000.000.';return;}
      guardar.disabled=true;msg.textContent='Guardando valor del domicilio...';
      try{
        await updateDoc(doc(db,'pedidos',pedidoId),{
          domicilioValor:valor,domicilioValorFijadoEn:serverTimestamp()
        });
        msg.textContent='✅ Domicilio confirmado: '+pesosCobro(valor);
      }catch(e){
        msg.textContent='No se guardó. Revisa tu sesión de administrador y Firestore.';
        guardar.disabled=false;
      }
    });
    section.append(form);
  }
  if (!reporte) {
    parrafo(section, d.estadoEntrega==='entregado'
      ? 'Entrega antigua sin reporte de cobro. Requiere revisión manual.'
      : '⏳ Aún no hay pago reportado por el domiciliario.');
    return;
  }
  resumenReporte(section,d);
  if(d.cobroVerificado!==true) {
    const nota=parrafo(section,'Antes de conciliar: verifica el abono en Nequi/banco y recibe el efectivo entregado por el repartidor.');
    const msg=parrafo(section,'');
    msg.setAttribute('role','status');
    const confirmar=boton(section,'✅ Confirmar pago conciliado');
    confirmar.disabled=d.estadoEntrega!=='entregado';
    if(confirmar.disabled) {
      msg.textContent='Primero espera a que el domiciliario marque la entrega como entregada.';
    }
    confirmar.addEventListener('click',async()=>{
      if(!window.confirm('¿Ya verificaste la transferencia en tu cuenta y recibiste el efectivo correspondiente?'))return;
      confirmar.disabled=true;msg.textContent='Confirmando conciliación...';
      try{
        await updateDoc(doc(db,'pedidos',pedidoId),{
          cobroVerificado:true,cobroVerificadoEn:serverTimestamp()
        });
        msg.textContent='✅ Pago conciliado por administración.';
      }catch(err){
        msg.textContent='No se pudo confirmar el pago. Revisa permisos y conexión.';
        confirmar.disabled=false;
      }
    });
  }
}
