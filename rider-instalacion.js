// Instalación independiente del inicio de sesión y de Firebase.
(()=>{
  const grupos=[...document.querySelectorAll('.instalar-rider')];
  let evento=null,instalada=false;
  const modo=window.matchMedia('(display-mode: standalone)');
  const esInstalada=()=>instalada||modo.matches||window.navigator.standalone===true;
  function pintar(){
    for(const grupo of grupos)grupo.hidden=esInstalada();
  }
  function ayuda(texto){
    for(const grupo of grupos){const p=grupo.querySelector('.instalar-rider-ayuda');p.textContent=texto;p.hidden=!texto;}
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();evento=e;pintar();});
  window.addEventListener('appinstalled',()=>{instalada=true;evento=null;ayuda('');pintar();});
  if(modo.addEventListener)modo.addEventListener('change',pintar);
  for(const grupo of grupos)grupo.querySelector('button').addEventListener('click',async()=>{
    if(esInstalada())return;
    if(evento){
      const actual=evento;evento=null;
      try{await actual.prompt();const r=await actual.userChoice;if(r.outcome==='dismissed')ayuda('Puedes instalarla después desde este botón o el menú del navegador.');}
      catch(error){ayuda('Abre Chrome y usa su menú ⋮ para instalar la aplicación.');}
    }else{
      const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
      ayuda(ios?'En Safari toca Compartir y luego Añadir a pantalla de inicio.':'Abre este enlace en Chrome. Toca ⋮ y elige Instalar aplicación o Añadir a pantalla de inicio.');
    }
  });
  pintar();
  if('serviceWorker' in navigator && window.isSecureContext){
    navigator.serviceWorker.register('./rider-sw.js',{scope:'./domiciliarios.html',updateViaCache:'none'}).catch(error=>console.warn('No se registró el service worker de Rider:',error));
  }
})();
