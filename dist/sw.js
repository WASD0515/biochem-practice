const PREFIX='biochem:'+self.registration.scope+':',CACHE=PREFIX+'1.6.0';
const FILES=['./','index.html','styles.css','app.js','update.js','platform.js','engine.js','catalog.js','bank.js','question-bank.json','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png','import-word.js','vendor/fflate.js'];
const STATIC=new Set(FILES.map(f=>new URL(f,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);url.hash='';url.search='';
 if(!STATIC.has(url.href))return;
 // Cache a complete version before activation to keep scripts consistent offline.
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.href))||fetch(event.request)));
});
