// Instalación del centro de control. No cambia las sesiones de Firebase.
(()=>{
  const grupos=[...document.querySelectorAll('.instalar-control')];
  const modo=window.matchMedia('(display-mode: standalone)');
  let evento=null,instalada=false;
  const esInstalada=()=>instalada||modo.matches||navigator.standalone===true;
  function pintar(){for(const g of grupos)g.hidden=esInstalada();}
  function ayuda(m){for(const g of grupos){const p=g.querySelector('.instalar-control-ayuda');p.textContent=m;p.hidden=!m;}}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();evento=e;pintar();});
  window.addEventListener('appinstalled',()=>{instalada=true;evento=null;ayuda('');pintar();});
  modo.addEventListener?.('change',pintar);
  for(const g of grupos)g.querySelector('button').addEventListener('click',async()=>{
    if(esInstalada())return;
    if(evento){
      const e=evento;evento=null;
      try{await e.prompt();const r=await e.userChoice;if(r.outcome==='dismissed')ayuda('Puedes instalarla después desde el menú de Chrome.');}
      catch(_){ayuda('En Chrome abre el menú ⋮ y elige Instalar aplicación.');}
    }else{
      const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
      ayuda(ios?'En Safari toca Compartir y Añadir a pantalla de inicio.':'En Chrome toca ⋮ y elige Instalar aplicación o Añadir a pantalla de inicio.');
    }
  });
  // El editor es parte del centro de trabajo. Rider y la vista previa pública siguen separados.
  document.addEventListener('click',e=>{
    const a=e.target.closest?.('#editor-pantalla-completa');
    if(a&&esInstalada()&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();location.assign(a.href);}
  });
  pintar();
  if('serviceWorker' in navigator&&window.isSecureContext){
    navigator.serviceWorker.register('./pulso-control-sw.js',{scope:'./panel-pedidos.html',updateViaCache:'none'}).catch(e=>console.warn('No se pudo registrar la instalación de Pulso Food:',e));
  }
})();
