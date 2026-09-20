(function(){
  if(window.__TAURI_INTERNALS__)return;
  if(!('serviceWorker'in navigator))return;

  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(reloading)return;
    reloading=true;
    // A newly activated worker means a newer app shell exists.
    // Reload once so HTML/CSS/JS all come from the same build.
    location.reload();
  });

  window.addEventListener('load',async function(){
    try{
      const reg=await navigator.serviceWorker.register('./service-worker.js?v=20260920-6',{updateViaCache:'none'});
      await reg.update();
    }catch(err){
      console.warn('PWA service worker registration failed',err);
    }
  });
})();