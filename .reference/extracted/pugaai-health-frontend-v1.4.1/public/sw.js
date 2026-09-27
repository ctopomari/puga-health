const VERSION='pugaai-health-v1.2.3';
const SHELL_CACHE=`${VERSION}-shell`;
const SHELL=['/','/index.html','/manifest.webmanifest','/offline.html','/puga-trinicare-official.png','/puga-trinicare-compact.png','/puga-trinicare-transparent.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL_CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==SHELL_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{const copy=res.clone(); caches.open(SHELL_CACHE).then(c=>c.put('/index.html',copy)); return res}).catch(()=>caches.match('/index.html').then(r=>r||caches.match('/offline.html'))));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok){const copy=res.clone(); caches.open(SHELL_CACHE).then(c=>c.put(req,copy));} return res}).catch(()=>caches.match('/offline.html'))));
});

