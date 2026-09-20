(function(){
  if(window.__TAURI_INTERNALS__)return;
  if(!('serviceWorker'in navigator))return;
  window.addEventListener('load',async function(){
    try{
      const reg=await navigator.serviceWorker.register('./service-worker.js?v=2.0.2');
      reg.update().catch(()=>{});
    }catch(err){
      console.warn('PWA service worker registration failed',err);
    }
  });
})();