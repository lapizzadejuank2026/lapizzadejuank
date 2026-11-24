// PWA de clientes: no comparte el identificador de instalación ni el icono de Rider.
(()=>{
  const grupos=[...document.querySelectorAll('.instalar-clientes')];
  const modo=window.matchMedia('(display-mode: standalone)');
  let evento=null,instalada=false,logoActual='',generacion=0,preparando=Promise.resolve(false);
  const cacheNombre='pulso-clientes-icono-v1';
  const instaladaAhora=()=>instalada||modo.matches||navigator.standalone===true;
  function pintar(){for(const g of grupos)g.hidden=instaladaAhora();}
  function ayuda(texto){for(const g of grupos){const p=g.querySelector('.instalar-clientes-ayuda');p.textContent=texto;p.hidden=!texto;}}
  function imagen(src){return new Promise((resolve,reject)=>{
    const i=new Image();if(/^https:/i.test(src)&&new URL(src).origin!==location.origin)i.crossOrigin='anonymous';
    i.onload=()=>resolve(i);i.onerror=reject;i.src=src;
  });}
  function png(img,n){return new Promise((resolve,reject)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=n;
    const ctx=canvas.getContext('2d');if(!ctx){reject(Error('Canvas'));return;}
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,n,n);
    const escala=n*.90/Math.max(img.naturalWidth,img.naturalHeight);
    const w=img.naturalWidth*escala,h=img.naturalHeight*escala;
    ctx.drawImage(img,(n-w)/2,(n-h)/2,w,h);
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG')),'image/png');
  });}
  window.prepararIconoClientes=(src)=>{
    if(!src||src===logoActual)return;
    logoActual=src;const token=++generacion;
    preparando=(async()=>{
      if(!('caches' in window))return false;
      const cache=await caches.open(cacheNombre);
      if(src==='chef.png'){
        if(token===generacion){await cache.delete(new URL('./clientes-icon-192.png',location.href));await cache.delete(new URL('./clientes-icon-512.png',location.href));}
        return false;
      }
      const img=await imagen(src);
      const blobs=await Promise.all([192,512].map(n=>png(img,n)));
      if(token!==generacion)return false;
      await Promise.all([192,512].map((n,i)=>cache.put(new URL('./clientes-icon-'+n+'.png',location.href),new Response(blobs[i],{headers:{'Content-Type':'image/png'}}))));
      return true;
    })().catch(()=>false);
  };
  // Recuperar la marca si Firebase llegó a cargar antes de este script.
  const marca=document.getElementById('logo-bienvenida')||document.getElementById('marca-logo');
  if(marca&&marca.getAttribute('src')!=='chef.png')window.prepararIconoClientes(marca.getAttribute('src'));
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
