const CACHE='dividend-fire-pwa-v2026-09-20-3';
const SHELL=['./','./index.html','./style.css','./simulation-core.js','./web-api.js','./app.js','./manifest.webmanifest','./app-icon.svg','./data/market.json'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function cachedFallback(request,cache){
  let hit=await cache.match(request);
  if(!hit) hit=await caches.match(request);
  if(hit) return hit;

  // HTML references versioned assets and market requests use cache-busting queries.
  // The install cache stores their canonical URL without the query string, so
  // normalize before declaring the app unavailable offline.
  const url=new URL(request.url);
  if(url.search){
    url.search='';
    hit=await cache.match(url.toString());
    if(!hit) hit=await caches.match(url.toString());
    if(hit) return hit;
  }
  return Response.error();
}

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const fresh=await fetch(request);
    if(fresh&&fresh.ok) cache.put(request,fresh.clone());
    return fresh;
  }catch(_){
    return cachedFallback(request,cache);
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  event.respondWith(networkFirst(event.request));
});
