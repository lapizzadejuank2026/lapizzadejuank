// La PWA de clientes controla únicamente las navegaciones públicas y los iconos.
// No almacenar ni interceptar pedidos, cobros, Firebase, ni páginas de administración.
const base=new URL('./',self.location.href);
const publicas=new Set([base.pathname,new URL('index.html',base).pathname,new URL('index-1.html',base).pathname]);
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.delete('pulso-clientes-icono-v1'),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==base.origin)return;
  if(req.mode!=='navigate'||!publicas.has(url.pathname))return;
  e.respondWith(fetch(req,{cache:'no-store'}).catch(()=>new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>La Pizza de Juan K</title><body style="background:#111;color:white;font:18px Arial;padding:24px"><h1>La Pizza de Juan K</h1><p>Necesitas Internet para consultar el menú y realizar tu pedido.</p><button onclick="location.reload()" style="padding:14px">Reintentar</button></body></html>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
  )));
});
