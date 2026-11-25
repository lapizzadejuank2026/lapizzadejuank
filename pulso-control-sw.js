// Alcance exclusivo de recepción; no reemplaza los service workers de clientes ni Rider.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url),ruta=new URL('./panel-pedidos.html',self.location.href);
  if(req.method!=='GET'||req.mode!=='navigate'||url.origin!==ruta.origin||url.pathname!==ruta.pathname)return;
  // No guardar pedidos, información de clientes, sesiones, caja ni respuestas de Firebase.
  event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulso Food</title><body style="background:#07172e;color:white;font:18px Arial;padding:25px"><h1>Pulso Food</h1><p>No hay conexión a Internet. Conéctate para trabajar en el centro de control.</p><p>No se ha registrado ninguna operación.</p><button onclick="location.reload()" style="padding:14px">Reintentar</button></body></html>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
  )));
});
