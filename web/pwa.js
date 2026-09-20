(function(){
  if(window.__TAURI_INTERNALS__)return;
  if(!('serviceWorker'in navigator))return;

  window.addEventListener('load',async function(){
    try{
      // Download updates quietly. Do not reload the page when a new worker is found.
      // The updated worker takes over naturally after the current app tab/session closes,
      // so the next visit opens the new bundle without a surprise refresh.
      const reg=await navigator.serviceWorker.register('./service-worker.js?v=20260920-9',{updateViaCache:'none'});
      await reg.update();
    }catch(err){
      console.warn('PWA service worker registration failed',err);
    }
  });
})();