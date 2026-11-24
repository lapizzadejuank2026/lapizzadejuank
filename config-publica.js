// Configuración pública compartida: horarios y apariencia del restaurante.
(function(){
  'use strict';
  const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const minutos=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):null;
  const predeterminado=()=>Object.fromEntries(dias.map((_,i)=>[i,{abierto:true,tramos:[{inicio:'15:00',fin:'23:00'}]}]));
  function normalizarSemana(semana){
    const resultado=predeterminado();
    for(let i=0;i<7;i++){
      const d=semana?.[i];
      if(!d||typeof d.abierto!=='boolean')continue;
      const tramos=Array.isArray(d.tramos)?d.tramos.filter(t=>minutos(t?.inicio)!==null&&minutos(t?.fin)!==null&&t.inicio!==t.fin).slice(0,6).map(t=>({inicio:t.inicio,fin:t.fin})):[];
      resultado[i]={abierto:d.abierto,tramos};
    }
    return resultado;
  }
  function normalizarHorarios(h){return {general:normalizarSemana(h?.general),domicilio:h?.domicilio?normalizarSemana(h.domicilio):null,recoger:h?.recoger?normalizarSemana(h.recoger):null};}
  function validarSemana(semana){
    const ocupados=new Uint8Array(7*1440);
    for(let i=0;i<7;i++){
      const d=semana[i];
      if(!d.abierto)continue;
      if(!d.tramos.length||d.tramos.length>6)throw Error('Agrega entre 1 y 6 horarios para '+dias[i]+'.');
      for(const t of d.tramos){
        const a=minutos(t.inicio),b=minutos(t.fin);
        if(a===null||b===null||a===b)throw Error('Revisa la apertura y cierre del '+dias[i]+'.');
        const duracion=(b-a+1440)%1440;
        for(let m=0;m<duracion;m++){
          const pos=(i*1440+a+m)%ocupados.length;
          if(ocupados[pos])throw Error('Hay horarios superpuestos alrededor del '+dias[i]+'.');
          ocupados[pos]=1;
        }
      }
    }
  }
  function estadoHorario(semana,fecha=new Date()){
    const partes=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(fecha).map(p=>[p.type,p.value]));
    const dia=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(partes.weekday),m=Number(partes.hour)*60+Number(partes.minute);
    const actual=semana[dia],anterior=semana[(dia+6)%7];
    const abierto=Boolean(actual?.abierto&&actual.tramos.some(t=>{const a=minutos(t.inicio),b=minutos(t.fin);return a!==null&&b!==null&&(b>a?m>=a&&m<b:m>=a);})||anterior?.abierto&&anterior.tramos.some(t=>{const a=minutos(t.inicio),b=minutos(t.fin);return a!==null&&b!==null&&b<a&&m<b;}));
    const hoy=actual?.abierto&&actual.tramos.length?actual.tramos.map(t=>t.inicio+' – '+t.fin+(minutos(t.fin)<minutos(t.inicio)?' (+1 día)':'')).join(' / '):'Sin horario de apertura hoy';
    return {abierto,hoy,dia};
  }
  const colorValido=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);
  const portadaValida=s=>typeof s==='string'&&/^https:\/\//i.test(s)&&s.length<=1800;
  // Familias locales: sin descargas externas, con alternativas para Android y iOS.
  const tipografias=Object.freeze({
    original:{nombre:'Original del menú',familia:''},
    moderna:{nombre:'Moderna',familia:'system-ui, -apple-system, "Segoe UI", sans-serif'},
    clasica:{nombre:'Clásica',familia:'Arial, Helvetica, sans-serif'},
    elegante:{nombre:'Elegante',familia:'Georgia, "Times New Roman", serif'},
    editorial:{nombre:'Editorial',familia:'"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'},
    condensada:{nombre:'Compacta',familia:'"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", sans-serif'},
    artesanal:{nombre:'Artesanal',familia:'"Trebuchet MS", Verdana, sans-serif'}
  });
  const tipografiaValida=s=>typeof s==='string'&&Object.prototype.hasOwnProperty.call(tipografias,s);
  function aplicarApariencia(datos,contexto){
    const a=datos?.apariencia||{},root=document.documentElement;
    const principal=colorValido(a.principal)?a.principal:null,acento=colorValido(a.acento)?a.acento:null;
    const pares=contexto==='bienvenida'?{'--rojo':principal,'--amarillo':acento}:{'--red':principal,'--gold':acento};
    for(const [k,v] of Object.entries(pares)){if(v)root.style.setProperty(k,v);else root.style.removeProperty(k);}
    const familia=tipografiaValida(a.tipografia)?tipografias[a.tipografia].familia:'';
    if(familia)root.style.setProperty('--fuente-negocio',familia);else root.style.removeProperty('--fuente-negocio');
    const imagen=document.getElementById('portada-negocio');
    if(imagen){const url=portadaValida(a.portadaURL)?a.portadaURL:'';imagen.hidden=!url;if(url&&imagen.getAttribute('src')!==url)imagen.src=url;else if(!url)imagen.removeAttribute('src');}
  }
  window.PulsoConfig={dias,minutos,predeterminado,normalizarHorarios,validarSemana,estadoHorario,colorValido,portadaValida,tipografias,tipografiaValida,aplicarApariencia};
})();
