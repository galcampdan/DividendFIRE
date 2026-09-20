const CACHE='dividend-fire-pwa-v2026-09-20-8';
const REFRESH_TOKEN='20260920-8';
const SHELL=['./','./index.html','./style.css','./simulation-core.js','./web-api.js','./app.js','./manifest.webmanifest','./app-icon.svg','./data/market.json'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();

    // Older releases used cache-first HTML/JS. Existing installed PWAs can therefore
    // stay pinned to a broken bundle even after deployment. On activation of this
    // worker, force each open same-origin window through the fresh network-first path.
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(clients.map(async client=>{
      try{
        const url=new URL(client.url);
        if(url.origin!==self.location.origin)return;
        if(url.searchParams.get('__df_refresh')===REFRESH_TOKEN)return;
        url.searchParams.set('__df_refresh',REFRESH_TOKEN);
        await client.navigate(url.toString());
      }catch(_){}
    }));
  })());
});

async function cachedFallback(request,cache){
  let hit=await cache.match(request);
  if(!hit) hit=await caches.match(request);
  if(hit) return hit;

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
    const fresh=await fetch(request,{cache:'no-store'});
    if(fresh&&fresh.ok) cache.put(request,fresh.clone());
    return fresh;
  }catch(_){
    return cachedFallback(request,cache);
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(networkFirst(event.request));
});
