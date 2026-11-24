// PWA de clientes: no comparte el identificador de instalación ni el icono de Rider.
(()=>{
  const grupos=[...document.querySelectorAll('.instalar-clientes')];
  const modo=window.matchMedia('(display-mode: standalone)');
  let evento=null,instalada=false;
  const instaladaAhora=()=>instalada||modo.matches||navigator.standalone===true;
  function pintar(){for(const g of grupos)g.hidden=instaladaAhora();}
  function ayuda(texto){for(const g of grupos){const p=g.querySelector('.instalar-clientes-ayuda');p.textContent=texto;p.hidden=!texto;}}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();evento=e;pintar();});
  window.addEventListener('appinstalled',()=>{instalada=true;evento=null;ayuda('');pintar();});
  modo.addEventListener?.('change',pintar);
  for(const grupo of grupos)grupo.querySelector('button').addEventListener('click',async()=>{
    if(instaladaAhora())return;
    // No retrasar prompt: algunos navegadores requieren una activación del usuario.
    if(evento){
      const e=evento;evento=null;
      try{await e.prompt();const r=await e.userChoice;if(r.outcome==='dismissed')ayuda('Puedes instalarla más tarde desde el menú del navegador.');}
      catch(_){ayuda('En Chrome abre el menú ⋮ y elige Instalar aplicación.');}
      return;
    }
    const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    ayuda(ios?'En Safari toca Compartir y luego Añadir a pantalla de inicio.':'Abre este enlace en Chrome, toca ⋮ y elige Instalar aplicación o Añadir a pantalla de inicio.');
  });
  pintar();
  if('serviceWorker' in navigator&&window.isSecureContext){
    navigator.serviceWorker.register('./clientes-sw.js',{scope:'./',updateViaCache:'none'}).catch(e=>console.warn('No se pudo registrar la instalación de clientes:',e));
  }
})();
